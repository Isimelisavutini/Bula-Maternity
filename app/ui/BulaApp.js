"use client";

import Image from "next/image";
import Link from "next/link";
import BrandLogo from "./BrandLogo";
import { AskMyMidwife, CarePodWorkspace, MyMidwifeCard } from "./CarePod";
import { useCallback, useEffect, useRef, useState } from "react";

function MenuIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 3v12m0 0 5-5m-5 5-5-5M5 21h14" />
    </svg>
  );
}

const iosDownloadUrl =
  process.env.NEXT_PUBLIC_IOS_APP_DOWNLOAD_URL ||
  "https://github.com/Isimelisavutini/Bula-Maternity/releases/latest";

function TabIcon({ name }) {
  if (name === "Patient Messages")
    return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M21 11a8 8 0 0 1-8 8H7l-5 3V11a9 9 0 0 1 19 0Z" /><path d="M7 9h10M7 13h6" /></svg>;
  if (name === "Dashboard")
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </svg>
    );
  if (name === "Patients")
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  if (name === "Appointments")
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 11h18" />
      </svg>
    );
  if (name === "Maternity Wards")
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M3 7v11M21 18v-7a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v7M3 14h18M7 9V7a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2" />
      </svg>
    );
  if (name === "Journey" || name === "Ask My Midwife")
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M12 21s-7-4.35-7-11a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 6.65-7 11-7 11Z" />
      </svg>
    );
  return <MenuIcon />;
}

const navigation = {
  Administrator: [
    "Dashboard",
    "Patient Messages",
    "Patients",
    "Appointments",
    "Clinical Care",
    "Maternity Wards",
    "Billing",
    "Staff",
    "Reports",
    "Security",
    "Architecture",
  ],
  Doctor: [
    "Dashboard",
    "Patient Messages",
    "Patients",
    "Appointments",
    "Clinical Care",
    "Maternity Wards",
  ],
  Midwife: [
    "Dashboard",
    "Patient Messages",
    "Patients",
    "Appointments",
    "Clinical Care",
    "Maternity Wards",
  ],
  Receptionist: [
    "Dashboard",
    "Patients",
    "Appointments",
    "Maternity Wards",
    "Billing",
  ],
  Finance: ["Dashboard", "Billing", "Reports"],
  Patient: ["Dashboard", "Ask My Midwife", "Journey", "Appointments", "Maternity Wards"],
};

const milestones = [
  {
    week: 4,
    emoji: "🌱",
    label: "tiny poppy seed",
    length: "Approx. 1 mm",
    weight: "Early implantation",
  },
  {
    week: 12,
    emoji: "🍋",
    label: "Fiji lime",
    length: "5.4 cm",
    weight: "14g",
  },
  {
    week: 20,
    emoji: "🥭",
    label: "Small mango",
    length: "25.6 cm",
    weight: "300g",
  },
  {
    week: 26,
    emoji: "🧡",
    label: "Fresh Fiji papaya",
    length: "35.6 cm",
    weight: "760g",
  },
  {
    week: 32,
    emoji: "🥥",
    label: "Island coconut",
    length: "42.4 cm",
    weight: "1.7kg",
  },
  {
    week: 37,
    emoji: "🍉",
    label: "Small watermelon",
    length: "48.6 cm",
    weight: "2.9kg",
  },
];

const pregnancyGrowth = {
  4: {
    title: "Early Implantation & Embryonic Disc",
    size: "Approx. 1 mm",
    comparison: "Comparable to a tiny poppy seed",
    image: "/pregnancy/week-04.png",
    alt: "Medical illustration of early embryonic development within the gestational sac",
    milestones: [
      "The blastocyst has firmly implanted into the uterine lining.",
      "The amniotic sac and yolk sac are forming.",
      "Cells are differentiating into three germ layers—ectoderm, mesoderm, and endoderm—laying the foundation for the nervous system, organs, skeleton, and muscles.",
    ],
  },
};

