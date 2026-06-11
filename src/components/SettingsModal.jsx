import { useState, useEffect, useRef } from "react";
import { MODEL_PRESETS, loadKeys, saveKey } from "../lib/api";

export default function SettingsModal({ activeProvider, onSave, onClose }) {
  const [keys, setKeys] = useState({});
  const [provider, setProvider] = useState(activeProvider || "deepseek");
  const [customEp, setCustomEp] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [proxyUrl, setProxyUrl] = useState(() => { try { return localStorage.getItem("api_proxy_url") || ""; } catch (_) { return ""; } });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { ok: true } | { ok: false, msg }
  const modalRef = useRef(null);

  useEffect(() => {
    setKeys(loadKeys());
    const saved = JSON.parse(localStorage.getItem("custom_cfg") || "{}");
    if (saved.endpoint) setCustomEp(saved.endpoint);
    if (saved.model) setCustomModel(saved.model);
  }, []);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  async function handleTest() {
    const key = keys[provider];
    if (!key) { setTestResult({ ok: false, msg: "请先输入 API Key" }); return; }
    setTesting(true);
    setTestResult(null);
    try {
      const preset = MODEL_PRESETS[provider] || MODEL_PRESETS.deepseek;
      const endpoint = proxyUrl || (provider === "custom" ? customEp : preset.endpoint);
      const model = provider === "custom" ? customModel : preset.model;
      const headers = { "Content-Type": "application/json" };
      // keyInBody: 密钥放在请求体（如 ModelsLab/MiMo Pro）
      if (!preset.keyInBody) {
        headers[preset.authHeader] = preset.authPrefix + key;
      }

      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10000);

      // 发送最小请求测试连通性
      const isAnthropic = preset.protocol === "anthropic";
      let bodyObj = isAnthropic
        ? { model, max_tokens: 1, messages: [{ role: "user", content: "hi" }] }
        : { model, max_tokens: 1, messages: [{ role: "user", content: "hi" }] };
      // 某些平台（如 ModelsLab）要求密钥在请求体中
      if (preset.keyInBody) bodyObj[preset.authHeader] = key;
      const body = JSON.stringify(bodyObj);

      const res = await fetch(endpoint, { method: "POST", headers, body, signal: ctrl.signal });
      clearTimeout(timer);

      if (res.status === 401 || res.status === 403) {
        setTestResult({ ok: false, msg: "API Key 无效" });
      } else if (res.status === 429) {
        setTestResult({ ok: true, msg: "连接正常（频率限制中）" });
      } else if (res.ok) {
        setTestResult({ ok: true, msg: "连接成功" });
      } else if (res.status === 400) {
        // 400: 请求格式可能有问题，读取错误详情
        const errText = await res.text().catch(() => "");
        const short = errText.slice(0, 120);
        setTestResult({ ok: false, msg: `请求被拒绝 (400): ${short || "请检查模型名称和端点"}` });
      } else {
        const errText = await res.text().catch(() => "");
        setTestResult({ ok: false, msg: `连接失败 (${res.status}): ${errText.slice(0, 80)}` });
      }
    } catch (e) {
      setTestResult({ ok: false, msg: `网络错误: ${e.message?.slice(0, 60)}` });
    } finally {
      setTesting(false);
    }
  }

  function handleSave() {
    // Save key for current provider
    saveKey(provider, keys[provider] || "");
    // Save custom endpoint if applicable
    if (provider === "custom") {
      localStorage.setItem("custom_cfg", JSON.stringify({ endpoint: customEp, model: customModel }));
    }
    // Also save active provider pref
    localStorage.setItem("active_provider", provider);
    try { localStorage.setItem("api_proxy_url", proxyUrl); } catch (_) {}
    onSave({ provider, keys, customEp, customModel, proxyUrl });
  }

  const preset = MODEL_PRESETS[provider];
  const providerList = Object.entries(MODEL_PRESETS).filter(([k]) => k !== "custom");

  return (
    <>
      <div className="modal-overlay fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ pointerEvents: "none" }}>
        <div ref={modalRef} role="dialog" aria-modal="true" aria-label="设置" className="modal-card p-5 w-full max-w-md max-h-[90vh] overflow-y-auto" style={{ pointerEvents: "auto" }}>

          <h2 className="sidebar-brand text-lg mb-4" style={{ color: "var(--gold)" }}>设置</h2>

          {/* Model Selector */}
          <label className="block text-xs mb-1.5 opacity-50 uppercase tracking-wider">模型提供商</label>
          <div className="grid grid-cols-3 gap-1.5 mb-4">
            {providerList.map(([k, v]) => (
              <button key={k} onClick={() => setProvider(k)}
                className={`text-xs px-2 py-2 rounded-lg border transition-all text-center ${
                  provider === k
                    ? "border-[var(--gold)] bg-[var(--gold)]/10 text-[var(--gold)]"
                    : "border-[var(--border-subtle)] opacity-50 hover:opacity-80"
                }`}>
                <div className="font-medium">{v.name}</div>
                <div className="opacity-40 text-[10px]">{v.provider}</div>
              </button>
            ))}
            {/* Custom */}
            <button key="custom" onClick={() => setProvider("custom")}
              className={`text-xs px-2 py-2 rounded-lg border transition-all text-center ${
                provider === "custom"
                  ? "border-[var(--gold)] bg-[var(--gold)]/10 text-[var(--gold)]"
                  : "border-[var(--border-subtle)] opacity-50 hover:opacity-80"
              }`}>
              <div className="font-medium">自定义</div>
              <div className="opacity-40 text-[10px]">兼容 OpenAI</div>
            </button>
          </div>

          {/* Custom endpoint fields */}
          {provider === "custom" && (
            <div className="space-y-2 mb-4 p-3 rounded-lg" style={{ background: "rgba(0,0,0,0.2)" }}>
              <input value={customEp} onChange={(e) => setCustomEp(e.target.value)}
                placeholder="API 端点 URL (https://...)" className="w-full px-3 py-2 rounded-lg text-xs"
                style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-subtle)", outline: "none" }} />
              <input value={customModel} onChange={(e) => setCustomModel(e.target.value)}
                placeholder="模型名称 (gpt-4o / claude-3-opus...)" className="w-full px-3 py-2 rounded-lg text-xs"
                style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-subtle)", outline: "none" }} />
            </div>
          )}

          {/* 代理地址（国内用户必需） */}
          <label className="block text-xs mb-1.5 opacity-50 uppercase tracking-wider">
            🌐 代理地址（国内访问海外 API 时使用）
          </label>
          <input value={proxyUrl} onChange={(e) => setProxyUrl(e.target.value)}
            placeholder="留空直连 / 填入代理地址 (如 https://your-proxy.com/v1)"
            className="w-full px-3 py-2.5 rounded-lg text-xs mb-4"
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-subtle)", outline: "none" }} />

          {/* API Key */}
          <label className="block text-xs mb-1.5 opacity-50 uppercase tracking-wider">
            {preset.provider} API Key
          </label>
          <div className="flex gap-2 mb-2">
            <input type="password" value={keys[provider] || ""}
              onChange={(e) => { setKeys({ ...keys, [provider]: e.target.value }); setTestResult(null); }}
              placeholder={provider === "deepseek" ? "sk-..." : provider === "openai" ? "sk-proj-..." : "输入 Key..."}
              className="flex-1 px-3 py-2.5 rounded-lg text-sm"
              style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-subtle)", outline: "none" }}
              autoFocus />
            <button type="button" onClick={handleTest} disabled={testing || !keys[provider]}
              className="px-3 py-2.5 rounded-lg text-xs shrink-0 transition-all disabled:opacity-30"
              style={{ background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.2)", color: "var(--gold)" }}>
              {testing ? "测试中..." : "测试连接"}
            </button>
          </div>
          {testResult && (
            <div className={`text-xs mb-2 px-2 py-1 rounded ${testResult.ok ? "text-green-400 bg-green-500/10" : "text-red-400 bg-red-500/10"}`}>
              {testResult.ok ? "✅ " : "❌ "}{testResult.msg}
            </div>
          )}

          <p className="text-xs mb-5 opacity-30 leading-relaxed">
            密钥仅保存在本地浏览器。每个模型提供商可独立配置。
            {preset.endpoint && <span className="block mt-1 opacity-50">{preset.endpoint}</span>}
          </p>

          {/* Info */}
          <div className="text-xs opacity-25 mb-4 p-3 rounded-lg" style={{ background: "rgba(0,0,0,0.15)" }}>
            <div className="font-medium mb-1">支持的协议</div>
            <div>· Anthropic Messages API（DeepSeek / Claude）</div>
            <div>· OpenAI Chat Completions（GPT / 通义千问 / GLM / Kimi）</div>
            <div className="mt-1">· 自动重试 3 次 + 指数退避</div>
            <div>· 90 秒请求超时</div>
            <div>· 离线自动检测</div>
          </div>

          <div className="flex gap-2 justify-end">
            <button onClick={onClose} className="btn-ghost text-sm">取消</button>
            <button onClick={handleSave} className="btn-send px-5 py-2 text-sm">保存</button>
          </div>
        </div>
      </div>
    </>
  );
}
