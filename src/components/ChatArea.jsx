import { useMemo } from "react";

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderMarkdown(text) {
  let html = escapeHtml(text);

  // Code blocks first — protected from later regex
  const codeBlocks = [];
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    codeBlocks.push(code);
    return `%%CODEBLOCK_${codeBlocks.length - 1}%%`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold / Italic / Strikethrough
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // Tables — only if line contains pipe (outside code blocks)
  const lines = html.split("\n");
  let inTable = false;
  const result = [];
  for (const line of lines) {
    if (line.startsWith("|") && line.endsWith("|") && !line.includes("%%CODEBLOCK")) {
      const cells = line.split("|").filter(c => c.trim());
      if (cells.every(c => /^[-:]+$/.test(c.trim()))) continue; // separator
      if (!inTable) { result.push("<table>"); inTable = true; }
      result.push(`<tr>${cells.map(c => `<td>${c.trim()}</td>`).join("")}</tr>`);
    } else {
      if (inTable) { result.push("</table>"); inTable = false; }
      result.push(line);
    }
  }
  if (inTable) result.push("</table>");
  html = result.join("\n");

  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Restore code blocks
  html = html.replace(/%%CODEBLOCK_(\d+)%%/g, (_, i) => {
    const idx = parseInt(i);
    return idx < codeBlocks.length ? `<pre><code>${codeBlocks[idx]}</code></pre>` : `%%CODEBLOCK_${idx}%%`;
  });

  // Paragraphs
  html = html.replace(/\n\n/g, "</p><p>");
  html = html.replace(/\n/g, "<br>");
  return `<p>${html}</p>`;
}

function copyText(text) {
  navigator.clipboard?.writeText(text).catch(() => {});
}

// 各智能体欢迎页配置
const WELCOME = {
  director:  { title: "导演", desc: "分镜设计 · 剧本创作 · 预算通告", tips: ["写一个悬疑短片的分镜脚本", "为科幻片设计开场镜头序列", "生成完整的电影预算表和通告单"] },
  doctor:    { title: "剧本医生", desc: "四层诊断 · 逐句修改", tips: ["分析这个剧本的结构问题", "诊断第三场对话的角色一致性", "给第二幕提出节奏优化方案"] },
  designer:  { title: "美术指导", desc: "视觉概念 · 色彩体系 · 场景服装", tips: ["为赛博朋克电影设计视觉风格", "给女主角设计三套情绪对应的服装", "为沙漠场景做色彩方案"] },
  post:      { title: "后期总监", desc: "剪辑策略 · 调色方案 · 声音设计", tips: ["设计一个动作场面的剪辑节奏", "为回忆片段做调色方案", "给悬疑场景做声音后期设计"] },
  seedance:  { title: "文戏提示词", desc: "Seedance 2.0 情绪表演提示词生成", tips: ["上传剧本，生成逐场文戏提示词", "为母女和解场景写Seedance提示词", "把这段小说对话转为AI表演提示词"] },
  character: { title: "人物造型", desc: "高精度角色设计 · 七层专业框架", tips: ["设计一个废土世界的机械师角色", "为古装剧女主做完整造型方案", "上传剧本，提取所有人物做造型设计"] },
  scene:     { title: "场景设计", desc: "十维场景生成 · 全风格全氛围覆盖", tips: ["设计赛博朋克雨夜街景", "为仙侠剧做三组场景方案", "上传剧本，提取所有场景逐一设计"] },
  lens:      { title: "视觉解析师", desc: "反向提示词工程 · 支持Midjourney/ChatGPT/Gemini/Seedream/Seedance/Kling/Runway", tips: ["📸 上传参考图 → 拆解为Midjourney生图提示词", "🎬 上传电影截图 → 转化为Seedance视频提示词", "🖼️ 上传2-3张同风格图 → 提取共同视觉DNA"] },
};

function formatTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

