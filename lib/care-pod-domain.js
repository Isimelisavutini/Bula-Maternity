import initial from "../shared/care-pod.json" with { type: "json" };
import chatPrivacy from "../shared/chat-privacy.json" with { type: "json" };

export { chatPrivacy };

function consent(payload, user, now) {
  if (payload.privacyConsent !== true || payload.privacyVersion !== chatPrivacy.version)
    throw new Error("VALIDATION_FAILED");
  return { version: chatPrivacy.version, acceptedAt: now.toISOString(), acceptedBy: user.id };
}

export const careStaffRoles = ["Administrator", "Doctor", "Midwife"];
export const careCategories = [
  "Baby Kicks",
  "Pain/Cramps",
  "Food/Herbs",
  "Discharge",
  "Vitamins",
  "Emotional Support",
  "General",
];
const targets = {
  "Baby Kicks": 45,
  "Pain/Cramps": 240,
  "Food/Herbs": 360,
  Discharge: 240,
  Vitamins: 360,
  "Emotional Support": 120,
  General: 360,
};
export const safetyFlags = [
  "Bleeding or leaking fluid",
  "Reduced or stopped movements",
  "Severe headache or vision changes",
  "Severe or constant abdominal pain",
  "I feel unsafe or may harm myself",
];

export function careState(data) {
  return structuredClone(data.carePod || initial);
}
export function coveringMidwife(care, assignment) {
  const pod = care.pods.find((p) => p.id === assignment?.podId);
  const ordered = [
    assignment?.primaryId,
    ...(pod?.midwifeIds || []).filter((id) => id !== assignment?.primaryId),
  ];
  return (
    ordered
      .map((id) => care.midwives.find((m) => m.id === id))
      .find((m) => m?.status === "On Duty") || null
  );
}
export function careView(data, user) {
  const care = careState(data);
  if (!careStaffRoles.includes(user.role) && user.role !== "Patient")
    return null;
  if (user.role === "Patient") {
    care.assignments = care.assignments.filter((a) => a.patientId === "CF1001");
    care.threads = care.threads.filter((t) => t.patientId === "CF1001");
    care.alerts = care.alerts.filter((a) => a.patientId === "CF1001");
  }
  return care;
}

function requireStaff(user) {
  if (!careStaffRoles.includes(user.role))
    throw new Error("PERMISSION_DENIED:care.staff");
}
function patientIdFor(user, payload) {
  return user.role === "Patient" ? "CF1001" : String(payload.patientId || "");
}
function text(value, max = 2000) {
  return typeof value === "string" && value.trim().length <= max
    ? value.trim()
    : "";
}
function audio(value) {
  if (value === null || value === undefined || value === "") return null;
  if (
    typeof value !== "string" ||
    value.length > 350000 ||
    !/^data:audio\/(webm|mp4|ogg)(;codecs=[\w.-]+)?;base64,[A-Za-z0-9+/]+=*$/.test(
      value,
    )
  )
    throw new Error("VALIDATION_FAILED");
  return value;
}

