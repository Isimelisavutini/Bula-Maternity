using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using CareFiji.Api;
using CareFiji.Domain;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Xunit;

namespace CareFiji.Tests;

public sealed class DomainTests
{
    private static DemoUser User(string role) => DemoDomain.Users.Values.First(x => x.User.Role == role).User;

    public static IEnumerable<object[]> PermissionCases()
    {
        var allowed = new Dictionary<string, string[]>
        {
            ["Administrator"] = ["addPatient", "addAppointment", "updateAppointment", "saveNote", "reviewNote", "updateRoom", "updateInvoice"],
            ["Doctor"] = ["addAppointment", "updateAppointment", "saveNote", "reviewNote"],
            ["Midwife"] = ["addAppointment", "saveNote", "updateRoom"],
            ["Receptionist"] = ["addPatient", "addAppointment", "updateAppointment", "updateRoom"],
            ["Finance"] = ["updateInvoice"], ["Patient"] = ["addAppointment"]
        };
        foreach (var role in allowed.Keys)
            foreach (var action in allowed["Administrator"])
                yield return [role, action, allowed[role].Contains(action)];
    }

    [Theory, MemberData(nameof(PermissionCases))]
    public void AllRoleActionCombinationsEnforcePermissionsAndAudit(string role, string action, bool allowed)
    {
        var data = DemoDomain.Seed();
        data["notes"]!["CF1001"] = new JsonObject { ["status"] = "Draft" };
        var payload = action switch
        {
            "addAppointment" => JsonNode.Parse("""{"service":"Ultrasound","date":"2026-10-30","name":"Synthetic patient"}""")!.AsObject(),
            "updateAppointment" => JsonNode.Parse("""{"id":"A1","status":"Cancelled"}""")!.AsObject(),
            "saveNote" or "reviewNote" => JsonNode.Parse("""{"patientId":"CF1001","text":"Synthetic note"}""")!.AsObject(),
            "updateRoom" => new JsonObject { ["id"] = "M201" },
            "updateInvoice" => new JsonObject { ["id"] = "INV01" }, _ => new JsonObject()
        };
        var result = DemoDomain.Execute(data, User(role), action, payload, DateTimeOffset.UtcNow);
        Assert.Equal(allowed, result.Error is null);
        Assert.Single(result.Data["audit"]!.AsArray());
        Assert.Equal(allowed ? "success" : $"rejected:{result.Error}", DemoDomain.Text(result.Data["audit"]![0], "outcome"));
        Assert.Empty(data["audit"]!.AsArray());
    }

    [Theory]
    [InlineData("Patient", 1, 1, 0, 0)]
    [InlineData("Finance", 0, 0, 0, 1)]
    [InlineData("Receptionist", 3, 1, 3, 1)]
    [InlineData("Doctor", 3, 1, 3, 1)]
    [InlineData("Midwife", 3, 1, 3, 1)]
    [InlineData("Administrator", 3, 1, 3, 1)]
    public void RoleFilteredViewsMatchExistingContract(string role, int patients, int appointments, int rooms, int invoices)
    {
        var seed = DemoDomain.Seed(); seed["_revision"] = 1;
        var view = DemoDomain.View(seed, role);
        Assert.Equal(patients, view["patients"]!.AsArray().Count);
        Assert.Equal(appointments, view["appointments"]!.AsArray().Count);
        Assert.Equal(rooms, view["rooms"]!.AsArray().Count);
        Assert.Equal(invoices, view["invoices"]!.AsArray().Count);
        Assert.False(view.ContainsKey("audit")); Assert.False(view.ContainsKey("_revision"));
    }

