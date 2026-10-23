import assert from "node:assert/strict";
import test from "node:test";
import privacy from "../shared/chat-privacy.json" with { type: "json" };

const consent = { privacyConsent: true, privacyVersion: privacy.version };

const origin = process.env.BACKEND_CONTRACT_URL;
test("care-pod question, buddy handover, reply, booking, follow-up and alert API workflow", { skip: !origin }, async () => {
  async function login(username, password) {
    const response = await fetch(`${origin}/api/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
    assert.equal(response.status, 200); return response.headers.get("set-cookie").split(";")[0];
  }
  async function action(cookie, name, payload) {
    const response = await fetch(`${origin}/api/action`, { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ action: name, payload }) });
    return { status: response.status, body: await response.json() };
  }
  const patient = await login("patient", "bula-patient"); const mere = await login("midwife", "bula-midwife"); const kesa = await login("kesa", "bula-kesa");
  assert.equal((await action(patient, "submitCareQuestion", { category: "General", text: "No consent", safetyChecked: true })).status, 400);
  const submitted = await action(patient, "submitCareQuestion", { ...consent, category: "General", text: "Synthetic contract question", safetyChecked: true, patientId: "CF1002", gestationWeek: 40 });
  assert.equal(submitted.status, 200);
  const thread = submitted.body.data.carePod.threads.at(-1);
  assert.equal(thread.patientId, "CF1001"); assert.equal(thread.gestationWeek, 26);
  assert.equal(thread.messages[0].privacyConsent.version, privacy.version);
  assert.equal(thread.messages[0].privacyConsent.acceptedBy, "demo-patient");
  assert.ok(Date.parse(thread.messages[0].privacyConsent.acceptedAt));
  const threadId = thread.id;
  assert.equal((await action(patient, "replyCareQuestion", { threadId, text: "Unauthorized" })).status, 403);
  const handover = await action(mere, "setMidwifeStatus", { status: "In Delivery" });
  assert.equal(handover.status, 200); assert.equal(handover.body.data.carePod.threads.find(t => t.id === threadId).assignedTo, "demo-kesa");
  const reply = await action(kesa, "replyCareQuestion", { threadId, text: "Bring your antenatal record." });
  assert.equal(reply.status, 200); assert.equal(reply.body.data.carePod.threads.find(t => t.id === threadId).status, "Replied");
  const booking = await action(kesa, "bookCareAppointment", { threadId, date: "2026-11-02" });
  assert.equal(booking.status, 200); assert.equal(booking.body.data.appointments.at(-1).name, "Mereani Sovaki");
  assert.equal((await action(patient, "followupCareQuestion", { threadId, text: "No consent", safetyChecked: true })).status, 400);
  const followup = await action(patient, "followupCareQuestion", { ...consent, threadId, text: "Thank you", safetyChecked: true });
  assert.equal(followup.status, 200); assert.equal(followup.body.data.carePod.threads.find(t => t.id === threadId).status, "Open");
  const alert = await action(patient, "raiseCareAlert", { flags: ["Reduced or stopped movements"] });
  assert.equal(alert.status, 200); const alertId = alert.body.data.carePod.alerts.at(-1).id;
  assert.equal((await action(kesa, "acknowledgeCareAlert", { alertId })).status, 200);
  assert.equal((await action(kesa, "closeCareQuestion", { threadId })).status, 200);
  assert.equal((await action(patient, "followupCareQuestion", { ...consent, threadId, text: "Closed", safetyChecked: true })).status, 400);
  await action(mere, "setMidwifeStatus", { status: "On Duty" });
});
