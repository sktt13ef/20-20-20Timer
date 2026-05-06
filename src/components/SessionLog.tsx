import type { TimerEvent } from "../lib/timer";

type SessionLogProps = {
  events: TimerEvent[];
};

export function SessionLog({ events }: SessionLogProps) {
  return (
    <section className="panel session-log" aria-label="今日记录">
      <div className="panel-heading">
        <h2>今日记录</h2>
      </div>
      <div className="log-list">
        {events.length === 0 ? (
          <div className="empty-log">暂无记录</div>
        ) : (
          events.slice(0, 8).map((event) => (
            <div className="log-item" key={`${event.timestamp}-${event.type}`}>
              <time>{new Date(event.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</time>
              <span>{event.label}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
