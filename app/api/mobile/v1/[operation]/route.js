import { NextResponse } from "next/server";
import { authenticatedMobileClient } from "../../../../../lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const entities = ["profiles", "pregnancies", "appointments", "kick_events", "ward_allocations", "consent_records"];

function json(body, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function apiError(code, message, status, retryable = false) {
  return json({ error: { code, message, retryable } }, status);
}

function translateError(error) {
  const message = String(error?.message || error || "UNKNOWN_ERROR");
  if (message === "AUTH_REQUIRED" || message === "AUTH_EXPIRED") return apiError(message, "Sign in again to continue.", 401);
  if (message === "SUPABASE_NOT_CONFIGURED") return apiError(message, "Production data service is not configured.", 503, true);
  if (message.includes("STALE_REVISION")) return apiError("STALE_REVISION", "This record changed on another device.", 409);
  if (message.includes("PERMISSION_DENIED") || message.includes("row-level security")) return apiError("PERMISSION_DENIED", "This account cannot access that record.", 403);
  if (message.includes("VALIDATION_FAILED")) return apiError("VALIDATION_FAILED", "The submitted information is invalid.", 400);
  return apiError("TEMPORARY_UNAVAILABLE", "The service is temporarily unavailable.", 503, true);
}

async function bootstrap(request) {
  const { supabase } = await authenticatedMobileClient(request);
  const results = await Promise.all(entities.map(async (entity) => {
    const { data, error } = await supabase.from(entity).select("*").is("deleted_at", null);
    if (error) throw error;
    return [entity, data];
  }));
  const { data: cursorRows, error: cursorError } = await supabase.from("sync_changes").select("sequence").order("sequence", { ascending: false }).limit(1);
  if (cursorError) throw cursorError;
  return json({ data: Object.fromEntries(results), cursor: String(cursorRows?.[0]?.sequence || 0), serverTime: new Date().toISOString() });
}

async function sync(request) {
  const { supabase } = await authenticatedMobileClient(request);
  const cursor = new URL(request.url).searchParams.get("cursor") || "0";
  if (!/^\d+$/.test(cursor)) return apiError("VALIDATION_FAILED", "Cursor must be numeric.", 400);
  const { data, error } = await supabase.from("sync_changes").select("sequence,entity_type,entity_id,operation,payload,changed_at").gt("sequence", cursor).order("sequence").limit(500);
  if (error) throw error;
  return json({ changes: data || [], cursor: String(data?.at(-1)?.sequence || cursor), hasMore: (data?.length || 0) === 500, serverTime: new Date().toISOString() });
}

async function commands(request) {
  const { supabase } = await authenticatedMobileClient(request);
  const body = await request.json();
  if (!body?.id || !body?.type || !body?.deviceTimestamp || !body?.timezone) return apiError("VALIDATION_FAILED", "Command metadata is incomplete.", 400);
  const { data, error } = await supabase.rpc("process_mobile_command", {
    p_command_id: body.id,
    p_command_type: body.type,
    p_payload: body.payload || {},
    p_device_timestamp: body.deviceTimestamp,
    p_timezone: body.timezone,
    p_base_revision: body.baseRevision ?? null
  });
  if (error) throw error;
  if (data?.accepted === false) {
    const code = data.error || "VALIDATION_FAILED";
    return apiError(code, code === "TEMPORARY_UNAVAILABLE" ? "The command could not be processed yet." : "The submitted information is invalid.", code === "TEMPORARY_UNAVAILABLE" ? 503 : 400, code === "TEMPORARY_UNAVAILABLE");
  }
  return json({ result: data, serverTime: new Date().toISOString() });
}

export async function GET(request, { params }) {
  try {
    const operation = (await params).operation;
    if (operation === "bootstrap") return await bootstrap(request);
    if (operation === "sync") return await sync(request);
    return apiError("NOT_FOUND", "Unknown mobile operation.", 404);
  } catch (error) {
    return translateError(error);
  }
}

export async function POST(request, { params }) {
  try {
    if ((await params).operation === "commands") return await commands(request);
    return apiError("NOT_FOUND", "Unknown mobile operation.", 404);
  } catch (error) {
    return translateError(error);
  }
}
