import assert from "node:assert/strict";
import test from "node:test";
import { demoUsers, seed, viewForRole } from "../lib/domain.js";

// Cross-language contract checks use the existing JavaScript implementation as
// the migration reference; they do not run or deploy its API handlers.
const origin = process.env.BACKEND_CONTRACT_URL;

for (const [username, identity] of Object.entries(demoUsers)) {
  test(`C# preserves ${identity.role} browser contract`, { skip: !origin }, async () => {
    const login = await fetch(`${origin}/api/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: identity.password }),
    });
    assert.equal(login.status, 200);
    assert.deepEqual(await login.json(), { user: { id: identity.id, name: identity.name, role: identity.role } });
    const cookie = login.headers.get("set-cookie");
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
    const headers = { Cookie: cookie.split(";")[0] };
    const data = await fetch(`${origin}/api/data`, { headers });
    assert.equal(data.status, 200);
    assert.deepEqual(await data.json(), { data: viewForRole(seed, identity.role) });
    const session = await fetch(`${origin}/api/session`, { headers });
    const user = (await session.json()).user;
    assert.deepEqual({ id: user.id, name: user.name, role: user.role }, { id: identity.id, name: identity.name, role: identity.role });
    assert.ok(user.expires > Date.now());
    const logout = await fetch(`${origin}/api/logout`, { method: "POST", headers });
    assert.equal(logout.status, 200);
    assert.match(logout.headers.get("set-cookie"), /expires=Thu, 01 Jan 1970/i);
  });
}
