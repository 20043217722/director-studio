import AgentIcon from "./AgentIcon";

export default function MobileTabBar({ agents, active, onSelect }) {
  return (
    <nav className="mobile-tabs">
      {agents.map(a => (
        <button key={a.id} onClick={() => onSelect(a.id)}
          className={`mobile-tab ${active === a.id ? "active" : ""}`}>
          <AgentIcon id={a.id} active={active === a.id} />
          <span>{a.name}</span>
        </button>
      ))}
    </nav>
  );
}
