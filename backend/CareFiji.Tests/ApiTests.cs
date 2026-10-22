using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using CareFiji.Api;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace CareFiji.Tests;

public sealed class ApiFactory : WebApplicationFactory<Program>
{
    public readonly FakeSupabase Upstream = new();
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["SESSION_SECRET"] = "contract-test-secret", ["SUPABASE_URL"] = "https://test.supabase.co", ["SUPABASE_ANON_KEY"] = "test-public-key",
            ["UPSTASH_REDIS_REST_URL"] = null
        }));
        builder.ConfigureServices(services => services.AddHttpClient<SupabaseGateway>().ConfigurePrimaryHttpMessageHandler(() => Upstream));
    }
}

public sealed class ApiTests
{
    private static async Task Login(HttpClient client, string username = "patient", string password = "bula-patient")
    {
        var response = await client.PostAsJsonAsync("/api/login", new { username, password });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("httponly", string.Join(";", response.Headers.GetValues("Set-Cookie")), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task DemoLoginCookieDataLogoutAndErrorsKeepWireContract()
    {
        using var factory = new ApiFactory(); using var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/data")).StatusCode);
        await Login(client);
        var session = await client.GetFromJsonAsync<JsonObject>("/api/session");
        Assert.Equal("Patient", session!["user"]!["role"]!.GetValue<string>());
        var data = await client.GetFromJsonAsync<JsonObject>("/api/data");
        Assert.Single(data!["data"]!["patients"]!.AsArray()); Assert.Empty(data["data"]!["invoices"]!.AsArray());
        var rejection = await client.PostAsJsonAsync("/api/action", new { action = "addPatient" });
        Assert.Equal(HttpStatusCode.Forbidden, rejection.StatusCode);
        Assert.Equal("PERMISSION_DENIED:patient.add", (await rejection.Content.ReadFromJsonAsync<JsonObject>())!["error"]!.GetValue<string>());
        await client.PostAsJsonAsync("/api/logout", new { });
        Assert.Null((await client.GetFromJsonAsync<JsonObject>("/api/session"))!["user"]);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/login", new { username = "patient", password = "wrong" })).StatusCode);
    }

    [Fact]
    public async Task RejectedAndAcceptedDemoActionsAreAudited()
    {
        using var factory = new ApiFactory(); using var client = factory.CreateClient(); await Login(client, "admin", "bula-admin");
        await client.PostAsJsonAsync("/api/action", new { action = "addPatient" });
        await client.PostAsJsonAsync("/api/action", new { action = "unknown" });
        var audit = (await client.GetFromJsonAsync<JsonObject>("/api/audit"))!["audit"]!.AsArray();
        Assert.Equal(2, audit.Count); Assert.Equal("rejected:UNKNOWN_ACTION", audit[0]!["outcome"]!.GetValue<string>());
    }

    [Fact]
    public async Task DemoCookieCannotAuthenticatePatientApiAndExpiredBearerIsTyped()
    {
        using var factory = new ApiFactory(); using var client = factory.CreateClient(); await Login(client);
        var missing = await client.GetAsync("/api/mobile/v1/bootstrap");
        Assert.Equal(HttpStatusCode.Unauthorized, missing.StatusCode);
        Assert.Equal("AUTH_REQUIRED", (await missing.Content.ReadFromJsonAsync<JsonObject>())!["error"]!["code"]!.GetValue<string>());
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "expired");
        var expired = await client.GetAsync("/api/mobile/v1/sync");
        Assert.Equal("AUTH_EXPIRED", (await expired.Content.ReadFromJsonAsync<JsonObject>())!["error"]!["code"]!.GetValue<string>());
    }

    [Fact]
    public async Task PatientTokenIsForwardedOnEveryDatabaseCallAndBootstrapIsIsolated()
    {
        using var factory = new ApiFactory();
        foreach (var patient in new[] { "patient-a", "patient-b" })
        {
            using var client = factory.CreateClient(); client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", patient);
            var body = await client.GetFromJsonAsync<JsonObject>("/api/mobile/v1/bootstrap");
            Assert.Equal(patient, body!["data"]!["profiles"]![0]!["id"]!.GetValue<string>());
            Assert.Equal("0", body["cursor"]!.GetValue<string>()); Assert.NotNull(body["serverTime"]);
        }
        Assert.All(factory.Upstream.SeenTokens, token => Assert.Contains(token, new[] { "patient-a", "patient-b" }));
    }

    [Theory]
    [InlineData("log_kick")]
    [InlineData("request_appointment")]
    public async Task RetriedOfflineCommandPreservesUuidTimestampAndOriginalResult(string type)
    {
        using var factory = new ApiFactory(); using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "patient-a");
        var id = Guid.NewGuid(); var command = new { id, type, deviceTimestamp = "2026-10-23T08:00:00Z", timezone = "Pacific/Fiji", baseRevision = 3, payload = new { service = "Antenatal", scheduledAt = "2026-11-01T08:00:00Z" } };
        var first = await client.PostAsJsonAsync("/api/mobile/v1/commands", command);
        var second = await client.PostAsJsonAsync("/api/mobile/v1/commands", command);
        Assert.Equal(HttpStatusCode.OK, first.StatusCode); Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        var body = await second.Content.ReadFromJsonAsync<JsonObject>();
        Assert.Equal(id.ToString(), body!["result"]!["entityId"]!.GetValue<string>());
        Assert.True(body["result"]!["duplicate"]!.GetValue<bool>());
        Assert.Single(factory.Upstream.Commands);
        Assert.Equal("2026-10-23T08:00:00Z", factory.Upstream.LastPayload!["p_device_timestamp"]!.GetValue<string>());
        Assert.Equal(3, factory.Upstream.LastPayload["p_base_revision"]!.GetValue<int>());
    }