export function applyCareAction(data, user, action, payload, now) {
  const next = structuredClone(data);
  const care = careState(data);
  next.carePod = care;
  let target;
  if (action === "setMidwifeStatus") {
    requireStaff(user);
    const id = user.role === "Administrator" ? payload.midwifeId : user.id;
    const midwife = care.midwives.find((m) => m.id === id);
    if (
      !midwife ||
      !["On Duty", "In Clinic", "In Delivery", "Off Duty"].includes(
        payload.status,
      )
    )
      throw new Error("VALIDATION_FAILED");
    midwife.status = payload.status;
    target = midwife.id;
  } else if (action === "assignCarePod") {
    if (user.role !== "Administrator" && user.role !== "Midwife")
      throw new Error("PERMISSION_DENIED:care.assign");
    const patient = next.patients.find((p) => p.id === payload.patientId);
    const pod = care.pods.find((p) => p.id === payload.podId);
    if (!patient || !pod || !pod.midwifeIds.includes(payload.primaryId))
      throw new Error("VALIDATION_FAILED");
    care.assignments = care.assignments.filter(
      (a) => a.patientId !== patient.id,
    );
    care.assignments.push({
      patientId: patient.id,
      podId: pod.id,
      primaryId: payload.primaryId,
    });
    target = patient.id;
  } else if (action === "submitCareQuestion" || action === "raiseCareAlert") {
    if (user.role !== "Patient")
      throw new Error("PERMISSION_DENIED:care.patient");
    const patientId = patientIdFor(user, payload);
    const patient = next.patients.find((p) => p.id === patientId);
    const assignment = care.assignments.find((a) => a.patientId === patientId);
    if (!assignment || !patient) throw new Error("VALIDATION_FAILED");
    if (action === "raiseCareAlert") {
      if (
        !Array.isArray(payload.flags) ||
        !payload.flags.length ||
        payload.flags.some((f) => !safetyFlags.includes(f))
      )
        throw new Error("VALIDATION_FAILED");
      target = crypto.randomUUID();
      care.alerts.push({
        id: target,
        patientId,
        podId: assignment.podId,
        flags: payload.flags,
        createdAt: now.toISOString(),
        acknowledgedAt: null,
        acknowledgedBy: null,
      });
    } else {
      const privacyConsent = consent(payload, user, now);
      const body = text(payload.text);
      const voice = audio(payload.audio);
      if (
        payload.safetyChecked !== true ||
        !careCategories.includes(payload.category) ||
        (!body && !voice) ||
        care.threads.length >= 100
      )
        throw new Error("VALIDATION_FAILED");
      const assignedTo = coveringMidwife(care, assignment)?.id || null;
      target = crypto.randomUUID();
      care.threads.push({
        id: target,
        patientId,
        patientName: patient.name,
        podId: assignment.podId,
        assignedTo,
        category: payload.category,
        priority: ["Baby Kicks", "Pain/Cramps", "Emotional Support"].includes(
          payload.category,
        )
          ? "Attention"
          : "Routine",
        gestationWeek: patient.weeks,
        status: "Open",
        createdAt: now.toISOString(),
        dueAt: new Date(
          now.getTime() + targets[payload.category] * 60000,
        ).toISOString(),
        messages: [
          {
            id: crypto.randomUUID(),
            senderId: user.id,
            senderName: user.name,
            senderRole: "Patient",
            privacyConsent,
            text: body,
            audio: voice,
            at: now.toISOString(),
          },
        ],
      });
    }
  } else if (action === "followupCareQuestion") {
    if (user.role !== "Patient")
      throw new Error("PERMISSION_DENIED:care.patient");
    const thread = care.threads.find(
      (t) => t.id === payload.threadId && t.patientId === "CF1001",
    );
    if (!thread) throw new Error("NOT_FOUND");
    const privacyConsent = consent(payload, user, now);
    const body = text(payload.text);
    const voice = audio(payload.audio);
    if (
      payload.safetyChecked !== true ||
      (!body && !voice) ||
      thread.status === "Closed" ||
      thread.messages.length >= 50
    )
      throw new Error("VALIDATION_FAILED");
    thread.messages.push({
      id: crypto.randomUUID(),
      senderId: user.id,
      senderName: user.name,
      senderRole: "Patient",
      privacyConsent,
      text: body,
      audio: voice,
      at: now.toISOString(),
    });
    thread.status = "Open";
    thread.dueAt = new Date(
      now.getTime() + targets[thread.category] * 60000,
    ).toISOString();
    target = thread.id;
  } else if (
    ["replyCareQuestion", "closeCareQuestion", "bookCareAppointment"].includes(
      action,
    )
  ) {
    requireStaff(user);
    const thread = care.threads.find((t) => t.id === payload.threadId);
    if (!thread) throw new Error("NOT_FOUND");
    target = thread.id;
    if (action === "replyCareQuestion") {
      const body = text(payload.text);
      const voice = audio(payload.audio);
      if (
        (!body && !voice) ||
        thread.status === "Closed" ||
        thread.messages.length >= 50
      )
        throw new Error("VALIDATION_FAILED");
      thread.messages.push({
        id: crypto.randomUUID(),
        senderId: user.id,
        senderName: user.name,
        senderRole: user.role,
        text: body,
        audio: voice,
        at: now.toISOString(),
      });
      thread.status = "Replied";
      thread.assignedTo = user.id;
    } else if (action === "closeCareQuestion") thread.status = "Closed";
    else {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date || ""))
        throw new Error("VALIDATION_FAILED");
      next.appointments.push({
        id: crypto.randomUUID(),
        name: thread.patientName,
        date: payload.date,
        service: "Antenatal",
        status: "Pending",
      });
      thread.messages.push({
        id: crypto.randomUUID(),
        senderId: user.id,
        senderName: user.name,
        senderRole: user.role,
        text: `An antenatal appointment was requested for ${payload.date}. Please check Appointments for confirmation.`,
        audio: null,
        at: now.toISOString(),
      });
      thread.status = "Replied";
    }
  } else if (action === "acknowledgeCareAlert") {
    requireStaff(user);
    const alert = care.alerts.find((a) => a.id === payload.alertId);
    if (!alert) throw new Error("NOT_FOUND");
    alert.acknowledgedAt = now.toISOString();
    alert.acknowledgedBy = user.id;
    target = alert.id;
  } else throw new Error("UNKNOWN_ACTION");
  // A duty change reroutes only unanswered work. Existing replies keep their author.
  for (const thread of care.threads.filter((t) => t.status === "Open"))
    thread.assignedTo =
      coveringMidwife(
        care,
        care.assignments.find((a) => a.patientId === thread.patientId),
      )?.id || null;
  if (care.alerts.length > 500 || JSON.stringify(care).length > 1500000)
    throw new Error("VALIDATION_FAILED");
  return { next, target };
}
