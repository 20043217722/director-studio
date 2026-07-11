import { useState, useRef, useEffect, useCallback } from "react";
import { loadKeys, watchNetwork, callAgentStream, MODEL_PRESETS, sanitizePrompt } from "./lib/api";
import { parseFile, fileToBase64, fileToBase64Resized, fileToObjectURL, isImage } from "./lib/fileParser";
import { updatePreferences, getLikedMessages, getPreferenceInjection } from "./lib/preferences";
import { trackPageView, recordVisit } from "./lib/analytics";
// CanvasWorkspace removed from site -- source kept in GitHub for future use
import Sidebar from "./components/Sidebar";
import AdminDashboard from "./components/AdminDashboard";
import AdminGate from "./components/AdminGate";
import ChatArea from "./components/ChatArea";
import InputBar from "./components/InputBar";
import ExportMenu from "./components/ExportMenu";
import SettingsModal from "./components/SettingsModal";
import ThemeSwitcher, { getEffectiveTheme } from "./components/ThemeSwitcher";
import MobileTabBar from "./components/MobileTabBar";
import { loadSessionHistory, saveSessionHistory } from "./lib/sessionStore";
import AgentIcon from "./components/AgentIcon";

import ErrorBoundary from "./components/ErrorBoundary";
import PassGate from "./components/PassGate";

// Init theme on load
document.documentElement.setAttribute("data-theme", getEffectiveTheme());

