import { useMemo, useState, useRef, useEffect } from "react";

// Multi-format export button
function ExportButton({ text }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    setTimeout(() => document.addEventListener('click', close), 0);
    return () => document.removeEventListener('click', close);
  }, [open]);

  const download = (text, filename, mime) => {
    const blob = new Blob([text], { type: mime + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  };

  const exportMD = () => download(text, 'agent-output.md', 'text/markdown');

  const exportWord = () => {
    const html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>body{font-family:SimSun;font-size:14px;line-height:1.8;padding:40px}h1{font-size:20px}h2{font-size:17px}h3{font-size:15px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:6px}code{background:#f0f0f0;padding:2px 4px}strong{color:#C47482}</style></head><body>' + text.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>').replace(/^# (.+)$/gm, '<h1>$1</h1>').replace(/^## (.+)$/gm, '<h2>$1</h2>').replace(/^### (.+)$/gm, '<h3>$1</h3>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/^- (.+)$/gm, '<li>$1</li>') + '</body></html>';
    download(html, 'agent-output.doc', 'application/msword');
  };

  const printPDF = () => {
    const w = window.open('', '_blank');
    const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>导演工作室·导出</title><style>body{font-family:"Microsoft YaHei",sans-serif;font-size:14px;line-height:1.8;max-width:800px;margin:40px auto;padding:20px;color:#1E3A5F}h1{font-size:22px;border-bottom:2px solid #0EA5E9;padding-bottom:8px}h2{font-size:18px;color:#0EA5E9}h3{font-size:15px}table{border-collapse:collapse;width:100%;margin:12px 0}td,th{border:1px solid #ccc;padding:8px}th{background:#f0f7ff}code{background:#f0f0f0;padding:2px 6px;border-radius:3px}strong{color:#C47482}@media print{body{margin:0;padding:20px}}</style></head><body>' + text.replace(/\n\n/g, '<p></p>').replace(/\n/g, '<br>').replace(/^# (.+)$/gm, '<h1>$1</h1>').replace(/^## (.+)$/gm, '<h2>$1</h2>').replace(/^### (.+)$/gm, '<h3>$1</h3>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') + '</body></html>';
    w.document.write(html); w.document.close();
    setTimeout(() => w.print(), 500);
  };

  return (
    <span ref={ref} style={{position:'relative'}}>
      <button onClick={() => setOpen(!open)}
        className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/10 hover:bg-white/10 hover:text-white/70"
        title="导出文档">📥</button>
      {open && (
        <div style={{position:'absolute',top:'100%',right:0,marginTop:4,zIndex:50,
          background:'var(--bg-elevated)',border:'1px solid var(--border)',borderRadius:6,padding:2,minWidth:130,
          boxShadow:'var(--shadow-panel)'}}>
          <button onClick={() => { exportMD(); setOpen(false); }}
            style={{display:'block',width:'100%',textAlign:'left',padding:'5px 10px',fontSize:11,border:'none',borderRadius:4,background:'transparent',color:'var(--text)',cursor:'pointer'}}>
            📝 Markdown (.md)
          </button>
          <button onClick={() => { exportWord(); setOpen(false); }}
            style={{display:'block',width:'100%',textAlign:'left',padding:'5px 10px',fontSize:11,border:'none',borderRadius:4,background:'transparent',color:'var(--text)',cursor:'pointer'}}>
            📄 Word 文档 (.doc)
          </button>
          <button onClick={() => { printPDF(); setOpen(false); }}
            style={{display:'block',width:'100%',textAlign:'left',padding:'5px 10px',fontSize:11,border:'none',borderRadius:4,background:'transparent',color:'var(--text)',cursor:'pointer'}}>
            🖨️ 打印为 PDF
          </button>
        </div>
      )}
    </span>
  );
}

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

  // !! 醒目高亮 (自定义语法: !!text!!)
  html = html.replace(/!!(.+?)!!/g, '<mark class="key-highlight">$1</mark>');

  // Bold → 醒目彩色
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="text-accent">$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // 自动高亮技术参数: HEX颜色 #XXXXXX, f/XX, XXmm, XXXXK
  html = html.replace(/(#[0-9A-Fa-f]{6}\b)/g, '<code class="param-hex">$1</code>');
  html = html.replace(/\b(f\/\d+\.?\d*)\b/g, '<code class="param-lens">$1</code>');
  html = html.replace(/\b(\d{2,4}mm)\b/g, '<code class="param-lens">$1</code>');
  html = html.replace(/\b(\d{4}K)\b/g, '<code class="param-temp">$1</code>');
  html = html.replace(/\b(\d+[:：]\d+(\.\d+)?)\b(?!["'<>])/g, '<code class="param-ratio">$1</code>');
  // 角度
  html = html.replace(/\b(\d{1,2}°)\b/g, '<code class="param-angle">$1</code>');

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

  // Restore code blocks with copy button
  html = html.replace(/%%CODEBLOCK_(\d+)%%/g, (_, i) => {
    const idx = parseInt(i);
    if (idx >= codeBlocks.length) return `%%CODEBLOCK_${idx}%%`;
    const code = codeBlocks[idx].replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    return `<div class="code-block-wrap"><pre><code>${codeBlocks[idx]}</code></pre><button class="copy-code-btn" onclick="(function(b){var t=b.parentElement.querySelector('code').textContent;navigator.clipboard.writeText(t).then(function(){b.textContent='✓ 已复制';setTimeout(function(){b.textContent='📋 复制'},1500)})})(this)" title="一键复制">📋 复制</button></div>`;
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
  director:  { title: "导演", desc: "故事创意 · 逐镜分镜 · AIGC提示词 · 跨Agent协作", tips: ["🎬 写一个悬疑短片，输出逐镜 Seedance/Kling 提示词", "🎥 为科幻片设计开场镜头序列+连续性锁定+Agent握手", "📋 根据一句话创意生成完整分镜→自动标注下游Agent任务"] },
  doctor:    { title: "剧本医生", desc: "四层诊断 · AIGC适配标注 · 角色视觉追踪", tips: ["📝 分析剧本结构+标注每层对AIGC视频的影响", "🔍 诊断场景问题→输出关键场景Seedance提示词修复方案", "👤 追踪所有角色视觉连续性→生成人物造型Agent输入"] },
  designer:  { title: "美术指导", desc: "视觉概念 · 色彩体系 · 场景服装", tips: ["为赛博朋克电影设计视觉风格", "给女主角设计三套情绪对应的服装", "为沙漠场景做色彩方案"] },
  post:      { title: "后期总监", desc: "剪辑策略 · 调色方案 · 声音设计", tips: ["设计一个动作场面的剪辑节奏", "为回忆片段做调色方案", "给悬疑场景做声音后期设计"] },
  seedance:  { title: "剧幕文戏分析", desc: "分镜脚本·剧本精准拆解 → Seedance/Kling/Runway 提示词", tips: ["🎬 上传分镜脚本 → 逐镜拆解镜头·运镜·表演", "📜 上传剧本片段 → 逐场逐拍分析情绪·动作", "🎥 指定视频平台 → 生成专业Seedance 2.0 提示词"] },
  character: { title: "人物造型", desc: "高精度角色设计 · 七层专业框架", tips: ["设计一个废土世界的机械师角色", "为古装剧女主做完整造型方案", "上传剧本，提取所有人物做造型设计"] },
  scene:     { title: "场景设计", desc: "十维场景生成 · 全风格全氛围覆盖", tips: ["设计赛博朋克雨夜街景", "为仙侠剧做三组场景方案", "上传剧本，提取所有场景逐一设计"] },
  lens:      { title: "视觉解析师", desc: "图片/文档 → 视觉DNA提取 · 8平台提示词生成", tips: ["📸 上传参考图 → 拆解为各平台生图提示词", "📄 上传剧本/小说/策划案 → 提取视觉元素生成提示词", "🖼️+📄 图片+文档混合 → 图文一致性与融合提示词"] },
};

function formatTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

export default function ChatArea({ mode, messages, loading, onUndo, onRegenerate, onRetry, onToggleLike }) {
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
    <div className="max-w-3xl mx-auto px-5 py-5 space-y-5">
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
                {m.role === "assistant" && !m.error && onToggleLike && (
                  <button onClick={() => onToggleLike(m.id)}
                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                      m.liked
                        ? "bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30 like-btn-active"
                        : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10 hover:text-white/70"
                    }`}
                    title={m.liked ? "取消点赞" : "点赞收藏"}>
                    👍
                  </button>
                )}
                {m.role === "assistant" && !m.error && (
                  <button onClick={() => copyText(m.text)} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/10 hover:bg-white/10 hover:text-white/70" title="复制">📋</button>
                )}
                {m.role === "assistant" && !m.error && (
                  <ExportButton text={m.text} />
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
