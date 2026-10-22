using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using CareFiji.Domain;
using Microsoft.AspNetCore.WebUtilities;

namespace CareFiji.Api;

public sealed class DemoSession(IConfiguration config, IHostEnvironment environment, TimeProvider clock)
{
    public const string CookieName = "carefiji_session";
    private string Secret => config["SESSION_SECRET"] ?? (environment.IsDevelopment()
        ? "carefiji-bula-maternity-public-demo-v1" : throw new DomainException("DEMO_NOT_CONFIGURED"));

    public string Create(DemoUser user) {
        var payload = WebEncoders.Base64UrlEncode(JsonSerializer.SerializeToUtf8Bytes(new { id = user.Id, name = user.Name, role = user.Role, expires = clock.GetUtcNow().AddHours(8).ToUnixTimeMilliseconds() }));
        return $"{payload}.{Sign(payload)}";
    }

    private string Sign(string payload) => WebEncoders.Base64UrlEncode(HMACSHA256.HashData(Encoding.UTF8.GetBytes(Secret), Encoding.UTF8.GetBytes(payload)));

    public DemoUser? Read(string? cookie)
    {
        if (string.IsNullOrEmpty(cookie)) return null;
        try
        {
            var parts = cookie.Split('.');
            if (parts.Length != 2) return null;
            var supplied = WebEncoders.Base64UrlDecode(parts[1]);
            var expected = WebEncoders.Base64UrlDecode(Sign(parts[0]));
            if (!CryptographicOperations.FixedTimeEquals(supplied, expected)) return null;
            using var json = JsonDocument.Parse(WebEncoders.Base64UrlDecode(parts[0]));
            var root = json.RootElement;
            if (root.GetProperty("expires").GetInt64() <= clock.GetUtcNow().ToUnixTimeMilliseconds()) return null;
            var id = root.GetProperty("id").GetString(); var role = root.GetProperty("role").GetString();
            return DemoDomain.Users.Values.Select(x => x.User).FirstOrDefault(x => x.Id == id && x.Role == role);
        }
        catch (Exception ex) when (ex is FormatException or JsonException or KeyNotFoundException or InvalidOperationException) { return null; }
    }

    public CookieOptions Options => new() { HttpOnly = true, Secure = !environment.IsDevelopment(), SameSite = SameSiteMode.Lax, Path = "/", MaxAge = TimeSpan.FromHours(8), IsEssential = true };

    public object? Details(string? cookie)
    {
        var user = Read(cookie);
        if (user is null) return null;
        using var document = JsonDocument.Parse(WebEncoders.Base64UrlDecode(cookie!.Split('.')[0]));
        return new { id = user.Id, name = user.Name, role = user.Role, expires = document.RootElement.GetProperty("expires").GetInt64() };
    }
}
