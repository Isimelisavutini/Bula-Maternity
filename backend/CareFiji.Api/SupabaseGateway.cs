using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using CareFiji.Domain;

namespace CareFiji.Api;

public sealed class SupabaseGateway(HttpClient http, IConfiguration config)
{
    private (Uri Url, string Key) Configuration()
    {
        var url = config["SUPABASE_URL"] ?? config["NEXT_PUBLIC_SUPABASE_URL"];
        var key = config["SUPABASE_ANON_KEY"] ?? config["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
        if (!Uri.TryCreate(url, UriKind.Absolute, out var endpoint) || endpoint.Scheme != "https" || string.IsNullOrWhiteSpace(key))
            throw new DomainException("SUPABASE_NOT_CONFIGURED");
        return (new Uri(endpoint.AbsoluteUri.TrimEnd('/') + "/"), key);
    }

    public async Task<JsonNode> Send(string path, string? token, CancellationToken ct, JsonObject? payload = null)
    {
        var (url, key) = Configuration();
        using var request = new HttpRequestMessage(payload is null ? HttpMethod.Get : HttpMethod.Post, new Uri(url, path));
        request.Headers.Add("apikey", key);
        if (token is not null) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (payload is not null) request.Content = JsonContent.Create(payload);
        using var response = await http.SendAsync(request, ct);
        JsonNode? body;
        try { body = await response.Content.ReadFromJsonAsync<JsonNode>(ct); }
        catch (JsonException) { throw new DomainException("TEMPORARY_UNAVAILABLE"); }
        if (response.IsSuccessStatusCode) return body ?? new JsonObject();
        if (response.StatusCode == HttpStatusCode.Unauthorized) throw new DomainException("AUTH_EXPIRED");
        if (response.StatusCode == HttpStatusCode.Forbidden) throw new DomainException("PERMISSION_DENIED");
        var message = body is JsonObject obj ? DemoDomain.Text(obj, "message") : "";
        foreach (var code in new[] { "STALE_REVISION", "PERMISSION_DENIED", "VALIDATION_FAILED" })
            if (message.Contains(code, StringComparison.Ordinal)) throw new DomainException(code);
        if (message.Contains("row-level security", StringComparison.OrdinalIgnoreCase)) throw new DomainException("PERMISSION_DENIED");
        throw new DomainException("TEMPORARY_UNAVAILABLE");
    }

    public async Task<string> Authenticate(HttpRequest request, CancellationToken ct)
    {
        if (!AuthenticationHeaderValue.TryParse(request.Headers.Authorization, out var auth) || !auth.Scheme.Equals("Bearer", StringComparison.OrdinalIgnoreCase) || string.IsNullOrEmpty(auth.Parameter))
            throw new DomainException("AUTH_REQUIRED");
        var user = await Send("auth/v1/user", auth.Parameter, ct);
        if (user is not JsonObject || string.IsNullOrEmpty(DemoDomain.Text(user, "id"))) throw new DomainException("AUTH_EXPIRED");
        return auth.Parameter;
    }

    public async Task<bool> Ready(CancellationToken ct)
    {
        await Send("auth/v1/settings", null, ct);
        return true;
    }
}
