import test from "node:test";
import assert from "node:assert/strict";
import { applyAction, seed, viewForRole } from "../lib/domain.js";

const admin = { id: "admin", name: "Admin", role: "Administrator" };
const doctor = { id: "doctor", name: "Doctor", role: "Doctor" };
const patient = { id: "patient", name: "Patient", role: "Patient" };

test("role views do not leak clinical and billing data to patients", () => {
  const view = viewForRole(seed, "Patient");
  assert.deepEqual(view.rooms, []);
  assert.deepEqual(view.invoices, []);
  assert.deepEqual(view.notes, {});
  assert.ok(view.patients.every((item) => item.id === "CF1001"));
});

test("server permissions reject unauthorized patient creation", () => {
  assert.throws(() => applyAction(seed, doctor, "addPatient", {}), /PERMISSION_DENIED:patient.add/);
});

test("appointment workflow validates and controls transitions", () => {
  const booked = applyAction(seed, patient, "addAppointment", { service: "Ultrasound", date: "2026-10-30" }).next;
  const appointment = booked.appointments.at(-1);
  assert.equal(appointment.name, "Mere Vakaloloma");
  assert.equal(appointment.status, "Pending");
  const confirmed = applyAction(booked, admin, "updateAppointment", { id: appointment.id, status: "Confirmed" }).next;
  assert.throws(() => applyAction(confirmed, admin, "updateAppointment", { id: appointment.id, status: "Pending" }), /INVALID_TRANSITION/);
});

test("clinical notes move from draft to reviewed", () => {
  const drafted = applyAction(seed, doctor, "saveNote", { patientId: "CF1001", text: "Synthetic note" }, new Date("2026-10-22T00:00:00Z")).next;
  assert.equal(drafted.notes.CF1001.status, "Draft");
  const reviewed = applyAction(drafted, doctor, "reviewNote", { patientId: "CF1001" }, new Date("2026-10-22T01:00:00Z")).next;
  assert.equal(reviewed.notes.CF1001.status, "Reviewed");
});
