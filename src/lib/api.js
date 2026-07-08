import agentPrompts from "./agentPrompts";
// ========== 多模型 API 客户端 ==========
import { getPreferenceInjection } from "./preferences";

// 后端代理检测（如果 localhost:3001 运行，自动走代理，免 API Key）
let _proxyChecked = false
let _proxyAvailable = false
async function ensureProxy() {
  if (_proxyChecked) return _proxyAvailable
  _proxyChecked = true
  try {
    const r = await fetch('http://localhost:3001/health', { signal: AbortSignal.timeout(1500) })
    _proxyAvailable = r.ok
    if (_proxyAvailable) console.log('[API] Proxy detected — using backend')
  } catch { _proxyAvailable = false }
  return _proxyAvailable
}
function wrapEndpoint(url) {
  if (_proxyAvailable) return `http://localhost:3001/api/${url}`
  const userProxy = (() => { try { return localStorage.getItem('api_proxy_url') || '' } catch { return '' } })()
  return userProxy || url
}

// 预设模型配置
export const MODEL_PRESETS = {
  "deepseek": {
    name: "DeepSeek V4 Pro",
    provider: "DeepSeek",
    endpoint: "https://api.deepseek.com/anthropic/v1/messages",
    model: "deepseek-v4-pro[1m]",
    authHeader: "x-api-key",
    authPrefix: "",
    protocol: "anthropic", // Anthropic-compatible Messages API
    vision: true,    // DeepSeek V4 Pro 已支持图片识别
  },
  "openai": {
    name: "GPT-4o",
    provider: "OpenAI",
    endpoint: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    protocol: "openai",
    vision: true,
  },
  "claude": {
    name: "Claude Opus 4",
    provider: "Anthropic",
    endpoint: "https://api.anthropic.com/v1/messages",
    model: "claude-opus-4-7-20250601",
    authHeader: "x-api-key",
    authPrefix: "",
    protocol: "anthropic",
    vision: true,
  },
  "qwen": {
    name: "通义千问 Max",
    provider: "阿里云",
    endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    model: "qwen-max",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    protocol: "openai",
    vision: true,
  },
  "qwen-vl": {
    name: "通义千问 VL Max",
    provider: "阿里云",
    endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    model: "qwen-vl-max",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    protocol: "openai",
    vision: true,
  },
  "glm": {
    name: "GLM-4 Plus",
    provider: "智谱AI",
    endpoint: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    model: "glm-4-plus",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    protocol: "openai",
    vision: true,
  },
  "moonshot": {
    name: "Kimi",
    provider: "月之暗面",
    endpoint: "https://api.moonshot.cn/v1/chat/completions",
    model: "moonshot-v1-128k",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    protocol: "openai",
  },
  "xiaomi": {
    name: "小米 MiMo Pro",
    provider: "小米 (ModelsLab)",
    endpoint: "https://modelslab.com/api/v7/llm/chat/completions",
    model: "xiaomi-mimo-v2.5-pro-asr",
    authHeader: "key",
    authPrefix: "",
    protocol: "openai",
    keyInBody: true,  // ModelsLab 密钥在请求体中
    vision: true,     // MiMo 原生多模态
  },
  "minimax": {
    name: "MiniMax M2.7",
    provider: "MiniMax（国内）",
    endpoint: "https://api.minimaxi.com/v1/chat/completions",
    model: "MiniMax-M2.7",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    protocol: "openai",
    vision: false,
  },
  "minimax-en": {
    name: "MiniMax M2.7 (国际)",
    provider: "MiniMax（国际）",
    endpoint: "https://api.minimax.io/v1/chat/completions",
    model: "MiniMax-M2.7",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    protocol: "openai",
    vision: false,
  },
  "gemini": {
    name: "Gemini 3 Flash",
    provider: "Google Gemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    model: "gemini-2.5-flash",
    authHeader: "x-goog-api-key",
    authPrefix: "",
    protocol: "openai",
    vision: true,
  },
  "agnes": {
    name: "Agnes 2.0 Flash",
    provider: "Agnes AI",
    endpoint: "https://apihub.agnes-ai.com/v1/chat/completions",
    model: "agnes-2.0-flash",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    protocol: "openai",
    vision: true,
  },
  "custom": {
    name: "自定义",
    provider: "Custom",
    endpoint: "",
    model: "",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    protocol: "openai",
  },
};

