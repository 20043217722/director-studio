import { useState, useRef, useEffect, useCallback } from "react";
import { loadKeys, watchNetwork, callAgentStream, MODEL_PRESETS } from "./lib/api";
import { parseFile, fileToBase64, fileToBase64Resized, fileToObjectURL, isImage } from "./lib/fileParser";
import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";
import InputBar from "./components/InputBar";
import ExportMenu from "./components/ExportMenu";
import SettingsModal from "./components/SettingsModal";
import ThemeSwitcher, { getEffectiveTheme } from "./components/ThemeSwitcher";
import MobileTabBar from "./components/MobileTabBar";
import AgentIcon from "./components/AgentIcon";

// Init theme on load
document.documentElement.setAttribute("data-theme", getEffectiveTheme());

const AGENTS = [
  { id: "director", name: "导演", desc: "分镜设计 · 剧本创作 · 预算通告" },
  { id: "doctor",   name: "剧本医生", desc: "四层诊断 · 逐句修改" },
  { id: "designer", name: "美术指导", desc: "视觉概念 · 色彩体系 · 场景服装" },
  { id: "post",     name: "后期总监", desc: "剪辑策略 · 调色方案 · 声音设计" },
  { id: "seedance", name: "剧幕文戏分析", desc: "逐幕逐拍情绪动作拆解 · Seedance/Kling/Runway 表演提示词" },
  { id: "character", name: "人物造型", desc: "高精度角色设计 · 七层专业框架" },
  { id: "scene", name: "场景设计", desc: "十维场景生成 · 全风格全氛围覆盖" },
  { id: "lens", name: "视觉解析师", desc: "反向提示词工程 · 视觉元素拆解 · 多平台适配" },
];

const HISTORY_PREFIX = "director_studio_history_";
const MAX_HISTORY = 100; // 从200降到100，减少localStorage压力
const MAX_HISTORY_SIZE = 2 * 1024 * 1024; // 每模式最多2MB

function getHistoryKey(mode) { return HISTORY_PREFIX + mode; }
function loadHistory(mode) {
  try {
    const raw = localStorage.getItem(getHistoryKey(mode));
    if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr)) return arr; }
  } catch (_) {}
  return [];
}
function saveHistory(mode, msgs) {
  try {
    // 只保存关键字段，减少体积
    let slim = msgs.slice(-MAX_HISTORY).map(({ id, role, text, error, time }) => ({ id, role, text, error, time }));
    let json = JSON.stringify(slim);
    // 超容时持续裁剪到一半
    while (json.length > MAX_HISTORY_SIZE && slim.length > 10) {
      slim = slim.slice(Math.floor(slim.length / 2));
      json = JSON.stringify(slim);
    }
    // 逐模式存储前先检查全局容量
    const allKeys = Object.keys(localStorage).filter(k => k.startsWith(HISTORY_PREFIX));
    if (allKeys.length > 0 && json.length > MAX_HISTORY_SIZE / 2) {
      // 清理其他模式的旧数据
      for (const k of allKeys) {
        if (k !== getHistoryKey(mode)) {
          try {
            const old = localStorage.getItem(k);
            if (old && old.length > MAX_HISTORY_SIZE) {
              const arr = JSON.parse(old);
              localStorage.setItem(k, JSON.stringify(arr.slice(-30)));
            }
          } catch (_) {}
        }
      }
    }
    localStorage.setItem(getHistoryKey(mode), json);
  } catch (e) {
    // localStorage 满时清空所有历史
    console.warn("localStorage 存储失败，清理旧数据");
    try {
      Object.keys(localStorage).filter(k => k.startsWith(HISTORY_PREFIX)).forEach(k => localStorage.removeItem(k));
      const slim = msgs.slice(-20).map(({ id, role, text, error, time }) => ({ id, role, text, error, time }));
      localStorage.setItem(getHistoryKey(mode), JSON.stringify(slim));
    } catch (_) {}
  }
}