const growthStages = [
  { week: 4, image: "/pregnancy/stage-04.png", note: "A tiny beginning takes root." },
  { week: 12, image: "/pregnancy/stage-12.png", note: "Little fingers and toes are forming." },
  { week: 20, image: "/pregnancy/stage-20.png", note: "Small movements become more noticeable." },
  { week: 26, image: "/pregnancy/stage-26.png", note: "Your baby is growing and responding to sound." },
  { week: 32, image: "/pregnancy/stage-32.png", note: "Growing stronger, with less room to stretch." },
  { week: 37, image: "/pregnancy/stage-37.png", note: "Getting ready for your first hello." },
];

function GrowthCard({ week }) {
  const growth = pregnancyGrowth[week];
  const size = milestones.reduce((best, item) => item.week <= week ? item : best, milestones[0]);
  const stage = growthStages.reduce((best, item) => item.week <= week ? item : best, growthStages[0]);
  if (!growth) return (
    <article className="growth-card">
      <div className="growth-copy">
        <h3>Your baby’s development</h3>
        <div className="growth-size">
          <strong>{size.emoji} Around the size of a {size.label}</strong>
          <span>At the week {size.week} milestone: {size.length} · {size.weight}</span>
        </div>
        <p>{stage.note}</p>
      </div>
    </article>
  );

  return (
    <article className="growth-card" aria-labelledby={`growth-week-${week}`}>
      <div className="growth-copy">
        <small>YOUR BABY THIS WEEK</small>
        <h3 id={`growth-week-${week}`}>
          Week {week}: {growth.title}
        </h3>
        <div className="growth-size">
          <strong>{growth.size}</strong>
          <span>{growth.comparison}</span>
        </div>
        <h4>Key milestones</h4>
        <ul>
          {growth.milestones.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function SplashScreen({ onDone }) {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const fadeTimer = window.setTimeout(() => setLeaving(true), 2300);
    const doneTimer = window.setTimeout(onDone, 2800);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
    };
  }, [onDone]);
  return (
    <div
      className={`startup-splash ${leaving ? "splash-leaving" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="CareFiji introduction"
    >
      <Image className="splash-baby-background" src="/pregnancy/stage-32.png" alt="" fill sizes="100vw" preload aria-hidden="true" />
      <div className="splash-background-shade" />
      <div className="splash-brand">
        <Image className="splash-logo" src="/branding/carefiji-logo.png" alt="CareFiji — Bula Maternity" width={640} height={640} preload />
      </div>
      <div className="splash-gateway">
        <div className="splash-loader">
          <i />
        </div>
        <div>
          <span>◈ Suva Secure Gateway</span>
        </div>
      </div>
    </div>
  );
}

function PatientDashboard({ compact = false, care, onAsk }) {
  const [week, setWeek] = useState(26);
  const [kicks, setKicks] = useState(12);
  const [heartId, setHeartId] = useState(0);
  const days = week * 7;
  const remaining = 280 - days;
  const progress = Math.round((days / 280) * 100);
  const trimester = week <= 13 ? 1 : week <= 27 ? 2 : 3;
  const stage = growthStages.reduce(
    (best, item) => (item.week <= week ? item : best),
    growthStages[0],
  );
  function logKick() {
    setKicks((value) => value + 1);
    setHeartId((value) => value + 1);
    try {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 520;
      gain.gain.setValueAtTime(0.05, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.12);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.12);
    } catch {}
  }
  return (
    <div className="patient-dashboard">
      <div className="patient-greeting">
        <div>
          <h2>
            Bula Vinaka, Mere! <span>🌺</span>
          </h2>
          <p>
            CWM Suva Clinic <b>• Today is feeling peaceful</b>
          </p>
        </div>
        <button
          onClick={() =>
            document
              .getElementById("week-simulator")
              ?.scrollIntoView({ behavior: "smooth" })
          }
        >
          W{week} D{days % 7 || 7}
        </button>
      </div>
      <article className="day-card day-card-expanded has-growth-image">
        {stage ? (
          <>
            <Image
              className="day-card-image"
              src={stage.image}
              alt=""
              fill
              sizes="(max-width: 800px) 100vw, 820px"
              priority
              aria-hidden="true"
            />
            <div className="day-card-image-overlay" />
          </>
        ) : null}
        <div className="day-meta">
          <span>Week {week}</span>
          <b>Trimester {trimester}</b>
        </div>
        <div className="day-number">
          Day {days} <small>of 280 days</small>
        </div>
        <p>
          {stage.note}
        </p>
        <div className="baby-snapshot">
          <small className="stage-caption">Illustrative development stage</small>
          <div className="kick-wrap">
            <i key={heartId}>♥</i>
            <button
              onClick={logKick}
              aria-label={`Log baby kick. ${kicks} kicks logged`}
            >
              ♥ Log Kick <b>{kicks}</b>
            </button>
          </div>
        </div>
      </article>
      <MyMidwifeCard care={care} onOpen={onAsk} />
      <GrowthCard week={week} />
      <article className="gestation-card">
        <div className="dual-accent">
          <i />
          <i />
        </div>
        <div className="gestation-title">
          <strong>♡ MATERNAL GESTATION & EDD</strong>
          <span>● {Math.ceil(remaining / 7)} weeks to go</span>
        </div>
        <div className="gestation-metrics">
          <div>
            <small>Current Week</small>
            <strong>Week {week}</strong>
            <span>Trimester {trimester}</span>
          </div>
          <div>
            <small>Remaining to Due Date</small>
            <strong className="remaining-days">
              {remaining} <em>days</em>
            </strong>
            <span>{Math.floor(remaining / 7)} full weeks left</span>
          </div>
        </div>
        <div className="pregnancy-progress">
          <p>
            <span>Overall Pregnancy Progress</span>
            <b>{progress}% Completed</b>
          </p>
          <div>
            <i style={{ width: `${progress}%` }} />
          </div>
          <small>
            <span>Week 1</span>
            <span>Week 13</span>
            <span>Week 27</span>
            <span>Week 40</span>
          </small>
        </div>
        <div className="edd-banner">
          <span>⚑</span>
          <div>
            <small>EXPECTED DUE DATE (EDD)</small>
            <strong>January 28, 2027</strong>
          </div>
          <button title="Based on a synthetic LMP date">LMP Info ⓘ</button>
        </div>
      </article>
      {compact ? null : (
        <article className="week-simulator" id="week-simulator">
          <div>
            <strong>⌁ Interactive Week Simulator</strong>
            <span>LIVE SANDBOX</span>
          </div>
          <p>Slide to preview pregnancy metrics across all stages.</p>
          <label htmlFor="week-range">
            <span>Week 4</span>
            <b>
              Week {week} (Day {days})
            </b>
            <span>Week 40</span>
          </label>
          <input
            id="week-range"
            type="range"
            min="4"
            max="40"
            value={week}
            onChange={(event) => setWeek(Number(event.target.value))}
          />
          <div className="week-jumps">
            {[
              [4, "Early"],
              [12, "T1"],
              [20, "Scan"],
              [26, "Now"],
              [37, "Term"],
            ].map(([value, label]) => (
              <button
                className={week === value ? "selected" : ""}
                onClick={() => setWeek(value)}
                key={value}
              >
                Week {value} ({label})
              </button>
            ))}
          </div>
        </article>
      )}
    </div>
  );
}

async function api(operation, options) {
  const result = await fetch(`/api/${operation}`, {
    cache: "no-store",
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const body = await result.json();
  if (!result.ok) throw new Error(body.error || "REQUEST_FAILED");
  return body;
}

function Login({ onLogin, initialUsername = "admin" }) {
  const [username, setUsername] = useState(initialUsername);
  const [password, setPassword] = useState(`bula-${initialUsername}`);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const credentials = {
    admin: "bula-admin",
    doctor: "bula-doctor",
    midwife: "bula-midwife",
    kesa: "bula-kesa",
    litia: "bula-litia",
    reception: "bula-reception",
    finance: "bula-finance",
    patient: "bula-patient",
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
      const result = await api("login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      onLogin(result.user);
    } catch {
      setError("Those demo credentials were not accepted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <Image
        className="login-baby-background"
        src="/pregnancy/stage-32.png"
        alt=""
        fill
        sizes="100vw"
        aria-hidden="true"
      />
      <div className="login-background-wash" aria-hidden="true" />
      <div className="login-vector-pattern" aria-hidden="true" />
      <section className="login-card">
        <Image
          className="login-logo"
          src="/branding/carefiji-logo.png"
          alt="CareFiji — Bula Maternity"
          width={180}
          height={180}
        />
        <h1>Welcome to the demonstration workspace.</h1>
        <p>
          Explore synthetic maternity workflows with server-enforced role
          permissions.
        </p>
        <div className="warning">
          Demonstration only. Never enter real patient or clinical information.
        </div>
        <form onSubmit={submit}>
          <label>
            Demo identity
            <select
              value={username}
              onChange={(event) => choose(event.target.value)}
            >
              <option value="admin">Administrator</option>
              <option value="doctor">Doctor</option>
              <option value="midwife">Midwife</option>
              <option value="kesa">Sister Kesa · Pod buddy</option>
              <option value="litia">Sister Litia · Pod buddy</option>
              <option value="reception">Receptionist</option>
              <option value="finance">Finance</option>
              <option value="patient">Patient</option>
            </select>
          </label>
          <label>
            Password
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
            />
          </label>
          <button disabled={busy}>
            {busy ? "Signing in…" : "Enter secure demo"}
          </button>
        </form>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <p>
          <Link href="/patient">Open the production patient portal</Link>
          <Link href="/">About CareFiji · back to home</Link>
        </p>
      </section>
    </main>
  );
}

function DataTable({ headers, rows }) {
  return (
    <div className="table">
      <table>
        <thead>
          <tr>
            {headers.map((item) => (
              <th key={item}>{item}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.key || index}>
              {row.cells.map((cell, cellIndex) => (
                <td data-label={headers[cellIndex]} key={cellIndex}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Dashboard({ data, user, act, onNavigate }) {
  if (user.role === "Patient") return <PatientDashboard care={data.carePod} onAsk={() => onNavigate("Ask My Midwife")} />;
  if (user.role === "Midwife") return <CarePodWorkspace data={data} user={user} act={act} />;
  return (
    <>
      <div className="hero">
        <span>AUTHENTICATED DEMONSTRATION · SUVA, FIJI</span>
        <h2>Care for every beginning.</h2>
        <p>
          Signed in as {user.name} · {user.role}
        </p>
      </div>
      <div className="stats">
        {[
          ["Synthetic patients", data.patients.length],
          ["Appointments", data.appointments.length],
          [
            "Admitted",
            data.patients.filter((item) => item.status === "Admitted").length,
          ],
          [
            "Available rooms",
            data.rooms.filter((item) => !item.patient).length,
          ],
        ].map(([label, value]) => (
          <div className="stat" key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </>
  );
}

function Appointments({ data, role, act }) {
  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await act("addAppointment", {
      name: form.get("name"),
      service: form.get("service"),
      date: form.get("date"),
    });
    event.currentTarget.reset();
  }
  return (
    <>
      <h2>Appointments</h2>
      <DataTable
        headers={["Patient", "Service", "Date", "Status", "Action"]}
        rows={data.appointments.map((item) => ({
          key: item.id,
          cells: [
            item.name,
            item.service,
            item.date,
            item.status,
            ["Administrator", "Doctor", "Receptionist"].includes(role) &&
            item.status !== "Cancelled" ? (
              <button
                className="tiny"
                onClick={() =>
                  act("updateAppointment", {
                    id: item.id,
                    status:
                      item.status === "Pending" ? "Confirmed" : "Cancelled",
                  })
                }
              >
                {item.status === "Pending" ? "Confirm" : "Cancel"}
              </button>
            ) : (
              "—"
            ),
          ],
        }))}
      />
      <h3>Request synthetic appointment</h3>
      <form onSubmit={submit}>
        <label>
          Patient
          <input
            name="name"
            defaultValue={role === "Patient" ? "Mereani Sovaki" : ""}
            readOnly={role === "Patient"}
            required
          />
        </label>
        <label>
          Service
          <select name="service">
            <option>Antenatal</option>
            <option>Ultrasound</option>
            <option>Postnatal</option>
            <option>Delivery planning</option>
          </select>
        </label>
        <label>
          Date
          <input type="date" name="date" defaultValue="2026-10-27" required />
        </label>
        <button>Submit request</button>
      </form>
    </>
  );
}

function ClinicalCare({ data, role, act }) {
  const [selected, setSelected] = useState(data.patients[0]?.id || "");
  const patient =
    data.patients.find((item) => item.id === selected) || data.patients[0];
  const note = patient ? data.notes[patient.id] : null;
  const [text, setText] = useState(() => note?.text || "");
  if (!patient) return <p>No patient records are available for this role.</p>;
  return (
    <>
      <h2>Clinical Care</h2>
      <div className="warning">
        Synthetic records only. This prototype must not be used for clinical
        decisions.
      </div>
      <select
        value={patient.id}
        onChange={(event) => {
          const id = event.target.value;
          setSelected(id);
          setText(data.notes[id]?.text || "");
        }}
      >
        {data.patients.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
      <div className="panel">
        <h3>{patient.name}</h3>
        <p>
          {patient.weeks} weeks · {patient.status}
        </p>
      </div>
      <h3>Clinical note workflow</h3>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows="5"
        placeholder="Required synthetic note"
      />
      <p>
        State: <b>{note?.status || "Not started"}</b>
      </p>
      <button onClick={() => act("saveNote", { patientId: patient.id, text })}>
        Save draft
      </button>
      {["Administrator", "Doctor"].includes(role) ? (
        <button
          className="secondary-action"
          onClick={() => act("reviewNote", { patientId: patient.id })}
        >
          Review & lock state
        </button>
      ) : null}
    </>
  );
}

function Content({ page, data, user, act, audit, onNavigate }) {
  const role = user.role;
  if (page === "Dashboard") return <Dashboard data={data} user={user} act={act} onNavigate={onNavigate} />;
  if (page === "Ask My Midwife" && role === "Patient") return <AskMyMidwife data={data} act={act} />;
  if (page === "Patient Messages" && ["Administrator", "Doctor", "Midwife"].includes(role)) return <CarePodWorkspace data={data} user={user} act={act} />;
  if (page === "Journey" && role === "Patient")
    return (
      <>
        <h2 className="journey-title">My Pregnancy Journey</h2>
        <PatientDashboard care={data.carePod} onAsk={() => onNavigate("Ask My Midwife")} />
      </>
    );
  if (page === "Patients")
    return (
      <>
        <div className="heading">
          <h2>Patient Registry</h2>
          {["Administrator", "Receptionist"].includes(role) ? (
            <button onClick={() => act("addPatient", {})}>
              + Add synthetic patient
            </button>
          ) : null}
        </div>
        <DataTable
          headers={["ID", "Name", "Gestation", "Status"]}
          rows={data.patients.map((item) => ({
            key: item.id,
            cells: [item.id, item.name, `${item.weeks} weeks`, item.status],
          }))}
        />
      </>
    );
  if (page === "Appointments")
    return <Appointments data={data} role={role} act={act} />;
  if (page === "Clinical Care")
    return <ClinicalCare data={data} role={role} act={act} />;
  if (page === "Maternity Wards" && role === "Patient")
    return (
      <>
        <h2>My Maternity Ward</h2>
        <div className="patient-ward">
          <span>⌂</span>
          <div>
            <small>PLANNED BIRTH LOCATION</small>
            <h3>CWM Suva Maternity</h3>
            <p>
              Your ward is pre-allocated. A room assignment will be confirmed
              closer to admission.
            </p>
          </div>
        </div>
      </>
    );
  if (page === "Maternity Wards")
    return (
      <>
        <h2>Maternity Ward Board</h2>
        <div className="rooms">
          {data.rooms.map((room) => (
            <div className="panel" key={room.id}>
              <small>{room.id}</small>
              <h3>{room.patient ? "Occupied" : "Available"}</h3>
              <p>{room.patient || "Unassigned"}</p>
              {role !== "Doctor" ? (
                <button
                  className="tiny"
                  onClick={() => act("updateRoom", { id: room.id })}
                >
                  {room.patient ? "Clear" : "Assign synthetic occupant"}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </>
    );
  if (page === "Billing")
    return (
      <>
        <h2>Billing</h2>
        <p>Illustrative FJD values only.</p>
        <DataTable
          headers={["Invoice", "Patient", "Amount", "Status", "Action"]}
          rows={data.invoices.map((invoice) => ({
            key: invoice.id,
            cells: [
              invoice.id,
              invoice.name,
              `FJD ${invoice.amount.toLocaleString()}`,
              invoice.status,
              ["Administrator", "Finance"].includes(role) ? (
                <button
                  className="tiny"
                  onClick={() => act("updateInvoice", { id: invoice.id })}
                >
                  Advance status
                </button>
              ) : (
                "—"
              ),
            ],
          }))}
        />
      </>
    );
  if (page === "Staff")
    return (
      <>
        <h2>Team Directory</h2>
        <DataTable
          headers={["Staff", "Role", "Shift"]}
          rows={[
            ["Dr A. Kumar", "Obstetrician", "Day"],
            ["Dr L. Singh", "Obstetrician", "On-call"],
            ["Nurse M. Ratu", "Senior Midwife", "Day"],
            ["Nurse P. Devi", "Midwife", "Night"],
          ].map((cells) => ({ key: cells[0], cells }))}
        />
      </>
    );
  if (page === "Reports")
    return (
      <>
        <h2>Operational Reports</h2>
        <div className="stats">
          <div className="stat">
            <small>Appointments</small>
            <strong>{data.appointments.length}</strong>
          </div>
          <div className="stat">
            <small>Invoice total</small>
            <strong>
              FJD{" "}
              {data.invoices
                .reduce((sum, item) => sum + item.amount, 0)
                .toLocaleString()}
            </strong>
          </div>
        </div>
      </>
    );
  if (page === "Security")
    return (
      <>
        <h2>Security & Audit</h2>
        <div className="panel">
          <h3>Signed demo identity</h3>
          <p>
            {user.name} · {user.role}
          </p>
          <p className="mono">{user.id}</p>
        </div>
        <h3>Recent audit events</h3>
        {audit ? (
          <DataTable
            headers={["Time", "Actor", "Role", "Action", "Target", "Outcome"]}
            rows={audit.map((item) => ({
              key: item.id,
              cells: [
                new Date(item.at).toLocaleString(),
                item.actorName,
                item.role,
                item.action,
                item.target,
                item.outcome,
              ],
            }))}
          />
        ) : (
          <p>Loading audit events…</p>
        )}
      </>
    );
  return (
    <>
      <h2>Production-readiness gates</h2>
      {[
        [
          "Identity & RBAC",
          "Signed HTTP-only sessions plus server-side permission checks are implemented.",
        ],
        [
          "Durable storage",
          "Shared synthetic state and audit events are stored in Upstash Redis.",
        ],
        [
          "Clinical workflow",
          "Notes require content and move Draft → Reviewed; appointments use controlled transitions.",
        ],
        [
          "Still required",
          "Independent penetration testing, threat modelling, backups, privacy assessment, clinical governance, and regulatory review are required before any real-world use.",
        ],
      ].map(([title, copy]) => (
        <div className="panel" key={title}>
          <h3>{title}</h3>
          <p>{copy}</p>
        </div>
      ))}
    </>
  );
}

export default function BulaApp({ initialDemoRole = "admin" }) {
  const dataGeneration = useRef(0);
  const [user, setUser] = useState(null);
  const [data, setData] = useState(null);
  const [page, setPage] = useState("Dashboard");
  const [audit, setAudit] = useState(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const dismissSplash = useCallback(() => setShowSplash(false), []);
  const splashControls = (
    <>{showSplash ? <SplashScreen onDone={dismissSplash} /> : null}</>
  );

  useEffect(() => {
    let active = true;
    api("session")
      .then(async (session) => {
        if (!session.user) return { session, result: null };
        const result = await api("data");
        return { session, result };
      })
      .then(({ session, result }) => {
        if (!active) return;
        setUser(session.user);
        setData(result?.data || null);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (page === "Security" && user?.role === "Administrator")
      api("audit")
        .then((result) => setAudit(result.audit))
        .catch((error) => setStatus(error.message));
  }, [page, user?.role]);
  useEffect(() => {
    if (!user || !["Patient", "Administrator", "Doctor", "Midwife"].includes(user.role)) return undefined;
    let active = true;
    let pending = false;
    async function refresh() {
      if (document.visibilityState !== "visible" || pending) return;
      pending = true;
      const generation = dataGeneration.current;
      try { const result = await api("data"); if (active && generation === dataGeneration.current) setData(result.data); }
      catch { /* Preserve the last snapshot when offline; refresh never submits data. */ }
      finally { pending = false; }
    }
    const timer = window.setInterval(refresh, 15000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); window.removeEventListener("online", refresh); };
  }, [user]);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.body.classList.add("menu-open");
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.classList.remove("menu-open");
    };
  }, [menuOpen]);

  async function act(action, payload) {
    dataGeneration.current++;
    setStatus("");
    try {
      const result = await api("action", {
        method: "POST",
        body: JSON.stringify({ action, payload }),
      });
      dataGeneration.current++;
      setData(result.data);
      setStatus("Saved and recorded in the audit log.");
      return true;
    } catch (error) {
      dataGeneration.current++;
      setStatus(`Action rejected: ${error.message}`);
      return false;
    }
  }

  async function logout() {
    await api("logout", { method: "POST", body: "{}" });
    setUser(null);
    setData(null);
    setPage("Dashboard");
    setAudit(null);
    setMenuOpen(false);
  }

  if (loading)
    return (
      <>
        {splashControls}
        <div className="loading">Loading CareFiji…</div>
      </>
    );
  if (!user || !data)
    return (
      <>
        {splashControls}
        <Login
          initialUsername={initialDemoRole}
          onLogin={async (nextUser) => {
            setUser(nextUser);
            const result = await api("data");
            setData(result.data);
          }}
        />
      </>
    );
  const pages = navigation[user.role] || ["Dashboard"];
  const activePage = pages.includes(page) ? page : "Dashboard";
  const mobileTabs = (
    user.role === "Patient"
      ? ["Dashboard", "Ask My Midwife", "Appointments", "Maternity Wards"]
      : pages.includes("Patient Messages")
      ? ["Dashboard", "Patient Messages", "Patients", "Appointments"]
      : ["Dashboard", "Patients", "Appointments", "Maternity Wards"]
  ).filter((item) => pages.includes(item));
  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const choosePage = (nextPage) => {
    setPage(nextPage);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="shell">
      {splashControls}
      <div className="mobile-bar">
        <BrandLogo compact />
        <div className="mobile-actions">
          <span
            className="avatar online"
            aria-label={`Signed in as ${user.name}`}
          >
            {initials}
          </span>
          <button
            className="icon-button"
            aria-label="Open navigation"
            aria-controls="app-navigation"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <MenuIcon />
          </button>
        </div>
      </div>
      {menuOpen ? (
        <button
          className="menu-scrim"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}
      <aside
        id="app-navigation"
        className={menuOpen ? "menu-visible" : ""}
        role={menuOpen ? "dialog" : undefined}
        aria-modal={menuOpen || undefined}
        aria-label="Navigation menu"
      >
        <div className="drawer-head">
          <BrandLogo />
          <button
            className="icon-button drawer-close"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
          >
            <CloseIcon />
          </button>
        </div>
        <p className="sidecaption">SECURE DEMO WORKSPACE</p>
        <nav aria-label="Primary navigation">
          {pages.map((item) => (
            <button
              key={item}
              className={item === activePage ? "active" : ""}
              onClick={() => choosePage(item)}
            >
              {item}
            </button>
          ))}
        </nav>
        <a
          className="download-app"
          href={iosDownloadUrl}
          target="_blank"
          rel="noreferrer"
          onClick={() => setMenuOpen(false)}
        >
          <DownloadIcon />
          <span>
            <strong>Download App</strong>
            <small>iOS 15 or later</small>
          </span>
        </a>
        <button className="logout" onClick={logout}>
          Sign out
        </button>
        <div className="bottom">Suva, Fiji · Synthetic data only</div>
      </aside>
      <main className="dashboard-surface">
        <header>
          <div>
            <small>CAREFIJI / {activePage.toUpperCase()}</small>
            <h1>{activePage}</h1>
          </div>
          <div className="actions">
            <span>DEMO ONLY</span>
            <b>{user.role}</b>
          </div>
        </header>
        <section className="dashboard-content">
          <Content
            page={activePage}
            data={data}
            user={user}
            act={act}
            audit={audit}
            onNavigate={choosePage}
          />
          {status ? (
            <p className="status-message" role="status">
              {status}
            </p>
          ) : null}
          <p className="status">
            Authenticated prototype · no real patient information permitted.
            <br />
            Copyright @ BASA
          </p>
        </section>
      </main>
      <nav className="mobile-tabs" aria-label="Quick navigation">
        {mobileTabs.map((item) => {
          const active = item === activePage;
          const label =
            item === "Patient Messages" ? "Messages" : item === "Ask My Midwife" ? "Midwife" : item === "Appointments"
              ? "Appts"
              : item === "Maternity Wards"
                ? "Wards"
                : item;
          const count =
            item === "Patient Messages"
              ? (data.carePod?.threads.filter((thread) => thread.status === "Open").length || 0)
              : item === "Patients"
              ? data.patients.length
              : item === "Appointments"
                ? data.appointments.length
                : null;
          return (
            <button
              key={item}
              className={active ? "tab-active" : ""}
              aria-current={active ? "page" : undefined}
              onClick={() => choosePage(item)}
            >
              <span className="tab-icon">
                <TabIcon name={item} />
                {count !== null ? (
                  <span
                    className={`tab-badge ${item === "Appointments" ? "badge-alert" : ""}`}
                  >
                    {count}
                  </span>
                ) : null}
                {active ? <span className="tab-dot" /> : null}
              </span>
              <span>{label}</span>
            </button>
          );
        })}
        <button
          aria-expanded={menuOpen}
          aria-controls="app-navigation"
          onClick={() => setMenuOpen(true)}
        >
          <span className="tab-icon">
            <TabIcon name="Menu" />
          </span>
          <span>Menu</span>
        </button>
        <span className="home-indicator" aria-hidden="true" />
      </nav>
    </div>
  );
}
