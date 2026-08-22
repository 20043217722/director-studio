/**
 * Browser-side file parsing: images → base64, docs → text
 * 优化：GBK编码检测、PDF结构保留、DOCX表格提取、MD支持、文件大小检查
 */
import mammoth from "mammoth";

// ---- MIME / extension detection ----
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/bmp", "image/tiff", "image/heic", "image/heif", "image/avif", "image/x-icon"]);
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".jpe", ".jfif", ".png", ".gif", ".webp", ".svg", ".bmp", ".tiff", ".tif", ".heic", ".heif", ".avif", ".ico"]);

// 文件大小限制: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

export function isImage(file) {
  const byType = IMAGE_TYPES.has(file.type);
  const ext = "." + (file.name || "").split(".").pop().toLowerCase();
  return byType || IMAGE_EXTS.has(ext);
}

// ---- Image → base64 ----
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const mime = dataUrl.match(/^data:(.+?);/)?.[1] || file.type || "image/jpeg";
      const base64 = dataUrl.split(",")[1];
      resolve({ base64, mime });
    };
    reader.onerror = () => reject(new Error("文件读取失败，请重试"));
    reader.readAsDataURL(file);
  });
}

// 压缩图片后转 base64（避免超出模型上下文限制）
const MAX_DIM = 1568; // 最大宽高，约 2.5MP，适合视觉模型
const JPEG_QUALITY = 0.85;

export function fileToBase64Resized(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width: w, height: h } = img;
      // 小图不缩放
      if (w <= MAX_DIM && h <= MAX_DIM) {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result;
          const mime = dataUrl.match(/^data:(.+?);/)?.[1] || file.type || "image/jpeg";
          resolve({ base64: dataUrl.split(",")[1], mime });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
        return;
      }
      // 等比缩放到 MAX_DIM 以内
      const ratio = Math.min(MAX_DIM / w, MAX_DIM / h);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error("图片压缩失败")); return; }
        const reader = new FileReader();
        reader.onload = () => resolve({ base64: reader.result.split(",")[1], mime: "image/jpeg" });
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      }, "image/jpeg", JPEG_QUALITY);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("图片加载失败")); };
    img.src = url;
  });
}

// ---- Image → object URL for display ----
export function fileToObjectURL(file) {
  return URL.createObjectURL(file);
}

// ========== 编码检测与解码 ==========

/**
 * 智能解码文本文件：尝试 UTF-8 → GBK → GB2312
 * 解决中国用户常见的乱码问题（Windows 中文软件默认保存为 GBK）
 */
async function decodeTextFile(file) {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);

  // 1. 先试 UTF-8（BOM 检测）
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return new TextDecoder("utf-8").decode(bytes.slice(3));
  }
  // UTF-16 LE BOM
  if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
    return new TextDecoder("utf-16le").decode(bytes.slice(2));
  }
  // UTF-16 BE BOM
  if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
    return new TextDecoder("utf-16be").decode(bytes.slice(2));
  }

  // 2. UTF-8 解码 + 乱码检测
  const utf8Text = new TextDecoder("utf-8").decode(bytes);
  if (!hasEncodingErrors(utf8Text)) return utf8Text;

  // 3. 尝试 GBK
  try {
    const gbkText = new TextDecoder("gbk").decode(bytes);
    if (!hasEncodingErrors(gbkText)) return gbkText;
  } catch (_) {}

  // 4. 尝试 GB18030（GBK 的超集）
  try {
    const gb18030Text = new TextDecoder("gb18030").decode(bytes);
    return gb18030Text;
  } catch (_) {}

  // 5. 回退到 UTF-8（带替换字符）
  return utf8Text.replace(/�/g, "");
}

/**
 * 检测文本是否包含乱码特征：大量 � 替换字符、不可打印字符比例过高
 */
function hasEncodingErrors(text) {
  if (!text) return false;
  const replacementChars = (text.match(/�/g) || []).length;
  if (replacementChars > text.length * 0.01) return true;
  // 检测异常比例的控制字符
  const controlChars = text.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g) || [];
  return controlChars.length > text.length * 0.05;
}

// ========== 文档内容清洗 ==========

/** 去除多余空白和翻译噪音 */
function cleanText(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")   // 最多保留3个连续换行
    .replace(/[ \t]{2,}/g, " ")      // 多余空格合并
    .replace(/^\s+|\s+$/g, "")
    .trim();
}

