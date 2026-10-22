import test from "node:test";
import assert from "node:assert/strict";
import { applyAction, demoUsers, seed, viewForRole } from "../lib/domain.js";
import { careState, coveringMidwife } from "../lib/care-pod-domain.js";

const patient = demoUsers.patient; const midwife = demoUsers.midwife; const kesa = demoUsers.kesa; const now = new Date("2026-10-23T08:00:00Z");
const question = { category: "General", text: "What should I bring to my appointment?", safetyChecked: true };
function act(data, user, action, payload) { return applyAction(data, user, action, payload, now).next; }

test("legacy datasets receive a complete care pod without changing the seed", () => {
  const care = careState(seed); assert.equal(care.midwives.length, 3); assert.equal(coveringMidwife(care, care.assignments[0]).id, midwife.id);
  assert.equal(seed.carePod, undefined);
});
test("patient identity and gestation are taken from the server record", () => {
  const data = act(seed, patient, "submitCareQuestion", { ...question, patientId: "CF1002", gestationWeek: 40 });
  const thread = data.carePod.threads[0]; assert.equal(thread.patientId, "CF1001"); assert.equal(thread.gestationWeek, 26);
  assert.equal(thread.assignedTo, midwife.id); assert.equal(thread.status, "Open");
});
test("safety confirmation and message metadata are mandatory", () => {
  for (const payload of [{ ...question, safetyChecked: false }, { ...question, text: "" }, { ...question, category: "Unknown" }, { ...question, audio: "javascript:alert(1)" }, { ...question, audio: { invalid: true } }])
    assert.throws(() => act(seed, patient, "submitCareQuestion", payload), /VALIDATION_FAILED/);
});
test("in-delivery and off-duty statuses reroute unanswered questions to the pod buddy", () => {
  let data = act(seed, patient, "submitCareQuestion", question);
  data = act(data, midwife, "setMidwifeStatus", { status: "In Delivery" });
  assert.equal(data.carePod.threads[0].assignedTo, kesa.id);
  data = act(data, kesa, "setMidwifeStatus", { status: "Off Duty" });
  assert.equal(data.carePod.threads[0].assignedTo, null);
});
test("patients and nonclinical staff cannot change staff status or reply", () => {
  const data = act(seed, patient, "submitCareQuestion", question);
  for (const user of [patient, demoUsers.finance, demoUsers.reception])
    assert.throws(() => act(data, user, "replyCareQuestion", { threadId: data.carePod.threads[0].id, text: "Unauthorized" }), /PERMISSION_DENIED/);
  assert.throws(() => act(data, patient, "setMidwifeStatus", { status: "Off Duty" }), /PERMISSION_DENIED/);
});
test("patients see only their conversations and nonclinical roles see no care data", () => {
  const data = act(seed, patient, "submitCareQuestion", question);
  data.carePod.threads.push({ id: "other-patient-thread", patientId: "CF1002", messages: [] });
  data.carePod.alerts.push({ patientId: "CF1002" });
  const view = viewForRole(data, "Patient"); assert.equal(view.carePod.threads.length, 1); assert.equal(view.carePod.alerts.length, 0);
  assert.equal(viewForRole(data, "Finance").carePod, null); assert.equal(viewForRole(data, "Receptionist").carePod, null);
});
test("staff replies persist, appointment requests reach the appointment list, and closing prevents replies", () => {
  let data = act(seed, patient, "submitCareQuestion", question); const threadId = data.carePod.threads[0].id;
  data = act(data, midwife, "replyCareQuestion", { threadId, text: "Bring your antenatal record." });
  assert.equal(data.carePod.threads[0].messages.length, 2); assert.equal(data.carePod.threads[0].status, "Replied");
  data = act(data, midwife, "bookCareAppointment", { threadId, date: "2026-11-02" });
  assert.equal(data.appointments.at(-1).name, "Mereani Sovaki"); assert.equal(data.appointments.at(-1).status, "Pending");
  data = act(data, midwife, "closeCareQuestion", { threadId });
  assert.throws(() => act(data, midwife, "replyCareQuestion", { threadId, text: "Too late" }), /VALIDATION_FAILED/);
});
test("explicit red flags create a separate alert with acknowledgement history", () => {
  let data = act(seed, patient, "raiseCareAlert", { flags: ["Reduced or stopped movements"] });
  assert.equal(data.carePod.threads.length, 0); assert.equal(data.carePod.alerts.length, 1);
  data = act(data, midwife, "acknowledgeCareAlert", { alertId: data.carePod.alerts[0].id });
  assert.equal(data.carePod.alerts[0].acknowledgedBy, midwife.id);
  assert.throws(() => act(data, patient, "raiseCareAlert", { flags: [] }), /VALIDATION_FAILED/);
});
test("staff can pair a booking patient only to a midwife in the selected pod", () => {
  const data = act(seed, midwife, "assignCarePod", { patientId: "CF1003", podId: "suva-pod", primaryId: kesa.id });
  assert.equal(data.carePod.assignments.find(a => a.patientId === "CF1003").primaryId, kesa.id);
  assert.throws(() => act(data, midwife, "assignCarePod", { patientId: "CF1003", podId: "suva-pod", primaryId: "unknown" }), /VALIDATION_FAILED/);
});
test("voice attachments accept supported audio only and enforce size bounds", () => {
  const audio = "data:audio/webm;codecs=opus;base64,AAAA";
  const data = act(seed, patient, "submitCareQuestion", { ...question, text: "", audio });
  assert.equal(data.carePod.threads[0].messages[0].audio, audio);
  assert.throws(() => act(seed, patient, "submitCareQuestion", { ...question, audio: "data:audio/webm;base64," + "A".repeat(350001) }), /VALIDATION_FAILED/);
});
