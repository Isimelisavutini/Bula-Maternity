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
    return structuredClone(memory);
  }
  const redis = client();
  const existing = await redis.get(KEY);
  if (existing) return existing;
  await redis.set(KEY, seed, { nx: true });
  return (await redis.get(KEY)) || structuredClone(seed);
}

export async function transactData(mutate) {
  if (!configured()) {
    const result = mutate(structuredClone(memory));
    memory = structuredClone(result.data);
    return result;
  }
  const redis = Redis.fromEnv({ automaticDeserialization: false });
  const script = "if redis.call('GET',KEYS[1]) == ARGV[1] then redis.call('SET',KEYS[1],ARGV[2]); return 1 else return 0 end";
  for (let attempt = 0; attempt < 8; attempt++) {
    let raw = await redis.get(KEY);
    if (raw === null) { await redis.set(KEY, JSON.stringify(seed), { nx: true }); raw = await redis.get(KEY); }
    if (typeof raw !== "string") throw new Error("TEMPORARY_UNAVAILABLE");
    const result = mutate(JSON.parse(raw));
    if (await redis.eval(script, [KEY], [raw, JSON.stringify(result.data)]) === 1) return result;
    await new Promise(resolve => setTimeout(resolve, 10 * (attempt + 1)));
  }
  throw new Error("TEMPORARY_UNAVAILABLE");
}
