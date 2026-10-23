using System.Text.Json.Nodes;
using CareFiji.Domain;
using Xunit;

namespace CareFiji.Tests;

public sealed class CarePodTests
{
    private static readonly DateTimeOffset Now = DateTimeOffset.Parse("2026-10-23T08:00:00Z");
    private static DemoUser Patient => DemoDomain.Users["patient"].User;
    private static DemoUser Mere => DemoDomain.Users["midwife"].User;
    private static JsonObject Question() => new() { ["category"] = "General", ["text"] = "What should I bring?", ["safetyChecked"] = true, ["privacyConsent"] = true, ["privacyVersion"] = CarePodDomain.PrivacyVersion };
    private static Mutation Act(JsonObject data, DemoUser user, string action, JsonObject payload) => DemoDomain.Execute(data, user, action, payload, Now);

    [Fact]
    public void ServerStampsPatientAndGestationAndRoutesToOnDutyPrimary()
    {
        var payload = Question(); payload["patientId"] = "CF1002"; payload["gestationWeek"] = 40;
        var result = Act(DemoDomain.Seed(), Patient, "submitCareQuestion", payload);
        Assert.Null(result.Error); var thread = result.Data["carePod"]!["threads"]![0]!;
        Assert.Equal("CF1001", DemoDomain.Text(thread, "patientId")); Assert.Equal(26, thread["gestationWeek"]!.GetValue<int>());
        Assert.Equal(Mere.Id, DemoDomain.Text(thread, "assignedTo"));
        Assert.Single(result.Data["audit"]!.AsArray());
    }

    [Fact]
    public void DutyChangesRerouteToBuddyOrLeaveExplicitlyUnassigned()
    {
        var data = Act(DemoDomain.Seed(), Patient, "submitCareQuestion", Question()).Data;
        data = Act(data, Mere, "setMidwifeStatus", new JsonObject { ["status"] = "In Delivery" }).Data;
        Assert.Equal("demo-kesa", DemoDomain.Text(data["carePod"]!["threads"]![0], "assignedTo"));
        data = Act(data, DemoDomain.Users["kesa"].User, "setMidwifeStatus", new JsonObject { ["status"] = "Off Duty" }).Data;
        Assert.Null(data["carePod"]!["threads"]![0]!["assignedTo"]);
    }

    [Theory]
    [InlineData("patient")]
    [InlineData("finance")]
    [InlineData("reception")]
    public void NonClinicalRolesCannotReply(string username)
    {
        var data = Act(DemoDomain.Seed(), Patient, "submitCareQuestion", Question()).Data;
        var result = Act(data, DemoDomain.Users[username].User, "replyCareQuestion", new JsonObject { ["threadId"] = data["carePod"]!["threads"]![0]!["id"]!.DeepClone(), ["text"] = "Unauthorized" });
        Assert.Equal("PERMISSION_DENIED:care.staff", result.Error);
        Assert.Contains("rejected", DemoDomain.Text(result.Data["audit"]!.AsArray().Last(), "outcome"));
    }

    [Fact]
    public void PatientCareViewExcludesOtherPatientsAndNonclinicalRolesHaveNoCareView()
    {
        var data = Act(DemoDomain.Seed(), Patient, "submitCareQuestion", Question()).Data;
        data["carePod"]!["threads"]!.AsArray().Add(new JsonObject { ["patientId"] = "CF1002", ["id"] = "other" });
        Assert.Single(DemoDomain.View(data, "Patient")["carePod"]!["threads"]!.AsArray());
        Assert.Null(DemoDomain.View(data, "Finance")["carePod"]); Assert.Null(DemoDomain.View(data, "Receptionist")["carePod"]);
    }

    [Fact]
    public void ReplyFollowupBookingAndClosingPersistInOneConversation()
    {
        var data = Act(DemoDomain.Seed(), Patient, "submitCareQuestion", Question()).Data;
        var id = data["carePod"]!["threads"]![0]!["id"]!.GetValue<string>();
        data = Act(data, Mere, "replyCareQuestion", new JsonObject { ["threadId"] = id, ["text"] = "Bring your antenatal record." }).Data;
        Assert.Equal("Replied", DemoDomain.Text(data["carePod"]!["threads"]![0], "status"));
        var followup = Question(); followup["threadId"] = id; followup["text"] = "Thank you";
        data = Act(data, Patient, "followupCareQuestion", followup).Data;
        Assert.Equal("Open", DemoDomain.Text(data["carePod"]!["threads"]![0], "status"));
        data = Act(data, Mere, "bookCareAppointment", new JsonObject { ["threadId"] = id, ["date"] = "2026-11-02" }).Data;
        Assert.Equal(2, data["appointments"]!.AsArray().Count); Assert.Equal("Pending", DemoDomain.Text(data["appointments"]!.AsArray().Last(), "status"));
        data = Act(data, Mere, "closeCareQuestion", new JsonObject { ["threadId"] = id }).Data;
        Assert.Equal("VALIDATION_FAILED", Act(data, Mere, "replyCareQuestion", new JsonObject { ["threadId"] = id, ["text"] = "Too late" }).Error);
    }

