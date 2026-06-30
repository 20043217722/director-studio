import AgentIcon from "./AgentIcon";

export default function Sidebar({ agents, active, onSelect, onClose }) {
  let lastGroup = null;

  return (
    <aside className="sidebar">
      {/* Chinese branding */}
      <div className="sidebar-brand">
        <div className="zh">导演工作室</div>
        <div className="tagline">AI FILM STUDIO</div>
      </div>

      {/* Agent cards — grouped by creative phase */}
      <nav className="flex-1 py-2" style={{ overflowY: 'auto' }}>
        {agents.map((a) => {
          const showGroup = a.group && a.group !== lastGroup;
          if (showGroup) lastGroup = a.group;
          return (
            <div key={a.id}>
              {showGroup && (
                <div style={{
                  fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                  padding: '8px 18px 4px', textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  {a.group}
                </div>
              )}
              <div
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
            </div>
          );
        })}
      </nav>

      <div className="px-5 py-3 border-t flex items-center justify-between text-xs" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
        <span className="hidden lg:inline">AI · Studio</span>
        <button onClick={onClose} className="lg:hidden text-sm">关闭</button>
      </div>
    </aside>
  );
}
