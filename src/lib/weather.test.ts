import { describe, expect, it } from "vitest";
import {
  diffWarningStates,
  filterUnsentEvents,
  normalizeHkoWarnings,
  type WarningState,
} from "./weather";

const FETCHED_AT = "2026-06-17T12:00:00.000Z";

describe("normalizeHkoWarnings", () => {
  it("normalizes HKO warnsum and warningInfo payloads", () => {
    const state = normalizeHkoWarnings(
      {
        WRAIN: {
          name: "Rainstorm Warning Signal",
          code: "WRAINR",
          type: "Red",
          actionCode: "ISSUE",
          issueTime: "2026-06-17T10:00:00+08:00",
          updateTime: "2026-06-17T10:15:00+08:00",
        },
        WTS: {
          name: "Thunderstorm Warning",
          code: "WTS",
          actionCode: "EXTEND",
          issueTime: "2026-06-17T09:00:00+08:00",
        },
      },
      {
        details: [
          {
            warningStatementCode: "WRAIN",
            subtype: "WRAINR",
            contents: ["Red Rainstorm Warning Signal", "Heavy rain is affecting Hong Kong."],
          },
          {
            warningStatementCode: "WTS",
            contents: ["Thunderstorm Warning", "Squally thunderstorms are expected."],
          },
        ],
      },
      FETCHED_AT,
    );

    expect(state.warnings).toEqual([
      expect.objectContaining({
        id: "WRAIN:WRAINR",
        family: "WRAIN",
        code: "WRAINR",
        name: "Rainstorm Warning Signal (Red)",
        detail: "Red Rainstorm Warning Signal Heavy rain is affecting Hong Kong.",
      }),
      expect.objectContaining({
        id: "WTS:WTS",
        family: "WTS",
        code: "WTS",
        name: "Thunderstorm Warning",
        detail: "Thunderstorm Warning Squally thunderstorms are expected.",
      }),
    ]);
  });

  it("handles an empty HKO response", () => {
    const state = normalizeHkoWarnings({}, {}, FETCHED_AT);
    expect(state.warnings).toEqual([]);
  });
});

describe("diffWarningStates", () => {
  it("initializes silently when there is no previous state", () => {
    expect(diffWarningStates(null, stateWith("WTS:WTS"))).toEqual([]);
  });

  it("emits UP when a warning appears", () => {
    const events = diffWarningStates(stateWith(), stateWith("WTS:WTS"));

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(expect.objectContaining({
      type: "UP",
      warningId: "WTS:WTS",
      warningName: "Thunderstorm Warning",
    }));
  });

  it("emits OFF when a warning disappears", () => {
    const events = diffWarningStates(stateWith("WTS:WTS"), stateWith());

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(expect.objectContaining({
      type: "OFF",
      warningId: "WTS:WTS",
      detail: "Thunderstorm Warning is no longer in force.",
    }));
  });

  it("ignores text-only updates to an active warning", () => {
    const previous = stateWith("WTS:WTS");
    const current = stateWith("WTS:WTS");
    current.warnings[0].detail = "Updated text only.";

    expect(diffWarningStates(previous, current)).toEqual([]);
  });

  it("treats warning level changes as old OFF and new UP", () => {
    const events = diffWarningStates(
      stateWith("WRAIN:WRAINA"),
      stateWith("WRAIN:WRAINR"),
    );

    expect(events.map((event) => `${event.type}:${event.warningId}`)).toEqual([
      "OFF:WRAIN:WRAINA",
      "UP:WRAIN:WRAINR",
    ]);
  });
});

describe("filterUnsentEvents", () => {
  it("removes events that have already been sent", () => {
    const events = diffWarningStates(stateWith(), stateWith("WTS:WTS", "WHOT:WHOT"));
    const unsent = filterUnsentEvents(events, [events[0].id]);

    expect(unsent).toEqual([events[1]]);
  });
});

function stateWith(...ids: string[]): WarningState {
  return {
    source: "HKO",
    fetchedAt: FETCHED_AT,
    warnings: ids.map((id) => {
      const [family, code] = id.split(":");
      return {
        id,
        family,
        code,
        name: warningName(code),
        issueTime: "2026-06-17T10:00:00+08:00",
        updateTime: "2026-06-17T10:00:00+08:00",
        detail: `${warningName(code)} detail.`,
      };
    }),
  };
}

function warningName(code: string): string {
  const names: Record<string, string> = {
    WHOT: "Very Hot Weather Warning",
    WRAINA: "Rainstorm Warning Signal (Amber)",
    WRAINR: "Rainstorm Warning Signal (Red)",
    WTS: "Thunderstorm Warning",
  };

  return names[code] ?? code;
}
