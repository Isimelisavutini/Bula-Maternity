using System.Globalization;
using System.Text.Json.Nodes;
using CareFiji.Domain;

namespace CareFiji.Api;

public static class MobileEndpoints
{
    private static readonly string[] Entities = ["profiles", "pregnancies", "appointments", "kick_events", "ward_allocations", "consent_records"];

    public static void MapMobile(this WebApplication app)
    {
        app.MapGet("/api/mobile/v1/bootstrap", async (HttpRequest request, SupabaseGateway supabase, TimeProvider clock, CancellationToken ct) =>
        {
            var token = await supabase.Authenticate(request, ct);
            // Read the cursor first: concurrent changes may replay, but cannot be skipped.
            var cursors = await supabase.Send("rest/v1/sync_changes?select=sequence&order=sequence.desc&limit=1", token, ct);
            var cursor = cursors.AsArray().FirstOrDefault()?["sequence"]?.ToString() ?? "0";
            var rows = await Task.WhenAll(Entities.Select(async entity => (entity, data: await supabase.Send($"rest/v1/{entity}?select=*&deleted_at=is.null", token, ct))));
            var data = new JsonObject();
            foreach (var row in rows) data[row.entity] = row.data;
            return Results.Json(new { data, cursor, serverTime = clock.GetUtcNow() });
        });

        app.MapGet("/api/mobile/v1/sync", async (HttpRequest request, SupabaseGateway supabase, TimeProvider clock, CancellationToken ct) =>
        {
            var token = await supabase.Authenticate(request, ct);
            var cursor = request.Query["cursor"].FirstOrDefault() ?? "0";
            if (!long.TryParse(cursor, NumberStyles.None, CultureInfo.InvariantCulture, out var sequence) || sequence < 0) throw new DomainException("VALIDATION_FAILED");
            var changes = (await supabase.Send($"rest/v1/sync_changes?select=sequence,entity_type,entity_id,operation,payload,changed_at&sequence=gt.{sequence}&order=sequence.asc&limit=500", token, ct)).AsArray();
            return Results.Json(new { changes, cursor = changes.LastOrDefault()?["sequence"]?.ToString() ?? cursor, hasMore = changes.Count == 500, serverTime = clock.GetUtcNow() });
        });

        app.MapPost("/api/mobile/v1/commands", async (HttpRequest request, SupabaseGateway supabase, TimeProvider clock, CancellationToken ct) =>
        {
            var token = await supabase.Authenticate(request, ct);
            var body = await request.ReadFromJsonAsync<JsonObject>(ct) ?? throw new DomainException("VALIDATION_FAILED");
            if (!Guid.TryParse(DemoDomain.Text(body, "id"), out _) || string.IsNullOrWhiteSpace(DemoDomain.Text(body, "type")) ||
                !DateTimeOffset.TryParse(DemoDomain.Text(body, "deviceTimestamp"), CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out _) ||
                DemoDomain.Text(body, "timezone").Length is 0 or > 100 ||
                (body["payload"] is not null and not JsonObject) ||
                (body["baseRevision"] is not null && (body["baseRevision"] is not JsonValue value || !value.TryGetValue<long>(out _))))
                throw new DomainException("VALIDATION_FAILED");
            var result = await supabase.Send("rest/v1/rpc/process_mobile_command", token, ct, new JsonObject
            {
                ["p_command_id"] = body["id"]!.DeepClone(), ["p_command_type"] = body["type"]!.DeepClone(),
                ["p_payload"] = body["payload"]?.DeepClone() ?? new JsonObject(),
                ["p_device_timestamp"] = body["deviceTimestamp"]!.DeepClone(), ["p_timezone"] = body["timezone"]!.DeepClone(),
                ["p_base_revision"] = body["baseRevision"]?.DeepClone()
            });
            if (result["accepted"]?.GetValue<bool>() == false) throw new DomainException(DemoDomain.Text(result, "error") is { Length: > 0 } code ? code : "VALIDATION_FAILED");
            return Results.Json(new { result, serverTime = clock.GetUtcNow() });
        });
    }
}