export default function ChatArea({ mode, messages, loading, onUndo, onRegenerate, onRetry }) {
  const w = WELCOME[mode] || WELCOME.director;

  const empty = useMemo(() => (
    <div className="empty-state flex items-center justify-center h-full px-5" style={{ color: "var(--text-muted)" }}>
      <div className="text-center max-w-sm">
        <h2 className="text-xl mb-2 tracking-wider font-bold" style={{ color: "var(--brand)" }}>{w.title}</h2>
        <p className="text-xs opacity-40 mb-6">{w.desc}</p>
        <div className="text-xs space-y-2">
          {w.tips.map((tip, i) => (
            <div key={i} className="px-3 py-2 rounded-lg text-left cursor-pointer transition-all hover:opacity-80"
              style={{ background: "rgba(212,175,55,0.04)", border: "1px solid rgba(212,175,55,0.08)", color: "var(--text-secondary)" }}
              onClick={() => {
                const ta = document.querySelector(".input-field");
                if (ta) { ta.value = tip; ta.dispatchEvent(new Event("input", { bubbles: true })); ta.focus(); }
              }}>
              {tip}
            </div>
          ))}
        </div>
        <div className="motif-line my-8 mx-auto" style={{ width: 120 }} />
        <div className="text-[10px] opacity-20">输入需求 · 上传文件 · 开始创作</div>
      </div>
    </div>
  ), [w]);

  if (messages.length === 0 && !loading) return empty;

  return (
    <div className="max-w-3xl mx-auto px-5 py-5 space-y-3">
      {messages.map((m, i) => {
        // 检测是否需要显示时间分隔（距上一条超过5分钟）
        const prev = messages[i - 1];
        const showTime = !prev || (m.time && prev.time && (new Date(m.time) - new Date(prev.time) > 300000));
        return (
        <div key={m.id}>
          {showTime && m.time && (
            <div className="text-center my-3">
              <span className="text-[10px] px-2 py-0.5 rounded-full opacity-30" style={{ background: "rgba(255,255,255,0.03)" }}>
                {new Date(m.time).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          )}
        <div className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
          <div className="relative group max-w-[85%]">
            {/* Hover action buttons */}
            {!m.streaming && (
              <div className="absolute -top-2 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
                {m.role === "user" && onUndo && (
                  <button onClick={() => onUndo(m.id)} className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30" title="撤回">撤回</button>
                )}
                {m.role === "assistant" && !m.error && (
                  <button onClick={() => copyText(m.text)} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/10 hover:bg-white/10 hover:text-white/70" title="复制">📋</button>
                )}
                {m.role === "assistant" && !m.error && onRegenerate && (
                  <button onClick={() => onRegenerate(m.id)} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/10 hover:bg-white/10 hover:text-white/70" title="重新生成">🔄</button>
                )}
                {m.role === "assistant" && m.error && onRetry && (
                  <button onClick={() => onRetry(m.retryText || "", m.retryFiles || m.retryFile || null)} className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30" title="重试">🔁 重试</button>
                )}
              </div>
            )}
            <div className={`px-4 py-3 text-sm leading-relaxed msg-content ${
              m.role === "user" ? "msg-user" : m.error ? "msg-error" : "msg-assistant"
            } ${m.streaming ? "opacity-90" : ""}`}>
              {m.imgUrls?.length > 0
                ? m.imgUrls.map((url, i) => <img key={i} src={url} alt="用户上传" className="max-w-[200px] rounded-lg mb-1" loading="lazy" />)
                : m.imgUrl && <img src={m.imgUrl} alt="用户上传" className="max-w-xs rounded-lg mb-2" loading="lazy" />}
              {m.partial && <div className="text-[10px] text-yellow-500/60 mb-1">⚠️ 响应可能不完整</div>}
              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text) + (m.streaming ? '<span class="loading-dot inline-block ml-0.5 align-middle" style="animation-delay:0ms"></span>' : "") }} />
            </div>
          </div>
        </div>
        </div>
      )})}
      {loading && !messages.some(m => m.streaming) && (
        <div className="flex justify-start">
          <div className="msg-assistant px-4 py-3 rounded-2xl">
            <span className="inline-flex gap-1.5">
              <span className="loading-dot" />
              <span className="loading-dot" />
              <span className="loading-dot" />
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
