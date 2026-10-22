"use client";

import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const CACHE_KEY = "carefiji-production-patient-cache-v1";

function configuredClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
}

function cachedPortal() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(window.localStorage.getItem(CACHE_KEY) || "null"); } catch { return null; }
}

export default function PatientPortal() {
  const [supabase] = useState(configuredClient);
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [data, setData] = useState(() => cachedPortal()?.data || null);
  const [cursor, setCursor] = useState(() => cachedPortal()?.cursor || "0");
  const [status, setStatus] = useState("Cached data available offline");

  const bootstrap = useCallback(async (accessToken) => {
    const response = await fetch("/api/mobile/v1/bootstrap", { cache: "no-store", headers: { Authorization: `Bearer ${accessToken}` } });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message || "Sync failed");
    setData(body.data); setCursor(body.cursor); setStatus(`Updated ${new Date(body.serverTime).toLocaleTimeString()}`);
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data: body.data, cursor: body.cursor }));
  }, []);

  const sync = useCallback(async (accessToken) => {
    if (!navigator.onLine) { setStatus("Offline · showing saved information"); return; }
    try {
      const response = await fetch(`/api/mobile/v1/sync?cursor=${encodeURIComponent(cursor)}`, { cache: "no-store", headers: { Authorization: `Bearer ${accessToken}` } });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "Sync failed");
      if (body.changes.length) await bootstrap(accessToken);
      else { setCursor(body.cursor); setStatus(`Updated ${new Date(body.serverTime).toLocaleTimeString()}`); }
    } catch (error) { setStatus(error.message); }
  }, [bootstrap, cursor]);

  useEffect(() => {
    if (!supabase) return undefined;
    supabase.auth.getSession().then(({ data: value }) => setSession(value.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, value) => setSession(value));
    return () => listener.subscription.unsubscribe();
  }, [supabase]);
  useEffect(() => {
    if (!session) return undefined;
    const initial = window.setTimeout(() => bootstrap(session.access_token).catch((error) => setStatus(error.message)), 0);
    const timer = window.setInterval(() => sync(session.access_token), 180000);
    const resume = () => { if (document.visibilityState === "visible") sync(session.access_token); };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); document.removeEventListener("visibilitychange", resume); window.removeEventListener("online", resume); };
  }, [bootstrap, session, sync]);

  async function requestCode(event) {
    event.preventDefault(); setStatus("Sending verification code…");
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (error) setStatus(error.message); else { setSent(true); setStatus("Check your registered email"); }
  }
  async function verify(event) {
    event.preventDefault(); setStatus("Verifying…");
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    if (error) setStatus(error.message);
  }
  async function command(type, payload = {}) {
    if (!session || !navigator.onLine) { setStatus("This action needs a connection in the web portal. The iOS app can queue it offline."); return; }
    const response = await fetch("/api/mobile/v1/commands", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ id: crypto.randomUUID(), type, payload, deviceTimestamp: new Date().toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }) });
    const body = await response.json();
    if (!response.ok) setStatus(body.error?.message || "Action failed"); else await bootstrap(session.access_token);
  }

  if (!supabase) return <main className="portal-page"><div className="portal-card"><h1>Patient portal setup required</h1><p>Add the Supabase public URL and anon key in Vercel, then redeploy from GitHub.</p></div></main>;
  if (!session) return <main className="portal-page"><form className="portal-card" onSubmit={sent ? verify : requestCode}><div className="brand brand-dark"><span className="mark">✚</span><span><strong>CareFiji</strong><small>BULA MATERNITY</small></span></div><h1>Patient sign in</h1><p>Use the verified email registered to your CareFiji record.</p><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>{sent ? <label>Six-digit code<input inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} required /></label> : null}<button>{sent ? "Verify and sign in" : "Send verification code"}</button><p role="status">{status}</p></form></main>;

  const profile = data?.profiles?.[0]; const pregnancy = data?.pregnancies?.[0]; const kickCount = data?.kick_events?.length || 0;
  return <main className="portal-page"><div className="portal-shell"><header className="portal-header"><div className="brand brand-dark"><span className="mark">✚</span><span><strong>CareFiji</strong><small>BULA MATERNITY</small></span></div><button onClick={() => supabase.auth.signOut()}>Sign out</button></header><p className="portal-sync" role="status">● {navigator.onLine ? "Online" : "Offline"} · {status}</p><section><h1>Bula Vinaka, {profile?.full_name?.split(" ")[0] || "Mere"}! 🌺</h1><div className="day-card"><div className="day-meta"><span>✦ LIVE PREGNANCY JOURNEY</span><b>Patient portal</b></div><div className="day-number">{pregnancy ? new Date(`${pregnancy.expected_due_date}T00:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "Due date pending"}</div><p>Expected due date · securely synchronized with your care team</p><div className="baby-snapshot"><span className="baby-emoji">🧡</span><div><small>BABY MOVEMENT LOG</small><strong>{kickCount} kicks recorded</strong></div><div className="kick-wrap"><button onClick={() => command("log_kick")}>♥ Log Kick</button></div></div></div><div className="portal-actions"><button onClick={() => sync(session.access_token)}>Refresh information</button><Link href="/">Open demonstration workspace</Link></div></section></div></main>;
}
