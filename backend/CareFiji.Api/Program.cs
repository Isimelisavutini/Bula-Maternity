using System.Text.Json;
using System.Text.Json.Nodes;
using CareFiji.Api;
using CareFiji.Domain;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<DemoSession>();
builder.Services.AddHttpClient<SupabaseGateway>(http => http.Timeout = TimeSpan.FromSeconds(15));
builder.Services.AddHttpClient<RedisDemoStore>(http => http.Timeout = TimeSpan.FromSeconds(15));
builder.Services.AddSingleton<IDemoStore>(services =>
    builder.Environment.IsDevelopment() && string.IsNullOrEmpty(builder.Configuration["UPSTASH_REDIS_REST_URL"])
        ? new MemoryDemoStore() : services.GetRequiredService<RedisDemoStore>());
builder.Services.AddApplicationInsightsTelemetry(options =>
{
    // Never collect request URLs, bodies, auth headers, or upstream database queries.
    options.EnableRequestTrackingTelemetryModule = false;
    options.EnableDependencyTrackingTelemetryModule = false;
});
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 64 * 1024);
var app = builder.Build();

app.Use(async (context, next) =>
{
    context.Response.Headers.CacheControl = "no-store";
    try { await next(context); }
    catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested) { }
    catch (Exception error)
    {
        var mobile = context.Request.Path.StartsWithSegments("/api/mobile/v1");
        var code = error switch
        {
            DomainException => error.Message,
            JsonException or BadHttpRequestException => "VALIDATION_FAILED",
            _ => "TEMPORARY_UNAVAILABLE"
        };
        var status = code switch
        {
            "AUTH_REQUIRED" or "AUTH_EXPIRED" or "SIGN_IN_REQUIRED" or "INVALID_CREDENTIALS" => 401,
            var c when c.StartsWith("PERMISSION_DENIED", StringComparison.Ordinal) => 403,
            "NOT_FOUND" => 404,
            "STALE_REVISION" => 409,
            "VALIDATION_FAILED" or "INVALID_TRANSITION" or "DRAFT_REQUIRED" or "UNKNOWN_ACTION" => 400,
            _ => 503
        };
        context.Response.StatusCode = status;
        if (mobile)
        {
            var message = code switch
            {
                "AUTH_REQUIRED" or "AUTH_EXPIRED" => "Sign in again to continue.",
                "SUPABASE_NOT_CONFIGURED" => "Production data service is not configured.",
                "STALE_REVISION" => "This record changed on another device.",
                "PERMISSION_DENIED" => "This account cannot access that record.",
                "VALIDATION_FAILED" => "The submitted information is invalid.",
                _ => "The service is temporarily unavailable."
            };
            await context.Response.WriteAsJsonAsync(new { error = new { code, message, retryable = status == 503 } });
        }
        else await context.Response.WriteAsJsonAsync(new { error = code });
    }
});

DemoUser Required(HttpRequest request, DemoSession sessions) => sessions.Read(request.Cookies[DemoSession.CookieName]) ?? throw new DomainException("SIGN_IN_REQUIRED");

app.MapGet("/health/live", () => Results.Json(new { status = "live" }));
app.MapGet("/health/ready", async (IDemoStore store, SupabaseGateway supabase, IConfiguration config, IHostEnvironment env, CancellationToken ct) =>
{
    try
    {
        var ready = (env.IsDevelopment() || !string.IsNullOrWhiteSpace(config["SESSION_SECRET"])) && await store.Ready(ct) && await supabase.Ready(ct);
        return Results.Json(new { status = ready ? "ready" : "not_ready" }, statusCode: ready ? 200 : 503);
    }
    catch { return Results.Json(new { status = "not_ready" }, statusCode: 503); }
});
app.MapGet("/api/session", (HttpRequest request, DemoSession sessions) => Results.Json(new { user = sessions.Details(request.Cookies[DemoSession.CookieName]) }));
app.MapPost("/api/login", async (HttpContext context, DemoSession sessions, CancellationToken ct) =>
{
    var body = await context.Request.ReadFromJsonAsync<JsonObject>(ct) ?? throw new DomainException("VALIDATION_FAILED");
    if (!DemoDomain.Users.TryGetValue(DemoDomain.Text(body, "username").ToLowerInvariant(), out var identity) || DemoDomain.Text(body, "password") != identity.Password)
        throw new DomainException("INVALID_CREDENTIALS");
    context.Response.Cookies.Append(DemoSession.CookieName, sessions.Create(identity.User), sessions.Options);
    return Results.Json(new { user = identity.User });
});
app.MapPost("/api/logout", (HttpContext context, DemoSession sessions) =>
{
    context.Response.Cookies.Delete(DemoSession.CookieName, sessions.Options);
    return Results.Json(new { ok = true });
});
app.MapGet("/api/data", async (HttpRequest request, DemoSession sessions, IDemoStore store, CancellationToken ct) =>
{
    var user = Required(request, sessions); DemoDomain.Require(user, "read");
    return Results.Json(new { data = DemoDomain.View(await store.Read(ct), user.Role) });
});
app.MapGet("/api/audit", async (HttpRequest request, DemoSession sessions, IDemoStore store, CancellationToken ct) =>
{
    var user = Required(request, sessions); DemoDomain.Require(user, "audit.read");
    var data = await store.Read(ct);
    return Results.Json(new { audit = data["audit"]!.AsArray().TakeLast(100).Reverse().Select(x => x!.DeepClone()).ToArray() });
});
app.MapPost("/api/action", async (HttpRequest request, DemoSession sessions, IDemoStore store, TimeProvider clock, CancellationToken ct) =>
{
    var user = Required(request, sessions);
    var body = await request.ReadFromJsonAsync<JsonObject>(ct) ?? throw new DomainException("VALIDATION_FAILED");
    if (body["payload"] is not null and not JsonObject) throw new DomainException("VALIDATION_FAILED");
    var action = DemoDomain.Text(body, "action"); var payload = body["payload"]?.AsObject() ?? new JsonObject();
    var result = await store.Update(data => DemoDomain.Execute(data, user, action, payload, clock.GetUtcNow()), ct);
    if (result.Error is not null) throw new DomainException(result.Error);
    return Results.Json(new { data = DemoDomain.View(result.Data, user.Role) });
});
app.MapMobile();
app.MapMethods("/api/{**path}", ["GET", "POST", "PUT", "PATCH", "DELETE"], (HttpContext context) =>
    context.Request.Path.StartsWithSegments("/api/mobile/v1")
        ? Results.Json(new { error = new { code = "NOT_FOUND", message = "Unknown mobile operation.", retryable = false } }, statusCode: 404)
        : Results.Json(new { error = "NOT_FOUND" }, statusCode: 404));
app.Run();

public partial class Program;
