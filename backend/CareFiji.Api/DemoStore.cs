using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using CareFiji.Domain;

namespace CareFiji.Api;

public interface IDemoStore
{
    Task<JsonObject> Read(CancellationToken ct);
    Task<Mutation> Update(Func<JsonObject, Mutation> mutate, CancellationToken ct);
    Task<bool> Ready(CancellationToken ct);
}

public sealed class MemoryDemoStore : IDemoStore
{
    private readonly SemaphoreSlim gate = new(1);
    private JsonObject data = DemoDomain.Seed();
    public async Task<JsonObject> Read(CancellationToken ct) { await gate.WaitAsync(ct); try { return data.DeepClone().AsObject(); } finally { gate.Release(); } }
    public async Task<Mutation> Update(Func<JsonObject, Mutation> mutate, CancellationToken ct)
    {
        await gate.WaitAsync(ct);
        try { var result = mutate(data.DeepClone().AsObject()); data = result.Data.DeepClone().AsObject(); return result; }
        finally { gate.Release(); }
    }
    public Task<bool> Ready(CancellationToken ct) => Task.FromResult(true);
}

public sealed class RedisDemoStore(HttpClient http, IConfiguration config) : IDemoStore
{
    public const string Key = "carefiji:bula-maternity:v1";
    // Compare the exact serialized version read, including legacy documents without a revision.
    internal const string CompareAndSet = "if redis.call('GET',KEYS[1]) == ARGV[1] then redis.call('SET',KEYS[1],ARGV[2]); return 1 else return 0 end";

    private async Task<JsonNode?> Command(object[] command, CancellationToken ct)
    {
        var url = config["UPSTASH_REDIS_REST_URL"];
        var token = config["UPSTASH_REDIS_REST_TOKEN"];
        if (!Uri.TryCreate(url, UriKind.Absolute, out var endpoint) || endpoint.Scheme != "https" || string.IsNullOrEmpty(token)) throw new DomainException("DEMO_NOT_CONFIGURED");
        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint) { Content = JsonContent.Create(command) };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        using var response = await http.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode) throw new DomainException("TEMPORARY_UNAVAILABLE");
        JsonObject? body;
        try { body = await response.Content.ReadFromJsonAsync<JsonObject>(ct); }
        catch (JsonException) { throw new DomainException("TEMPORARY_UNAVAILABLE"); }
        if (body is null || body["error"] is not null) throw new DomainException("TEMPORARY_UNAVAILABLE");
        return body["result"]?.DeepClone();
    }

    private async Task<string> ReadRaw(CancellationToken ct)
    {
        var value = (await Command(["GET", Key], ct))?.GetValue<string>();
        if (value is not null) return value;
        await Command(["SET", Key, DemoDomain.Seed().ToJsonString(), "NX"], ct);
        return (await Command(["GET", Key], ct))?.GetValue<string>() ?? throw new DomainException("TEMPORARY_UNAVAILABLE");
    }

    public async Task<JsonObject> Read(CancellationToken ct) => JsonNode.Parse(await ReadRaw(ct))!.AsObject();
    public async Task<Mutation> Update(Func<JsonObject, Mutation> mutate, CancellationToken ct)
    {
        for (var attempt = 0; attempt < 8; attempt++)
        {
            var raw = await ReadRaw(ct); var result = mutate(JsonNode.Parse(raw)!.AsObject());
            if ((await Command(["EVAL", CompareAndSet, 1, Key, raw, result.Data.ToJsonString()], ct))?.GetValue<int>() == 1) return result;
            await Task.Delay(TimeSpan.FromMilliseconds(10 * (attempt + 1)), ct);
        }
        throw new DomainException("TEMPORARY_UNAVAILABLE");
    }
    public async Task<bool> Ready(CancellationToken ct) => (await Command(["PING"], ct))?.GetValue<string>() == "PONG";
}
