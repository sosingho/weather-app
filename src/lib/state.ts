import { Redis } from "@upstash/redis";
import { getRedisConfig, maskValue, requireRedisConfig } from "./config";
import type { WarningState } from "./weather";

export type LastCheckRecord = {
  ok: boolean;
  checkedAt: string;
  trigger: string;
  activeWarningCount: number;
  eventsFound: number;
  eventsSent: number;
  initialized: boolean;
  skippedReason?: string;
  error?: string;
};

export type LastSendRecord = {
  sentAt: string;
  eventId: string;
  eventType: string;
  warningName: string;
  provider: "meta-whatsapp-cloud";
  dryRun: boolean;
  recipient: string;
  messageId?: string;
};

export type StoredNotifierSnapshot = {
  lastState: WarningState | null;
  lastCheck: LastCheckRecord | null;
  lastSend: LastSendRecord | null;
};

const KEYS = {
  lastState: "weather:notifier:last-state",
  lastCheck: "weather:notifier:last-check",
  lastSend: "weather:notifier:last-send",
  sentEvents: "weather:notifier:sent-events",
  cronLock: "weather:notifier:cron-lock",
};

export function isRedisConfigured(): boolean {
  return Boolean(getRedisConfig());
}

export function createRedisClient(): Redis {
  const config = requireRedisConfig();
  return new Redis(config);
}

export async function getStoredNotifierSnapshot(redis = createRedisClient()): Promise<StoredNotifierSnapshot> {
  const [lastState, lastCheck, lastSend] = await Promise.all([
    readJson<WarningState>(redis, KEYS.lastState),
    readJson<LastCheckRecord>(redis, KEYS.lastCheck),
    readJson<LastSendRecord>(redis, KEYS.lastSend),
  ]);

  return { lastState, lastCheck, lastSend };
}

export async function getLastWarningState(redis = createRedisClient()): Promise<WarningState | null> {
  return readJson<WarningState>(redis, KEYS.lastState);
}

export async function setLastWarningState(state: WarningState, redis = createRedisClient()): Promise<void> {
  await writeJson(redis, KEYS.lastState, state);
}

export async function setLastCheck(record: LastCheckRecord, redis = createRedisClient()): Promise<void> {
  await writeJson(redis, KEYS.lastCheck, record);
}

export async function setLastSend(record: LastSendRecord, redis = createRedisClient()): Promise<void> {
  await writeJson(redis, KEYS.lastSend, record);
}

export async function acquireCronLock(runId: string, redis = createRedisClient(), ttlSeconds = 240): Promise<boolean> {
  const result = await redis.set(KEYS.cronLock, runId, {
    nx: true,
    ex: ttlSeconds,
  });

  return result === "OK";
}

export async function releaseCronLock(runId: string, redis = createRedisClient()): Promise<void> {
  const currentRunId = await redis.get<string>(KEYS.cronLock);

  if (currentRunId === runId) {
    await redis.del(KEYS.cronLock);
  }
}

export async function getSentEventIds(eventIds: string[], redis = createRedisClient()): Promise<Set<string>> {
  const checks = await Promise.all(eventIds.map((eventId) => redis.sismember(KEYS.sentEvents, eventId)));
  return new Set(eventIds.filter((_, index) => checks[index]));
}

export async function markEventSent(eventId: string, redis = createRedisClient()): Promise<void> {
  await redis.sadd(KEYS.sentEvents, eventId);
  await redis.expire(KEYS.sentEvents, 60 * 60 * 24 * 90);
}

export function maskRecipient(recipient: string): string {
  return maskValue(recipient);
}

async function readJson<T>(redis: Redis, key: string): Promise<T | null> {
  const value = await redis.get<T | string>(key);

  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return JSON.parse(value) as T;
  }

  return value as T;
}

async function writeJson(redis: Redis, key: string, value: unknown): Promise<void> {
  await redis.set(key, JSON.stringify(value));
}
