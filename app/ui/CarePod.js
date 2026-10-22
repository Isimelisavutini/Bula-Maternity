"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  careCategories,
  coveringMidwife,
  safetyFlags,
} from "../../lib/care-pod-domain";

const guidance = {
  "Baby Kicks": {
    title: "Your baby’s usual pattern matters",
    text: "If movements are reduced, different, or have stopped, contact your maternity unit promptly. Do not wait for a chat reply or use a kick count to delay contacting care.",
  },
  "Pain/Cramps": {
    title: "Tell us how it feels",
    text: "Tell the midwife where the discomfort is, when it began, and whether it comes and goes. Severe or persistent pain, bleeding, fever, or feeling very unwell needs prompt assessment.",
  },
  "Food/Herbs": {
    title: "Ask before using herbal remedies",
    text: "Share the ingredient and amount you are considering. Avoid alcohol and seek individual advice before using concentrated herbal remedies or supplements during pregnancy.",
  },
  Discharge: {
    title: "Describe any changes",
    text: "Tell your midwife about the color, smell, itching, or soreness. Fluid leaking, bleeding, fever, or pain needs prompt maternity advice rather than waiting in chat.",
  },
  Vitamins: {
    title: "Bring your supplement questions",
    text: "Share the name and dose from the label. Follow your care team’s advice and check before starting, stopping, or combining supplements.",
  },
  "Emotional Support": {
    title: "You can ask for support",
    text: "Tell us how you have been feeling and what support you have nearby. If you feel unsafe or might harm yourself, seek immediate help from emergency services and someone you trust.",
  },
  General: {
    title: "A question is always welcome",
    text: "Your pod can help with routine pregnancy questions. If you feel unwell or something feels urgent, contact your maternity unit directly.",
  },
};
const macros = [
  [
    "Ask for context",
    "Bula mama, thank you for reaching out. When did this start, and has anything changed since your message?",
  ],
  [
    "Arrange a review",
    "Thank you for explaining. I would like us to arrange an in-person review. Please check Appointments for the booking details.",
  ],
  [
    "Herbs & supplements",
    "Please share the ingredient name and label. Check with your maternity clinician before using concentrated herbs or adding supplements.",
  ],
  [
    "Hospital bag",
    "For your hospital bag, ask your maternity unit about its local checklist. Usual essentials include your antenatal record, comfortable clothing, toiletries, and baby clothes.",
  ],
];
const when = (value) =>
  new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

function EmergencyBar({ expanded = false }) {
  const phone = process.env.NEXT_PUBLIC_MATERNITY_TRIAGE_PHONE;
  const validPhone = /^\+?[\d ()-]{5,24}$/.test(phone || "");
  return (
    <div
      className={`care-emergency ${expanded ? "care-emergency-expanded" : ""}`}
      role={expanded ? "alert" : undefined}
    >
      <details open={expanded}>
        <summary>
          In pain, bleeding, or worried about movements? Get urgent help.
        </summary>
        <p>Do not wait for a text reply. Contact maternity care now.</p>
        <div className="care-inline-actions">
          {validPhone ? (
            <a
              className="care-call"
              href={`tel:${phone.replace(/[ ()-]/g, "")}`}
            >
              Call maternity triage
            </a>
          ) : (
            <span>
              Ward number not configured. Use your maternity contact or local
              emergency service.
            </span>
          )}
          <a
            href="https://www.google.com/maps/dir/?api=1&destination=Colonial+War+Memorial+Hospital+Suva+Fiji"
            target="_blank"
            rel="noreferrer"
          >
            Directions to CWM Suva
          </a>
        </div>
      </details>
    </div>
  );
}

function MidwifeAvatar({ midwife, size = 60 }) {
  return (
    <Image
      className="care-avatar"
      src={midwife.image}
      alt={`${midwife.name}, synthetic demo profile`}
      width={size}
      height={size}
      sizes={`${size}px`}
    />
  );
}

