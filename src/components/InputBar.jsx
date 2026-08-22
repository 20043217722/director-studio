import { useState, useRef, useEffect } from "react";

const DRAFT_KEY = "director_studio_draft";

export default function InputBar({ onSend, onStop, loading, network }) {
  const [text, setText] = useState(() => {
    try { return localStorage.getItem(DRAFT_KEY) || ""; } catch (_) { return ""; }
  });
  const [files, setFiles] = useState([]);
  const fileRef = useRef(null);
  const taRef = useRef(null);

  // 保存草稿
  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, text); } catch (_) {}
  }, [text]);

  function removeFile(idx) {
    setFiles((prev) => {
      const dt = new DataTransfer();
      prev.forEach((f, i) => { if (i !== idx) dt.items.add(f); });
      if (fileRef.current) fileRef.current.files = dt.files;
      return prev.filter((_, i) => i !== idx);
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) { onStop?.(); return; }
    try {
      await onSend(text, files);
      setText("");
      setFiles([]);
      try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      console.error("发送失败:", e);
      // 保留输入内容让用户重试，不清空
    }
  }

  function handleKeyDown(e) {
    // Ctrl+Enter 或 Enter 发送, Shift+Enter 换行
    if ((e.key === "Enter" && !e.shiftKey) || (e.key === "Enter" && e.ctrlKey)) {
      if (e.isComposing || e.nativeEvent?.isComposing) return;
      e.preventDefault();
      handleSubmit(e);
    }
  }

  // Auto-resize textarea
  function handleInput(e) {
    setText(e.target.value);
    const ta = taRef.current;
    if (ta) { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 120) + "px"; }
  }

  return (
    <form onSubmit={handleSubmit} className="input-wrap p-3 shrink-0">
      {network === "offline" && (
        <div className="text-center text-xs py-1 mb-2 rounded-md opacity-60"
          style={{ background: "rgba(239,68,68,0.08)", color: "#f87171" }}>
          离线 — 请检查网络连接
        </div>
      )}
      <div className="max-w-3xl mx-auto flex items-end gap-2">
        <button type="button" onClick={() => fileRef.current?.click()}
          className="p-2 rounded-lg opacity-35 hover:opacity-70 transition-opacity text-base shrink-0" title="上传文件">
          📎
        </button>
        <input ref={fileRef} type="file" multiple accept="image/*,.docx,.pdf,.txt,.csv,.xlsx,.pptx"
          onChange={(e) => setFiles(Array.from(e.target.files || []))} className="hidden" />

        <textarea
          ref={taRef}
          value={text}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={loading ? "AI 正在回复中..." : "输入创作需求... (Enter 发送 · Shift+Enter 换行)"}
          rows={1}
          disabled={loading}
          className="input-field flex-1 px-4 py-2.5 text-sm resize-none disabled:opacity-30"
          style={{ minHeight: "40px" }}
        />

        {files.length > 0 && (
          <span className="text-xs px-2 py-1 rounded-md shrink-0 max-w-[180px] truncate flex items-center gap-1 flex-wrap"
            style={{ background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.15)", color: "var(--gold)" }}>
            {files.length <= 2 ? files.map((f, i) => (
              <span key={i} className="flex items-center gap-1 truncate">
                <span className="truncate max-w-[80px]">{f.name}</span>
                <button type="button" onClick={() => removeFile(i)} className="text-[10px] opacity-50 hover:opacity-100 shrink-0">✕</button>
              </span>
            )) : (
              <span className="flex items-center gap-1">
                <span>{files.length} 个文件</span>
                <button type="button" onClick={() => { setFiles([]); if (fileRef.current) fileRef.current.value = ""; }}
                  className="text-[10px] opacity-50 hover:opacity-100 shrink-0">✕</button>
              </span>
            )}
          </span>
        )}

        <button type="submit" disabled={!loading && !text.trim() && files.length === 0}
          className={`touch-ripple px-5 py-2.5 text-sm shrink-0 ${loading ? "btn-stop" : "btn-send"}`}
          style={{ "--ripple-x": "50%", "--ripple-y": "50%" }}>
          {loading ? "■ 停止" : "发送"}
        </button>
      </div>
    </form>
  );
}
