import { Eye, Timer } from "lucide-react";
import type { CSSProperties } from "react";
import { formatDuration, phaseLabel, progressPercent, type TimerSnapshot } from "../lib/timer";

type TimerDisplayProps = {
  snapshot: TimerSnapshot;
};

export function TimerDisplay({ snapshot }: TimerDisplayProps) {
  const progress = progressPercent(snapshot);
  const style = {
    "--progress": `${progress}%`,
    "--phase-color": snapshot.phase === "work" ? "#2f6b5f" : "#c85b37"
  } as CSSProperties;

  return (
    <section className={`timer-display timer-display-${snapshot.phase}`} style={style} aria-live="polite">
      <div className="timer-ring">
        <div className="timer-core">
          {snapshot.phase === "work" ? <Timer size={26} aria-hidden="true" /> : <Eye size={26} aria-hidden="true" />}
          <div className="phase-label">{phaseLabel(snapshot.phase)}</div>
          <div className="time-left">{formatDuration(snapshot.remainingSeconds)}</div>
        </div>
      </div>
      <div className="cycle-strip">
        <span>已完成</span>
        <strong>{snapshot.completedCycles}</strong>
        <span>轮</span>
      </div>
    </section>
  );
}