    [Fact]
    public void SafetyFlagsCreateSeparateAlertAndAcknowledgementIsAudited()
    {
        var data = Act(DemoDomain.Seed(), Patient, "raiseCareAlert", new JsonObject { ["flags"] = new JsonArray("Reduced or stopped movements") }).Data;
        Assert.Empty(data["carePod"]!["threads"]!.AsArray());
        var alertId = data["carePod"]!["alerts"]![0]!["id"]!.DeepClone();
        var result = Act(data, Mere, "acknowledgeCareAlert", new JsonObject { ["alertId"] = alertId });
        Assert.Equal(Mere.Id, DemoDomain.Text(result.Data["carePod"]!["alerts"]![0], "acknowledgedBy"));
        Assert.Equal(2, result.Data["audit"]!.AsArray().Count);
    }

    [Fact]
    public void InvalidSafetyAndVoicePayloadsAreRejectedWithoutMutatingState()
    {
        var payload = Question(); payload["safetyChecked"] = false;
        Assert.Equal("VALIDATION_FAILED", Act(DemoDomain.Seed(), Patient, "submitCareQuestion", payload).Error);
        payload = Question(); payload["audio"] = "javascript:alert(1)";
        var result = Act(DemoDomain.Seed(), Patient, "submitCareQuestion", payload);
        Assert.Equal("VALIDATION_FAILED", result.Error); Assert.Null(result.Data["carePod"]);
        payload = Question(); payload["audio"] = new JsonObject { ["invalid"] = true };
        Assert.Equal("VALIDATION_FAILED", Act(DemoDomain.Seed(), Patient, "submitCareQuestion", payload).Error);
    }

    [Fact]
    public void ConsentIsRequiredForEachPatientMessageAndStampedByServer()
    {
        foreach (var value in new JsonNode?[] { null, JsonValue.Create(false), JsonValue.Create("true") })
        {
            var invalid = Question(); invalid["privacyConsent"] = value;
            var rejected = Act(DemoDomain.Seed(), Patient, "submitCareQuestion", invalid);
            Assert.Equal("VALIDATION_FAILED", rejected.Error);
            Assert.Null(rejected.Data["carePod"]);
            Assert.Contains("rejected", DemoDomain.Text(rejected.Data["audit"]!.AsArray().Last(), "outcome"));
        }
        var stale = Question(); stale["privacyVersion"] = "old-notice";
        Assert.Equal("VALIDATION_FAILED", Act(DemoDomain.Seed(), Patient, "submitCareQuestion", stale).Error);
        var payload = Question(); payload["acceptedBy"] = "other"; payload["acceptedAt"] = "2099-01-01";
        var data = Act(DemoDomain.Seed(), Patient, "submitCareQuestion", payload).Data;
        var thread = data["carePod"]!["threads"]![0]!;
        var evidence = thread["messages"]![0]!["privacyConsent"]!;
        Assert.Equal(CarePodDomain.PrivacyVersion, DemoDomain.Text(evidence, "version"));
        Assert.Equal(Patient.Id, DemoDomain.Text(evidence, "acceptedBy"));
        Assert.Equal(Now, DateTimeOffset.Parse(DemoDomain.Text(evidence, "acceptedAt")));
        var followup = Question(); followup["threadId"] = thread["id"]!.DeepClone(); followup["privacyConsent"] = false;
        Assert.Equal("VALIDATION_FAILED", Act(data, Patient, "followupCareQuestion", followup).Error);
        followup["privacyConsent"] = true;
        var result = Act(data, Patient, "followupCareQuestion", followup);
        Assert.Null(result.Error);
        Assert.Equal(CarePodDomain.PrivacyVersion, DemoDomain.Text(result.Data["carePod"]!["threads"]![0]!["messages"]![1]!["privacyConsent"], "version"));
    }

    [Fact]
    public void BookingPairingRequiresMembershipInThePod()
    {
        var result = Act(DemoDomain.Seed(), Mere, "assignCarePod", new JsonObject { ["patientId"] = "CF1003", ["podId"] = "suva-pod", ["primaryId"] = "demo-kesa" });
        Assert.Null(result.Error);
        Assert.Equal("demo-kesa", DemoDomain.Text(result.Data["carePod"]!["assignments"]!.AsArray().First(a => DemoDomain.Text(a, "patientId") == "CF1003"), "primaryId"));
    }
}
