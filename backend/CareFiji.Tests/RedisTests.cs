using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using CareFiji.Api;
using CareFiji.Domain;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace CareFiji.Tests;

public sealed class RedisTests
{
    [Fact]
    public async Task LegacyDocumentIsPreservedAndStaleWritesAreRetriedAtomically()
    {
        using var upstream = new RedisHandler(); using var http = new HttpClient(upstream);
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["UPSTASH_REDIS_REST_URL"] = "https://redis.test", ["UPSTASH_REDIS_REST_TOKEN"] = "private-test-token"
        }).Build();
        var store = new RedisDemoStore(http, config);
        Assert.True(await store.Ready(default));
        Assert.False((await store.Read(default)).ContainsKey("_revision"));
        var admin = DemoDomain.Users["admin"].User;
        await Task.WhenAll(Enumerable.Range(0, 4).Select(_ => store.Update(data => DemoDomain.Execute(data, admin, "addPatient", new JsonObject(), DateTimeOffset.UtcNow), default)));
        var final = await store.Read(default);
        Assert.Equal(7, final["patients"]!.AsArray().Count);
        Assert.Equal(4, final["audit"]!.AsArray().Count);
        Assert.Equal(4, final["_revision"]!.GetValue<int>());
        Assert.True(upstream.Conflicts > 0);
    }

    private sealed class RedisHandler : HttpMessageHandler
    {
        private readonly object gate = new();
        private string data = DemoDomain.Seed().ToJsonString();
        public int Conflicts { get; private set; }
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Assert.Equal("private-test-token", request.Headers.Authorization?.Parameter);
            var command = (await request.Content!.ReadFromJsonAsync<JsonArray>(ct))!;
            await Task.Delay(5, ct);
            lock (gate)
            {
                JsonNode? result;
                switch (command[0]!.GetValue<string>())
                {
                    case "PING": result = JsonValue.Create("PONG"); break;
                    case "GET": result = JsonValue.Create(data); break;
                    case "EVAL":
                        Assert.Equal(RedisDemoStore.Key, command[3]!.GetValue<string>());
                        if (command[4]!.GetValue<string>() == data) { data = command[5]!.GetValue<string>(); result = JsonValue.Create(1); }
                        else { Conflicts++; result = JsonValue.Create(0); }
                        break;
                    default: throw new InvalidOperationException("Unexpected Redis command");
                }
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = JsonContent.Create(new JsonObject { ["result"] = result }) };
            }
        }
    }
}