/** 自动检测文档类型并添加标记 */
function detectDocType(text) {
  const sample = text.slice(0, 500);
  if (/镜号|分镜|故事板|景别|机位|运动|^第[一二三1-9].*[场幕]/.test(sample)) return "剧本/分镜";
  if (/^第[一二三1-9].*[章回]|Chapter\s+\d|^[0-9]+\.\s/.test(sample)) return "小说/章节";
  if (/预算|通告|演员表|拍摄日程|场次/.test(sample)) return "通告/预算表";
  if (/合同|协议|甲方|乙方/.test(sample)) return "合同/协议";
  if (/诊断|分析|评估/.test(sample)) return "分析报告";
  return "";
}

// ========== 各格式解析器 ==========

// ---- .txt / .csv / .md / .html ----
async function parseText(file) {
  const text = await decodeTextFile(file);
  return cleanText(text);
}

// ---- .docx（结构化提取）----
async function parseDocx(file) {
  const MAX_SIZE = 20 * 1024 * 1024; // 20MB for DOCX
  if (file.size > MAX_SIZE) throw new Error(`文档过大 (${(file.size / 1024 / 1024).toFixed(1)}MB)，请拆分为小文件`);

  const buf = await file.arrayBuffer();

  // 方案1: 尝试 mammoth HTML → 保留结构
  try {
    const htmlResult = await mammoth.convertToHtml({ arrayBuffer: buf });
    if (htmlResult.value) {
      const html = htmlResult.value;
      // 将 HTML 转换为保留结构的 markdown 式文本
      let text = html
        .replace(/<h1>/gi, "\n\n# ").replace(/<\/h1>/gi, "\n")
        .replace(/<h2>/gi, "\n\n## ").replace(/<\/h2>/gi, "\n")
        .replace(/<h3>/gi, "\n\n### ").replace(/<\/h3>/gi, "\n")
        .replace(/<table>/gi, "\n").replace(/<\/table>/gi, "\n")
        .replace(/<tr>/gi, "").replace(/<\/tr>/gi, "\n")
        .replace(/<td[^>]*>/gi, " | ").replace(/<\/td>/gi, "")
        .replace(/<th[^>]*>/gi, " | ").replace(/<\/th>/gi, "")
        .replace(/<p>/gi, "").replace(/<\/p>/gi, "\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<li>/gi, "\n- ").replace(/<\/li>/gi, "")
        .replace(/<[^>]+>/g, "");
      text = cleanText(text);
      if (text.trim().length > 10) return text;
    }
  } catch (_) {}

  // 方案2: 回退到纯文本提取
  const rawResult = await mammoth.extractRawText({ arrayBuffer: buf });
  const text = cleanText(rawResult.value || "");
  if (!text.trim()) return "(文档为空)";

  const docType = detectDocType(text);
  return docType ? `[${docType}]\n\n${text}` : text;
}

// ---- .xlsx / .xls（智能表格提取）----
async function parseExcel(file) {
  const MAX_SIZE = 15 * 1024 * 1024; // 15MB
  if (file.size > MAX_SIZE) throw new Error(`表格过大 (${(file.size / 1024 / 1024).toFixed(1)}MB)`);

  const buf = await file.arrayBuffer();
  const XLSX = await import("xlsx");
  const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
  const sheets = [];

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const ref = ws["!ref"];
    const range = ref ? XLSX.utils.decode_range(ref) : { e: { r: 0, c: 0 } };
    const rows = Math.min(range.e.r - range.s.r + 1, 5000); // 最多5000行

    // 转 CSV 并控制行数
    const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false, strip: true });
    const lines = csv.split("\n").slice(0, rows + 1);

    if (lines.length <= 1) {
      sheets.push(`【工作表：${name}】\n(空表)`);
      continue;
    }

    // 检测是否有明显表头
    const header = lines[0];
    const dataLines = lines.slice(1).filter(l => l.trim());
    sheets.push(`【工作表：${name}】(共 ${dataLines.length} 行)\n${header}\n${"-".repeat(Math.min(header.length, 60))}\n${dataLines.join("\n")}`);
  }

  const result = sheets.join("\n\n---\n\n") || "(表格为空)";

  const docType = detectDocType(result);
  return docType ? `[${docType}]\n\n${result}` : result;
}

