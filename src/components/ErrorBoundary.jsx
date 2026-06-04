import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(e) { return { hasError: true, error: e }; }
  componentDidCatch(e, info) { console.error("ErrorBoundary:", e, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100dvh", padding: 20, background: "var(--bg-root)", color: "var(--text)", fontFamily: "system-ui" }}>
          <div style={{ textAlign: "center", maxWidth: 400 }}>
            <div style={{ fontSize: "3rem", marginBottom: 16 }}>🎬</div>
            <h2 style={{ marginBottom: 8 }}>出错了</h2>
            <p style={{ color: "var(--text-muted)", marginBottom: 16, fontSize: "0.9rem" }}>{this.state.error?.message || "发生了未知错误"}</p>
            <button onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
              style={{ background: "var(--primary)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 28px", cursor: "pointer", fontWeight: 600 }}>
              刷新页面
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
