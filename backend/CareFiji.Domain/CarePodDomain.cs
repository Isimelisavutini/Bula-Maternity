using System.Reflection;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace CareFiji.Domain;

public static class CarePodDomain
{
    public static readonly string[] Actions = ["setMidwifeStatus", "assignCarePod", "submitCareQuestion", "followupCareQuestion", "raiseCareAlert", "replyCareQuestion", "closeCareQuestion", "bookCareAppointment", "acknowledgeCareAlert"];
    private static readonly string[] StaffRoles = ["Administrator", "Doctor", "Midwife"];
    private static readonly Dictionary<string, int> Targets = new() { ["Baby Kicks"] = 45, ["Pain/Cramps"] = 240, ["Food/Herbs"] = 360, ["Discharge"] = 240, ["Vitamins"] = 360, ["Emotional Support"] = 120, ["General"] = 360 };
    private static readonly string[] Flags = ["Bleeding or leaking fluid", "Reduced or stopped movements", "Severe headache or vision changes", "Severe or constant abdominal pain", "I feel unsafe or may harm myself"];
    private static string Text(JsonNode? node, string key) => DemoDomain.Text(node, key);
    private static void Invalid() => throw new DomainException("VALIDATION_FAILED");
    private static void Staff(DemoUser user) { if (!StaffRoles.Contains(user.Role)) throw new DomainException("PERMISSION_DENIED:care.staff"); }

    public static JsonObject State(JsonObject data)
    {
        if (data["carePod"] is JsonObject existing) return existing.DeepClone().AsObject();
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("CareFiji.care-pod.json")!;
        return JsonNode.Parse(stream)!.AsObject();
    }
    public static JsonObject? View(JsonObject data, string role)
    {
        if (!StaffRoles.Contains(role) && role != "Patient") return null;
        var care = State(data);
        if (role == "Patient")
            foreach (var key in new[] { "assignments", "threads", "alerts" })
                care[key] = new JsonArray(care[key]!.AsArray().Where(x => Text(x, "patientId") == "CF1001").Select(x => x!.DeepClone()).ToArray());
        return care;
    }
    private static string? Cover(JsonObject care, string patientId)
    {
        var assignment = care["assignments"]!.AsArray().FirstOrDefault(a => Text(a, "patientId") == patientId);
        if (assignment is null) return null;
        var pod = care["pods"]!.AsArray().FirstOrDefault(p => Text(p, "id") == Text(assignment, "podId"));
        if (pod is null) return null;
        var ids = new[] { Text(assignment, "primaryId") }.Concat(pod["midwifeIds"]!.AsArray().Select(x => x!.GetValue<string>())).Distinct();
        return ids.FirstOrDefault(id => care["midwives"]!.AsArray().Any(m => Text(m, "id") == id && Text(m, "status") == "On Duty"));
    }
    private static string MessageText(JsonObject payload)
    {
        var value = Text(payload, "text").Trim();
        return value.Length <= 2000 ? value : "";
    }
    private static string? Audio(JsonObject payload)
    {
        if (payload["audio"] is not null && (payload["audio"] is not JsonValue raw || !raw.TryGetValue<string>(out _))) Invalid();
        var value = Text(payload, "audio"); if (value == "") return null;
        if (value.Length > 350000 || !Regex.IsMatch(value, @"^data:audio/(webm|mp4|ogg)(;codecs=[\w.-]+)?;base64,[A-Za-z0-9+/]+=*$")) Invalid();
        return value;
    }
    private static JsonObject Message(DemoUser user, string text, string? audio, DateTimeOffset now) => new()
    {
        ["id"] = Guid.NewGuid().ToString(), ["senderId"] = user.Id, ["senderName"] = user.Name,
        ["senderRole"] = user.Role, ["text"] = text, ["audio"] = audio, ["at"] = now.ToString("O")
    };