const AGENTS = [
  { group: '📝 前期创意', id: "director", name: "导演", desc: "故事创意 · 逐镜分镜 · AIGC提示词 · 跨Agent协作" },
  { group: '📝 前期创意', id: "doctor",   name: "剧本医生", desc: "四层诊断 · AIGC适配标注 · 角色视觉追踪" },
  { group: '🎨 视觉设计', id: "character", name: "人物造型", desc: "七层框架 · AIGC生图提示词 · 角色连续性锁" },
  { group: '🎨 视觉设计', id: "scene", name: "场景设计", desc: "十维场景 · AIGC场景提示词 · 跨场连续性" },
  { group: '🎨 视觉设计', id: "designer", name: "美术指导", desc: "视觉世界观 · 色彩体系 · AIGC视觉方案" },
  { group: '📷 拍摄方案', id: "cinematographer", name: "摄影指导", desc: "镜头语法 · 布光方案 · 7平台策略 · 运镜时序" },
  { group: '📷 拍摄方案', id: "seedance", name: "剧幕文戏分析", desc: "逐镜FACS拆解 · Seedance提示词 · 表演时序" },
  { group: '🎧 后期制作', id: "sound", name: "声音设计", desc: "音景 · 拟音 · AI音频提示词 · 配乐情绪曲线" },
  { group: '🎧 后期制作', id: "post", name: "后期总监", desc: "剪辑策略 · 转场设计 · AIGC后期方案 · VFX规划" },
  { group: '🔍 分析工具', id: "lens", name: "视觉解析师", desc: "视觉DNA提取 · 8平台提示词 · 微表情解码 · 反幻觉" },
  { group: '🤖 AI工程', id: "prompteng", name: "提示词工程师", desc: "为Claude Code/Cursor/Codex等AI Agent生成一步到位的精确提示词" },
];


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
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const sessionsRef = useRef({});
  const [activeTabs, setActiveTabs] = useState(() => [localStorage.getItem("director_studio_last_mode") || "director"]);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [passed, setPassed] = useState(() => sessionStorage.getItem('ds_pass') === '1');
  useEffect(() => { trackPageView(); recordVisit(); }, []);
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

  useEffect(() => { if (messages.length > 0) scrollToBottom(); }, [messages]);

  // Toast 自动消失
  function showToast(text, type = "info") {
    setToast({ text, type });
  }
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); } }, [toast]);

  // Auto-save history per-mode
  useEffect(() => { saveSessionHistory(mode, messages); }, [messages, mode]);

  // Save last active mode
  useEffect(() => { localStorage.setItem("director_studio_last_mode", mode); }, [mode]);
  useEffect(() => { try { setMessages(loadSessionHistory(mode)) } catch { setMessages([]) } }, [mode]);

  function switchMode(newMode) {
    const cur = sessionsRef.current[mode] || {};
    sessionsRef.current[mode] = { ...cur, messages, loading, sendingRef: sendingRef.current };
    saveSessionHistory(mode, messages);
    if (newMode === mode) return;
    const saved = sessionsRef.current[newMode];
    setMessages(saved?.messages || loadSessionHistory(newMode));
    setMode(newMode);
    setLoading(saved?.loading || false);
    sendingRef.current = saved?.sendingRef || false;
    setActiveTabs(prev => prev.includes(newMode) ? prev : [...prev, newMode]);
  }

  function closeTab(tabMode) {
    const tabs = activeTabs.filter(t => t !== tabMode);
    if (tabs.length === 0) return;
    if (tabMode === mode) {
      const nextMode = tabs[0];
      const saved = sessionsRef.current[nextMode];
      saveSessionHistory(mode, messages);
      setMessages(saved?.messages || loadSessionHistory(nextMode));
      setMode(nextMode);
      setLoading(saved?.loading || false);
      sendingRef.current = saved?.sendingRef || false;
    }
    setActiveTabs(tabs);
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

  function toggleLike(msgId) {
    setMessages((prev) => {
      const updated = prev.map((m) => m.id === msgId ? { ...m, liked: !m.liked } : m);
      // 更新偏好
      const likedMsgs = updated.filter(m => m.role === "assistant" && m.liked && !m.error);
      updatePreferences(mode, likedMsgs);
      return updated;
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

  // Cleanup blob URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      messagesRef.current.forEach(m => {
        if (m.imgUrls) m.imgUrls.forEach(u => { if (u?.startsWith("blob:")) URL.revokeObjectURL(u); });
        if (m.imgUrl?.startsWith("blob:")) URL.revokeObjectURL(m.imgUrl);
      });
    };
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
      if (e.key === "/" && !settingsOpen && !showAdmin) {
        e.preventDefault();
        document.querySelector(".input-field")?.focus();
        }
        if (e.ctrlKey && e.shiftKey && e.key === "A") { e.preventDefault(); setShowAdmin(v => !v);
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
      const visionModels = new Set(["deepseek", "openai", "claude", "qwen", "qwen-vl", "glm", "xiaomi", "minimax", "minimax-en"]);
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
    const aiMsg = { id: ++msgIdRef.current, role: "assistant", text: "", streaming: true, time: Date.now(), liked: false };
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
      const sanitized = sanitizePrompt(replyText);
      setMessages((prev) => prev.map((m) => m.id === aiMsg.id ? { ...m, text: sanitized, streaming: false } : m));
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

  const [shortcutOpen, setShortcutOpen] = useState(false);

  // Keyboard shortcut: ? to show shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShortcutOpen(v => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const SHORTCUTS = [
    { key: "Enter", desc: "发送消息" },
    { key: "Shift+Enter", desc: "换行" },
    { key: "Space", desc: "暂停/继续生成" },
    { key: "Ctrl+N", desc: "新建会话" },
    { key: "Ctrl+1-8", desc: "切换智能体 1-8" },
    { key: "Ctrl+E", desc: "导出" },
    { key: "Ctrl+,", desc: "打开设置" },
    { key: "?", desc: "显示/隐藏此面板" },
  ];

  const currentAgent = AGENTS.find((a) => a.id === mode);
  const preset = MODEL_PRESETS[provider];

  return (
    <ErrorBoundary>
    {!passed ? <PassGate onUnlock={() => setPassed(true)} /> : (
    <div className="flex overflow-hidden" style={{ position: "fixed", inset: 0, background: "var(--bg-root)" }}>
      {sidebarOpen && <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <div className={`sidebar fixed lg:relative z-30 h-full transition-transform duration-250 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <Sidebar agents={AGENTS} active={mode} onSelect={(id) => { switchMode(id); setSidebarOpen(false); }} onClose={() => setSidebarOpen(false)} />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="app-header flex items-center px-3 gap-2 shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-1 text-lg opacity-60 hover:opacity-100">☰</button>
          <AgentIcon id={currentAgent?.id} active />
          <span className="sidebar-brand text-sm hidden sm:inline" style={{ color: "var(--gold)", fontWeight: 700, letterSpacing: "0.02em" }}>{currentAgent?.name}</span>
          <span className="hidden md:inline text-xs opacity-55 truncate">{currentAgent?.desc}</span>
          <div className="flex-1" />
          <ThemeSwitcher />
          <span className="provider-badge hidden sm:inline ml-2" style={{fontWeight:600,fontSize:11}}>{preset?.name || provider}</span>
          <span className={`net-dot shrink-0 ${network === "online" ? "online" : "offline"}`} title={network === "online" ? "在线" : "离线"} />
          {updateMsg && <button onClick={installPwa} className="update-badge px-2 py-0.5 cursor-pointer hidden sm:block">{updateMsg}</button>}
          <ExportMenu onExport={handleExport} disabled={loading} />
          <button onClick={clearHistory} className="p-1.5 rounded-lg opacity-45 hover:opacity-80 transition-opacity text-sm" title="清空记录">🗑</button>
          <button onClick={() => setSettingsOpen(true)} style={{padding:'6px 12px',borderRadius:6,border:'1px solid var(--border-glow)',background:'var(--bg-card)',color:'var(--text)',cursor:'pointer',fontSize:13,fontWeight:600}} title="设置">⚙ 设置</button>
        </header>
        {<>
            {/* Agent tabs */}
            <div style={{display:"flex",gap:2,padding:"2px 6px",overflowX:"auto",background:"var(--bg-root)",borderBottom:"1px solid var(--border)",minHeight:30,alignItems:"flex-end"}}>
              {activeTabs.map(t => {
                const ag = AGENTS.find(a => a.id === t);
                const isActive = mode === t;
                return (
                  <button key={t} onClick={() => switchMode(t)}
                    style={{
                      padding:"3px 8px",fontSize:11,fontWeight:isActive?700:500,
                      borderRadius:"4px 4px 0 0",border:"none",cursor:"pointer",
                      background:isActive?"var(--bg-card)":"transparent",
                      color:isActive?"var(--text)":"var(--text-muted)",
                      whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:3,
                      borderBottom:isActive?"2px solid var(--accent)":"2px solid transparent"
                    }}>
                    {ag?.name||t}
                    {activeTabs.length>1 && <span onClick={(e)=>{e.stopPropagation();closeTab(t)}} style={{fontSize:9,opacity:.4}}>x</span>}
                  </button>
                );
              })}
              <span style={{fontSize:9,color:"var(--text-muted)",padding:"3px 6px",flex:1,textAlign:"right"}}>点击Agent加标签 | 各标签独立</span>
            </div>
            <div className="flex-1 overflow-y-auto relative" ref={chatContainerRef} onScroll={handleChatScroll}>
              {loading && <div className="typing-progress sticky top-0 z-10 w-full" />}
              <ChatArea mode={mode} messages={messages} loading={loading} onUndo={undoMessage} onRegenerate={regenerate} onRetry={handleSend} onToggleLike={toggleLike} />
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
          </>
        }
      </div>
      {settingsOpen && <SettingsModal activeProvider={provider} onSave={handleSettingsSave} onClose={() => setSettingsOpen(false)} />}
      {showAdmin && !adminAuthed && <AdminGate onUnlock={() => setAdminAuthed(true)} />}
      {showAdmin && adminAuthed && <AdminDashboard onClose={() => { setShowAdmin(false); setAdminAuthed(false) }} />}
      {/* 快捷键面板 */}
      {shortcutOpen && (
        <>
          <div className="modal-overlay fixed inset-0 z-40" onClick={() => setShortcutOpen(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ pointerEvents: "none" }}>
            <div className="shortcut-panel modal-card p-5 w-full max-w-sm" style={{ pointerEvents: "auto" }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--brand)" }}>⌨️ 快捷键</h3>
              {SHORTCUTS.map(s => (
                <div key={s.key} className="shortcut-row">
                  <span className="text-xs" style={{ color: "var(--text)" }}>{s.desc}</span>
                  <span className="shortcut-key">{s.key}</span>
                </div>
              ))}
              <button onClick={() => setShortcutOpen(false)}
                className="w-full mt-3 py-1.5 rounded-lg text-xs border transition-all opacity-40 hover:opacity-80"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                关闭
              </button>
            </div>
          </div>
        </>
      )}
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
    )}
    </ErrorBoundary>
  );
}
