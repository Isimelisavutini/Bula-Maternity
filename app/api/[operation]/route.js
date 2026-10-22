import { NextResponse } from "next/server";
import { applyAction, demoUsers, requirePermission, viewForRole } from "../../../lib/domain";
import { clearSession, createSession, readSession } from "../../../lib/session";
import { readData, writeData } from "../../../lib/store";

export const runtime = "nodejs";

function response(body, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function errorStatus(message) {
  if (message === "SIGN_IN_REQUIRED") return 401;
  if (message.startsWith("PERMISSION_DENIED")) return 403;
  if (["VALIDATION_FAILED", "INVALID_TRANSITION", "DRAFT_REQUIRED", "UNKNOWN_ACTION"].includes(message)) return 400;
  if (message === "NOT_FOUND") return 404;
  return 500;
}

async function userRequired() {
  const user = await readSession();
  if (!user) throw new Error("SIGN_IN_REQUIRED");
  return user;
}

async function handleGet(operation) {
  if (operation === "session") return response({ user: await readSession() });
  const user = await userRequired();
  const data = await readData();
  if (operation === "data") {
    requirePermission(user, "read");
    return response({ data: viewForRole(data, user.role) });
  }
  if (operation === "audit") {
    requirePermission(user, "audit.read");
    return response({ audit: data.audit.slice(-100).reverse() });
  }
  return response({ error: "NOT_FOUND" }, 404);
}

async function handlePost(operation, request) {
  if (operation === "login") {
    const { username, password } = await request.json();
    const candidate = demoUsers[String(username || "").toLowerCase()];
    if (!candidate || candidate.password !== password) return response({ error: "INVALID_CREDENTIALS" }, 401);
    const user = { id: candidate.id, name: candidate.name, role: candidate.role };
    await createSession(user);
    return response({ user });
  }
  if (operation === "logout") {
    await clearSession();
    return response({ ok: true });
  }
  if (operation === "action") {
    const user = await userRequired();
    const { action, payload = {} } = await request.json();
    const data = await readData();
    try {
      const { next, target } = applyAction(data, user, action, payload);
      next.audit.push({ id: crypto.randomUUID(), at: new Date().toISOString(), actor: user.id, actorName: user.name, role: user.role, action, target, outcome: "success" });
      next.audit = next.audit.slice(-1000);
      await writeData(next);
      return response({ data: viewForRole(next, user.role) });
    } catch (error) {
      data.audit.push({ id: crypto.randomUUID(), at: new Date().toISOString(), actor: user.id, actorName: user.name, role: user.role, action, target: "unknown", outcome: `rejected:${error.message}` });
      data.audit = data.audit.slice(-1000);
      await writeData(data);
      throw error;
    }
  }
  return response({ error: "NOT_FOUND" }, 404);
}

export async function GET(_request, { params }) {
  try {
    return await handleGet((await params).operation);
  } catch (error) {
    return response({ error: error.message }, errorStatus(error.message));
  }
}

export async function POST(request, { params }) {
  try {
    return await handlePost((await params).operation, request);
  } catch (error) {
    return response({ error: error.message }, errorStatus(error.message));
  }
}
