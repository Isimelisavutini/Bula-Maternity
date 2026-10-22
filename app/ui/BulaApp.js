"use client";

import { useEffect, useState } from "react";

const navigation = {
  Administrator: ["Dashboard", "Patients", "Appointments", "Clinical Care", "Maternity Wards", "Billing", "Staff", "Reports", "Security", "Architecture"],
  Doctor: ["Dashboard", "Patients", "Appointments", "Clinical Care", "Maternity Wards"],
  Midwife: ["Dashboard", "Patients", "Appointments", "Clinical Care", "Maternity Wards"],
  Receptionist: ["Dashboard", "Patients", "Appointments", "Maternity Wards", "Billing"],
  Finance: ["Dashboard", "Billing", "Reports"],
  Patient: ["Dashboard", "Appointments"]
};

async function api(operation, options) {
  const result = await fetch(`/api/${operation}`, { cache: "no-store", ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  const body = await result.json();
  if (!result.ok) throw new Error(body.error || "REQUEST_FAILED");
  return body;
}

function Login({ onLogin }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("bula-admin");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const credentials = {
    admin: "bula-admin",
    doctor: "bula-doctor",
    midwife: "bula-midwife",
    reception: "bula-reception",
    finance: "bula-finance",
    patient: "bula-patient"
  };

  function choose(value) {
    setUsername(value);
    setPassword(credentials[value]);
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api("login", { method: "POST", body: JSON.stringify({ username, password }) });
      onLogin(result.user);
    } catch {
      setError("Those demo credentials were not accepted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand brand-dark"><span className="mark">✚</span><span><strong>CareFiji</strong><small>BULA MATERNITY</small></span></div>
        <h1>Welcome to the demonstration workspace.</h1>
        <p>Explore synthetic maternity workflows with server-enforced role permissions.</p>
        <div className="warning">Demonstration only. Never enter real patient or clinical information.</div>
        <form onSubmit={submit}>
          <label>Demo identity
            <select value={username} onChange={(event) => choose(event.target.value)}>
              <option value="admin">Administrator</option><option value="doctor">Doctor</option><option value="midwife">Midwife</option>
              <option value="reception">Receptionist</option><option value="finance">Finance</option><option value="patient">Patient</option>
            </select>
          </label>
          <label>Password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" /></label>
          <button disabled={busy}>{busy ? "Signing in…" : "Enter secure demo"}</button>
        </form>
        {error ? <p className="error" role="alert">{error}</p> : null}
      </section>
    </main>
  );
}

function DataTable({ headers, rows }) {
  return <div className="table"><table><thead><tr>{headers.map((item) => <th key={item}>{item}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.key || index}>{row.cells.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

function Dashboard({ data, user }) {
  return <><div className="hero"><span>AUTHENTICATED DEMONSTRATION · SUVA, FIJI</span><h2>Care for every beginning.</h2><p>Signed in as {user.name} · {user.role}</p></div><div className="stats">{[
    ["Synthetic patients", data.patients.length], ["Appointments", data.appointments.length], ["Admitted", data.patients.filter((item) => item.status === "Admitted").length], ["Available rooms", data.rooms.filter((item) => !item.patient).length]
  ].map(([label, value]) => <div className="stat" key={label}><small>{label}</small><strong>{value}</strong></div>)}</div></>;
}

function Appointments({ data, role, act }) {
  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await act("addAppointment", { name: form.get("name"), service: form.get("service"), date: form.get("date") });
    event.currentTarget.reset();
  }
  return <><h2>Appointments</h2><DataTable headers={["Patient", "Service", "Date", "Status", "Action"]} rows={data.appointments.map((item) => ({ key: item.id, cells: [item.name, item.service, item.date, item.status, ["Administrator", "Doctor", "Receptionist"].includes(role) && item.status !== "Cancelled" ? <button className="tiny" onClick={() => act("updateAppointment", { id: item.id, status: item.status === "Pending" ? "Confirmed" : "Cancelled" })}>{item.status === "Pending" ? "Confirm" : "Cancel"}</button> : "—"] }))} /><h3>Request synthetic appointment</h3><form onSubmit={submit}><label>Patient<input name="name" defaultValue={role === "Patient" ? "Mere Vakaloloma" : ""} readOnly={role === "Patient"} required /></label><label>Service<select name="service"><option>Antenatal</option><option>Ultrasound</option><option>Postnatal</option><option>Delivery planning</option></select></label><label>Date<input type="date" name="date" defaultValue="2026-10-27" required /></label><button>Submit request</button></form></>;
}

function ClinicalCare({ data, role, act }) {
  const [selected, setSelected] = useState(data.patients[0]?.id || "");
  const patient = data.patients.find((item) => item.id === selected) || data.patients[0];
  const note = patient ? data.notes[patient.id] : null;
  const [text, setText] = useState(() => note?.text || "");
  if (!patient) return <p>No patient records are available for this role.</p>;
  return <><h2>Clinical Care</h2><div className="warning">Synthetic records only. This prototype must not be used for clinical decisions.</div><select value={patient.id} onChange={(event) => { const id = event.target.value; setSelected(id); setText(data.notes[id]?.text || ""); }}>{data.patients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><div className="panel"><h3>{patient.name}</h3><p>{patient.weeks} weeks · {patient.status}</p></div><h3>Clinical note workflow</h3><textarea value={text} onChange={(event) => setText(event.target.value)} rows="5" placeholder="Required synthetic note" /><p>State: <b>{note?.status || "Not started"}</b></p><button onClick={() => act("saveNote", { patientId: patient.id, text })}>Save draft</button>{["Administrator", "Doctor"].includes(role) ? <button className="secondary-action" onClick={() => act("reviewNote", { patientId: patient.id })}>Review & lock state</button> : null}</>;
}

function Content({ page, data, user, act, audit }) {
  const role = user.role;
  if (page === "Dashboard") return <Dashboard data={data} user={user} />;
  if (page === "Patients") return <><div className="heading"><h2>Patient Registry</h2>{["Administrator", "Receptionist"].includes(role) ? <button onClick={() => act("addPatient", {})}>+ Add synthetic patient</button> : null}</div><DataTable headers={["ID", "Name", "Gestation", "Status"]} rows={data.patients.map((item) => ({ key: item.id, cells: [item.id, item.name, `${item.weeks} weeks`, item.status] }))} /></>;
  if (page === "Appointments") return <Appointments data={data} role={role} act={act} />;
  if (page === "Clinical Care") return <ClinicalCare data={data} role={role} act={act} />;
  if (page === "Maternity Wards") return <><h2>Maternity Ward Board</h2><div className="rooms">{data.rooms.map((room) => <div className="panel" key={room.id}><small>{room.id}</small><h3>{room.patient ? "Occupied" : "Available"}</h3><p>{room.patient || "Unassigned"}</p>{role !== "Doctor" ? <button className="tiny" onClick={() => act("updateRoom", { id: room.id })}>{room.patient ? "Clear" : "Assign synthetic occupant"}</button> : null}</div>)}</div></>;
  if (page === "Billing") return <><h2>Billing</h2><p>Illustrative FJD values only.</p><DataTable headers={["Invoice", "Patient", "Amount", "Status", "Action"]} rows={data.invoices.map((invoice) => ({ key: invoice.id, cells: [invoice.id, invoice.name, `FJD ${invoice.amount.toLocaleString()}`, invoice.status, ["Administrator", "Finance"].includes(role) ? <button className="tiny" onClick={() => act("updateInvoice", { id: invoice.id })}>Advance status</button> : "—"] }))} /></>;
  if (page === "Staff") return <><h2>Team Directory</h2><DataTable headers={["Staff", "Role", "Shift"]} rows={[["Dr A. Kumar", "Obstetrician", "Day"], ["Dr L. Singh", "Obstetrician", "On-call"], ["Nurse M. Ratu", "Senior Midwife", "Day"], ["Nurse P. Devi", "Midwife", "Night"]].map((cells) => ({ key: cells[0], cells }))} /></>;
  if (page === "Reports") return <><h2>Operational Reports</h2><div className="stats"><div className="stat"><small>Appointments</small><strong>{data.appointments.length}</strong></div><div className="stat"><small>Invoice total</small><strong>FJD {data.invoices.reduce((sum, item) => sum + item.amount, 0).toLocaleString()}</strong></div></div></>;
  if (page === "Security") return <><h2>Security & Audit</h2><div className="panel"><h3>Signed demo identity</h3><p>{user.name} · {user.role}</p><p className="mono">{user.id}</p></div><h3>Recent audit events</h3>{audit ? <DataTable headers={["Time", "Actor", "Role", "Action", "Target", "Outcome"]} rows={audit.map((item) => ({ key: item.id, cells: [new Date(item.at).toLocaleString(), item.actorName, item.role, item.action, item.target, item.outcome] }))} /> : <p>Loading audit events…</p>}</>;
  return <><h2>Production-readiness gates</h2>{[["Identity & RBAC", "Signed HTTP-only sessions plus server-side permission checks are implemented."], ["Durable storage", "Shared synthetic state and audit events are stored in Upstash Redis."], ["Clinical workflow", "Notes require content and move Draft → Reviewed; appointments use controlled transitions."], ["Still required", "Independent penetration testing, threat modelling, backups, privacy assessment, clinical governance, and regulatory review are required before any real-world use."]].map(([title, copy]) => <div className="panel" key={title}><h3>{title}</h3><p>{copy}</p></div>)}</>;
}

export default function BulaApp() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState(null);
  const [page, setPage] = useState("Dashboard");
  const [audit, setAudit] = useState(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api("session").then(async (session) => {
      if (!session.user) return { session, result: null };
      const result = await api("data");
      return { session, result };
    }).then(({ session, result }) => {
      if (!active) return;
      setUser(session.user);
      setData(result?.data || null);
    }).catch(() => {}).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (page === "Security" && user?.role === "Administrator") api("audit").then((result) => setAudit(result.audit)).catch((error) => setStatus(error.message));
  }, [page, user?.role]);

  async function act(action, payload) {
    setStatus("");
    try {
      const result = await api("action", { method: "POST", body: JSON.stringify({ action, payload }) });
      setData(result.data);
      setStatus("Saved and recorded in the audit log.");
    } catch (error) {
      setStatus(`Action rejected: ${error.message}`);
    }
  }

  async function logout() {
    await api("logout", { method: "POST", body: "{}" });
    setUser(null); setData(null); setPage("Dashboard"); setAudit(null);
  }

  if (loading) return <div className="loading">Loading CareFiji…</div>;
  if (!user || !data) return <Login onLogin={async (nextUser) => { setUser(nextUser); const result = await api("data"); setData(result.data); }} />;
  const pages = navigation[user.role] || ["Dashboard"];
  const activePage = pages.includes(page) ? page : "Dashboard";

  return <div className="shell"><aside><div className="brand"><span className="mark">✚</span><span><strong>CareFiji</strong><small>BULA MATERNITY</small></span></div><p className="sidecaption">SECURE DEMO WORKSPACE</p><nav>{pages.map((item) => <button key={item} className={item === activePage ? "active" : ""} onClick={() => setPage(item)}>{item}</button>)}</nav><button className="logout" onClick={logout}>Sign out</button><div className="bottom">Suva, Fiji · Synthetic data only</div></aside><main><header><div><small>CAREFIJI / {activePage.toUpperCase()}</small><h1>{activePage}</h1></div><div className="actions"><span>DEMO ONLY</span><b>{user.role}</b></div></header><section><Content page={activePage} data={data} user={user} act={act} audit={audit} />{status ? <p className="status-message" role="status">{status}</p> : null}<p className="status">Authenticated prototype · no real patient information permitted.<br />Copyright @ BASA</p></section></main></div>;
}
