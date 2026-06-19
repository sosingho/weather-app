export type HkoWarningSummaryRecord = {
  name?: string;
  code?: string;
  type?: string;
  actionCode?: string;
  issueTime?: string;
  updateTime?: string;
  expireTime?: string;
};

export type HkoWarningSummaryPayload = Record<string, HkoWarningSummaryRecord>;

export type HkoWarningInfoRecord = {
  contents?: string[];
  warningStatementCode?: string;
  subtype?: string;
  updateTime?: string;
};

export type HkoWarningInfoPayload = {
  details?: HkoWarningInfoRecord[];
};

export type NormalizedWarning = {
  id: string;
  family: string;
  code: string;
  name: string;
  type?: string;
  actionCode?: string;
  issueTime?: string;
  updateTime?: string;
  expireTime?: string;
  detail: string;
};

export type WarningState = {
  source: "HKO";
  fetchedAt: string;
  warnings: NormalizedWarning[];
};

export type WeatherSignalEventType = "UP" | "OFF";

export type WeatherSignalEvent = {
  id: string;
  type: WeatherSignalEventType;
  warningId: string;
  warningName: string;
  occurredAt: string;
  detail: string;
  current?: NormalizedWarning;
  previous?: NormalizedWarning;
};

const HKO_ENDPOINT = "https://data.weather.gov.hk/weatherAPI/opendata/weather.php";
const WARNING_DETAIL_MAX_LENGTH = 500;

export async function fetchHkoWarningState(fetchImpl: typeof fetch = fetch): Promise<WarningState> {
  const warnsumUrl = buildHkoUrl("warnsum");
  const warningInfoUrl = buildHkoUrl("warningInfo");

  const [warnsumResponse, warningInfoResponse] = await Promise.all([
    fetchImpl(warnsumUrl, { cache: "no-store" }),
    fetchImpl(warningInfoUrl, { cache: "no-store" }),
  ]);

  if (!warnsumResponse.ok) {
    throw new Error(`HKO warnsum request failed with ${warnsumResponse.status}`);
  }

  if (!warningInfoResponse.ok) {
    throw new Error(`HKO warningInfo request failed with ${warningInfoResponse.status}`);
  }

  const [warnsum, warningInfo] = (await Promise.all([
    warnsumResponse.json(),
    warningInfoResponse.json(),
  ])) as [HkoWarningSummaryPayload, HkoWarningInfoPayload];

  return normalizeHkoWarnings(warnsum, warningInfo, new Date().toISOString());
}

export function normalizeHkoWarnings(
  warnsum: HkoWarningSummaryPayload | null | undefined,
  warningInfo: HkoWarningInfoPayload | null | undefined,
  fetchedAt: string,
): WarningState {
  const detailLookup = buildDetailLookup(warningInfo);
  const warnings = Object.entries(warnsum ?? {})
    .filter((entry): entry is [string, HkoWarningSummaryRecord] => Boolean(entry[1]))
    .map(([family, record]) => {
      const code = clean(record.code) || family;
      const type = clean(record.type);
      const baseName = clean(record.name) || family;
      const name = type ? `${baseName} (${type})` : baseName;
      const detail = detailLookup.get(code) ?? detailLookup.get(family) ?? `${name} is in force.`;

      return {
        id: `${family}:${code}`,
        family,
        code,
        name,
        type,
        actionCode: clean(record.actionCode),
        issueTime: clean(record.issueTime),
        updateTime: clean(record.updateTime),
        expireTime: clean(record.expireTime),
        detail,
      } satisfies NormalizedWarning;
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    source: "HKO",
    fetchedAt,
    warnings,
  };
}

export function diffWarningStates(
  previous: WarningState | null | undefined,
  current: WarningState,
): WeatherSignalEvent[] {
  if (!previous) {
    return [];
  }

  const previousById = new Map(previous.warnings.map((warning) => [warning.id, warning]));
  const currentById = new Map(current.warnings.map((warning) => [warning.id, warning]));
  const events: WeatherSignalEvent[] = [];

  for (const warning of previous.warnings) {
    if (!currentById.has(warning.id)) {
      events.push(buildSignalEvent("OFF", warning, current.fetchedAt));
    }
  }

  for (const warning of current.warnings) {
    if (!previousById.has(warning.id)) {
      events.push(buildSignalEvent("UP", warning, current.fetchedAt));
    }
  }

  return events.sort((a, b) => a.id.localeCompare(b.id));
}

export function filterUnsentEvents<T extends { id: string }>(events: T[], sentEventIds: Iterable<string>): T[] {
  const sent = new Set(sentEventIds);
  return events.filter((event) => !sent.has(event.id));
}

export function buildSignalEvent(
  type: WeatherSignalEventType,
  warning: NormalizedWarning,
  occurredAt: string,
): WeatherSignalEvent {
  const eventTime = type === "UP"
    ? warning.issueTime ?? warning.updateTime ?? occurredAt
    : occurredAt;
  const detail = type === "UP"
    ? warning.detail
    : `${warning.name} is no longer in force.`;

  return {
    id: `${type}:${warning.id}:${eventTime}`,
    type,
    warningId: warning.id,
    warningName: warning.name,
    occurredAt,
    detail,
    current: type === "UP" ? warning : undefined,
    previous: type === "OFF" ? warning : undefined,
  };
}

export function getEventStatusText(type: WeatherSignalEventType): string {
  return `Weather signal ${type}`;
}

export function formatHongKongTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;

  return new Intl.DateTimeFormat("en-HK", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(date);
}

export function summarizeWarningDetail(detail: string, maxLength = WARNING_DETAIL_MAX_LENGTH): string {
  const normalized = detail.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function buildHkoUrl(dataType: "warnsum" | "warningInfo"): string {
  const url = new URL(HKO_ENDPOINT);
  url.searchParams.set("dataType", dataType);
  url.searchParams.set("lang", "en");
  return url.toString();
}

function buildDetailLookup(payload: HkoWarningInfoPayload | null | undefined): Map<string, string> {
  const lookup = new Map<string, string>();

  for (const detail of payload?.details ?? []) {
    const content = summarizeWarningDetail((detail.contents ?? []).join(" "));
    if (!content) {
      continue;
    }

    const statementCode = clean(detail.warningStatementCode);
    const subtype = clean(detail.subtype);

    if (statementCode) {
      lookup.set(statementCode, content);
    }

    if (subtype) {
      lookup.set(subtype, content);
    }
  }

  return lookup;
}

function clean(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