    [Fact]
    public void AppointmentValidationAndTransitionsMatchExistingWorkflow()
    {
        var data = DemoDomain.Seed();
        var booked = DemoDomain.Execute(data, User("Patient"), "addAppointment", new JsonObject { ["service"] = "Ultrasound", ["date"] = "2026-10-30", ["name"] = "Ignored" }, DateTimeOffset.UtcNow);
        Assert.Null(booked.Error);
        var item = booked.Data["appointments"]!.AsArray().Last()!;
        Assert.Equal("Mereani Sovaki", DemoDomain.Text(item, "name"));
        var payload = new JsonObject { ["id"] = DemoDomain.Text(item, "id"), ["status"] = "Confirmed" };
        Assert.Null(DemoDomain.Execute(booked.Data, User("Doctor"), "updateAppointment", payload, DateTimeOffset.UtcNow).Error);
        payload["status"] = "Invalid";
        Assert.Equal("INVALID_TRANSITION", DemoDomain.Execute(booked.Data, User("Doctor"), "updateAppointment", payload, DateTimeOffset.UtcNow).Error);
        Assert.Equal("VALIDATION_FAILED", DemoDomain.Execute(data, User("Patient"), "addAppointment", new JsonObject(), DateTimeOffset.UtcNow).Error);
    }

    [Fact]
    public void NotesMustBeDraftedBeforeReview()
    {
        var payload = new JsonObject { ["patientId"] = "CF1001", ["text"] = "Synthetic note" };
        var data = DemoDomain.Execute(DemoDomain.Seed(), User("Doctor"), "saveNote", payload, DateTimeOffset.UtcNow).Data;
        var reviewed = DemoDomain.Execute(data, User("Doctor"), "reviewNote", payload, DateTimeOffset.UtcNow);
        Assert.Equal("Reviewed", DemoDomain.Text(reviewed.Data["notes"]!["CF1001"], "status"));
        Assert.Equal("DRAFT_REQUIRED", DemoDomain.Execute(reviewed.Data, User("Doctor"), "reviewNote", payload, DateTimeOffset.UtcNow).Error);
    }

    [Fact]
    public async Task ConcurrentMemoryMutationsRetainAllAcceptedActions()
    {
        var store = new MemoryDemoStore();
        await Task.WhenAll(Enumerable.Range(0, 30).Select(_ => store.Update(data => DemoDomain.Execute(data, User("Administrator"), "addPatient", new JsonObject(), DateTimeOffset.UtcNow), default)));
        var data = await store.Read(default);
        Assert.Equal(33, data["patients"]!.AsArray().Count); Assert.Equal(30, data["audit"]!.AsArray().Count);
        Assert.Equal(33, data["patients"]!.AsArray().Select(x => DemoDomain.Text(x, "id")).Distinct().Count());
    }

    [Fact]
    public void ExistingNodeCookieIsAcceptedAndTamperedOrExpiredCookiesAreRejected()
    {
        const string secret = "a-test-secret";
        var session = new DemoSession(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["SESSION_SECRET"] = secret }).Build(), new TestEnvironment(), TimeProvider.System);
        string Cookie(long expires)
        {
            var json = $$"""{"id":"demo-patient","name":"Mereani Sovaki","role":"Patient","expires":{{expires}}}""";
            var payload = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(json));
            return payload + "." + WebEncoders.Base64UrlEncode(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(payload)));
        }
        Assert.Equal("Patient", session.Read(Cookie(DateTimeOffset.UtcNow.AddHours(8).ToUnixTimeMilliseconds()))?.Role);
        Assert.Null(session.Read(Cookie(0))); Assert.Null(session.Read(Cookie(long.MaxValue) + "x"));
        Assert.Equal(User("Doctor"), session.Read(session.Create(User("Doctor"))));
        Assert.Equal(TimeSpan.FromHours(8), session.Options.MaxAge); Assert.True(session.Options.HttpOnly);
    }
}

internal sealed class TestEnvironment : IWebHostEnvironment
{
    public string EnvironmentName { get; set; } = "Development";
    public string ApplicationName { get; set; } = "CareFiji.Api";
    public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
    public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    public string WebRootPath { get; set; } = AppContext.BaseDirectory;
    public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
}