export default function App() {
  const msgIdRef = useRef(0);

  // URL 清理参数：访问 ?clean 即可一键清空所有数据
  useEffect(() => {
    if (window.location.search.includes("clean")) {
      const keys = Object.keys(localStorage).filter(k =>
        k.startsWith("director_studio") || ["api_keys", "custom_cfg", "active_provider"].includes(k)
      );
      keys.forEach(k => localStorage.removeItem(k));
      window.location.search = "";
    }
  }, []);
  const [mode, setMode] = useState(() => localStorage.getItem("director_studio_last_mode") || "director");
  const [messages, setMessages] = useState(() => loadHistory(mode));
  const [loading, setLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [provider, setProvider] = useState(() => localStorage.getItem("active_provider") || "deepseek");
  const [network, setNetwork] = useState(() => navigator.onLine ? "online" : "offline");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [updateMsg, setUpdateMsg] = useState("");
  const [toast, setToast] = useState(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const messagesEnd = useRef(null);
  const chatContainerRef = useRef(null);
  const messagesRef = useRef(messages);
  const sendingRef = useRef(false);
  const userScrollRef = useRef(false); // 用户手动滚动标记
  messagesRef.current = messages;

  // 智能滚动：只在用户在底部时自动滚动
  const scrollToBottom = (force) => {
    const el = chatContainerRef.current;
    if (!el) return;
    if (force || !userScrollRef.current) {
      messagesEnd.current?.scrollIntoView({ behavior: force ? "auto" : "smooth" });
      setUserScrolledUp(false);
    }
  };

  // 监听用户手动滚动
  function handleChatScroll() {
    const el = chatContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    userScrollRef.current = !atBottom;
    setUserScrolledUp(!atBottom);
  }

  useEffect(() => { scrollToBottom(); }, [messages]);

  // Toast 自动消失
  function showToast(text, type = "info") {
    setToast({ text, type });
  }
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); } }, [toast]);

  // Auto-save history per-mode
  useEffect(() => { saveHistory(mode, messages); }, [messages, mode]);

  // Save last active mode
  useEffect(() => { localStorage.setItem("director_studio_last_mode", mode); }, [mode]);

  function switchMode(newMode) {
    if (newMode === mode) return;
    if (loading && !window.confirm("当前智能体正在回复中，切换将丢失回复内容。确定切换吗？")) return;
    // 停止当前生成
    if (abortRef.current) abortRef.current.abort();
    saveHistory(mode, messages);
    setMessages(loadHistory(newMode));
    setMode(newMode);
    setLoading(false);
    abortRef.current = null;
    sendingRef.current = false;
  }

  function clearHistory() {
    if (window.confirm("确认清除「当前智能体」的对话记录？")) {
      setMessages([]);
    }
  }

  // Undo: delete user message + subsequent AI reply
  function undoMessage(msgId) {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === msgId);
      if (idx < 0) return prev;
      // 清理图片 URL 防止内存泄漏
      const msg = prev[idx];
      if (msg.imgUrls) msg.imgUrls.forEach(u => { if (u?.startsWith("blob:")) URL.revokeObjectURL(u); });
      else if (msg.imgUrl?.startsWith("blob:")) URL.revokeObjectURL(msg.imgUrl);
      // 同时删除用户消息及其后续 AI 回复
      const endIdx = (idx + 1 < prev.length && prev[idx + 1].role === "assistant") ? idx + 2 : idx + 1;
      return prev.filter((_, i) => i < idx || i >= endIdx);
    });
  }

  // Regenerate: remove last AI reply and re-send the user message before it
  async function regenerate(aiMsgId) {
    const msgs = messagesRef.current;
    const idx = msgs.findIndex((m) => m.id === aiMsgId);
    if (idx < 1) return;
    const userMsg = msgs[idx - 1];
    if (userMsg.role !== "user") return;
    // Remove from AI message onward
    setMessages((prev) => prev.slice(0, idx));
    // Re-send with original files from the AI message's retryFiles
    const aiMsg = msgs[idx];
    handleSend(userMsg.text, aiMsg.retryFiles || null);
  }

  useEffect(() => {
    let prevOnline = navigator.onLine;
    const cleanup = watchNetwork((status) => {
      setNetwork(status);
      if (status === "online" && !prevOnline) {
        showToast("网络已恢复", "success");
      }
      prevOnline = status === "online";
    });
    return cleanup;
  }, []);

  // PWA install prompt (with cleanup)
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); window._pwaInstall = e; setUpdateMsg("安装桌面应用"); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function installPwa() { if (window._pwaInstall) { window._pwaInstall.prompt(); setUpdateMsg(""); } }

  // 全局快捷键
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "/" && !settingsOpen) {
        e.preventDefault();
        document.querySelector(".input-field")?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen]);

  const abortRef = useRef(null);

  const handleSend = useCallback(async (text, fileArray) => {
    const files = Array.isArray(fileArray) ? fileArray : (fileArray ? [fileArray] : []);
    if (!text.trim() && files.length === 0) return;
    // 防止重复发送
    if (sendingRef.current) return;
    sendingRef.current = true;

    const keys = loadKeys();
    if (!keys[provider]) {
      const msg = { id: ++msgIdRef.current, role: "assistant", text: "⚙️ 请先配置 API Key\n\n点击右上角 ⚙ 设置 → 选择模型提供商 → 填入 API Key → 保存", error: true };
      setMessages((prev) => [...prev, msg]);
      setSettingsOpen(true);
      sendingRef.current = false;
      return;
    }
    if (network === "offline") {
      const msg = { id: ++msgIdRef.current, role: "assistant", text: "🌐 网络离线，请检查网络连接后重试", error: true };
      setMessages((prev) => [...prev, msg]);
      sendingRef.current = false;
      return;
    }

    let docText = ""; let displayText = text;
    const imageBase64s = []; const imageMimes = []; const imgUrls = [];
    const imgFiles = files.filter(f => isImage(f));
    const docFiles = files.filter(f => !isImage(f));

    // 视觉模型检查
    if (imgFiles.length > 0) {
      const visionModels = new Set(["openai", "claude", "qwen", "qwen-vl", "glm", "xiaomi"]);
      if (!visionModels.has(provider) && provider !== "custom") {
        const msg = { id: ++msgIdRef.current, role: "assistant",
          text: `⚠️ **${MODEL_PRESETS[provider]?.name || provider}** 不支持图片识别\n\n当前模型是纯文本模型，无法处理图片。请切换到支持视觉的模型：\n- **Claude Opus 4** (推荐)\n- **GPT-4o**\n- **通义千问 Max**\n- **GLM-4 Plus**\n\n点击右上角 ⚙ 设置切换。`,
          error: true };
        setMessages((prev) => [...prev, msg]);
        sendingRef.current = false;
        return;
      }
    }

    // Lens 模式无图片时给提示（不阻断，用户可能在问文字问题）
    if (mode === "lens" && imgFiles.length === 0 && docFiles.length === 0) {
      showToast("💡 上传参考图可获得最佳分析效果", "info");
    }

    // 处理图片文件
    if (imgFiles.length > 0) {
      for (let i = 0; i < imgFiles.length; i++) {
        const imgFile = imgFiles[i];
        // 多图时显示进度
        if (imgFiles.length > 1) showToast(`正在处理图片 ${i + 1}/${imgFiles.length}...`, "info");
        imgUrls.push(fileToObjectURL(imgFile));
        try {
          const parsed = await fileToBase64Resized(imgFile);
          imageBase64s.push(parsed.base64);
          imageMimes.push(parsed.mime);
        } catch (e) {
          console.error("[handleSend] 图片转base64失败:", e);
          // 部分失败不中断：跳过失败图，继续处理其他图
          imgUrls.pop(); // 移除失败图的 ObjectURL
          continue;
        }
        if (imgFiles.length > 1) setToast(null);
      }
      // 如果所有图都失败了
      if (imageBase64s.length === 0) {
        const msg = { id: ++msgIdRef.current, role: "assistant", text: "所有图片读取失败，请检查文件格式后重试", error: true };
        setMessages((prev) => [...prev, msg]);
        sendingRef.current = false;
        return;
      }
      // 检查总大小 (base64 编码后约 1.33x 原文件大小)
      const totalB64 = imageBase64s.reduce((sum, b) => sum + b.length, 0);
      if (totalB64 > 40 * 1024 * 1024) {
        showToast("图片总大小较大，发送可能较慢", "info");
      }
      if (!text) {
        displayText = imgFiles.length === 1 ? "[图片]" : `[图片 x ${imageBase64s.length}]`;
      }
      // 清除进度 toast（防止最后一张图失败时残留）
      if (imgFiles.length > 1) setToast(null);
    }

    // 处理文档文件
    if (docFiles.length > 0) {
      for (const docFile of docFiles) {
        if (docFile.size > 1024 * 1024) showToast("正在解析文件...", "info");
        try {
          const result = await parseFile(docFile);
          const fileText = result.text || "";
          if (fileText) docText += (docText ? "\n\n---\n" : "") + fileText;
          if (docFile.size > 1024 * 1024) setToast(null);
        } catch (e) {
          docText += `\n(读取失败: ${e.message})`;
        }
      }
      if (docText) {
        const imgPrefix = imageBase64s.length > 0 ? `[图片 x ${imageBase64s.length}]\n\n` : "";
        const docPrefix = "📄 以下是从用户上传文档中提取的文本内容，请基于此内容中的视觉元素分析并生成专业提示词：\n\n---\n";
        displayText = imgPrefix + docPrefix + docText + (text ? `\n\n---\n📋 用户补充说明：${text}` : "");
      }
    }

    const userMsg = { id: ++msgIdRef.current, role: "user", text: displayText, imgUrls: imgUrls.length > 0 ? imgUrls : undefined, time: Date.now() };
    const aiMsg = { id: ++msgIdRef.current, role: "assistant", text: "", streaming: true, time: Date.now() };
    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setLoading(true);

    try {
      const cfg = JSON.parse(localStorage.getItem("custom_cfg") || "{}");
      const stripMarkdown = (t) => t.replace(/<[^>]+>/g, "").replace(/\n{3,}/g, "\n\n").trim();
      // 有图片时减少历史消息，避免超出模型上下文限制
      const histLimit = imageBase64s.length > 0 ? 6 : 20;
      const history = messagesRef.current.map((m) => ({ role: m.role, text: stripMarkdown(m.text) })).slice(-histLimit);
      const stream = new AbortController();
      abortRef.current = stream;
      let replyText = "";
      let lastUpdate = 0;
      const THROTTLE_MS = 60;
      for await (const chunk of callAgentStream(displayText || "请分析附件", mode, {
        apiKey: keys[provider], provider, imageBase64s, imageMimes, history,
        customEndpoint: cfg.endpoint || "", customModel: cfg.model || "",
        signal: stream.signal,
      })) {
        if (stream.signal.aborted) break;
        replyText += chunk;
        const now = Date.now();
        if (now - lastUpdate >= THROTTLE_MS) {
          lastUpdate = now;
          setMessages((prev) => prev.map((m) => m.id === aiMsg.id ? { ...m, text: replyText } : m));
        }
      }
      if (!replyText) replyText = "(对方未返回内容，请重试)";
      setMessages((prev) => prev.map((m) => m.id === aiMsg.id ? { ...m, text: replyText, streaming: false } : m));
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      const partial = aiMsg.text?.length > 0;
      if (errMsg === "ABORTED" || abortRef.current?.signal?.aborted) {
        setMessages((prev) => prev.map((m) => m.id === aiMsg.id ? {
          ...m,
          text: m.text + (partial ? "\n\n---\n*[已停止]*" : "*[已取消]*"),
          error: false,
          streaming: false,
          retryText: text,
          retryFiles: files,
        } : m));
      } else {
        setMessages((prev) => prev.map((m) => m.id === aiMsg.id ? {
          ...m,
          text: partial ? m.text : `❌ ${errMsg}`,
          error: !partial,
          partial,
          streaming: false,
          retryText: text,
          retryFiles: files,
        } : m));
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
      sendingRef.current = false;
    }
  }, [mode, provider, network]);

  const handleExport = useCallback(async (format) => {
    const msgs = messagesRef.current;
    const lastReply = [...msgs].reverse().find((m) => m.role === "assistant" && !m.error);
    if (!lastReply) { showToast("没有可导出的内容", "error"); return; }
    try {
      const agentName = AGENTS.find((a) => a.id === mode)?.name || "导出";
      if (format === "docx") {
        const { generateDocxBlob } = await import("./lib/export");
        saveBlob(await generateDocxBlob(agentName, lastReply.text), "docx");
      } else {
        const { generatePptxBlob } = await import("./lib/export");
        saveBlob(await generatePptxBlob(agentName, lastReply.text), "pptx");
      }
      showToast(`已导出为 ${format.toUpperCase()}`, "success");
    } catch (e) { showToast("导出失败: " + (e instanceof Error ? e.message : String(e)), "error"); }
  }, [mode]);

  function saveBlob(blob, ext) {
    const filename = `${AGENTS.find((a) => a.id === mode)?.name || "导出"}_${Date.now()}.${ext}`;

    // Electron: 用系统保存对话框
    if (window.electronAPI?.saveFile) {
      const reader = new FileReader();
      reader.onload = () => {
        const arr = Array.from(new Uint8Array(reader.result));
        window.electronAPI.saveFile({ title: filename.replace(/\.[^.]+$/, ""), buffer: arr, ext });
      };
      reader.readAsArrayBuffer(blob);
      return;
    }

    const url = URL.createObjectURL(blob);

    // iOS PWA: window.open 让用户在浏览器中查看并保存
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    if (isIOS) {
      const w = window.open(url, "_blank");
      if (!w) alert("请允许弹窗后重试，或复制链接打开：\n" + url);
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      return;
    }

    // 桌面浏览器 / Android PWA
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function handleSettingsSave({ provider: p, keys }) {
    setProvider(p);
    if (keys[p]) {
      setSettingsOpen(false);
      showToast(`已切换到 ${MODEL_PRESETS[p]?.name || p}`, "success");
    }
  }

  const currentAgent = AGENTS.find((a) => a.id === mode);
  const preset = MODEL_PRESETS[provider];

  return (
    <div className="flex overflow-hidden" style={{ background: "var(--bg-root)", height: "100dvh" }}>
      {sidebarOpen && <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <div className={`sidebar fixed lg:relative z-30 h-full transition-transform duration-250 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <Sidebar agents={AGENTS} active={mode} onSelect={(id) => { switchMode(id); setSidebarOpen(false); }} onClose={() => setSidebarOpen(false)} />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="app-header flex items-center px-3 gap-2 shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-1 text-lg opacity-50 hover:opacity-80">☰</button>
          <AgentIcon id={currentAgent?.id} active />
          <span className="sidebar-brand text-sm hidden sm:inline" style={{ color: "var(--gold)" }}>{currentAgent?.name}</span>
          <span className="hidden md:inline text-xs opacity-30 truncate">{currentAgent?.desc}</span>
          <div className="flex-1" />
          <ThemeSwitcher />
          <span className="provider-badge hidden sm:inline ml-2">{preset?.name || provider}</span>
          <span className={`net-dot shrink-0 ${network === "online" ? "online" : "offline"}`} title={network === "online" ? "在线" : "离线"} />
          {updateMsg && <button onClick={installPwa} className="update-badge px-2 py-0.5 cursor-pointer hidden sm:block">{updateMsg}</button>}
          <ExportMenu onExport={handleExport} disabled={loading || messages.length === 0} />
          <button onClick={clearHistory} className="p-1.5 rounded-lg opacity-25 hover:opacity-60 transition-opacity text-xs" title="清空记录">🗑</button>
          <button onClick={() => setSettingsOpen(true)} className="p-1.5 rounded-lg opacity-40 hover:opacity-80 transition-opacity text-sm" title="设置">⚙</button>
        </header>
        <div className="flex-1 overflow-y-auto relative" ref={chatContainerRef} onScroll={handleChatScroll}>
          <ChatArea mode={mode} messages={messages} loading={loading} onUndo={undoMessage} onRegenerate={regenerate} onRetry={handleSend} />
          <div ref={messagesEnd} />
          {userScrolledUp && (
            <button onClick={() => { userScrollRef.current = false; scrollToBottom(true); }}
              className="sticky bottom-4 float-right z-30 w-9 h-9 rounded-full shadow-lg flex items-center justify-center text-sm transition-all hover:scale-110 mr-4"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--gold)" }}
              title="回到底部">
              ↓
            </button>
          )}
        </div>
        <MobileTabBar agents={AGENTS} active={mode} onSelect={switchMode} />
        <div className="motif-line mx-4" />
        <InputBar onSend={handleSend} onStop={() => abortRef.current?.abort()} loading={loading} network={network} />
      </div>
      {settingsOpen && <SettingsModal activeProvider={provider} onSave={handleSettingsSave} onClose={() => setSettingsOpen(false)} />}
      {/* Toast 通知 */}
      {toast && (
        <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm shadow-lg pointer-events-none transition-all animate-fade-in ${
          toast.type === "error" ? "bg-red-500/90 text-white" :
          toast.type === "success" ? "bg-green-500/90 text-white" :
          "bg-white/10 backdrop-blur text-white/80 border border-white/10"
        }`}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