// ---- .pdf（结构化文本提取 + 页面标记）----
async function parsePdf(file) {
  const MAX_SIZE = 25 * 1024 * 1024; // 25MB
  if (file.size > MAX_SIZE) throw new Error(`PDF 过大 (${(file.size / 1024 / 1024).toFixed(1)}MB)`);

  const buf = await file.arrayBuffer();
  const pdfjsLib = await import("pdfjs-dist/build/pdf.mjs");

  // 设置 worker（pdfjs 需要）
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();
  } catch (_) {}

  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const totalPages = pdf.numPages;
  const MAX_PAGES = 200;
  const pages = Math.min(totalPages, MAX_PAGES);

  const chunks = [];
  let totalText = 0;

  for (let i = 1; i <= pages; i++) {
    // 每 5 页让出主线程
    if (i % 5 === 0) await new Promise(r => setTimeout(r, 0));

    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    // 按 Y 坐标聚合文本行（保留阅读顺序）
    const lines = [];
    let currentY = null;
    let currentLine = [];

    for (const item of content.items) {
      if (currentY === null || Math.abs(item.transform[5] - currentY) > 2) {
        if (currentLine.length > 0) {
          lines.push(currentLine.join(" "));
          currentLine = [];
        }
        currentY = item.transform[5];
      }
      currentLine.push(item.str);
    }
    if (currentLine.length > 0) lines.push(currentLine.join(" "));

    const pageText = lines.join("\n").trim();
    if (pageText) {
      if (pages > 1) chunks.push(`--- 第 ${i} 页 ---\n${pageText}`);
      else chunks.push(pageText);
      totalText += pageText.length;
    }
  }

  let text = chunks.join("\n\n");
  if (!text.trim()) return "(PDF 为空或无法识别文本)";

  if (totalPages > MAX_PAGES) {
    text += `\n\n(仅提取前 ${MAX_PAGES} 页，共 ${totalPages} 页)`;
  }

  text = cleanText(text);
  const docType = detectDocType(text);
  return docType ? `[${docType}]\n\n${text}` : text;
}

// ---- .pptx（PPT 文本提取）----
async function parsePptx(file) {
  // PPTX 是 ZIP 压缩包，浏览器端完整解析较复杂
  // 建议用户导出为 PDF 后上传
  return "(PPT 文件暂不支持直接文本提取，请导出为 PDF 后重新上传)";
}

// ========== 主入口 ==========
export async function parseFile(file) {
  const name = file.name || "";
  const type = file.type || "";
  const ext = name.split(".").pop()?.toLowerCase() || "";

  // 文件大小检查
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`文件过大 (${(file.size / 1024 / 1024).toFixed(1)}MB)，上限 ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  // Images
  if (isImage(file)) {
    const { base64, mime } = await fileToBase64(file);
    return { kind: "image", base64, mime, name };
  }

  // Documents — 按扩展名和 MIME 类型路由
  let text;
  const isDocx = ext === "docx" || type.includes("word") || type.includes("docx");
  const isExcel = ext === "xlsx" || ext === "xls" || type.includes("spreadsheet") || type.includes("excel");
  const isPdf = ext === "pdf" || type.includes("pdf");
  const isPptx = ext === "pptx" || ext === "ppt" || type.includes("presentation") || type.includes("powerpoint");
  const isText = ext === "txt" || ext === "csv" || ext === "md" || ext === "log" || ext === "json" || ext === "xml" || ext === "srt" || ext === "ass" || type.includes("text");
  const isHtml = ext === "html" || ext === "htm" || type.includes("html");
  const isScript = ext === "fountain" || ext === "fdx" || ext === "celtx";

  try {
    if (isDocx) {
      text = await parseDocx(file);
    } else if (isExcel) {
      text = await parseExcel(file);
    } else if (isPdf) {
      text = await parsePdf(file);
    } else if (isPptx) {
      text = await parsePptx(file);
    } else if (isHtml) {
      // HTML 转纯文本
      const raw = await decodeTextFile(file);
      text = raw.replace(/<[^>]+>/g, "").replace(/\n{3,}/g, "\n\n");
      text = cleanText(text);
    } else if (isScript) {
      // 剧本格式 — 保持原样
      text = cleanText(await decodeTextFile(file));
    } else if (isText) {
      text = await parseText(file);
    } else {
      // 未知格式 — 尝试作为文本读取
      try {
        text = await decodeTextFile(file);
        text = cleanText(text);
      } catch (_) {
        text = `(不支持的格式: .${ext || "未知"})\n支持: txt/csv/md/docx/xlsx/pdf/pptx/html/图片`;
      }
    }
  } catch (e) {
    text = `(解析失败: ${e.message})`;
  }

  const finalText = text?.trim();
  return {
    kind: "document",
    text: finalText || "(文件为空)",
    name,
  };
}