    [Fact]
    public async Task SyncPreservesDeletionsStringCursorAndPagination()
    {
        using var factory = new ApiFactory(); factory.Upstream.ChangeCount = 500;
        using var client = factory.CreateClient(); client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "patient-a");
        var body = await client.GetFromJsonAsync<JsonObject>("/api/mobile/v1/sync?cursor=10");
        Assert.Equal("510", body!["cursor"]!.GetValue<string>()); Assert.True(body["hasMore"]!.GetValue<bool>());
        Assert.Equal("delete", body["changes"]![0]!["operation"]!.GetValue<string>());
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/mobile/v1/sync?cursor=-1")).StatusCode);
    }

    [Theory]
    [InlineData("STALE_REVISION", HttpStatusCode.Conflict)]
    [InlineData("PERMISSION_DENIED", HttpStatusCode.Forbidden)]
    [InlineData("VALIDATION_FAILED", HttpStatusCode.BadRequest)]
    [InlineData("TEMPORARY_UNAVAILABLE", HttpStatusCode.ServiceUnavailable)]
    public async Task TypedErrorsPreserveConflictAndRetryPolicy(string code, HttpStatusCode status)
    {
        using var factory = new ApiFactory(); factory.Upstream.CommandError = code;
        using var client = factory.CreateClient(); client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "patient-a");
        var response = await client.PostAsJsonAsync("/api/mobile/v1/commands", new { id = Guid.NewGuid(), type = "log_kick", deviceTimestamp = "2026-10-23T08:00:00Z", timezone = "Pacific/Fiji" });
        Assert.Equal(status, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonObject>();
        Assert.Equal(code, body!["error"]!["code"]!.GetValue<string>()); Assert.Equal(status == HttpStatusCode.ServiceUnavailable, body["error"]!["retryable"]!.GetValue<bool>());
    }

    [Fact]
    public async Task HealthAndMalformedJsonFailWithoutLeakingDetails()
    {
        using var factory = new ApiFactory(); using var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health/live")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health/ready")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsync("/api/login", new StringContent("{", System.Text.Encoding.UTF8, "application/json"))).StatusCode);
    }

    [Fact]
    public async Task UpstreamHtmlFailureIsRetryableRatherThanClientValidationError()
    {
        using var factory = new ApiFactory(); factory.Upstream.HtmlFailure = true;
        using var client = factory.CreateClient(); client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "patient-a");
        var response = await client.GetAsync("/api/mobile/v1/bootstrap");
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonObject>();
        Assert.True(body!["error"]!["retryable"]!.GetValue<bool>());
        Assert.DoesNotContain("Internal", body.ToJsonString());
    }
}

public sealed class FakeSupabase : HttpMessageHandler
{
    public ConcurrentBag<string> SeenTokens { get; } = [];
    public ConcurrentDictionary<string, JsonObject> Commands { get; } = new();
    public JsonObject? LastPayload { get; private set; }
    public int ChangeCount { get; set; }
    public string? CommandError { get; set; }
    public bool HtmlFailure { get; set; }
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        if (HtmlFailure) return new HttpResponseMessage(HttpStatusCode.BadGateway) { Content = new StringContent("<html>Internal upstream failure</html>") };
        var path = request.RequestUri!.AbsolutePath; var token = request.Headers.Authorization?.Parameter ?? "";
        if (path == "/auth/v1/settings") return Reply(new JsonObject());
        SeenTokens.Add(token);
        if (token is not ("patient-a" or "patient-b")) return Reply(new JsonObject(), HttpStatusCode.Unauthorized);
        if (path == "/auth/v1/user") return Reply(new JsonObject { ["id"] = token });
        Assert.Equal("test-public-key", request.Headers.GetValues("apikey").Single());
        if (path == "/rest/v1/profiles") return Reply(new JsonArray(new JsonObject { ["id"] = token, ["full_name"] = "Synthetic patient" }));
        if (path == "/rest/v1/sync_changes")
        {
            if (!request.RequestUri.Query.Contains("sequence=gt.")) return Reply(new JsonArray());
            return Reply(new JsonArray(Enumerable.Range(11, ChangeCount).Select(i => (JsonNode)new JsonObject { ["sequence"] = i, ["entity_type"] = "appointments", ["entity_id"] = Guid.NewGuid().ToString(), ["operation"] = "delete", ["payload"] = new JsonObject(), ["changed_at"] = "2026-10-23T08:00:00Z" }).ToArray()));
        }
        if (path == "/rest/v1/rpc/process_mobile_command")
        {
            LastPayload = await request.Content!.ReadFromJsonAsync<JsonObject>(ct);
            if (CommandError is not null) return Reply(new JsonObject { ["accepted"] = false, ["error"] = CommandError });
            var id = LastPayload!["p_command_id"]!.GetValue<string>(); var key = token + id;
            var result = new JsonObject { ["accepted"] = true, ["entityId"] = id };
            if (!Commands.TryAdd(key, result.DeepClone().AsObject())) { result = Commands[key].DeepClone().AsObject(); result["duplicate"] = true; }
            return Reply(result);
        }
        return Reply(new JsonArray());
    }
    private static HttpResponseMessage Reply(JsonNode body, HttpStatusCode status = HttpStatusCode.OK) => new(status) { Content = JsonContent.Create(body) };
}
