using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace CareFiji.Domain;

public sealed record DemoUser(string Id, string Name, string Role);
public sealed record DemoIdentity(DemoUser User, string Password);
public sealed class DomainException(string code) : Exception(code);
public sealed record Mutation(JsonObject Data, string? Error);

public static class DemoDomain
{
    public static readonly IReadOnlyDictionary<string, DemoIdentity> Users = new Dictionary<string, DemoIdentity>
    {
        ["admin"] = new(new("demo-admin", "Demo Administrator", "Administrator"), "bula-admin"),
        ["doctor"] = new(new("demo-doctor", "Dr A. Kumar", "Doctor"), "bula-doctor"),
        ["midwife"] = new(new("demo-midwife", "Nurse M. Ratu", "Midwife"), "bula-midwife"),
        ["reception"] = new(new("demo-reception", "Demo Receptionist", "Receptionist"), "bula-reception"),
        ["finance"] = new(new("demo-finance", "Demo Finance", "Finance"), "bula-finance"),
        ["patient"] = new(new("demo-patient", "Mereani Sovaki", "Patient"), "bula-patient")
    };

    private static readonly Dictionary<string, string[]> Permissions = new()
    {
        ["Administrator"] = ["read", "patient.add", "appointment.add", "appointment.update", "note.draft", "note.review", "room.update", "invoice.update", "audit.read"],
        ["Doctor"] = ["read", "appointment.add", "appointment.update", "note.draft", "note.review"],
        ["Midwife"] = ["read", "appointment.add", "note.draft", "room.update"],
        ["Receptionist"] = ["read", "patient.add", "appointment.add", "appointment.update", "room.update"],
        ["Finance"] = ["read", "invoice.update"],
        ["Patient"] = ["read", "appointment.add"]
    };

    public static JsonObject Seed() => JsonNode.Parse("""
    {
      "patients": [
        {"id":"CF1001","name":"Mereani Sovaki","weeks":26,"status":"Antenatal"},
        {"id":"CF1002","name":"Ana Prasad","weeks":38,"status":"Admitted"},
        {"id":"CF1003","name":"Litia Naivalu","weeks":24,"status":"Antenatal"}
      ],
      "appointments":[{"id":"A1","name":"Mereani Sovaki","date":"2026-10-23","service":"Antenatal","status":"Confirmed"}],
      "rooms":[{"id":"M201","patient":""},{"id":"M202","patient":"Ana Prasad"},{"id":"M203","patient":""}],
      "invoices":[{"id":"INV01","name":"Ana Prasad","amount":5500,"status":"Unpaid"}],
      "notes":{},"audit":[]
    }
    """)!.AsObject();

    public static string Text(JsonNode? node, string key) => node?[key] is JsonValue value && value.TryGetValue<string>(out var result) ? result : "";

    public static void Require(DemoUser user, string permission)
    {
        if (!Permissions.TryGetValue(user.Role, out var allowed) || !allowed.Contains(permission))
            throw new DomainException($"PERMISSION_DENIED:{permission}");
    }

    public static JsonObject View(JsonObject data, string role)
    {
        var view = data.DeepClone().AsObject();
        view.Remove("audit");
        view.Remove("_revision");
        if (role == "Patient")
        {
            view["patients"] = new JsonArray(view["patients"]!.AsArray().Where(p => Text(p, "id") == "CF1001").Select(p => p!.DeepClone()).ToArray());
            view["appointments"] = new JsonArray(view["appointments"]!.AsArray().Where(p => Text(p, "name") == "Mereani Sovaki").Select(p => p!.DeepClone()).ToArray());
            view["rooms"] = new JsonArray(); view["invoices"] = new JsonArray(); view["notes"] = new JsonObject();
        }
        if (role == "Finance")
        {
            view["patients"] = new JsonArray(); view["appointments"] = new JsonArray();
            view["rooms"] = new JsonArray(); view["notes"] = new JsonObject();
        }
        if (role == "Receptionist") view["notes"] = new JsonObject();
        return view;
    }

