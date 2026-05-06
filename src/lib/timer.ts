export type TimerPhase = "work" | "rest";

export type TimerConfig = {
  workSeconds: number;
  restSeconds: number;
};

export type TimerSnapshot = {
  phase: TimerPhase;
  remainingSeconds: number;
  completedCycles: number;
  isRunning: boolean;
  config: TimerConfig;
};

export type TimerTransition = {
  from: TimerPhase;
  to: TimerPhase;
  completedCycles: number;
};

export type TimerEventType =
  | "started"
  | "paused"
  | "reset"
  | "rest-started"
  | "work-started"
  | "config-updated";

export type TimerEvent = {
  type: TimerEventType;
  timestamp: string;
  label: string;
  completedCycles: number;
};

export const DEFAULT_TIMER_CONFIG: TimerConfig = {
  workSeconds: 20 * 60,
  restSeconds: 20
};

export function normalizeTimerConfig(config: TimerConfig): TimerConfig {
  return {
    workSeconds: Math.max(60, Math.round(config.workSeconds)),
    restSeconds: Math.max(5, Math.round(config.restSeconds))
  };
}

export function createInitialTimer(config: TimerConfig = DEFAULT_TIMER_CONFIG): TimerSnapshot {
  const normalized = normalizeTimerConfig(config);

  return {
    phase: "work",
    remainingSeconds: normalized.workSeconds,
    completedCycles: 0,
    isRunning: false,
    config: normalized
  };
}

export function setTimerRunning(snapshot: TimerSnapshot, isRunning: boolean): TimerSnapshot {
  return {
    ...snapshot,
    isRunning
  };
}

export function phaseDuration(phase: TimerPhase, config: TimerConfig): number {
  return phase === "work" ? config.workSeconds : config.restSeconds;
}

export function nextPhase(phase: TimerPhase): TimerPhase {
  return phase === "work" ? "rest" : "work";
}

export function advanceTimer(
  snapshot: TimerSnapshot,
  elapsedSeconds: number
): { snapshot: TimerSnapshot; transitions: TimerTransition[] } {
  if (!snapshot.isRunning || elapsedSeconds <= 0) {
    return { snapshot, transitions: [] };
  }

  let nextSnapshot = { ...snapshot };
  let remainingElapsed = Math.floor(elapsedSeconds);
  const transitions: TimerTransition[] = [];

  while (remainingElapsed > 0) {
    const consumedSeconds = Math.min(remainingElapsed, nextSnapshot.remainingSeconds);
    nextSnapshot = {
      ...nextSnapshot,
      remainingSeconds: nextSnapshot.remainingSeconds - consumedSeconds
    };
    remainingElapsed -= consumedSeconds;

    if (nextSnapshot.remainingSeconds === 0) {
      const from = nextSnapshot.phase;
      const to = nextPhase(from);
      const completedCycles = from === "rest" ? nextSnapshot.completedCycles + 1 : nextSnapshot.completedCycles;

      nextSnapshot = {
        ...nextSnapshot,
        phase: to,
        completedCycles,
        remainingSeconds: phaseDuration(to, nextSnapshot.config)
      };

      transitions.push({ from, to, completedCycles });
    }
  }

  return { snapshot: nextSnapshot, transitions };
}

export function phaseLabel(phase: TimerPhase): string {
  return phase === "work" ? "专注用眼" : "远眺休息";
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function progressPercent(snapshot: TimerSnapshot): number {
  const total = phaseDuration(snapshot.phase, snapshot.config);
  const elapsed = total - snapshot.remainingSeconds;

  return Math.min(100, Math.max(0, (elapsed / total) * 100));
}

export function createTimerEvent(
  type: TimerEventType,
  completedCycles: number,
  label: string,
  timestamp = new Date().toISOString()
): TimerEvent {
  return {
    type,
    timestamp,
    label,
    completedCycles
  };
}

export function buildMarkdownSummary(
  events: TimerEvent[],
  snapshot: TimerSnapshot,
  exportedAt = new Date().toISOString()
): string {
  const lines = [
    "# 20-20-20 护眼计时记录",
    "",
    `- 导出时间：${exportedAt}`,
    `- 专注周期：${Math.round(snapshot.config.workSeconds / 60)} 分钟`,
    `- 远眺休息：${snapshot.config.restSeconds} 秒`,
    `- 已完成完整循环：${snapshot.completedCycles}`,
    `- 当前阶段：${phaseLabel(snapshot.phase)}`,
    `- 当前剩余：${formatDuration(snapshot.remainingSeconds)}`,
    "",
    "## 事件",
    ""
  ];

  if (events.length === 0) {
    lines.push("- 暂无记录");
  } else {
    for (const event of events) {
      lines.push(`- ${event.timestamp}：${event.label}（完成循环 ${event.completedCycles}）`);
    }
  }

  lines.push("", "## 说明", "", "- 本记录只反映本地计时器状态，不代表医学建议或事实核验。");

  return `${lines.join("\n")}\n`;
}
