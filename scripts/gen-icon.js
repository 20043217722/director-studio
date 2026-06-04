// Generate 180x180 PNG icon for iOS Web Clip + PWA
const { createCanvas } = require("@napi-rs/canvas");
const { writeFileSync } = require("fs");
const { join } = require("path");

async function main() {
  const canvas = createCanvas(180, 180);
  const ctx = canvas.getContext("2d");

  // Rounded rect background
  const r = 36;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(180 - r, 0);
  ctx.quadraticCurveTo(180, 0, 180, r);
  ctx.lineTo(180, 180 - r);
  ctx.quadraticCurveTo(180, 180, 180 - r, 180);
  ctx.lineTo(r, 180);
  ctx.quadraticCurveTo(0, 180, 0, 180 - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fillStyle = "#0EA5E9";
  ctx.fill();

  // Clapperboard top bar (gold)
  ctx.fillStyle = "#FBBF24";
  roundRect(ctx, 24, 48, 132, 16, 4);
  ctx.fill();

  // Clapperboard white body
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  roundRect(ctx, 24, 64, 132, 78, 6);
  ctx.fill();

  // Lines on clapperboard
  ctx.strokeStyle = "rgba(14,165,233,0.25)";
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(36, 84); ctx.lineTo(144, 84); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(36, 100); ctx.lineTo(132, 100); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(36, 116); ctx.lineTo(138, 116); ctx.stroke();

  // Film perforations
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath(); ctx.arc(16, 56, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(16, 80, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(16, 104, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(16, 128, 4, 0, Math.PI * 2); ctx.fill();

  // Save PNG
  const png = canvas.toBuffer("image/png");
  writeFileSync(join(__dirname, "public", "icon-180.png"), png);
  writeFileSync(join(__dirname, "public", "icon-192.png"), png);

  // Also make a 512 version
  const big = createCanvas(512, 512);
  const bctx = big.getContext("2d");
  bctx.drawImage(canvas, 0, 0, 180, 180, 0, 0, 512, 512);
  writeFileSync(join(__dirname, "public", "icon-512.png"), big.toBuffer("image/png"));

  console.log("Icons generated: icon-180.png, icon-192.png, icon-512.png");
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

main().catch(e => { console.error(e.message); process.exit(1); });
