/**
 * 用户偏好记忆引擎
 * 从点赞消息中提取偏好，为智能体提供个性化定制
 */

const PREFS_KEY = "director_studio_prefs";
const MAX_SNIPPETS = 10;
const MIN_LIKES_FOR_INJECTION = 2; // 至少2个点赞才注入偏好

// 风格关键词库
const STYLE_KEYWORDS = [
  "赛博朋克", "古装", "仙侠", "悬疑", "科幻", "写实", "废土",
  "蒸汽朋克", "奇幻", "都市", "战争", "西部", "黑色电影", "恐怖",
  "日系", "韩系", "欧美", "国风", "复古", "未来主义", "极简",
  "宫廷", "民国", "武侠", "谍战", "灾难", "爱情", "喜剧",
];

const COLOR_KEYWORDS = [
  "金色调", "冷色调", "暖色调", "暗黑", "明亮", "高饱和",
  "低饱和", "黑白", "单色", "霓虹", "自然光", "黄昏", "蓝调",
  "青色", "紫调", "红调", "橙调", "绿调", "琥珀",
];

function loadPreferences() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { global: { preferredStyles: [], preferredColorPalettes: [], preferredDetailLevel: "", preferredOutputFormat: "" } };
}

function savePreferences(prefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (_) {}
}

/**
 * 从消息文本中提取关键词
 */
function extractKeywords(text, keywordBank) {
  const found = [];
  for (const kw of keywordBank) {
    if (text.includes(kw)) found.push(kw);
  }
  return found;
}

/**
 * 推断细节偏好：详细/精炼
 */
function inferDetailLevel(text) {
  return text.length > 1500 ? "详细型" : "精炼型";
}

/**
 * 推断格式偏好
 */
function inferFormat(text) {
  const tableLines = (text.match(/\|/g) || []).length;
  const paragraphBreaks = (text.match(/\n\n/g) || []).length;
  if (tableLines > paragraphBreaks * 2) return "表格型";
  if (text.includes("🔴") || text.includes("🟡") || text.includes("🔵")) return "标注型";
  return "段落型";
}

/**
 * 从点赞消息中提取并更新偏好
 */
export function updatePreferences(mode, likedMessages) {
  const prefs = loadPreferences();

  if (!prefs[mode]) {
    prefs[mode] = { likedMessageCount: 0, topKeywords: [], topStyles: [], recentLikedSnippets: [] };
  }

  const agentPrefs = prefs[mode];
  agentPrefs.likedMessageCount = likedMessages.length;

  // 收集所有点赞文本
  const allText = likedMessages.map(m => m.text || "").join("\n");

  // 提取风格偏好
  const styles = extractKeywords(allText, STYLE_KEYWORDS);
  agentPrefs.topStyles = [...new Set(styles)].slice(0, 5);

  // 提取色彩偏好
  const colors = extractKeywords(allText, COLOR_KEYWORDS);
  prefs.global.preferredColorPalettes = [...new Set([...prefs.global.preferredColorPalettes, ...colors])].slice(0, 5);

  // 合并全局风格
  prefs.global.preferredStyles = [...new Set([...prefs.global.preferredStyles, ...styles])].slice(0, 8);

  // 全局偏好细节
  if (likedMessages.length > 0) {
    const lastLiked = likedMessages[likedMessages.length - 1];
    prefs.global.preferredDetailLevel = inferDetailLevel(lastLiked.text || "");
    prefs.global.preferredOutputFormat = inferFormat(lastLiked.text || "");
  }

  // 保存最近点赞摘要
  agentPrefs.recentLikedSnippets = likedMessages.slice(-MAX_SNIPPETS).map(m => {
    const text = m.text || "";
    return text.slice(0, 200) + (text.length > 200 ? "..." : "");
  });

  // 提取高频关键词（从所有点赞消息和用户原始消息）
  const allWords = allText.replace(/[^一-龥a-zA-Z0-9]/g, " ").split(/\s+/).filter(w => w.length >= 2);
  const freq = {};
  allWords.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  agentPrefs.topKeywords = Object.entries(freq)
    .filter(([, c]) => c >= 2)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([w]) => w);

  savePreferences(prefs);
  return prefs;
}

/**
 * 获取偏好注入文本（用于 system prompt）
 */
export function getPreferenceInjection(mode) {
  const prefs = loadPreferences();
  const agentPrefs = prefs[mode];

  if (!agentPrefs || agentPrefs.likedMessageCount < MIN_LIKES_FOR_INJECTION) {
    return "";
  }

  const parts = [];

  // prompteng-specific preferences
  if (mode === "prompteng") {
    if (agentPrefs.topPlatforms?.length > 0) {
      parts.push(`- 偏好目标平台: ${agentPrefs.topPlatforms.join(" / ")}`);
    }
    if (agentPrefs.topDetailLevels?.length > 0) {
      parts.push(`- 偏好输出模式: ${agentPrefs.topDetailLevels.join(" / ")}`);
    }
    if (agentPrefs.recentLikedSnippets?.length > 0) {
      const sample = agentPrefs.recentLikedSnippets[agentPrefs.recentLikedSnippets.length - 1];
      parts.push(`- 参考模板: 用户喜欢类似这样的回复 — "${sample.slice(0, 120)}..."`);
    }
    if (parts.length === 0) return "";
    return `\n\n## 用户偏好记忆\n用户已对 ${agentPrefs.likedMessageCount} 条提示词工程师回复点赞。请根据以下偏好定制本次输出：\n${parts.join("\n")}\n优先使用用户偏好的平台和模式，除非用户本次明确指定了不同的选择。`;
  }

  // visual/creative agent preferences (existing)
  if (agentPrefs.topStyles?.length > 0) {
    parts.push(`- 偏好风格: ${agentPrefs.topStyles.join(" / ")}`);
  }
  if (prefs.global.preferredColorPalettes?.length > 0) {
    parts.push(`- 偏好色调: ${prefs.global.preferredColorPalettes.slice(0, 3).join(" / ")}`);
  }
  if (prefs.global.preferredDetailLevel) {
    parts.push(`- 输出偏好: ${prefs.global.preferredDetailLevel} ${prefs.global.preferredOutputFormat}`);
  }
  if (agentPrefs.recentLikedSnippets?.length > 0) {
    const sample = agentPrefs.recentLikedSnippets[agentPrefs.recentLikedSnippets.length - 1];
    parts.push(`- 参考模板: 用户喜欢类似这样的回复 — "${sample.slice(0, 120)}..."`);
  }

  if (parts.length === 0) return "";

  return `\n\n## 用户偏好记忆\n用户已对 ${agentPrefs.likedMessageCount} 条回复点赞。请根据以下偏好定制本次输出：\n${parts.join("\n")}\n请保持与用户偏好一致的风格和输出格式，但不要机械复制——基于偏好做创造性发挥。`;
}

/**
 * 获取指定 mode 下所有点赞消息（从 App.jsx 调用时传入 messages）
 */
export function getLikedMessages(messages, mode) {
  return messages.filter(m => m.role === "assistant" && m.liked && !m.error);
}