// ========== 流式调用（实时逐字输出）==========
export async function* callAgentStream(prompt, mode, { apiKey, provider = "deepseek", imageBase64, imageMime, imageBase64s, imageMimes, history = [], customEndpoint = "", customModel = "", signal } = {}) {
  const preset = MODEL_PRESETS[provider] || MODEL_PRESETS.deepseek;
  const key = apiKey || getKeyForProvider(provider);
  if (!key) throw new Error(`请先填入 ${preset.provider} API Key`);

  const rawEndpoint = provider === "custom" ? customEndpoint : preset.endpoint;
  const model = provider === "custom" ? customModel : preset.model;

  // 代理地址：优先后端代理(localhost:3001) → 用户设置代理 → 直连
  let proxyUrl = "";
  try { proxyUrl = localStorage.getItem("api_proxy_url") || ""; } catch (_) {}
  await ensureProxy()
  const endpoint = _proxyAvailable ? wrapEndpoint(rawEndpoint) : (proxyUrl || rawEndpoint)
  const sys = getSystemPrompt(mode);
  const messages = history.map((h) => ({ role: h.role, content: h.text }));

  // 归一化图片参数（兼容旧的单值调用）
  const imgB64s = imageBase64s || (imageBase64 ? [imageBase64] : []);
  const imgMimes = imageMimes || (imageMime ? [imageMime] : []);

  // 检测图片MIME类型
  const guessMime = (b64) => b64.startsWith("/9j/") ? "image/jpeg" : b64.startsWith("iVBOR") ? "image/png" : b64.startsWith("R0lG") ? "image/gif" : b64.startsWith("UklGR") ? "image/webp" : "image/jpeg";

  let userContent;
  if (imgB64s.length > 0) {
    const blocks = [{ type: "text", text: prompt }];
    for (let i = 0; i < imgB64s.length; i++) {
      const m = imgMimes[i] || guessMime(imgB64s[i]) || "image/jpeg";
      if (preset.protocol === "anthropic") {
        blocks.push({ type: "image", source: { type: "base64", media_type: m, data: imgB64s[i] } });
      } else {
        blocks.push({ type: "image_url", image_url: { url: `data:${m};base64,${imgB64s[i]}` } });
      }
    }
    userContent = blocks;
  } else {
    userContent = prompt;
  }
  messages.push({ role: "user", content: userContent });

  const maxTokens = ["director", "doctor", "designer", "post", "character", "scene", "seedance", "lens", "cinematographer", "sound", "colorist", "prompteng"].includes(mode) ? 80000 : 4000;
  // 小上下文模型（Qwen-VL、GLM等）限制输出令牌数，避免超上下文
  const smallCtxModels = new Set(["qwen-vl-max", "qwen-max", "qwen-plus"]);
  const outputTokens = smallCtxModels.has(model) ? 4096 : maxTokens;
  const temps = { director: 0.4, doctor: 0.3, character: 0.3, scene: 0.4, seedance: 0.5, lens: 0.35, cinematographer: 0.3, sound: 0.35, colorist: 0.25, prompteng: 0.2 };
  const temperature = temps[mode] ?? 0.7;

  let reqBody, reqHeaders;
  if (preset.protocol === "anthropic") {
    reqBody = JSON.stringify({ model, max_tokens: outputTokens, temperature, system: sys, messages, stream: true });
    reqHeaders = { "Content-Type": "application/json", "anthropic-version": "2023-06-01" };
  } else {
    const bodyObj = { model, max_tokens: outputTokens, temperature, messages: [{ role: "system", content: sys }, ...messages], stream: true };
    // 某些平台（如 ModelsLab）要求密钥在请求体中
    if (preset.keyInBody) bodyObj[preset.authHeader] = key;
    reqBody = JSON.stringify(bodyObj);
    reqHeaders = { "Content-Type": "application/json" };
  }
  if (!preset.keyInBody) {
    reqHeaders[preset.authHeader] = preset.authPrefix + key;
  }

  // 带重试的流式请求
  const res = await fetchWithRetry(endpoint, { method: "POST", headers: reqHeaders, body: reqBody, signal }, preset.protocol, 2, true, model);
  if (!res.ok) {
    const e = await res.text().catch(() => "");
    throw categorizeError(res.status, e, preset.provider);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lastChunkTime = Date.now();
  const STREAM_TIMEOUT = 120000; // 120s 无数据则超时（专业分析需要更长生成时间）

  while (true) {
    // 流读取超时保护
    const readPromise = reader.read();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("STREAM_TIMEOUT")), STREAM_TIMEOUT)
    );

    let done, value;
    try {
      const result = await Promise.race([readPromise, timeoutPromise]);
      done = result.done;
      value = result.value;
    } catch (e) {
      if (e.message === "STREAM_TIMEOUT") {
        reader.cancel().catch(() => {});
        if (buffer.trim()) {
          yield `\n\n---\n⚠️ 流中断：120s 无新数据，以上为已生成内容。\n💡 可点击 🔄 重新生成，或缩短输入/减少文件`;
        } else {
          yield "\n\n❌ 流超时：未收到任何数据。请检查网络或代理，点击 🔄 重试";
        }
        return;
      }
      throw e;
    }

    if (done) {
      // Flush decoder + remaining buffer — 防止流结束时丢弃尾端数据
      try { buffer += decoder.decode(); } catch (_) {}
      if (buffer.trim()) yield buffer;
      break;
    }
    lastChunkTime = Date.now();
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6);
      if (json === "[DONE]") return;
      try {
        const evt = JSON.parse(json);
        if (preset.protocol === "anthropic") {
          if (evt.type === "content_block_delta" && evt.delta?.text) yield evt.delta.text;
          // 处理 Anthropic 流式错误
          if (evt.type === "error") {
            throw new Error(`API 错误: ${evt.error?.message || "未知错误"}`);
          }
        } else {
          const txt = evt.choices?.[0]?.delta?.content;
          if (txt) yield txt;
          // 处理 OpenAI 兼容流式错误
          if (evt.error) {
            throw new Error(`API 错误: ${evt.error.message || "未知错误"}`);
          }
        }
      } catch (e) {
        if (e.message.startsWith("API 错误")) throw e;
        // 单个 event 解析失败不中断整体流
      }
    }
  }
}

