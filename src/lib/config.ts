export type ConfigHealthItem = {
  key: string;
  group: "Redis" | "Cron" | "Admin" | "WhatsApp";
  required: boolean;
  configured: boolean;
  maskedValue?: string;
};

export type ConfigHealth = {
  ok: boolean;
  items: ConfigHealthItem[];
};

export type WhatsAppConfig = {
  accessToken?: string;
  phoneNumberId: string;
  to: string;
  templateName: string;
  templateLanguage: string;
  graphApiVersion: string;
  dryRun: boolean;
};

export type RedisConfig = {
  url: string;
  token: string;
};

const CONFIG_ITEMS: Array<Omit<ConfigHealthItem, "configured" | "maskedValue">> = [
  { key: "UPSTASH_REDIS_REST_URL", group: "Redis", required: true },
  { key: "UPSTASH_REDIS_REST_TOKEN", group: "Redis", required: true },
  { key: "CRON_SECRET", group: "Cron", required: true },
  { key: "ADMIN_TOKEN", group: "Admin", required: true },
  { key: "WHATSAPP_ACCESS_TOKEN", group: "WhatsApp", required: true },
  { key: "WHATSAPP_PHONE_NUMBER_ID", group: "WhatsApp", required: true },
  { key: "WHATSAPP_TO", group: "WhatsApp", required: true },
  { key: "WHATSAPP_TEMPLATE_NAME", group: "WhatsApp", required: true },
  { key: "WHATSAPP_TEMPLATE_LANGUAGE", group: "WhatsApp", required: false },
  { key: "WHATSAPP_GRAPH_API_VERSION", group: "WhatsApp", required: false },
  { key: "WHATSAPP_DRY_RUN", group: "WhatsApp", required: false },
];

export function getConfigHealth(): ConfigHealth {
  const items = CONFIG_ITEMS.map((item) => {
    const value = process.env[item.key];
    return {
      ...item,
      configured: Boolean(value),
      maskedValue: value ? maskValue(value) : undefined,
    };
  });

  return {
    ok: items.every((item) => !item.required || item.configured || isOptionalForDryRun(item.key)),
    items,
  };
}

export function getRedisConfig(): RedisConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  return { url, token };
}

export function requireRedisConfig(): RedisConfig {
  const config = getRedisConfig();

  if (!config) {
    throw new Error("Missing Upstash Redis environment variables.");
  }

  return config;
}

export function getWhatsAppConfig(): WhatsAppConfig {
  const dryRun = parseBoolean(process.env.WHATSAPP_DRY_RUN);
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const to = process.env.WHATSAPP_TO;
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME;

  if (!dryRun && (!accessToken || !phoneNumberId || !to || !templateName)) {
    throw new Error("Missing WhatsApp Cloud API environment variables.");
  }

  return {
    accessToken,
    phoneNumberId: phoneNumberId ?? "dry-run-phone-number-id",
    to: to ?? "dry-run-recipient",
    templateName: templateName ?? "weather_signal_alert",
    templateLanguage: process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? "en",
    graphApiVersion: process.env.WHATSAPP_GRAPH_API_VERSION ?? "v25.0",
    dryRun,
  };
}

export function getCronSecret(): string | null {
  return process.env.CRON_SECRET ?? null;
}

export function getAdminToken(): string | null {
  return process.env.ADMIN_TOKEN ?? null;
}

export function maskValue(value: string): string {
  if (value.length <= 6) {
    return "******";
  }

  return `${value.slice(0, 3)}…${value.slice(-3)}`;
}

function parseBoolean(value: string | undefined): boolean {
  return value?.toLowerCase() === "true";
}

function isOptionalForDryRun(key: string): boolean {
  if (!parseBoolean(process.env.WHATSAPP_DRY_RUN)) {
    return false;
  }

  return [
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_TO",
    "WHATSAPP_TEMPLATE_NAME",
  ].includes(key);
}
