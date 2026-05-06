import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  BellOff,
  Download,
  Maximize2,
  Minus,
  Minimize2,
  Pause,
  Pin,
  PinOff,
  Play,
  RotateCcw,
  Settings2,
  SkipForward,
  Upload,
  Volume2,
  VolumeX
} from "lucide-react";
import { IconButton } from "./components/IconButton";
import { SessionLog } from "./components/SessionLog";
import { StepperInput } from "./components/StepperInput";
import { TimerDisplay } from "./components/TimerDisplay";
import {
  exportEyeTimerCsv,
  importEyeTimerCsv,
  type EyeTimerCsvData,
  type TimerPreferences
} from "./lib/csv";
import {
  advanceTimer,
  createInitialTimer,
  createTimerEvent,
  nextPhase,
  phaseDuration,
  phaseLabel,
  setTimerRunning,
  type TimerConfig,
  type TimerEvent,
  type TimerEventType,
  type TimerSnapshot,
  type TimerTransition
} from "./lib/timer";
import type { WindowState } from "./types/electron";

const DEFAULT_WINDOW_STATE: WindowState = {
  miniMode: false,
  alwaysOnTop: false
};

const DEFAULT_PREFERENCES: TimerPreferences = {
  sound: true,
  desktopNotification: true
};

function App() {
  const [snapshot, setSnapshot] = useState<TimerSnapshot>(() => createInitialTimer());
  const [events, setEvents] = useState<TimerEvent[]>([]);
  const [workMinutes, setWorkMinutes] = useState(20);
  const [restSeconds, setRestSeconds] = useState(20);
  const [preferences, setPreferences] = useState<TimerPreferences>(DEFAULT_PREFERENCES);
  const [windowState, setWindowState] = useState<WindowState>(DEFAULT_WINDOW_STATE);
  const [notice, setNotice] = useState("准备开始");

  const snapshotRef = useRef(snapshot);
  const eventsRef = useRef(events);
  const preferencesRef = useRef(preferences);
  const audioContextRef = useRef<AudioContext | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const isDesktop = Boolean(window.eyeTimer);
  const nextPhaseLabel = phaseLabel(nextPhase(snapshot.phase));

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  useEffect(() => {
    return window.eyeTimer?.onWindowState(setWindowState);
  }, []);

  const addEvent = useCallback((type: TimerEventType, label: string, completedCycles: number) => {
    setEvents((currentEvents) => [createTimerEvent(type, completedCycles, label), ...currentEvents].slice(0, 200));
  }, []);

  const getAudioContext = useCallback(() => {
    if (!window.AudioContext) {
      return null;
    }

    const context = audioContextRef.current ?? new AudioContext();
    audioContextRef.current = context;
    return context;
  }, []);

  const unlockAudio = useCallback(async () => {
    const context = getAudioContext();

    if (!context) {
      return null;
    }

    if (context.state === "suspended") {
      await context.resume();
    }

    return context;
  }, [getAudioContext]);

  const playChime = useCallback(
    async (force = false) => {
      if (!force && !preferencesRef.current.sound) {
        return;
      }

      const context = await unlockAudio();

      if (!context) {
        return;
      }

      const notes = [
        { frequency: 760, start: 0, duration: 0.2 },
        { frequency: 560, start: 0.22, duration: 0.24 }
      ];

      notes.forEach((note) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const startsAt = context.currentTime + note.start;
        const endsAt = startsAt + note.duration;

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(note.frequency, startsAt);
        gain.gain.setValueAtTime(0.0001, startsAt);
        gain.gain.exponentialRampToValueAtTime(0.24, startsAt + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, endsAt);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(startsAt);
        oscillator.stop(endsAt + 0.02);
      });
    },
    [unlockAudio]
  );

  const showNotification = useCallback(
    (title: string, body: string) => {
      void playChime();

      if (preferencesRef.current.desktopNotification) {
        void window.eyeTimer?.showNotification({ title, body });
      }
    },
    [playChime]
  );

  const handleTransition = useCallback(
    (transition: TimerTransition) => {
      if (transition.to === "rest") {
        addEvent("rest-started", "进入远眺休息", transition.completedCycles);
        setNotice("远眺休息 20 秒");
        showNotification("该休息眼睛了", "看向远处，保持 20 秒。");
      } else {
        addEvent("work-started", "回到专注计时", transition.completedCycles);
        setNotice("休息完成");
        showNotification("休息完成", "可以回到当前任务。");
      }
    },
    [addEvent, showNotification]
  );

  useEffect(() => {
    let lastTickAt = Date.now();

    const intervalId = window.setInterval(() => {
      const currentSnapshot = snapshotRef.current;

      if (!currentSnapshot.isRunning) {
        lastTickAt = Date.now();
        return;
      }

      const now = Date.now();
      const elapsedSeconds = Math.floor((now - lastTickAt) / 1000);

      if (elapsedSeconds <= 0) {
        return;
      }

      lastTickAt += elapsedSeconds * 1000;
      const result = advanceTimer(currentSnapshot, elapsedSeconds);
      snapshotRef.current = result.snapshot;
      setSnapshot(result.snapshot);
      result.transitions.forEach(handleTransition);
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [handleTransition]);

  const setTimer = useCallback((nextSnapshot: TimerSnapshot) => {
    snapshotRef.current = nextSnapshot;
    setSnapshot(nextSnapshot);
  }, []);

  const toggleRunning = useCallback(() => {
    const currentSnapshot = snapshotRef.current;
    const nextSnapshot = setTimerRunning(currentSnapshot, !currentSnapshot.isRunning);

    if (nextSnapshot.isRunning) {
      void unlockAudio();
    }

    setTimer(nextSnapshot);
    setNotice(nextSnapshot.isRunning ? "计时中" : "已暂停");
    addEvent(
      nextSnapshot.isRunning ? "started" : "paused",
      nextSnapshot.isRunning ? "开始专注" : "暂停计时",
      nextSnapshot.completedCycles
    );
  }, [addEvent, setTimer, unlockAudio]);

  const resetTimer = useCallback(() => {
    const currentSnapshot = snapshotRef.current;
    const nextSnapshot = createInitialTimer(currentSnapshot.config);

    setTimer(nextSnapshot);
    setNotice("已重置");
    addEvent("reset", "重置计时", currentSnapshot.completedCycles);
  }, [addEvent, setTimer]);

  const skipPhase = useCallback(() => {
    const currentSnapshot = snapshotRef.current;
    const targetPhase = nextPhase(currentSnapshot.phase);
    const completedCycles =
      currentSnapshot.phase === "rest" ? currentSnapshot.completedCycles + 1 : currentSnapshot.completedCycles;
    const nextSnapshot: TimerSnapshot = {
      ...currentSnapshot,
      phase: targetPhase,
      completedCycles,
      remainingSeconds: phaseDuration(targetPhase, currentSnapshot.config)
    };

    setTimer(nextSnapshot);
    setNotice(`已切换到${phaseLabel(targetPhase)}`);
    addEvent(
      targetPhase === "rest" ? "rest-started" : "work-started",
      `切换到${phaseLabel(targetPhase)}`,
      completedCycles
    );
  }, [addEvent, setTimer]);

  const applyConfig = useCallback(() => {
    const nextSnapshot = createInitialTimer({
      workSeconds: workMinutes * 60,
      restSeconds
    });

    setTimer(nextSnapshot);
    setNotice("规则已更新");
    addEvent("config-updated", "更新计时规则", nextSnapshot.completedCycles);
  }, [addEvent, restSeconds, setTimer, workMinutes]);

  const toggleMiniMode = useCallback(async () => {
    if (!window.eyeTimer) {
      setWindowState((currentState) => ({ ...currentState, miniMode: !currentState.miniMode }));
      return;
    }

    setWindowState(await window.eyeTimer.setMiniMode(!windowState.miniMode));
  }, [windowState.miniMode]);

  const toggleAlwaysOnTop = useCallback(async () => {
    if (!window.eyeTimer) {
      return;
    }

    setWindowState(await window.eyeTimer.setAlwaysOnTop(!windowState.alwaysOnTop));
  }, [windowState.alwaysOnTop]);

  const minimizeWindow = useCallback(() => {
    void window.eyeTimer?.minimize();
  }, []);

  const createCurrentData = useCallback(
    (): EyeTimerCsvData => ({
      snapshot: snapshotRef.current,
      events: eventsRef.current,
      preferences: preferencesRef.current,
      windowState,
      draftConfig: {
        workSeconds: workMinutes * 60,
        restSeconds
      }
    }),
    [restSeconds, windowState, workMinutes]
  );

  const exportCsv = useCallback(() => {
    const csv = exportEyeTimerCsv(createCurrentData());
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `eye-202020-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice("CSV 已导出");
  }, [createCurrentData]);

  const applyImportedWindowState = useCallback(async (nextWindowState: WindowState) => {
    if (!window.eyeTimer) {
      setWindowState(nextWindowState);
      return;
    }

    const afterMiniMode = await window.eyeTimer.setMiniMode(nextWindowState.miniMode);
    const afterAlwaysOnTop = await window.eyeTimer.setAlwaysOnTop(nextWindowState.alwaysOnTop);
    setWindowState({
      ...afterMiniMode,
      ...afterAlwaysOnTop
    });
  }, []);

  const importCsv = useCallback(
    async (file: File) => {
      try {
        const result = importEyeTimerCsv(await file.text(), createCurrentData());
        const importedData = result.data;
        const draftWorkMinutes = Math.max(1, Math.round(importedData.draftConfig.workSeconds / 60));

        setTimer(importedData.snapshot);
        setEvents(importedData.events);
        setPreferences(importedData.preferences);
        setWorkMinutes(draftWorkMinutes);
        setRestSeconds(importedData.draftConfig.restSeconds);
        await applyImportedWindowState(importedData.windowState);
        setNotice(result.warnings.length > 0 ? `已导入，${result.warnings.length} 项使用原值` : "CSV 已导入");
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "CSV 导入失败");
      }
    },
    [applyImportedWindowState, createCurrentData, setTimer]
  );

  const currentRuleText = useMemo(
    () => `${Math.round(snapshot.config.workSeconds / 60)} 分钟 / ${snapshot.config.restSeconds} 秒`,
    [snapshot.config.restSeconds, snapshot.config.workSeconds]
  );

  const draftConfig: TimerConfig = useMemo(
    () => ({
      workSeconds: workMinutes * 60,
      restSeconds
    }),
    [restSeconds, workMinutes]
  );
  const configChanged =
    draftConfig.workSeconds !== snapshot.config.workSeconds || draftConfig.restSeconds !== snapshot.config.restSeconds;

  return (
    <main className={`app-shell ${windowState.miniMode ? "is-mini" : ""}`}>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">20</div>
          <div>
            <h1>护眼计时器</h1>
            <p>{currentRuleText}</p>
          </div>
        </div>

        <div className="window-actions">
          <IconButton
            label={windowState.alwaysOnTop ? "取消置顶" : "窗口置顶"}
            icon={windowState.alwaysOnTop ? <PinOff size={18} /> : <Pin size={18} />}
            active={windowState.alwaysOnTop}
            disabled={!isDesktop}
            onClick={toggleAlwaysOnTop}
          />
          <IconButton
            label={windowState.miniMode ? "退出小窗" : "小窗模式"}
            icon={windowState.miniMode ? <Maximize2 size={18} /> : <Minimize2 size={18} />}
            active={windowState.miniMode}
            onClick={toggleMiniMode}
          />
          {isDesktop ? <IconButton label="最小化" icon={<Minus size={18} />} onClick={minimizeWindow} /> : null}
        </div>
      </header>

      <section className="timer-stage">
        <TimerDisplay snapshot={snapshot} />

        <div className="primary-controls" aria-label="计时控制">
          <IconButton
            className="primary-action"
            label={snapshot.isRunning ? "暂停" : "开始"}
            icon={snapshot.isRunning ? <Pause size={20} /> : <Play size={20} />}
            showText
            onClick={toggleRunning}
          />
          <IconButton label="重置" icon={<RotateCcw size={19} />} onClick={resetTimer} />
          <IconButton label={`切换到${nextPhaseLabel}`} icon={<SkipForward size={19} />} onClick={skipPhase} />
        </div>

        <div className="notice-line" role="status">
          <span>{phaseLabel(snapshot.phase)}</span>
          <span>{notice}</span>
        </div>
      </section>

      <section className="control-dock">
        <div className="settings-inline" aria-label="计时规则">
          <StepperInput label="专注" min={1} max={90} step={1} unit="分钟" value={workMinutes} onChange={setWorkMinutes} />
          <StepperInput label="远眺" min={5} max={180} step={5} unit="秒" value={restSeconds} onChange={setRestSeconds} />
          <button className="text-button" disabled={!configChanged} onClick={applyConfig}>
            <Settings2 size={17} aria-hidden="true" />
            应用
          </button>
        </div>

        <div className="tool-row" aria-label="数据和提醒">
          <IconButton
            label={preferences.sound ? "关闭提示音" : "开启提示音"}
            icon={preferences.sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
            active={preferences.sound}
            onClick={() => setPreferences((current) => ({ ...current, sound: !current.sound }))}
          />
          <button
            className="text-button compact-button"
            onClick={() => {
              void playChime(true);
              setNotice("提示音测试");
            }}
          >
            <Volume2 size={17} aria-hidden="true" />
            试音
          </button>
          <IconButton
            label={preferences.desktopNotification ? "关闭系统通知" : "开启系统通知"}
            icon={preferences.desktopNotification ? <Bell size={18} /> : <BellOff size={18} />}
            active={preferences.desktopNotification}
            onClick={() =>
              setPreferences((current) => ({
                ...current,
                desktopNotification: !current.desktopNotification
              }))
            }
          />
          <button className="text-button" onClick={exportCsv}>
            <Download size={17} aria-hidden="true" />
            导出 CSV
          </button>
          <button className="text-button" onClick={() => importInputRef.current?.click()}>
            <Upload size={17} aria-hidden="true" />
            导入 CSV
          </button>
          <input
            ref={importInputRef}
            className="visually-hidden"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void importCsv(file);
              }
              event.target.value = "";
            }}
          />
        </div>

        <SessionLog events={events} />
      </section>
    </main>
  );
}

export default App;