// ========== 错误分类 ==========
function categorizeError(status, body, provider) {
  const msg = body?.slice?.(0, 300) || String(body || "");
  if (status === 401 || status === 403) {
    return new Error(`🔑 ${provider} API Key 无效或已过期，请在设置中更新`);
  }
  if (status === 429) {
    return new Error(`⏳ ${provider} 请求频率超限，请稍候重试`);
  }
  if (status === 413 || msg.includes("too large") || msg.includes("exceed")) {
    return new Error(`📦 图片过大，请尝试：\n• 压缩图片后再上传\n• 减少同时上传的图片数量\n• 降低图片分辨率`);
  }
  if (status >= 500) {
    return new Error(`🖥️ ${MODEL_PRESETS[provider]?.name || provider} 服务器繁忙 (${status})，请稍候重试`);
  }
  if (msg.includes("context length") || msg.includes("token") || msg.includes("max_tokens")) {
    return new Error(`📏 上下文超限。请尝试：\n• 点击右上角 🗑 清空对话历史\n• 减少同时分析的图片数量\n• 切换到长上下文模型 (Claude/DeepSeek)`);
  }
  if (msg.includes("content") && msg.includes("image")) {
    return new Error(`🖼️ ${MODEL_PRESETS[provider]?.name || provider} 不支持图片。请切换到支持视觉的模型：\n• Claude Opus 4（推荐）\n• GPT-4o\n• 通义千问 VL Max\n• GLM-4 Plus`);
  }
  if (msg.includes("image") && (msg.includes("format") || msg.includes("type") || msg.includes("invalid"))) {
    return new Error(`🖼️ 图片格式不被 ${MODEL_PRESETS[provider]?.name || provider} 支持，请使用 JPEG/PNG/WebP 格式`);
  }
  return new Error(`API ${status}: ${msg.slice(0, 200)}`);
}

// ========== 预检健康检查 ==========
const healthCache = new Map(); // endpoint → { ok, time }

async function preflightCheck(endpoint) {
  const now = Date.now();
  const cached = healthCache.get(endpoint);
  // 30 秒内复用缓存结果
  if (cached && now - cached.time < 10_000) return cached.ok;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000); // 5s 超时
    const res = await fetch(endpoint, {
      method: "HEAD",
      signal: ctrl.signal,
      mode: "no-cors", // 避免 CORS 预检失败
    });
    clearTimeout(timer);
    healthCache.set(endpoint, { ok: true, time: now });
    return true;
  } catch {
    healthCache.set(endpoint, { ok: false, time: now });
    return false;
  }
}

// ========== 熔断器 ==========
const circuitBreakers = new Map(); // endpoint → { failures, openUntil }

function checkCircuitBreaker(endpoint) {
  const cb = circuitBreakers.get(endpoint);
  if (!cb) return true; // 没有记录，放行
  if (cb.openUntil > Date.now()) return false; // 熔断中
  // 熔断过期, 重置
  circuitBreakers.delete(endpoint);
  return true;
}

function recordFailure(endpoint) {
  const cb = circuitBreakers.get(endpoint) || { failures: 0, openUntil: 0 };
  cb.failures++;
  if (cb.failures >= 3) {
    cb.openUntil = Date.now() + 30_000; // 熔断 30 秒
    console.warn(`[CircuitBreaker] ${endpoint} 熔断 30s (连续 ${cb.failures} 次失败)`);
  }
  circuitBreakers.set(endpoint, cb);
}

function recordSuccess(endpoint) {
  circuitBreakers.delete(endpoint); // 成功则清除熔断
}

