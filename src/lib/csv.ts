import {
  createInitialTimer,
  normalizeTimerConfig,
  phaseDuration,
  type TimerConfig,
  type TimerEvent,
  type TimerEventType,
  type TimerSnapshot
} from "./timer";
import type { WindowState } from "../types/electron";

export type TimerPreferences = {
  sound: boolean;
  desktopNotification: boolean;
};

export type EyeTimerCsvData = {
  snapshot: TimerSnapshot;
  events: TimerEvent[];
  preferences: TimerPreferences;
  windowState: WindowState;
  draftConfig: TimerConfig;
};

export type EyeTimerCsvImportResult = {
  data: EyeTimerCsvData;
  warnings: string[];
};

type CsvRow = [string, string, string, string];

const CSV_HEADER = ["record", "id", "field", "value"] as const;
const SCHEMA_VERSION = "1";
const TIMER_EVENT_TYPES = new Set<TimerEventType>([
  "started",
  "paused",
  "reset",
  "rest-started",
  "work-started",
  "config-updated"
]);

function escapeCell(value: string | number | boolean): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function row(record: string, id: string, field: string, value: string | number | boolean): string {
  return [record, id, field, value].map(escapeCell).join(",");
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function parseCsvRows(text: string): CsvRow[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return [];
  }

  const header = parseCsvLine(lines[0]);
  const isExpectedHeader = CSV_HEADER.every((field, index) => header[index] === field);

  if (!isExpectedHeader) {
    throw new Error("CSV 表头必须是 record,id,field,value");
  }

  return lines.slice(1).map((line, index) => {
    const cells = parseCsvLine(line);

    if (cells.length !== 4) {
      throw new Error(`第 ${index + 2} 行不是 4 列`);
    }

    return cells as CsvRow;
  });
}

function numberFrom(value: string | undefined, fallback: number, warnings: string[], label: string): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    warnings.push(`${label} 不是有效数字，已保留原值。`);
    return fallback;
  }

  return parsed;
}

function booleanFrom(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  return value.toLowerCase() === "true" ? true : value.toLowerCase() === "false" ? false : fallback;
}

function eventTypeFrom(value: string | undefined, fallback: TimerEventType): TimerEventType {
  return value !== undefined && TIMER_EVENT_TYPES.has(value as TimerEventType) ? (value as TimerEventType) : fallback;
}

export function exportEyeTimerCsv(data: EyeTimerCsvData): string {
  const rows = [
    CSV_HEADER.join(","),
    row("metadata", "schema", "version", SCHEMA_VERSION),
    row("snapshot", "current", "phase", data.snapshot.phase),
    row("snapshot", "current", "remainingSeconds", data.snapshot.remainingSeconds),
    row("snapshot", "current", "completedCycles", data.snapshot.completedCycles),
    row("snapshot", "current", "isRunning", data.snapshot.isRunning),
    row("config", "active", "workSeconds", data.snapshot.config.workSeconds),
    row("config", "active", "restSeconds", data.snapshot.config.restSeconds),
    row("config", "draft", "workSeconds", data.draftConfig.workSeconds),
    row("config", "draft", "restSeconds", data.draftConfig.restSeconds),
    row("preference", "current", "sound", data.preferences.sound),
    row("preference", "current", "desktopNotification", data.preferences.desktopNotification),
    row("window", "current", "miniMode", data.windowState.miniMode),
    row("window", "current", "alwaysOnTop", data.windowState.alwaysOnTop)
  ];

  data.events.forEach((event, index) => {
    const id = String(index);
    rows.push(row("event", id, "type", event.type));
    rows.push(row("event", id, "timestamp", event.timestamp));
    rows.push(row("event", id, "label", event.label));
    rows.push(row("event", id, "completedCycles", event.completedCycles));
  });

  return `${rows.join("\n")}\n`;
}

export function importEyeTimerCsv(text: string, fallback: EyeTimerCsvData): EyeTimerCsvImportResult {
  const warnings: string[] = [];
  const rows = parseCsvRows(text);
  const singleValues = new Map<string, string>();
  const eventRows = new Map<string, Map<string, string>>();

  rows.forEach(([record, id, field, value]) => {
    if (record === "event") {
      const event = eventRows.get(id) ?? new Map<string, string>();
      event.set(field, value);
      eventRows.set(id, event);
      return;
    }

    singleValues.set(`${record}.${id}.${field}`, value);
  });

  const activeConfig = normalizeTimerConfig({
    workSeconds: numberFrom(
      singleValues.get("config.active.workSeconds"),
      fallback.snapshot.config.workSeconds,
      warnings,
      "专注时长"
    ),
    restSeconds: numberFrom(
      singleValues.get("config.active.restSeconds"),
      fallback.snapshot.config.restSeconds,
      warnings,
      "休息时长"
    )
  });
  const draftConfig = normalizeTimerConfig({
    workSeconds: numberFrom(singleValues.get("config.draft.workSeconds"), fallback.draftConfig.workSeconds, warnings, "草稿专注时长"),
    restSeconds: numberFrom(singleValues.get("config.draft.restSeconds"), fallback.draftConfig.restSeconds, warnings, "草稿休息时长")
  });
  const importedPhase = singleValues.get("snapshot.current.phase");
  const phase = importedPhase === "rest" || importedPhase === "work" ? importedPhase : fallback.snapshot.phase;
  const baseSnapshot = createInitialTimer(activeConfig);
  const remainingSeconds = Math.min(
    phaseDuration(phase, activeConfig),
    Math.max(
      0,
      numberFrom(
        singleValues.get("snapshot.current.remainingSeconds"),
        fallback.snapshot.remainingSeconds,
        warnings,
        "剩余时间"
      )
    )
  );
  const completedCycles = Math.max(
    0,
    Math.round(
      numberFrom(
        singleValues.get("snapshot.current.completedCycles"),
        fallback.snapshot.completedCycles,
        warnings,
        "完成轮数"
      )
    )
  );
  const snapshot: TimerSnapshot = {
    ...baseSnapshot,
    phase,
    remainingSeconds,
    completedCycles,
    isRunning: booleanFrom(singleValues.get("snapshot.current.isRunning"), fallback.snapshot.isRunning)
  };
  const events = Array.from(eventRows.entries())
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([, fields]) => ({
      type: eventTypeFrom(fields.get("type"), "started"),
      timestamp: fields.get("timestamp") || new Date().toISOString(),
      label: fields.get("label") || "导入记录",
      completedCycles: Math.max(
        0,
        Math.round(numberFrom(fields.get("completedCycles"), 0, warnings, "事件完成轮数"))
      )
    }));

  return {
    data: {
      snapshot,
      events,
      preferences: {
        sound: booleanFrom(singleValues.get("preference.current.sound"), fallback.preferences.sound),
        desktopNotification: booleanFrom(
          singleValues.get("preference.current.desktopNotification"),
          fallback.preferences.desktopNotification
        )
      },
      windowState: {
        miniMode: booleanFrom(singleValues.get("window.current.miniMode"), fallback.windowState.miniMode),
        alwaysOnTop: booleanFrom(singleValues.get("window.current.alwaysOnTop"), fallback.windowState.alwaysOnTop)
      },
      draftConfig
    },
    warnings
  };
}
