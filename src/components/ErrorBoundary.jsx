import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null, errorInfo: null };
  static getDerivedStateFromError(e) { return { hasError: true, error: e }; }
  componentDidCatch(e, info) {
    console.error("ErrorBoundary:", e, info.componentStack);
    this.setState({ errorInfo: info });
  }

  handleRecover = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleClearAndReload = () => {
    try {
      // 只清除历史数据，保留 API key 和设置
      const keys = Object.keys(localStorage).filter(k =>
        k.startsWith("director_studio_history")
      );
      keys.forEach(k => localStorage.removeItem(k));
    } catch (_) {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const msg = this.state.error?.message || "发生了未知错误";
      const stack = this.state.errorInfo?.componentStack || "";
      const isStorageError = msg.includes("Storage") || msg.includes("localStorage") || msg.includes("quota");
      const isRenderError = msg.includes("render") || msg.includes("undefined") || msg.includes("null");

      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100dvh", padding: 20, background: "var(--bg-root)", color: "var(--text)", fontFamily: "system-ui" }}>
          <div style={{ textAlign: "center", maxWidth: 420 }}>
            <div style={{ fontSize: "3rem", marginBottom: 12 }}>🎬</div>
            <h2 style={{ marginBottom: 6, fontSize: "1.2rem" }}>导演工作室遇到问题</h2>
            <p style={{ color: "var(--text-muted)", marginBottom: 4, fontSize: "0.85rem" }}>{msg}</p>
            {stack && <p style={{ color: "var(--text-muted)", fontSize: "0.7rem", marginBottom: 16, whiteSpace: "pre-wrap", maxHeight: 80, overflow: "auto", opacity: 0.6 }}>{stack.slice(0, 200)}</p>}

            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={this.handleRecover}
                style={{ background: "var(--primary)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px", cursor: "pointer", fontWeight: 600, fontSize: "0.9rem" }}>
                尝试恢复
              </button>
              {isStorageError && (
                <button onClick={this.handleClearAndReload}
                  style={{ background: "var(--bg-card)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 24px", cursor: "pointer", fontWeight: 500, fontSize: "0.9rem" }}>
                  清除缓存并刷新
                </button>
              )}
              <button onClick={() => window.location.reload()}
                style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 24px", cursor: "pointer", fontSize: "0.9rem" }}>
                刷新页面
              </button>
            </div>

            {isRenderError && (
              <p style={{ marginTop: 12, fontSize: "0.75rem", color: "var(--text-muted)" }}>
                可能由对话数据异常引起，可尝试清除缓存
              </p>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
