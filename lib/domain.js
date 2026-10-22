export const seed = {
  patients: [
    { id: "CF1001", name: "Mereani Sovaki", weeks: 26, status: "Antenatal" },
    { id: "CF1002", name: "Ana Prasad", weeks: 38, status: "Admitted" },
    { id: "CF1003", name: "Litia Naivalu", weeks: 24, status: "Antenatal" }
  ],
  appointments: [
    { id: "A1", name: "Mereani Sovaki", date: "2026-10-23", service: "Antenatal", status: "Confirmed" }
  ],
  rooms: [
    { id: "M201", patient: "" },
    { id: "M202", patient: "Ana Prasad" },
    { id: "M203", patient: "" }
  ],
  invoices: [{ id: "INV01", name: "Ana Prasad", amount: 5500, status: "Unpaid" }],
  notes: {},
  audit: []
};

export const permissions = {
  Administrator: ["read", "patient.add", "appointment.add", "appointment.update", "note.draft", "note.review", "room.update", "invoice.update", "audit.read"],
  Doctor: ["read", "appointment.add", "appointment.update", "note.draft", "note.review"],
  Midwife: ["read", "appointment.add", "note.draft", "room.update"],
  Receptionist: ["read", "patient.add", "appointment.add", "appointment.update", "room.update"],
  Finance: ["read", "invoice.update"],
  Patient: ["read", "appointment.add"]
};

export const demoUsers = {
  admin: { id: "demo-admin", name: "Demo Administrator", role: "Administrator", password: "bula-admin" },
  doctor: { id: "demo-doctor", name: "Dr A. Kumar", role: "Doctor", password: "bula-doctor" },
  midwife: { id: "demo-midwife", name: "Nurse M. Ratu", role: "Midwife", password: "bula-midwife" },
  reception: { id: "demo-reception", name: "Demo Receptionist", role: "Receptionist", password: "bula-reception" },
  finance: { id: "demo-finance", name: "Demo Finance", role: "Finance", password: "bula-finance" },
  patient: { id: "demo-patient", name: "Mereani Sovaki", role: "Patient", password: "bula-patient" }
};

export function requirePermission(user, permission) {
  if (!permissions[user.role]?.includes(permission)) throw new Error(`PERMISSION_DENIED:${permission}`);
}

export function viewForRole(data, role) {
  const view = structuredClone(data);
  delete view.audit;
  if (role === "Patient") {
    view.patients = view.patients.filter((item) => item.id === "CF1001");
    view.appointments = view.appointments.filter((item) => item.name === "Mereani Sovaki");
    view.rooms = [];
    view.invoices = [];
    view.notes = {};
  }
  if (role === "Finance") {
    view.patients = [];
    view.appointments = [];
    view.rooms = [];
    view.notes = {};
  }
  if (role === "Receptionist") view.notes = {};
  return view;
}

export function applyAction(data, user, action, payload, now = new Date()) {
  const required = {
    addPatient: "patient.add",
    addAppointment: "appointment.add",
    updateAppointment: "appointment.update",
    saveNote: "note.draft",
    reviewNote: "note.review",
    updateRoom: "room.update",
    updateInvoice: "invoice.update"
  }[action];
  if (!required) throw new Error("UNKNOWN_ACTION");
  requirePermission(user, required);
  const next = structuredClone(data);
  let target = "unknown";

  if (action === "addPatient") {
    const number = next.patients.length + 1001;
    const patient = { id: `CF${number}`, name: `Demo Patient ${number - 1000}`, weeks: 20, status: "Antenatal" };
    next.patients.push(patient);
    target = patient.id;
  }
  if (action === "addAppointment") {
    if (!["Antenatal", "Ultrasound", "Postnatal", "Delivery planning"].includes(payload.service) || !/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) throw new Error("VALIDATION_FAILED");
    const name = user.role === "Patient" ? "Mereani Sovaki" : String(payload.name || "").trim();
    if (!name || name.length > 100) throw new Error("VALIDATION_FAILED");
    const appointment = { id: crypto.randomUUID(), name, service: payload.service, date: payload.date, status: "Pending" };
    next.appointments.push(appointment);
    target = appointment.id;
  }
  if (action === "updateAppointment") {
    const appointment = next.appointments.find((item) => String(item.id) === String(payload.id));
    if (!appointment) throw new Error("NOT_FOUND");
    const allowed = { Pending: ["Confirmed", "Cancelled"], Confirmed: ["Cancelled"], Cancelled: [] };
    if (!allowed[appointment.status]?.includes(payload.status)) throw new Error("INVALID_TRANSITION");
    appointment.status = payload.status;
    target = appointment.id;
  }
  if (action === "saveNote") {
    const patient = next.patients.find((item) => item.id === payload.patientId);
    const text = String(payload.text || "").trim();
    if (!patient) throw new Error("NOT_FOUND");
    if (!text || text.length > 2000) throw new Error("VALIDATION_FAILED");
    next.notes[patient.id] = { text, status: "Draft", author: user.id, updatedAt: now.toISOString() };
    target = patient.id;
  }
  if (action === "reviewNote") {
    const note = next.notes[payload.patientId];
    if (!note || note.status !== "Draft") throw new Error("DRAFT_REQUIRED");
    note.status = "Reviewed";
    note.reviewer = user.id;
    note.reviewedAt = now.toISOString();
    target = payload.patientId;
  }
  if (action === "updateRoom") {
    const room = next.rooms.find((item) => item.id === payload.id);
    if (!room) throw new Error("NOT_FOUND");
    room.patient = room.patient ? "" : "Demo Patient";
    target = room.id;
  }
  if (action === "updateInvoice") {
    const invoice = next.invoices.find((item) => item.id === payload.id);
    if (!invoice) throw new Error("NOT_FOUND");
    invoice.status = invoice.status === "Unpaid" ? "Partial" : invoice.status === "Partial" ? "Paid" : "Unpaid";
    target = invoice.id;
  }
  return { next, target };
}
