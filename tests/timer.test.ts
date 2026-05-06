import { describe, expect, it } from "vitest";
import { exportEyeTimerCsv, importEyeTimerCsv, type EyeTimerCsvData } from "../src/lib/csv";
import {
  advanceTimer,
  buildMarkdownSummary,
  createInitialTimer,
  createTimerEvent,
  formatDuration,
  progressPercent,
  setTimerRunning
} from "../src/lib/timer";

describe("timer workflow", () => {
  it("formats durations as mm:ss", () => {
    expect(formatDuration(0)).toBe("00:00");
    expect(formatDuration(20)).toBe("00:20");
    expect(formatDuration(20 * 60)).toBe("20:00");
  });

  it("moves from work to rest after the configured work duration", () => {
    const timer = setTimerRunning(createInitialTimer({ workSeconds: 60, restSeconds: 20 }), true);
    const result = advanceTimer(timer, 60);

    expect(result.snapshot.phase).toBe("rest");
    expect(result.snapshot.remainingSeconds).toBe(20);
    expect(result.snapshot.completedCycles).toBe(0);
    expect(result.transitions).toEqual([{ from: "work", to: "rest", completedCycles: 0 }]);
  });

  it("counts a cycle after the rest phase completes", () => {
    const timer = setTimerRunning(
      {
        ...createInitialTimer({ workSeconds: 60, restSeconds: 20 }),
        phase: "rest",
        remainingSeconds: 20
      },
      true
    );
    const result = advanceTimer(timer, 20);

    expect(result.snapshot.phase).toBe("work");
    expect(result.snapshot.completedCycles).toBe(1);
    expect(result.transitions).toEqual([{ from: "rest", to: "work", completedCycles: 1 }]);
  });

  it("reports progress within the current phase", () => {
    const timer = setTimerRunning(createInitialTimer({ workSeconds: 120, restSeconds: 20 }), true);
    const result = advanceTimer(timer, 30);

    expect(progressPercent(result.snapshot)).toBe(25);
  });

  it("exports a markdown session summary", () => {
    const timer = createInitialTimer({ workSeconds: 1200, restSeconds: 20 });
    const event = createTimerEvent("started", 0, "开始专注", "2026-05-06T08:00:00.000Z");
    const markdown = buildMarkdownSummary([event], timer, "2026-05-06T08:20:00.000Z");

    expect(markdown).toContain("# 20-20-20 护眼计时记录");
    expect(markdown).toContain("开始专注");
    expect(markdown).toContain("远眺休息：20 秒");
  });

  it("round-trips all timer data through CSV", () => {
    const event = createTimerEvent("started", 0, "开始专注", "2026-05-06T08:00:00.000Z");
    const data: EyeTimerCsvData = {
      snapshot: setTimerRunning(createInitialTimer({ workSeconds: 1200, restSeconds: 20 }), true),
      events: [event],
      preferences: {
        sound: false,
        desktopNotification: true
      },
      windowState: {
        miniMode: true,
        alwaysOnTop: true
      },
      draftConfig: {
        workSeconds: 1500,
        restSeconds: 25
      }
    };

    const csv = exportEyeTimerCsv(data);
    const result = importEyeTimerCsv(csv, {
      ...data,
      events: []
    });

    expect(result.warnings).toEqual([]);
    expect(result.data.snapshot).toEqual(data.snapshot);
    expect(result.data.events).toEqual(data.events);
    expect(result.data.preferences).toEqual(data.preferences);
    expect(result.data.windowState).toEqual(data.windowState);
    expect(result.data.draftConfig).toEqual(data.draftConfig);
  });
});
