import {
  acquireCronLock,
  createRedisClient,
  getLastWarningState,
  getSentEventIds,
  markEventSent,
  releaseCronLock,
  setLastCheck,
  setLastSend,
  setLastWarningState,
  type LastCheckRecord,
  type LastSendRecord,
} from "./state";
import {
  diffWarningStates,
  fetchHkoWarningState,
  filterUnsentEvents,
  type WeatherSignalEvent,
} from "./weather";
import { sendWeatherSignalMessage } from "./whatsapp";

export type WeatherSignalCheckResult = {
  ok: boolean;
  checkedAt: string;
  trigger: string;
  initialized: boolean;
  skipped: boolean;
  eventsFound: number;
  eventsSent: number;
  activeWarningCount: number;
  error?: string;
};

export async function runWeatherSignalCheck(trigger = "cron"): Promise<WeatherSignalCheckResult> {
  const redis = createRedisClient();
  const runId = crypto.randomUUID();
  const checkedAt = new Date().toISOString();
  const locked = await acquireCronLock(runId, redis);

  if (!locked) {
    const skippedRecord: LastCheckRecord = {
      ok: true,
      checkedAt,
      trigger,
      activeWarningCount: 0,
      eventsFound: 0,
      eventsSent: 0,
      initialized: false,
      skippedReason: "Another weather-signal check is already running.",
    };
    await setLastCheck(skippedRecord, redis);

    return {
      ok: true,
      checkedAt,
      trigger,
      initialized: false,
      skipped: true,
      eventsFound: 0,
      eventsSent: 0,
      activeWarningCount: 0,
    };
  }

  try {
    const currentState = await fetchHkoWarningState();
    const previousState = await getLastWarningState(redis);

    if (!previousState) {
      await setLastWarningState(currentState, redis);
      await setLastCheck({
        ok: true,
        checkedAt,
        trigger,
        activeWarningCount: currentState.warnings.length,
        eventsFound: 0,
        eventsSent: 0,
        initialized: true,
      }, redis);

      return {
        ok: true,
        checkedAt,
        trigger,
        initialized: true,
        skipped: false,
        eventsFound: 0,
        eventsSent: 0,
        activeWarningCount: currentState.warnings.length,
      };
    }

    const events = diffWarningStates(previousState, currentState);
    const sentEventIds = await getSentEventIds(events.map((event) => event.id), redis);
    const unsentEvents = filterUnsentEvents(events, sentEventIds);
    const sendRecords: LastSendRecord[] = [];

    for (const event of unsentEvents) {
      const sendResult = await sendWeatherSignalMessage(event);
      await markEventSent(event.id, redis);
      const sendRecord = toLastSendRecord(event, sendResult.messageId, sendResult.dryRun, sendResult.recipient);
      await setLastSend(sendRecord, redis);
      sendRecords.push(sendRecord);
    }

    await setLastWarningState(currentState, redis);
    await setLastCheck({
      ok: true,
      checkedAt,
      trigger,
      activeWarningCount: currentState.warnings.length,
      eventsFound: events.length,
      eventsSent: sendRecords.length,
      initialized: false,
    }, redis);

    return {
      ok: true,
      checkedAt,
      trigger,
      initialized: false,
      skipped: false,
      eventsFound: events.length,
      eventsSent: sendRecords.length,
      activeWarningCount: currentState.warnings.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown weather-signal check failure.";
    await setLastCheck({
      ok: false,
      checkedAt,
      trigger,
      activeWarningCount: 0,
      eventsFound: 0,
      eventsSent: 0,
      initialized: false,
      error: message,
    }, redis);

    return {
      ok: false,
      checkedAt,
      trigger,
      initialized: false,
      skipped: false,
      eventsFound: 0,
      eventsSent: 0,
      activeWarningCount: 0,
      error: message,
    };
  } finally {
    await releaseCronLock(runId, redis);
  }
}

function toLastSendRecord(
  event: WeatherSignalEvent,
  messageId: string | undefined,
  dryRun: boolean,
  recipient: string,
): LastSendRecord {
  return {
    sentAt: new Date().toISOString(),
    eventId: event.id,
    eventType: event.type,
    warningName: event.warningName,
    provider: "meta-whatsapp-cloud",
    dryRun,
    recipient,
    messageId,
  };
}