// ========== 网络重试 + 指数退避 + 超时 (+ 熔断保护) ==========
async function fetchWithRetry(url, options, protocol, retries = 3, streaming = false, modelName = "") {
  const deadline = Date.now() + 120000;
  const externalSignal = options.signal;
  delete options.signal;

  // 预检：非阻塞 ping——失败不阻止请求，由实际请求的错误处理来兜底
  const reachable = await preflightCheck(url);
  if (!reachable) {
    console.warn("[API] Preflight failed for", url, "— proceeding with actual request");
    // 不抛异常，继续尝试真实请求
  }

  // 熔断检查
  if (!checkCircuitBreaker(url)) {
    throw new Error("⏸️ API 暂时熔断（连续失败过多），请 30 秒后重试\n建议检查 API Key 或切换模型");
  }

  let lastError;
  // 网络错误多试几次（6次），认证/业务错误少试（3次）
  const isNetworkError = (e) => {
    const m = e?.message || "";
    return m === "Failed to fetch" || m.includes("NetworkError") ||
           m.includes("连接") || m.includes("超时") || m.includes("timeout") ||
           (e?.name === "TypeError");
  };
  let effectiveRetries = retries;

  for (let attempt = 0; attempt < effectiveRetries; attempt++) {
    // 外部取消信号优先
    if (externalSignal?.aborted) throw new Error("ABORTED");

    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new Error("⏰ 请求超时，请检查网络连接或更换 API 节点");
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), Math.min(remaining, 20000));

    // 外部取消时同步取消内部
    const onExternalAbort = () => { ctrl.abort(); clearTimeout(timer); };
    externalSignal?.addEventListener("abort", onExternalAbort, { once: true });

    try {
      const res = await fetch(url, { ...options, signal: ctrl.signal });
      clearTimeout(timer);

      if (res.status === 429) {
        const wait = Math.pow(2, attempt) * 2000 + 1000;
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      // 502/503/504 are transient server errors → retry
      if ((res.status === 502 || res.status === 503 || res.status === 504) && attempt < retries - 1) {
        const wait = Math.pow(2, attempt) * 1000;
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw categorizeError(res.status, errText, modelName || "");
      }

      if (streaming) { recordSuccess(url); return res; }

      const data = await res.json();
      recordSuccess(url);
      if (protocol === "anthropic") {
        for (const b of data.content || []) if (b.type === "text") return b.text;
        return "无响应内容";
      }
      const choice = data.choices?.[0];
      const content = choice?.message?.content;
      return typeof content === "string" ? content : (content?.[0]?.text || choice?.text || "无响应内容");
    } catch (e) {
      clearTimeout(timer);
      externalSignal?.removeEventListener("abort", onExternalAbort);
      // 用户主动取消
      if (e.message === "ABORTED" || externalSignal?.aborted) throw new Error("ABORTED");
      // 不重试认证错误
      if (e.message?.startsWith("🔑")) throw e;
      // 不重试图片不支持错误
      if (e.message?.startsWith("🖼️")) throw e;

      lastError = e;
      // 网络错误 → 增加重试次数并记录熔断
      if (isNetworkError(e)) {
        effectiveRetries = Math.max(effectiveRetries, 6);
        recordFailure(url);
      }

      if (attempt < effectiveRetries - 1 && e.name !== "AbortError") {
        const wait = Math.pow(2, attempt) * 800; // 800ms / 1.6s / 3.2s / 6.4s / 12.8s / 25.6s
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  // 最后一招：区分网络错误类型，给出具体建议
  if (!lastError) throw new Error("🌐 网络连接失败");
  const msg = lastError.message || "";
  // 浏览器无法连接服务器（DNS/防火墙/VPN 导致）
  if (msg === "Failed to fetch" || lastError.name === "TypeError") {
    const hints = [];
    const endpoint = url || options?.url || "";
    if (endpoint.includes("openai.com")) hints.push("OpenAI API 需科学上网");
    if (endpoint.includes("anthropic.com")) hints.push("Anthropic API 需科学上网");
    if (endpoint.includes("deepseek.com")) hints.push("检查 api.deepseek.com 是否可访问，或尝试更换网络");
    hints.push("尝试在设置中配置代理地址");
    hints.push("检查防火墙/VPN 设置");
    throw new Error(`🌐 无法连接 API 服务器\n${hints.join("\n")}\n原始错误: ${msg}`);
  }
  throw lastError;
}

// ========== API Key 存储（按 provider） ==========
function getKeyForProvider(provider) {
  try {
    const keys = JSON.parse(localStorage.getItem("api_keys") || "{}");
    // qwen-vl 自动复用 qwen 的 Key
    if (provider === "qwen-vl" && !keys["qwen-vl"]) return keys["qwen"] || "";
    return keys[provider] || "";
  } catch (_) { return ""; }
}

export function saveKey(provider, key) {
  const keys = JSON.parse(localStorage.getItem("api_keys") || "{}");
  if (key) keys[provider] = key;
  else delete keys[provider];
  localStorage.setItem("api_keys", JSON.stringify(keys));
}

export function loadKeys() {
  try { return JSON.parse(localStorage.getItem("api_keys") || "{}"); }
  catch (_) { return {}; }
}

// ========== 网络状态监控 ==========
export function watchNetwork(onChange) {
  function update() {
    onChange(navigator.onLine ? "online" : "offline");
  }
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
  return () => {
    window.removeEventListener("online", update);
    window.removeEventListener("offline", update);
  };
}

// ========== 图片转 base64 ==========
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ========== 智能体 Prompt ==========
function getSystemPrompt(mode) {
  const prompts = agentPrompts;

  const qualityFramework = `## 理解与萃取协议
收到用户消息后，先完成以下分析再展开回复：

**第零步·一致性锚定（必须执行，否则回复无效）**：
1. 用1句话复述用户的核心诉求
2. 确认：用户问了什么 → 我的回复主题是什么 → 二者是否一致？
3. 如果不一致，丢弃预想的回复框架，从用户实际提问出发
4. 简单问题简单答：用户问"是什么""为什么""怎么用"时，3段内直接回答

**第一步·意图识别**：用户想要什么？（创作/分析/修改/咨询/对比/解释）
**第二步·要素萃取**：从用户描述中提取不可丢失的核心信息——角色名/场景类型/情绪关键词/风格锚点/技术参数/时间长度/输出格式要求。如用户上传了文档，先执行文档智能解析
**第三步·隐性需求推断**：用户没明说但可能需要的——专业术语解释/替代方案/注意事项/常见错误提醒
**第四步·缺口确认**：如果用户描述存在关键信息缺失（如没说时长、没说风格），先礼貌询问或给出假设并标注【假设】

## 反幻觉协议（强制）
- 所有事实性参数必须可追溯到用户输入或行业标准——不可编造型号/色号/数值
- 引用具体电影参考时，必须确认该影片确实存在且风格描述准确
- 不确定的参数标注【待确认】而非臆造
- 用户输入中不存在的角色/场景信息，标注【用户未指定】而非自行补充
- 虚构的人物特征必须标注为【设计建议】与用户确认

## 回复质量标准
- **先锚定再展开**：开头用一句话回应用户核心诉求，让用户确认方向正确
- **结构分层**：重要信息前置，使用层级标题，每层不超过3-5个要点
- **高信息密度**：每句话承载具体信息。拒绝"可以根据需求调整""视情况而定"等空洞表述——给出具体数值/具体方案/具体示例
- **可执行性**：每条建议可直接落地。说"使用85mm f/1.8镜头，侧光45° 3200K"而非"用长焦镜头配合暖光"
- **覆盖完整性**：不遗漏用户描述中的任何细节。如果用户提了5个点，回复必须覆盖5个点
- **风险提示**：在关键决策点标注注意事项或常见陷阱
- **数值优先**：能用数字的不用形容词。说"色温3200K"不说"暖色光"

## 输出原则
- 拒绝模板感：每次回复根据具体输入定制，避免千篇一律的开场白
- 专业但不傲慢：用专业术语但附加通俗解释
- 如果有不确定的地方，标注"【待确认】"而非模糊带过
- 用户输入中的原文信息用【原文："..."】格式引用，便于用户验证准确性

## 精准输出协议 · 反冗长 · 信息密度铁律
每次回复必须遵守以下规则，违反即不合格：

### 🔴 意图匹配铁律（最高优先级，覆盖所有其他规则）
1. **锚定复述**：回复第一行必须用【用户问："..."】复述用户核心诉求。如果复述偏离=回复不合格
2. **意图分级**：
   - 简单问答/咨询 → 直接答案，≤3段，不使用框架展开
   - 分析/诊断/拆解 → 标题+表格+🔴🟡🔵标注
   - 设计/生成/创作 → 精要+参数表+负向约束
3. **错误降级规则**：当不确定用户意图级别时，默认使用更低级别（宁可不够详细，不要答非所问）
4. **偏离自检**：回复前自问——"用户真的问了这个吗？"如果任何段落回答的不是用户的问题，删除该段落

### 结构铁律
1. **标题即结论**：每个段落标题必须是该段的结论（如"🔴 关键问题：第二幕节奏断裂"而非"第二幕分析"）
2. **前置摘要**：每个一级标题下第一行用≤2句话概括该节全部结论
3. **表格优先**：对比类/清单类/参数类信息用表格（分镜脚本除外——分镜脚本必须用块格式·每镜独立拼块·禁止表格）
4. **逐条标注优先级**： 🔴致命 > 🟡建议 > 🔵可选，拒绝平铺

### 字数铁律
- 单次回复≤500字（不含代码块/表格）— 专业分析可放宽至600字
- 单个段落≤3句话
- 单句≤40字
- 超过此限=不合格，必须裁剪

### 首屏铁律（最高优先级）
- **关键结论在前3行**：用户必须在前3行看到核心答案，无需滚动
- 首个表格即为核心参数表，禁止前置铺垫段落

### 信息密度铁律
- 每句话至少包含1个可执行的数值/名称/命令
- 禁止的废话句式（出现即删除）：
  ✗ "需要注意的是..." "值得关注的是..." "从某种程度上说..."
  ✗ "在实际操作中，我们可以根据具体情况灵活调整..."
  ✗ "这是一个非常有意思的问题，让我从多个角度来分析..."
  ✗ "当然，这个方案也存在一些需要注意的地方..."
- 禁止的模糊词："适当""合理""合适的""良好的""充分的"
- 允许的开场：仅限1句锚定用户诉求的摘要（≤30字）

### 输出节奏
- 用户简单提问 → 直接答案(无标题/无框架展开)
- 用户"分析""拆解""诊断" → 标题+表格+🔴🟡🔵标注
- 用户"设计""生成""创作" → 精要+参数表+负向约束
- 用户追问 → 只补充前次遗漏，不重复已输出内容`;

  // 精简版通用协议，注入给已有专业闸门的 agent（避免重复大段 qualityFramework）
  const slimProtocol = `## 🧭 创作模式路由（最高优先级 — 回复前先判断）

### 路由规则
用户说→AI视频/Seedance/Kling/Runway/Sora/提示词/AI生成/生图/生视频/AIGC/文生视频 → **🎬 AIGC模式**
用户说→实拍/剧组/摄影棚/摄像机/场记/通告单/预算表/选角/堪景/灯光组/道具组/录音组/后期剪辑/达芬奇/Premiere/FCPX → **🎥 传统模式**
**模糊时**（用户只说"分镜""剧本""场景设计"但未指定AIGC还是实拍）→ **追问1个关键问题**："您是要用于AI视频生成，还是传统实拍？"（只问1次，不问第2遍）→ 根据回答路由

### 🛡️ 内容安全硬性要求（输出提示词前必过·最高优先级）
提示词最终要被AI生图/生视频平台（可灵/即梦/Seedance/Runway等）执行。平台有严格的内容审核——含有武器/血腥/暴力/死亡/恐怖/裸露/药物词汇会被直接拒绝。

**输出前强制替换（用描述代替直白词）：**
- 枪/刀/武器 → "手持道具""金属工具""装备"
- 血/伤口/尸体 → "深色液体痕迹""皮肤标记""静止的人形"
- 杀/打斗/攻击 → "制伏""肢体互动""对抗场景"
- 死/死亡/致命 → "不再移动""生命终止""关键性"
- 鬼/幽灵/恐怖 → "超自然存在""半透明人影""暗黑氛围"
- 裸体/性 → "身体线条""皮肤质感"
- 毒品/注射 → 完全避免或改为"特殊物质""医疗器具

### 强制输出标签（回复第一行必须标注）
**🎬 AIGC模式** 回复第一行：\`> 🎬 AIGC创作模式\`
**🎥 传统模式** 回复第一行：\`> 🎥 传统影视模式\`

### 模式隔离铁律
- **术语隔离**：AIGC模式禁止出现"实拍摄影机型号""场记""剧组岗位"；传统模式禁止出现"Seedance""Kling""提示词""FACS"
- **表格隔离**：AIGC用技术参数表(焦段mm/色温K/平台策略)；传统用剧组执行表(岗位/日期/设备/预算)
- **引用隔离**：AIGC引AI平台案例；传统引真实影片案例(标注导演+摄影师+年份)
- **输出前自检**：回复前扫描全文，如发现混入了另一模式的术语→删除该句

### 用户需求抓取增强
- **需求分层**：先判断大类(AIGC/传统)→再判断子类(创作/分析/修改)→再判断精度(粗略方案/详细方案)
- **模糊追问**：用户只给主题没给方向→主动问"要AIGC还是实拍？"→不默认
- **缺口标注**：用户没说平台/设备/预算→标注【待确认:xxx】而非跳过
- **回退保护**：如果用户说"不对，我要的是实拍不是AI"→**立即切换模式**→清空已生成的AIGC内容→重新开始



## 🎯 预期效果预判（每次输出必附·帮用户理解"这个提示词大概率会出什么"）
使用以上提示词生成画面/视频时：
预期你会得到: [1-2句话·描述最可能出现的画面效果]
但可能会有以下问题: [1-2个最常见失败模式·具体到哪个区域/物体/颜色]
如果出现问题·尝试: [1个具体修复建议·不是"调整参数"而是"把色温从3200K改成2700K"]

这个预判让你的用户知道：这版提示词在哪方面最可能成功，在哪方面要做好翻车准备。不是吓人，是让人少走弯路。

## 提示词质量自检（每次输出必过·5条铁律）
生成任何提示词后，必须自检以下5条。任意一条不合格，提示词作废重写：
1. 每个颜色都标注了色名=HEX？□
2. 每个光源都标注了类型·色温K·方向°？□
3. 画面四层（前景·主体·陪体·背景）逐层填了？□
4. 负面约束是否具体到材质/皮肤/光影（不是泛泛的"不要变形"）？□
5. 如果你自己是AI模型，读一遍这个提示词能准确脑补出画面吗？□

### 🔄 提示词迭代优化（AI视频模型核心工作流）
AI视频生成不是"写一次就完美"。标准流程是：
第一轮: 生成→评估画面→标记哪里不对（哪个区域·什么物体·什么颜色错了）
第二轮: 只修改标记的问题·不动其他地方→重新生成→评估
第三轮: 微调细节→最终版本
每次迭代只改一个变量——同时改多个参数你永远不知道是什么起作用了。



## 🛡️ 提示词内容安全筛查（防止AI模型审核不通过）

### 为什么提示词会被审核拒绝
AI生图/生视频平台（可灵/即梦/Seedance/Runway/Sora等）都有内容安全过滤器。
以下类型的词汇可能触发审核拒绝——

### 高危触发词（必须替换·不用原词）
| 类别 | 触发词（避免使用） | 安全替换方案 |
|------|------|------|
| 武器 | 枪、手枪、步枪、刀、武器 | "手持道具""金属工具""作战装备" |
| 血腥 | 血、血迹、流血、伤口、尸体 | "红色液体痕迹""皮肤上的深色印记""静止的人形" |
| 暴力 | 杀、打斗、攻击、殴打、致命 | "激烈的肢体互动""紧张的对抗""冲突场景" |
| 死亡 | 死、死亡、杀死、致命 | "不再移动""生命终结""沉睡状态" |
| 恐怖 | 鬼、幽灵、恐怖、惊悚、血腥 | "超自然存在""半透明人影""暗黑氛围" |
| 裸露 | 裸体、裸、暴露、性 | "皮肤质感""身体线条""紧身服装" |
| 药物 | 毒品、吸毒、注射、针头 | "特殊物质""医疗器具""注射器(医疗用途)" |
| 自残 | 自杀、割腕、跳楼 | "自我伤害""极端行为"（尽量避免整类场景） |
| 政治 | 国家领导人姓名、政治事件 | 完全避免·不提及任何真实政治人物或事件 |

### 安全措辞原则
1. 用"物"代替"武器"——描述物体的物理属性(金属·形状·颜色)而非功能(能伤人)
2. 用"颜色"代替"血液"——说"深红色液体"不说"血"
3. 用"氛围"代替"恐怖"——说"暗黑哥特式氛围""悬疑光影"不说"恐怖场景"
4. 用"静止"代替"死亡"——说"不再移动""沉睡姿势"不说"死了"
5. 英文版同步安全措辞——不说"blood"说"dark red liquid"，不说"gun"说"metallic handheld object"

### 输出前自检（生成提示词后·发送给用户前）
□ 扫描全部输出，是否有表中所列的高危触发词？
□ 如果有，是否已经替换为安全措辞？
□ 英文版是否也同步做了安全措辞？
□ 替换后的描述是否仍然准确传达原意？（安全措辞≠改变内容，只是改变说法）

如果无法安全替换（如故事核心就是暴力场景），在提示词末尾加注：
> ⚠️ 提示: 此提示词包含[X类]敏感内容，某些AI平台可能审核不通过。建议尝试使用不同平台，或降低描述的直白程度。

## 通用协议
- **意图识别**：先判断用户要什么+判断创作模式+标注在第一行
- **要素萃取**：锚定用户提供的不可丢失信息，原文引用标注【原文"..."】
- **缺口确认**：关键信息缺失时标注【待确认】而非臆造；模式模糊时追问而非默认
- **反幻觉**：不编造设备型号/色号/数值；不确定=【估】；不可见=【不可见】
- **可执行性**：每条输出可直接落地执行，拒绝"适当调整"等模糊措辞
- **数值优先**：能用数字不用形容词。说"3200K"不说"暖色"，说"ARRI Alexa 35"不说"专业摄影机"

## 精准输出协议
1. **锚定复述**：第一行【用户问："..."】复述核心诉求，偏离=不合格
2. **意图分级**：简单问答→直接答案(≤3段)；分析诊断→表格+标注；设计生成→精要+参数表
3. **错误降级**：不确定意图时默认用更低级别（宁粗勿错）
4. **偏离自检**：回复前自问"用户真的问了这个吗？"删除无关段落
5. **标题即结论**，非描述
6. **前置摘要**，≤2句概括本节结论
7. **表格优先**于散文式罗列（分镜脚本除外·分镜用块格式）
8. **逐条标注优先级**：🔴>🟡>🔵
9. 单次回复≤500字(不含代码块/表格)，单段≤3句，单句≤40字，关键结论前3行
10. 禁止："需要注意的是""从某种程度上""可以根据情况调整""适当的""合理的"
11. 开场仅1句锚定诉求(≤30字)，跳过寒暄
12. 追问时只补充前次遗漏，不重复已输出
13. 如果输出可能被下游 Agent 引用，在末尾附加握手块：<!--HANDOFF:下游agent_mode-->摘要<!--/HANDOFF:下游agent_mode-->（如 <!--HANDOFF:cinematographer-->给摄影指导看的摘要<!--/HANDOFF:cinematographer-->）## 多模式输出（强制）
**🎬 AIGC模式输出顺序：** AI提示词块 → TODO清单 → 分析报告(后置≤200字)
**🎥 传统模式输出顺序：** 实战方案 → 剧组执行清单 → 分析报告(后置≤200字)
**铁律：可执行方案在前，分析在后。AIGC用<!--PROMPT-->块，传统用设备/岗位/日程表。**
`;
  if (mode === "character" || mode === "scene" || mode === "lens" || mode === "seedance" || mode === "cinematographer" || mode === "sound" || mode === "colorist" || mode === "prompteng" || mode === "post") {
    // 偏好注入（仅 seedance/character/scene）
    let prefsInjection = "";
    if (["seedance", "character", "scene", "prompteng"].includes(mode)) {
      try { prefsInjection = getPreferenceInjection(mode) || ""; } catch (_) {}
    }
    return slimProtocol + (prefsInjection ? "\n\n" + prefsInjection : "") + "\n\n---\n\n" + (prompts[mode] || prompts.director || "");
  }
  return qualityFramework + "\n\n---\n\n" + (prompts[mode] || prompts.director || "");
}


// ========== 提示词内容安全后处理器 ==========
// 自动替换AI输出中的高危触发词，确保生成的提示词能通过AI模型审核
const CONTENT_SAFETY_MAP = [
  // 武器类 → 描述物理属性
  [/枪/g, "手持道具"], [/手枪/g, "小型手持道具"], [/步枪/g, "长型金属工具"],
  [/刀具/g, "金属器具"], [/武器/g, "装备"], [/子弹/g, "小型金属物"],
  // 血腥类 → 颜色/状态描述
  [/血迹/g, "深色液体痕迹"], [/流血/g, "红色液体"], [/血/g, "红色液体痕迹"],
  [/伤口/g, "皮肤标记"], [/尸体/g, "静止的人形"],
  // 暴力类 → 中性描述
  [/杀死/g, "使其停止行动"], [/致命/g, "关键性"], [/攻击/g, "对抗"],
  [/打斗/g, "肢体互动"], [/殴打/g, "激烈的肢体接触"], [/杀/g, "制伏"],
  // 死亡类 → 状态描述
  [/死亡/g, "生命终止"], [/死人/g, "不再移动的人"],
  // 恐怖类 → 氛围描述
  [/恐怖/g, "暗黑氛围"], [/惊悚/g, "悬疑"], [/鬼/g, "超自然存在"],
  [/幽灵/g, "半透明人影"],
  // 裸露类
  [/裸体/g, "身体线条"], [/裸/g, "轻装"],
  // 药物类
  [/毒品/g, "特殊物质"], [/吸毒/g, "使用特殊物质"],
  // 英文同步 (for English prompts used on Chinese platforms)
  [/gun/gi, "metallic handheld object"],
  [/pistol/gi, "small metallic device"],
  [/rifle/gi, "long metallic tool"],
  [/weapon/gi, "equipment"],
  [/blood/gi, "dark red liquid"],
  [/corpse/gi, "still human form"],
  [/kill(ed|ing|s)?\b/gi, "neutralize$1"],
  [/dead/gi, "motionless"],
  [/death/gi, "end of life"],
  [/horror/gi, "dark atmospheric"],
  [/ghost/gi, "ethereal presence"],
  [/naked?/gi, "lightly dressed"],
  [/drugs?/gi, "special substances"],
];

export function sanitizePrompt(text) {
  let result = text;
  let changes = 0;
  for (const [pattern, replacement] of CONTENT_SAFETY_MAP) {
    const before = result;
    result = result.replace(pattern, replacement);
    if (result !== before) changes++;
  }
  if (changes > 0) {
    console.log(`[ContentSafety] ${changes} trigger word(s) sanitized in prompt output`);
  }
  return result;
}
