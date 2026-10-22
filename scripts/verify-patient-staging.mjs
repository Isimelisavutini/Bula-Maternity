import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Run only with two provisioned synthetic staging patients. Creates one kick
// and one appointment request. No administrative/service-role token is used.
const origin = process.env.PATIENT_STAGING_API_URL;
const tokens = [process.env.PATIENT_STAGING_TOKEN_A, process.env.PATIENT_STAGING_TOKEN_B];
if (!origin || tokens.some(token => !token)) throw new Error("Set PATIENT_STAGING_API_URL and both PATIENT_STAGING_TOKEN_A/B using synthetic accounts.");
async function call(path, token, command) {
  const response = await fetch(`${origin}/api/mobile/v1/${path}`, {
    method: command ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(command ? { body: JSON.stringify(command) } : {}),
  });
  return { response, body: await response.json() };
}
const patients = await Promise.all(tokens.map(token => call("bootstrap", token)));
for (const patient of patients) {
  assert.equal(patient.response.status, 200);
  assert.equal(patient.body.data.profiles.length, 1);
  const id = patient.body.data.profiles[0].id;
  for (const table of ["pregnancies", "appointments", "kick_events", "ward_allocations", "consent_records"])
    assert.ok(patient.body.data[table].every(record => record.patient_id === id));
}
assert.notEqual(patients[0].body.data.profiles[0].id, patients[1].body.data.profiles[0].id);
assert.equal((await call("bootstrap", "invalid")).response.status, 401);
const baselineCursor = patients[0].body.cursor;
for (const type of ["log_kick", "request_appointment"]) {
  const command = {
    id: randomUUID(), type, deviceTimestamp: new Date(Date.now() - 3600000).toISOString(), timezone: "Pacific/Fiji",
    payload: type === "request_appointment" ? { service: "Antenatal", scheduledAt: new Date(Date.now() + 86400000).toISOString() } : {},
  };
  const first = await call("commands", tokens[0], command);
  assert.equal(first.response.status, 200); assert.equal(first.body.result.accepted, true);
  const retry = await call("commands", tokens[0], command);
  assert.equal(retry.response.status, 200); assert.equal(retry.body.result.entityId, first.body.result.entityId);
  assert.equal(retry.body.result.duplicate, true);
  const other = await call("bootstrap", tokens[1]);
  assert.ok(!JSON.stringify(other.body.data).includes(command.id));
}
let cursor = baselineCursor; let hasMore = true; let count = 0;
while (hasMore) {
  const { response, body } = await call(`sync?cursor=${encodeURIComponent(cursor)}`, tokens[0]);
  assert.equal(response.status, 200); assert.equal(typeof body.cursor, "string");
  count += body.changes.length; cursor = body.cursor; hasMore = body.hasMore;
}
assert.ok(count >= 2);
console.log("Synthetic staging authentication, RLS isolation, command retries, and sync checks passed.");
