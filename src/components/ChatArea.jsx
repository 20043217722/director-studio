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
  if (!text || typeof text !== 'string') return '<p></p>';
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

function copyText(text, e) {
  navigator.clipboard?.writeText(text).then(() => {
    // Show toast feedback
    const toast = document.createElement('div');
    toast.textContent = '✅ 已复制到剪贴板';
    Object.assign(toast.style, {
      position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
      background: 'var(--bg-elevated)', color: 'var(--text)', padding: '8px 20px',
      borderRadius: '20px', fontSize: '13px', fontWeight: 600, zIndex: 999,
      border: '1px solid var(--border-glow)', boxShadow: 'var(--shadow-md)',
      animation: 'fadeInUp 0.3s ease-out',
    });
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; }, 1500);
    setTimeout(() => toast.remove(), 2000);
  }).catch(() => {});
}

// 各智能体欢迎页配置
const WELCOME = {
  director:  { title: "导演", desc: "故事创意 · 逐镜分镜 · AIGC提示词 · 跨Agent协作", tips: ["🎬 写一个悬疑短片，输出逐镜 Seedance/Kling 提示词", "🎥 为科幻片设计开场镜头序列+连续性锁定+Agent握手", "📋 根据一句话创意生成完整分镜→自动标注下游Agent任务"] },
  doctor:    { title: "剧本医生", desc: "四层诊断 · AIGC适配标注 · 角色视觉追踪", tips: ["📝 分析剧本结构+标注每层对AIGC视频的影响", "🔍 诊断场景问题→输出关键场景Seedance提示词修复方案", "👤 追踪所有角色视觉连续性→生成人物造型Agent输入"] },
  designer:  { title: "美术指导", desc: "视觉世界观 · 色彩体系 · AIGC视觉方案", tips: ["🎨 为赛博朋克电影设计完整视觉风格+色彩方案+Midjourney提示词", "👗 给女主角设计三套情绪服装+面料参数+连续性锁", "🏠 为沙漠场景做材质色彩方案→自动握手场景设计Agent"] },
  post:      { title: "后期总监", desc: "剪辑策略 · AIGC后期方案 · 转场设计", tips: ["✂️ 设计动作场面剪辑节奏+AIGC后期提示词", "🎞️ 为回忆片段做后期方案(剪辑+转场+声音+色彩)", "🎬 规划VFX清单+标注AIGC可执行度(🟢🟡🔴)"] },
  seedance:  { title: "剧幕文戏分析", desc: "分镜拆解 · AI情绪表演(表情+肢体+语气) · Seedance提示词", tips: ["🎬 上传分镜脚本 → 逐镜拆解镜头·运镜·表演·时序", "🎭 标注情绪场景 → 三维拆解：😶表情+💪肢体+🗣️语气", "📜 剧本片段 → 逐场分析情绪爆发点·FACS·肢体语言·对白节奏"] },
  character: { title: "人物造型", desc: "高精度角色设计 · 七层框架 · AIGC生图提示词", tips: ["👤 设计废土机械师→输出MJ角色三视图+Seedance表演提示词", "👗 为古装剧女主做完整造型+服装弧线+连续性锁", "📜 上传剧本→提取所有人物→角色矩阵表→逐角色设计"] },
  scene:     { title: "场景设计", desc: "十维场景生成 · 全风格全氛围 · AIGC场景提示词", tips: ["🏛️ 设计赛博朋克雨夜街景→十维方案+MJ/Seedance提示词", "🏯 为仙侠剧做三组场景方案+场景间色彩过渡+连续性锁", "📜 上传剧本→提取所有场景→场景总表→逐场景展开"] },
  lens:      { title: "视觉解析师", desc: "图片/文档 → 视觉DNA · 8平台提示词 · 微表情解码", tips: ["📸 上传参考图 → 五维速览+8平台生图提示词+负向词", "📄 上传剧本/小说/策划案 → 视觉元素萃取+逐场景提示词", "🖼️+📄 图片+文档混合 → 图文一致性对比+融合提示词"] },
  cinematographer: { title: "摄影指导", desc: "镜头语法 · 布光方案 · 7平台策略 · 运镜时序", tips: ["📷 为关键场景设计灯光方案+7平台视频提示词", "🎥 设计运镜方案+镜头内时序(0s→Ns)+连续性锁", "💡 分析场景光线→输出Kling/Runway/Sora差异化策略"] },
  sound:     { title: "声音设计", desc: "音景 · 拟音 · 配乐 · AI音频提示词", tips: ["🔊 为场景设计逐镜声音方案+ElevenLabs/Suno提示词", "🎵 设计配乐情绪曲线+BPM+Key+出入点", "🔇 规划静默段落→标注叙事功能+持续时间"] },
  colorist:  { title: "调色师", desc: "色彩方案 · LUT · 场景过渡 · AIGC色彩提示词", tips: ["🎨 为全片设计色彩方案+色温弧线+连续性锁", "🎞️ 设计场景间色彩过渡+肤色保护+暗部高光规范", "📊 输出Seedance/Midjourney色彩提示词+负向约束"] },
  prompteng: { title: "提示词工程师", desc: "为 Claude Code / Cursor / Codex / Windsurf / Copilot 生成一步到位的精确提示词 — 消除 AI Agent 的猜测和返工", tips: [
    "🌐 制作个人主页网站 → 输出 Claude Code 完整提示词（Design Token + TodoWrite + 四态矩阵）",
    "📱 做一个 Todo App → 输出 Cursor .cursorrules + 分步构建指令",
    "🔧 写 Python CLI 工具 → 输出 Codex 结构化指令 + 错误恢复手册",
    "🐛 帮我调试 Bug → 输出诊断式提示词（症状→根因→修复→回归）",
    "🔄 修改现有项目 → 输出增量修改提示词（先读代码→精确Edit→不动无关文件）"
  ], platforms: ["Claude Code", "Cursor", "Codex", "Windsurf", "Copilot"] },
};

function formatTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

export default function ChatArea({ mode, messages, loading, onUndo, onRegenerate, onRetry, onToggleLike }) {
  const w = WELCOME[mode] || WELCOME.director;

  const empty = useMemo(() => (
    <div className="empty-state flex items-center justify-center h-full px-5" style={{ color: "var(--text-muted)" }}>
      <div className="text-center" style={{ maxWidth: mode === "prompteng" ? 500 : 360 }}>
        <h2 className="text-xl mb-2 tracking-wider font-bold" style={{ color: "var(--brand)" }}>{w.title}</h2>
        <p className="text-xs mb-4" style={{ opacity: 0.55, lineHeight: 1.6 }}>{w.desc}</p>

        {/* Platform badges (prompteng only) */}
        {w.platforms && (
          <div className="flex flex-wrap justify-center gap-1.5 mb-5">
            {w.platforms.map((p) => (
              <span key={p} className="text-[10px] px-2 py-0.5 rounded-full"
                style={{ background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text-secondary)", fontWeight: 600 }}>
                {p}
              </span>
            ))}
          </div>
        )}

        {/* Scene categories (prompteng only) */}
        {mode === "prompteng" && (
          <div className="grid grid-cols-2 gap-2 mb-5">
            {[
              { icon: "🌐", label: "从零新建", desc: "完整项目模板", color: "var(--accent-music)" },
              { icon: "🔄", label: "修改现有", desc: "增量精确编辑", color: "var(--accent-clone)" },
              { icon: "🐛", label: "调试Bug", desc: "诊断式修复", color: "var(--accent-sfx)" },
              { icon: "⚡", label: "单文件", desc: "轻量快速", color: "var(--accent-tts)" },
            ].map((s, i) => (
              <div key={i} className="quick-start-card px-3 py-2.5 rounded-lg text-left cursor-pointer"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                onClick={() => {
                  const ta = document.querySelector(".input-field");
                  if (ta) {
                    const prompts = {
                      "从零新建": "帮我制作一个个人主页网站，包含头像、简介、项目展示、联系方式",
                      "修改现有": "帮我在现有React项目中添加暗色模式切换功能",
                      "调试Bug": "帮我调试：npm run build 报错 'Cannot find module'",
                      "单文件": "帮我写一个倒计时组件，支持暂停/继续/重置",
                    };
                    ta.value = prompts[s.label] || s.label;
                    ta.dispatchEvent(new Event("input", { bubbles: true })); ta.focus();
                  }
                }}>
                <div className="text-sm mb-0.5" style={{ fontWeight: 700, color: "var(--text)" }}>{s.icon} {s.label}</div>
                <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>{s.desc}</div>
              </div>
            ))}
          </div>
        )}

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
        <div className="text-[10px] opacity-20">输入需求 · 自动识别场景 · 生成精确提示词</div>
      </div>
    </div>
  ), [w, mode]);

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
