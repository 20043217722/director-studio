// iPhone 安装服务器 — HTTPS + 正确 MIME 类型提供配置文件
// 用法: node ios-install.js
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const PORT = 8899;
const HTTPS_PORT = 8944;
const CONFIG_FILE = path.join(__dirname, "public", "director-studio.mobileconfig");

// 生成自签名证书（iOS 接受安装用途的自签名证书）
function generateCert() {
  const { execSync } = require("child_process");
  const certDir = path.join(__dirname, ".certs");
  const keyPath = path.join(certDir, "key.pem");
  const certPath = path.join(certDir, "cert.pem");
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
  fs.mkdirSync(certDir, { recursive: true });
  execSync(`openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 3650 -nodes -subj "/CN=DirectorStudio" 2>/dev/null`, { timeout: 10000 }).toString();
  return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
}

let ssl = null;
try { ssl = generateCert(); } catch (_) { console.log("SSL证书生成失败，仅使用HTTP"); }

// 获取本机局域网 IP
function getLanIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return "localhost";
}

// 安装页面 HTML
const INSTALL_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>安装导演工作室</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;background:#F0F7FF;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
.card{background:#fff;border-radius:20px;padding:40px 30px;max-width:400px;width:100%;text-align:center;box-shadow:0 4px 24px rgba(14,165,233,.12)}
h1{font-size:1.5rem;color:#1E3A5F;margin-bottom:8px}
p{font-size:.9rem;color:#8CA3B8;margin-bottom:24px}
.btn{display:inline-block;background:#0EA5E9;color:#fff;font-weight:600;font-size:1rem;padding:14px 36px;border-radius:14px;text-decoration:none;box-shadow:0 4px 16px rgba(14,165,233,.25)}
.steps{text-align:left;margin-top:28px;padding-top:20px;border-top:1px solid rgba(14,165,233,.12)}
.steps p{font-size:.8rem;color:#5B7A9A;margin-bottom:8px}
</style>
</head>
<body><div class="card">
<h1>🎬 导演工作室</h1><p>AI 电影导演创作平台</p>
<a class="btn" href="/profile.mobileconfig">📥 点击安装到 iPhone</a>
<div class="steps">
<p>① 点击上方按钮</p><p>② 弹窗中点「允许」</p>
<p>③ 打开「设置」→ 顶部「已下载描述文件」</p>
<p>④ 点「安装」→ 输入密码</p><p>⑤ 桌面出现图标 ✓</p>
</div></div></body></html>`;

function createServer(opts, port, label) {
  const srv = (opts ? https.createServer(opts) : http.createServer)((req, res) => {
    console.log(`${req.method} ${req.url}`);
    if (req.url === "/profile.mobileconfig") {
      res.writeHead(200, {
        "Content-Type": "application/x-apple-aspen-config",
        "Content-Disposition": 'attachment; filename="director-studio.mobileconfig"',
      });
      fs.createReadStream(CONFIG_FILE).pipe(res);
    } else {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(INSTALL_HTML);
    }
  });
  srv.listen(port, "0.0.0.0", () => {
    const ip = getLanIP();
    const proto = opts ? "https" : "http";
    console.log(`  ${label}: ${proto}://${ip}:${port}`);
  });
  return srv;
}

const httpServer = createServer(null, PORT, "HTTP (兼容)");
const httpsServer = ssl ? createServer(ssl, HTTPS_PORT, "HTTPS (推荐)") : null;

const ip = getLanIP();
console.log("\n========================================");
console.log("  iPhone 安装服务器已启动");
console.log("========================================");
console.log(`\n  iPhone Safari 打开 (推荐HTTPS):\n  https://${ip}:${HTTPS_PORT}\n`);
if (!ssl) console.log(`  或 (HTTP):\n  http://${ip}:${PORT}\n`);
console.log('  首次访问HTTPS会提示不安全，点「继续」即可');
console.log("  点击页面中的安装按钮即可");
console.log("\n  按 Ctrl+C 关闭服务器");
console.log("========================================\n");
