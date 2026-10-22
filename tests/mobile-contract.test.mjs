import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sql = await readFile(new URL("../supabase/migrations/202610220001_mobile_sync.sql", import.meta.url), "utf8");
const route = await readFile(new URL("../app/api/mobile/v1/[operation]/route.js", import.meta.url), "utf8");

test("mobile schema enables RLS for every patient data table", () => {
  for (const table of ["profiles", "pregnancies", "appointments", "kick_events", "ward_allocations", "devices", "consent_records", "mobile_commands", "audit_events", "sync_changes"]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
  }
});

test("sync schema indexes patient cursor and append-only events", () => {
  assert.match(sql, /sync_changes_patient_sequence_idx.*patient_id, sequence/);
  assert.match(sql, /kick_events_patient_occurred_idx.*patient_id, occurred_at/);
  assert.match(sql, /p_command_id uuid/);
  assert.match(sql, /on conflict \(id\) do nothing/);
});

test("mobile API exposes typed bootstrap, sync, and command operations", () => {
  assert.match(route, /operation === "bootstrap"/);
  assert.match(route, /operation === "sync"/);
  assert.match(route, /operation === "commands"/);
  assert.match(route, /STALE_REVISION/);
  assert.match(route, /TEMPORARY_UNAVAILABLE/);
});
