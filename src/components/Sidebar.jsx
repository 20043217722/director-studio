import AgentIcon from "./AgentIcon";

export default function Sidebar({ agents, active, onSelect, onClose }) {
  return (
    <aside className="sidebar">
      {/* Chinese branding */}
      <div className="sidebar-brand">
        <div className="zh">导演工作室</div>
        <div className="tagline">AI FILM STUDIO</div>
      </div>

      {/* Agent cards */}
      <nav className="flex-1 py-4">
        {agents.map((a) => (
          <div
            key={a.id}
            onClick={() => onSelect(a.id)}
            className={`agent-card ${active === a.id ? "active" : ""}`}
          >
            <div className="agent-icon-svg">
              <AgentIcon id={a.id} active={active === a.id} />
            </div>
            <div className="flex-1">
              <div className="agent-label">{a.name}</div>
              <div className="agent-desc">{a.desc}</div>
            </div>
          </div>
        ))}
      </nav>

      <div className="px-5 py-3 border-t flex items-center justify-between text-xs" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
        <span className="hidden lg:inline">AI · Studio</span>
        <button onClick={onClose} className="lg:hidden text-sm">关闭</button>
      </div>
    </aside>
  );
}
