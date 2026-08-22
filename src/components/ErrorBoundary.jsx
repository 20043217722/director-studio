import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          height: "100%", padding: 40,
          background: "var(--bg-root)", color: "var(--text)",
        }}>
          <div style={{ maxWidth: 480, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>💥</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: "var(--danger)" }}>
              应用遇到了意外错误
            </h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20, lineHeight: 1.6 }}>
              {this.state.error?.message || "未知错误"}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "10px 24px", fontSize: 14, fontWeight: 600,
                borderRadius: 8, border: "none", cursor: "pointer",
                background: "var(--primary)", color: "#fff",
              }}
            >
              🔄 重新加载
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