export function MyMidwifeCard({ care, onOpen }) {
  const [greetingError, setGreetingError] = useState("");
  useEffect(
    () => () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    },
    [],
  );
  if (!care) return null;
  const assignment = care.assignments[0];
  const primary = care.midwives.find((m) => m.id === assignment?.primaryId);
  const covering = coveringMidwife(care, assignment);
  if (!primary)
    return (
      <article className="care-welcome">
        <h3>Your care pod</h3>
        <p>Your care team will confirm your primary midwife at booking.</p>
      </article>
    );
  function listen() {
    if (!("speechSynthesis" in window)) {
      setGreetingError("Audio welcome is unavailable on this device.");
      return;
    }
    window.speechSynthesis.cancel();
    const welcome = new SpeechSynthesisUtterance(primary.welcome);
    welcome.lang = "en";
    welcome.rate = 0.9;
    window.speechSynthesis.speak(welcome);
  }
  return (
    <article className="care-welcome">
      <div className="care-welcome-main">
        <MidwifeAvatar midwife={primary} />
        <div>
          <small>MY MIDWIFE · SUVA CARE POD</small>
          <h3>{primary.name}</h3>
          <p>{primary.credentials}</p>
          <p>Clinic: {primary.clinicDays}</p>
        </div>
      </div>
      <p className="care-coverage">
        <i className={covering ? "care-online" : "care-offline"} />
        {covering?.id === primary.id
          ? `${primary.name} is on duty`
          : covering
            ? `${primary.name} is ${primary.status.toLowerCase()}. ${covering.name} is covering your pod.`
            : "Your pod is currently off duty. Routine questions remain queued; urgent concerns need direct contact."}
      </p>
      <div className="care-inline-actions">
        <button onClick={onOpen}>Ask a question</button>
        <button className="care-secondary" onClick={listen}>
          Listen to welcome
        </button>
      </div>
      {greetingError ? <p role="status">{greetingError}</p> : null}
      <small>Synthetic profiles · device-read welcome</small>
    </article>
  );
}

function VoiceRecorder({ audio, onChange }) {
  const [recording, setRecording] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const recorder = useRef(null);
  const stream = useRef(null);
  const timer = useRef(null);
  const chunks = useRef([]);
  const mounted = useRef(true);
  const starting = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearInterval(timer.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }
  async function start() {
    if (starting.current) return;
    setError("");
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError(
        "Voice recording is unavailable. You can type your question instead.",
      );
      return;
    }
    starting.current = true;
    setRequesting(true);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      if (!mounted.current) {
        stream.current.getTracks().forEach((t) => t.stop());
        return;
      }
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      recorder.current = new MediaRecorder(stream.current, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 32000,
      });
      chunks.current = [];
      recorder.current.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      recorder.current.onstop = async () => {
        clearInterval(timer.current);
        stream.current?.getTracks().forEach((t) => t.stop());
        if (!mounted.current) return;
        setRecording(false);
        const blob = new Blob(chunks.current, {
          type: recorder.current.mimeType,
        });
        if (blob.size > 250000) {
          setError(
            "This recording is too large. Please record a shorter note.",
          );
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          if (mounted.current) onChange(String(reader.result));
        };
        reader.readAsDataURL(blob);
      };
      recorder.current.start();
      setRecording(true);
      setSeconds(0);
      let elapsed = 0;
      timer.current = setInterval(() => {
        elapsed++;
        setSeconds(elapsed);
        if (elapsed >= 30) stop();
      }, 1000);
    } catch {
      stream.current?.getTracks().forEach((t) => t.stop());
      if (mounted.current)
        setError(
          "Microphone access was not granted. You can still type your message.",
        );
    } finally {
      starting.current = false;
      if (mounted.current) setRequesting(false);
    }
  }
  return (
    <div className="care-recorder">
      <button
        type="button"
        className={recording ? "care-recording" : "care-secondary"}
        onClick={recording ? stop : start}
        aria-pressed={recording}
        disabled={requesting}
      >
        {recording
          ? `Stop recording · ${seconds}s / 30s`
          : requesting
            ? "Waiting for microphone…"
            : "Record a voice note"}
      </button>
      {audio ? (
        <>
          <audio
            controls
            src={audio}
            preload="none"
            aria-label="Preview voice note"
          />
          <button
            type="button"
            className="care-secondary"
            onClick={() => onChange(null)}
          >
            Remove voice note
          </button>
        </>
      ) : null}
      {recording ? (
        <span role="status">Microphone active. Tap stop to finish.</span>
      ) : null}
      {error ? <p role="status">{error}</p> : null}
    </div>
  );
}

