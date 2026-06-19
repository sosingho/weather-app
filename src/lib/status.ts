import { getConfigHealth } from "./config";
import { getStoredNotifierSnapshot, isRedisConfigured, type StoredNotifierSnapshot } from "./state";
import { fetchHkoWarningState, type WarningState } from "./weather";

export type WeatherStatusResponse = {
  generatedAt: string;
  current: WarningState | null;
  currentError?: string;
  stored: StoredNotifierSnapshot | null;
  redisConfigured: boolean;
  config: ReturnType<typeof getConfigHealth>;
};

export async function getWeatherStatus(): Promise<WeatherStatusResponse> {
  const generatedAt = new Date().toISOString();
  const redisConfigured = isRedisConfigured();
  const [currentResult, storedResult] = await Promise.allSettled([
    fetchHkoWarningState(),
    redisConfigured ? getStoredNotifierSnapshot() : Promise.resolve(null),
  ]);

  return {
    generatedAt,
    current: currentResult.status === "fulfilled" ? currentResult.value : null,
    currentError: currentResult.status === "rejected" ? getErrorMessage(currentResult.reason) : undefined,
    stored: storedResult.status === "fulfilled" ? storedResult.value : null,
    redisConfigured,
    config: getConfigHealth(),
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown status error.";
}
