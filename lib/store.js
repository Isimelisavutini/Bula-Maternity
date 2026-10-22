import "server-only";
import { Redis } from "@upstash/redis";
import { seed } from "./domain";

const KEY = "carefiji:bula-maternity:v1";
let memory = structuredClone(seed);

function configured() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function client() {
  return Redis.fromEnv();
}

export async function readData() {
  if (!configured()) {
    if (process.env.NODE_ENV === "production") throw new Error("REDIS_NOT_CONFIGURED");
    return structuredClone(memory);
  }
  const redis = client();
  const existing = await redis.get(KEY);
  if (existing) return existing;
  await redis.set(KEY, seed, { nx: true });
  return (await redis.get(KEY)) || structuredClone(seed);
}

export async function writeData(data) {
  if (!configured()) {
    if (process.env.NODE_ENV === "production") throw new Error("REDIS_NOT_CONFIGURED");
    memory = structuredClone(data);
    return;
  }
  await client().set(KEY, data);
}