    public static string Apply(JsonObject data, DemoUser user, string action, JsonObject payload, DateTimeOffset now)
    {
        var permission = action switch
        {
            "addPatient" => "patient.add", "addAppointment" => "appointment.add",
            "updateAppointment" => "appointment.update", "saveNote" => "note.draft",
            "reviewNote" => "note.review", "updateRoom" => "room.update",
            "updateInvoice" => "invoice.update", _ => throw new DomainException("UNKNOWN_ACTION")
        };
        Require(user, permission);
        switch (action)
        {
            case "addPatient":
                var number = data["patients"]!.AsArray().Count + 1001;
                var id = $"CF{number}";
                data["patients"]!.AsArray().Add(new JsonObject { ["id"] = id, ["name"] = $"Demo Patient {number - 1000}", ["weeks"] = 20, ["status"] = "Antenatal" });
                return id;
            case "addAppointment":
                var service = Text(payload, "service"); var date = Text(payload, "date");
                var name = user.Role == "Patient" ? "Mereani Sovaki" : Text(payload, "name").Trim();
                if (!new[] { "Antenatal", "Ultrasound", "Postnatal", "Delivery planning" }.Contains(service) ||
                    !Regex.IsMatch(date, @"^\d{4}-\d{2}-\d{2}$") || name.Length is 0 or > 100)
                    throw new DomainException("VALIDATION_FAILED");
                var appointmentId = Guid.NewGuid().ToString();
                data["appointments"]!.AsArray().Add(new JsonObject { ["id"] = appointmentId, ["name"] = name, ["service"] = service, ["date"] = date, ["status"] = "Pending" });
                return appointmentId;
            case "updateAppointment":
                var appointment = Find(data, "appointments", Text(payload, "id"));
                var status = Text(payload, "status");
                var allowed = Text(appointment, "status") switch { "Pending" => new[] { "Confirmed", "Cancelled" }, "Confirmed" => ["Cancelled"], _ => [] };
                if (!allowed.Contains(status)) throw new DomainException("INVALID_TRANSITION");
                appointment["status"] = status; return Text(appointment, "id");
            case "saveNote":
                var patientId = Text(payload, "patientId"); Find(data, "patients", patientId);
                var text = Text(payload, "text").Trim();
                if (text.Length is 0 or > 2000) throw new DomainException("VALIDATION_FAILED");
                data["notes"]![patientId] = new JsonObject { ["text"] = text, ["status"] = "Draft", ["author"] = user.Id, ["updatedAt"] = now.ToString("O") };
                return patientId;
            case "reviewNote":
                var target = Text(payload, "patientId"); var note = data["notes"]?[target];
                if (note is null || Text(note, "status") != "Draft") throw new DomainException("DRAFT_REQUIRED");
                note["status"] = "Reviewed"; note["reviewer"] = user.Id; note["reviewedAt"] = now.ToString("O"); return target;
            case "updateRoom":
                var room = Find(data, "rooms", Text(payload, "id")); room["patient"] = Text(room, "patient") == "" ? "Demo Patient" : ""; return Text(room, "id");
            case "updateInvoice":
                var invoice = Find(data, "invoices", Text(payload, "id"));
                invoice["status"] = Text(invoice, "status") switch { "Unpaid" => "Partial", "Partial" => "Paid", _ => "Unpaid" }; return Text(invoice, "id");
        }
        throw new DomainException("UNKNOWN_ACTION");
    }

    private static JsonObject Find(JsonObject data, string collection, string id) =>
        data[collection]!.AsArray().FirstOrDefault(p => Text(p, "id") == id)?.AsObject() ?? throw new DomainException("NOT_FOUND");

    public static Mutation Execute(JsonObject original, DemoUser user, string action, JsonObject payload, DateTimeOffset now)
    {
        var data = original.DeepClone().AsObject(); var target = "unknown"; string? error = null;
        try { target = Apply(data, user, action, payload, now); }
        catch (DomainException ex) { data = original.DeepClone().AsObject(); error = ex.Message; }
        var audit = data["audit"]!.AsArray();
        audit.Add(new JsonObject { ["id"] = Guid.NewGuid().ToString(), ["at"] = now.ToString("O"), ["actor"] = user.Id, ["actorName"] = user.Name, ["role"] = user.Role, ["action"] = action, ["target"] = target, ["outcome"] = error is null ? "success" : $"rejected:{error}" });
        while (audit.Count > 1000) audit.RemoveAt(0);
        data["_revision"] = (original["_revision"]?.GetValue<long>() ?? 0) + 1;
        return new(data, error);
    }
}