    public static string Apply(JsonObject data, DemoUser user, string action, JsonObject payload, DateTimeOffset now)
    {
        var care = State(data); data["carePod"] = care; string target;
        switch (action)
        {
            case "setMidwifeStatus":
                Staff(user);
                var id = user.Role == "Administrator" ? Text(payload, "midwifeId") : user.Id;
                var midwife = care["midwives"]!.AsArray().FirstOrDefault(m => Text(m, "id") == id);
                if (midwife is null || !new[] { "On Duty", "In Clinic", "In Delivery", "Off Duty" }.Contains(Text(payload, "status"))) { Invalid(); return ""; }
                midwife["status"] = Text(payload, "status"); target = id; break;
            case "assignCarePod":
                if (user.Role is not ("Administrator" or "Midwife")) throw new DomainException("PERMISSION_DENIED:care.assign");
                var patientId = Text(payload, "patientId");
                var pod = care["pods"]!.AsArray().FirstOrDefault(p => Text(p, "id") == Text(payload, "podId"));
                if (!data["patients"]!.AsArray().Any(p => Text(p, "id") == patientId) || pod is null || !pod["midwifeIds"]!.AsArray().Any(x => x!.GetValue<string>() == Text(payload, "primaryId"))) { Invalid(); return ""; }
                var assignments = care["assignments"]!.AsArray();
                foreach (var assignment in assignments.Where(a => Text(a, "patientId") == patientId).ToArray()) assignments.Remove(assignment);
                assignments.Add(new JsonObject { ["patientId"] = patientId, ["podId"] = Text(pod, "id"), ["primaryId"] = Text(payload, "primaryId") }); target = patientId; break;
            case "submitCareQuestion":
            case "raiseCareAlert":
                if (user.Role != "Patient") throw new DomainException("PERMISSION_DENIED:care.patient");
                var patient = data["patients"]!.AsArray().First(p => Text(p, "id") == "CF1001")!;
                var pairing = care["assignments"]!.AsArray().FirstOrDefault(a => Text(a, "patientId") == "CF1001");
                if (pairing is null) { Invalid(); return ""; }
                target = Guid.NewGuid().ToString();
                if (action == "raiseCareAlert")
                {
                    if (payload["flags"] is not JsonArray flags || flags.Count == 0 || flags.Any(f => f is not JsonValue v || !v.TryGetValue<string>(out var flag) || !Flags.Contains(flag))) { Invalid(); return ""; }
                    care["alerts"]!.AsArray().Add(new JsonObject { ["id"] = target, ["patientId"] = "CF1001", ["podId"] = Text(pairing, "podId"), ["flags"] = flags.DeepClone(), ["createdAt"] = now.ToString("O"), ["acknowledgedAt"] = null, ["acknowledgedBy"] = null });
                }
                else
                {
                    var body = MessageText(payload); var voice = Audio(payload); var category = Text(payload, "category");
                    if (payload["safetyChecked"] is not JsonValue v || !v.TryGetValue<bool>(out var checkedSafety) || !checkedSafety || !Targets.ContainsKey(category) || (body == "" && voice is null) || care["threads"]!.AsArray().Count >= 100) { Invalid(); return ""; }
                    care["threads"]!.AsArray().Add(new JsonObject
                    {
                        ["id"] = target, ["patientId"] = "CF1001", ["patientName"] = Text(patient, "name"), ["podId"] = Text(pairing, "podId"),
                        ["assignedTo"] = Cover(care, "CF1001"), ["category"] = category,
                        ["priority"] = new[] { "Baby Kicks", "Pain/Cramps", "Emotional Support" }.Contains(category) ? "Attention" : "Routine",
                        ["gestationWeek"] = patient["weeks"]!.DeepClone(), ["status"] = "Open", ["createdAt"] = now.ToString("O"),
                        ["dueAt"] = now.AddMinutes(Targets[category]).ToString("O"), ["messages"] = new JsonArray(Message(user, body, voice, now))
                    });
                }
                break;
            case "followupCareQuestion":
                if (user.Role != "Patient") throw new DomainException("PERMISSION_DENIED:care.patient");
                var ownThread = care["threads"]!.AsArray().FirstOrDefault(t => Text(t, "id") == Text(payload, "threadId") && Text(t, "patientId") == "CF1001");
                if (ownThread is null) throw new DomainException("NOT_FOUND");
                var followupText = MessageText(payload); var followupAudio = Audio(payload);
                if (payload["safetyChecked"] is not JsonValue check || !check.TryGetValue<bool>(out var safe) || !safe || (followupText == "" && followupAudio is null) || Text(ownThread, "status") == "Closed" || ownThread["messages"]!.AsArray().Count >= 50) Invalid();
                ownThread["messages"]!.AsArray().Add(Message(user, followupText, followupAudio, now)); ownThread["status"] = "Open";
                ownThread["dueAt"] = now.AddMinutes(Targets[Text(ownThread, "category")]).ToString("O"); target = Text(ownThread, "id"); break;
            case "replyCareQuestion":
            case "closeCareQuestion":
            case "bookCareAppointment":
                Staff(user);
                var thread = care["threads"]!.AsArray().FirstOrDefault(t => Text(t, "id") == Text(payload, "threadId"));
                if (thread is null) throw new DomainException("NOT_FOUND");
                target = Text(thread, "id");
                if (action == "replyCareQuestion")
                {
                    var body = MessageText(payload); var voice = Audio(payload);
                    if ((body == "" && voice is null) || Text(thread, "status") == "Closed" || thread["messages"]!.AsArray().Count >= 50) Invalid();
                    thread["messages"]!.AsArray().Add(Message(user, body, voice, now)); thread["status"] = "Replied"; thread["assignedTo"] = user.Id;
                }
                else if (action == "closeCareQuestion") thread["status"] = "Closed";
                else
                {
                    var date = Text(payload, "date"); if (!Regex.IsMatch(date, @"^\d{4}-\d{2}-\d{2}$")) Invalid();
                    data["appointments"]!.AsArray().Add(new JsonObject { ["id"] = Guid.NewGuid().ToString(), ["name"] = Text(thread, "patientName"), ["date"] = date, ["service"] = "Antenatal", ["status"] = "Pending" });
                    thread["messages"]!.AsArray().Add(Message(user, $"An antenatal appointment was requested for {date}. Please check Appointments for confirmation.", null, now)); thread["status"] = "Replied";
                }
                break;
            case "acknowledgeCareAlert":
                Staff(user); var alert = care["alerts"]!.AsArray().FirstOrDefault(a => Text(a, "id") == Text(payload, "alertId"));
                if (alert is null) throw new DomainException("NOT_FOUND");
                alert["acknowledgedAt"] = now.ToString("O"); alert["acknowledgedBy"] = user.Id; target = Text(alert, "id"); break;
            default: throw new DomainException("UNKNOWN_ACTION");
        }
        foreach (var thread in care["threads"]!.AsArray().Where(t => Text(t, "status") == "Open")) thread!["assignedTo"] = Cover(care, Text(thread, "patientId"));
        if (care["alerts"]!.AsArray().Count > 500 || care.ToJsonString().Length > 1500000) Invalid();
        return target;
    }
}