function Conversation({ thread }) {
  return (
    <div className="care-conversation" aria-label="Conversation messages">
      {thread.messages.map((message) => (
        <article
          key={message.id}
          className={
            message.senderRole === "Patient"
              ? "care-message care-from-patient"
              : "care-message"
          }
        >
          <div>
            <strong>{message.senderName}</strong>
            <time dateTime={message.at}>{when(message.at)}</time>
          </div>
          {message.text ? <p>{message.text}</p> : null}
          {message.audio ? (
            <audio
              controls
              src={message.audio}
              preload="none"
              aria-label={`Voice note from ${message.senderName}`}
            />
          ) : null}
        </article>
      ))}
    </div>
  );
}

export function AskMyMidwife({ data, act }) {
  const care = data.carePod;
  const [step, setStep] = useState("safety");
  const [flags, setFlags] = useState([]);
  const [category, setCategory] = useState("General");
  const [text, setText] = useState(() => {
    try {
      return typeof window !== "undefined"
        ? localStorage.getItem("carefiji-demo-care-draft") || ""
        : "";
    } catch {
      return "";
    }
  });
  const [audio, setAudio] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [article, setArticle] = useState(null);
  const [selected, setSelected] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [online, setOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  useEffect(() => {
    function update() {
      setOnline(navigator.onLine);
    }
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const thread = care?.threads.find((t) => t.id === selected);
  async function safety() {
    if (!flags.length) {
      setStep("compose");
      return;
    }
    setStep("emergency");
    setBusy(true);
    const saved = await act("raiseCareAlert", { flags });
    setBusy(false);
    setNotice(
      saved
        ? "Demo alert recorded in the pod queue. This does not call or dispatch a clinical service."
        : "The alert was not delivered. Contact maternity care directly now.",
    );
  }
  async function submit(event) {
    event.preventDefault();
    if (!online) {
      setNotice(
        "You’re offline. Save a text draft, then reconnect to send. Urgent concerns need direct contact.",
      );
      return;
    }
    setBusy(true);
    const saved = await act(
      replyTo ? "followupCareQuestion" : "submitCareQuestion",
      {
        threadId: replyTo,
        text,
        audio,
        category,
        safetyChecked: true,
      },
    );
    setBusy(false);
    if (saved) {
      setText("");
      setAudio(null);
      try {
        localStorage.removeItem("carefiji-demo-care-draft");
      } catch {}
      setStep("sent");
      setNotice(
        "Your question is in the demo pod queue. Check back here for replies.",
      );
    } else
      setNotice(
        "Your question was not sent. Your text and recording are still here; please try again.",
      );
  }
  if (!care) return <p>Your care pod is not available for this account.</p>;
  return (
    <div className="care-page">
      <div className="care-page-heading">
        <div>
          <small>YOUR CONTINUITY OF CARE</small>
          <h2>Ask my midwife</h2>
          <p>A familiar team, one shared conversation.</p>
        </div>
        <span className="care-demo-label">Synthetic demo</span>
      </div>
      <EmergencyBar expanded={step === "emergency"} />
      <MyMidwifeCard
        care={care}
        onOpen={() => {
          setStep("safety");
          setSelected(null);
          setReplyTo(null);
        }}
      />
      <div className="care-knowledge">
        <h3>A little guidance, when you need it</h3>
        <div className="care-chips">
          {[
            ["Baby Kicks", "Kick help"],
            ["Food/Herbs", "Foods & herbs"],
            ["Pain/Cramps", "Cramps & tightening"],
            ["Discharge", "Discharge guide"],
          ].map(([topic, label]) => (
            <button
              className="care-secondary"
              key={topic}
              onClick={() => setArticle(topic)}
            >
              {label}
            </button>
          ))}
        </div>
        {article ? (
          <div className="care-guidance">
            <h4>{guidance[article].title}</h4>
            <p>{guidance[article].text}</p>
            <small>
              General demo information, not an individual clinical assessment.
            </small>
          </div>
        ) : null}
      </div>
      {step === "safety" ? (
        <section className="care-panel">
          <h3>First, a quick safety check</h3>
          <p>Are you having any of these right now? Select all that apply.</p>
          <fieldset>
            <legend className="care-sr-only">Urgent symptoms</legend>
            {safetyFlags.map((flag) => (
              <label className="care-check" key={flag}>
                <input
                  type="checkbox"
                  checked={flags.includes(flag)}
                  onChange={(event) =>
                    setFlags((value) =>
                      event.target.checked
                        ? [...value, flag]
                        : value.filter((f) => f !== flag),
                    )
                  }
                />
                {flag}
              </label>
            ))}
          </fieldset>
          <button onClick={safety} disabled={busy}>
            {flags.length
              ? "Get urgent contact options"
              : "None of these — continue"}
          </button>
        </section>
      ) : null}
      {step === "emergency" ? (
        <section className="care-panel">
          <h3>Get help now</h3>
          <p>
            The symptom check cannot diagnose you. Please contact maternity care
            directly; do not wait for this queue.
          </p>
          <button
            className="care-secondary"
            onClick={() => {
              setFlags([]);
              setStep("safety");
            }}
          >
            Review safety check
          </button>
        </section>
      ) : null}
      {step === "compose" ? (
        <section className="care-panel">
          <h3>What would you like to ask?</h3>
          <form className="care-form" onSubmit={submit}>
            <label>
              Topic
              <select
                aria-label="Topic"
                value={category}
                disabled={Boolean(replyTo)}
                onChange={(event) => setCategory(event.target.value)}
              >
                {careCategories.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <div className="care-guidance">
              <strong>{guidance[category].title}</strong>
              <p>{guidance[category].text}</p>
            </div>
            <label>
              Your question
              <textarea
                aria-label="Your question"
                maxLength={2000}
                rows={4}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Type in English, iTaukei, or Hindi…"
              />
            </label>
            <VoiceRecorder audio={audio} onChange={setAudio} />
            <small>
              Your record’s gestation ({data.patients[0]?.weeks || "—"} weeks)
              is attached when sent. No background recording.
            </small>
            <div className="care-inline-actions">
              <button disabled={busy || (!text.trim() && !audio) || !online}>
                {busy ? "Sending…" : "Send to my pod"}
              </button>
              <button
                type="button"
                className="care-secondary"
                onClick={() => {
                  try {
                    localStorage.setItem("carefiji-demo-care-draft", text);
                    setNotice(
                      "Text draft saved on this device. It has not been sent.",
                    );
                  } catch {
                    setNotice("Draft could not be saved on this device.");
                  }
                }}
              >
                Save text draft
              </button>
            </div>
          </form>
        </section>
      ) : null}
      {notice ? (
        <p className="care-notice" role="status">
          {notice}
        </p>
      ) : null}
      {step === "sent" ? (
        <button
          className="care-secondary"
          onClick={() => {
            setFlags([]);
            setReplyTo(null);
            setStep("safety");
          }}
        >
          Ask another question
        </button>
      ) : null}
      <section className="care-panel">
        <h3>Your conversations</h3>
        <p>
          Response targets are demo estimates during staffed hours, not a
          monitored emergency service.
        </p>
        {care.threads.length ? (
          <div className="care-thread-list">
            {[...care.threads].reverse().map((item) => (
              <button
                className={`care-thread ${selected === item.id ? "care-selected" : ""}`}
                key={item.id}
                onClick={() => setSelected(item.id)}
              >
                <strong>{item.category}</strong>
                <span>
                  {item.status} · {when(item.createdAt)}
                </span>
                <small>{item.messages.at(-1)?.text || "Voice message"}</small>
              </button>
            ))}
          </div>
        ) : (
          <p>No questions yet. Your messages and replies will appear here.</p>
        )}
        {thread ? (
          <>
            <Conversation thread={thread} />
            {thread.status !== "Closed" ? (
              <button
                className="care-secondary"
                onClick={() => {
                  setReplyTo(thread.id);
                  setCategory(thread.category);
                  setFlags([]);
                  setStep("safety");
                  setNotice(
                    "Complete the safety check before sending a follow-up.",
                  );
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                Continue conversation
              </button>
            ) : (
              <p>
                This conversation is closed. Start a new question if you need
                more support.
              </p>
            )}
          </>
        ) : null}
      </section>
    </div>
  );
}

export function CarePodWorkspace({ data, user, act }) {
  const care = data.carePod;
  const [filter, setFilter] = useState("Open");
  const [selected, setSelected] = useState(null);
  const [reply, setReply] = useState("");
  const [audio, setAudio] = useState(null);
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState("");
  const [notice, setNotice] = useState("");
  const [patientId, setPatientId] = useState(data.patients[0]?.id || "");
  const [primaryId, setPrimaryId] = useState("demo-midwife");
  if (!care) return <p>Care-pod access is not available for this role.</p>;
  const thread = care.threads.find((t) => t.id === selected);
  const queue = care.threads
    .filter(
      (t) =>
        filter === "All" ||
        (filter === "Open" ? t.status === "Open" : t.priority === filter),
    )
    .sort(
      (a, b) =>
        (a.priority === "Attention" ? 0 : 1) -
          (b.priority === "Attention" ? 0 : 1) ||
        new Date(a.dueAt) - new Date(b.dueAt),
    );
  async function send(event) {
    event.preventDefault();
    setBusy(true);
    const saved = await act("replyCareQuestion", {
      threadId: thread.id,
      text: reply,
      audio,
    });
    setBusy(false);
    if (saved) {
      setReply("");
      setAudio(null);
      setNotice("Reply sent to the patient conversation.");
    } else setNotice("Reply was not sent. Your draft remains available.");
  }
  return (
    <div className="care-page">
      <div className="care-page-heading">
        <div>
          <small>CONTINUITY OF CARER</small>
          <h2>Care pod workspace</h2>
          <p>Suva pod · shared coverage, clear handovers.</p>
        </div>
        <span className="care-demo-label">Synthetic demo</span>
      </div>
      <p className="care-notice">
        Queue refreshes every 15 seconds while visible. Alerts stay in this
        demo; no external notification or emergency dispatch is connected.
      </p>
      <div className="care-roster">
        {care.midwives.map((midwife) => (
          <article className="care-roster-card" key={midwife.id}>
            <MidwifeAvatar midwife={midwife} size={52} />
            <h3>{midwife.name}</h3>
            <p>{midwife.credentials}</p>
            <p>{midwife.clinicDays}</p>
            {user.role === "Administrator" || user.id === midwife.id ? (
              <label>
                Duty status
                <select
                  aria-label={`Duty status for ${midwife.name}`}
                  value={midwife.status}
                  onChange={(event) =>
                    act("setMidwifeStatus", {
                      midwifeId: midwife.id,
                      status: event.target.value,
                    })
                  }
                >
                  {["On Duty", "In Clinic", "In Delivery", "Off Duty"].map(
                    (status) => (
                      <option key={status}>{status}</option>
                    ),
                  )}
                </select>
              </label>
            ) : (
              <strong>{midwife.status}</strong>
            )}
          </article>
        ))}
      </div>
      {care.alerts.some((a) => !a.acknowledgedAt) ? (
        <section className="care-alert-queue" aria-label="Urgent care alerts">
          <h3>Urgent safety alerts</h3>
          {care.alerts
            .filter((a) => !a.acknowledgedAt)
            .map((alert) => (
              <article key={alert.id}>
                <strong>
                  {data.patients.find((p) => p.id === alert.patientId)?.name ||
                    alert.patientId}
                </strong>
                <p>{alert.flags.join(" · ")}</p>
                <small>{when(alert.createdAt)}</small>
                <button
                  onClick={() =>
                    act("acknowledgeCareAlert", { alertId: alert.id })
                  }
                >
                  Acknowledge alert
                </button>
                <p>
                  Acknowledge records review; it does not confirm contact or
                  resolution.
                </p>
              </article>
            ))}
        </section>
      ) : null}
      {user.role !== "Doctor" ? (
        <details className="care-panel">
          <summary>Booking assignment & care-pod pairing</summary>
          <form
            className="care-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const saved = await act("assignCarePod", {
                patientId,
                podId: "suva-pod",
                primaryId,
              });
              setNotice(
                saved
                  ? "Care-pod assignment updated."
                  : "Assignment was not saved.",
              );
            }}
          >
            <label>
              Patient
              <select
                value={patientId}
                onChange={(event) => setPatientId(event.target.value)}
              >
                {data.patients.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name} · {p.weeks} weeks
                  </option>
                ))}
              </select>
            </label>
            <label>
              Primary midwife
              <select
                value={primaryId}
                onChange={(event) => setPrimaryId(event.target.value)}
              >
                {care.midwives.map((m) => (
                  <option value={m.id} key={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <p>
              Pod: Suva · CWM clinic. Pairing is confirmed by staff at booking.
            </p>
            <button>Save assignment</button>
          </form>
        </details>
      ) : null}
      <div className="care-workspace">
        <section className="care-panel care-inbox">
          <h3>Shared in-tray</h3>
          <div className="care-chips">
            {["Open", "Attention", "Routine", "All"].map((item) => (
              <button
                className={filter === item ? "" : "care-secondary"}
                onClick={() => setFilter(item)}
                key={item}
              >
                {item}
              </button>
            ))}
          </div>
          {queue.length ? (
            queue.map((item) => (
              <button
                className={`care-thread ${item.priority === "Attention" ? "care-attention" : ""} ${selected === item.id ? "care-selected" : ""}`}
                key={item.id}
                onClick={() => {
                  setSelected(item.id);
                  setReply("");
                  setAudio(null);
                }}
              >
                <strong>{item.patientName}</strong>
                <span>
                  {item.category} · {item.gestationWeek} weeks · {item.status}
                </span>
                <small>
                  Cover:{" "}
                  {care.midwives.find((m) => m.id === item.assignedTo)?.name ||
                    "Unassigned — no on-duty cover"}
                </small>
                <small>
                  Target: {when(item.dueAt)}
                  {new Date(item.dueAt) < new Date() && item.status === "Open"
                    ? " · overdue"
                    : ""}
                </small>
              </button>
            ))
          ) : (
            <p>No conversations in this view.</p>
          )}
        </section>
        <section className="care-panel care-response">
          {thread ? (
            <>
              <h3>{thread.patientName}</h3>
              <p>
                {thread.category} · Week {thread.gestationWeek} ·{" "}
                {thread.status}
              </p>
              <Conversation thread={thread} />
              {thread.status !== "Closed" ? (
                <>
                  <h4>Draft responses — review before sending</h4>
                  <div className="care-chips">
                    {macros.map(([label, content]) => (
                      <button
                        className="care-secondary"
                        key={label}
                        onClick={() => setReply(content)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <form className="care-form" onSubmit={send}>
                    <label>
                      Reply
                      <textarea
                        aria-label="Reply"
                        rows={4}
                        maxLength={2000}
                        value={reply}
                        onChange={(event) => setReply(event.target.value)}
                      />
                    </label>
                    <VoiceRecorder
                      key={thread.id}
                      audio={audio}
                      onChange={setAudio}
                    />
                    <button disabled={busy || (!reply.trim() && !audio)}>
                      {busy ? "Sending…" : "Send reply"}
                    </button>
                  </form>
                  <div className="care-booking">
                    <label>
                      Antenatal appointment date
                      <input
                        aria-label="Antenatal appointment date"
                        type="date"
                        value={date}
                        onChange={(event) => setDate(event.target.value)}
                      />
                    </label>
                    <button
                      className="care-secondary"
                      disabled={!date}
                      onClick={async () => {
                        const saved = await act("bookCareAppointment", {
                          threadId: thread.id,
                          date,
                        });
                        setNotice(
                          saved
                            ? "Appointment request added to Appointments."
                            : "Appointment was not saved.",
                        );
                      }}
                    >
                      Request appointment
                    </button>
                    <button
                      className="care-secondary"
                      onClick={() =>
                        act("closeCareQuestion", { threadId: thread.id })
                      }
                    >
                      Close conversation
                    </button>
                  </div>
                </>
              ) : (
                <p>This conversation is closed.</p>
              )}
            </>
          ) : (
            <div className="care-empty">
              <h3>One pod. A familiar team.</h3>
              <p>
                Select a conversation to read the mother’s question, hear her
                voice note, and respond.
              </p>
            </div>
          )}
        </section>
      </div>
      {notice ? (
        <p className="care-notice" role="status">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
