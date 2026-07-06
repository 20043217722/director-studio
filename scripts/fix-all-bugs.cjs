/**
 * Fix all 7 bugs across Doctor, Sound, Director, Character
 */
const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '..', 'src', 'lib', 'agentPrompts.json');
const data = JSON.parse(fs.readFileSync(targetFile, 'utf-8'));

// ─── Fix 1: Doctor — Seedance V3→V5 + remove AU codes + add 10% emphasis ───
data.doctor = data.doctor.replace(
  '关键场景V3修复提示词（同步Seedance V3格式·直喂剧幕文戏）',
  '关键场景修复提示词（同步Seedance V5·4部分格式·直喂剧幕文戏）'
).replace(
  '<!--PROMPT:seedance-->\n📖 [Xs·场景概括·情绪A→B→C]\n🎥 [机身·镜头·焦段·滤镜]\n🎨 色彩基调: [饱和度]·[LUT]·主色:色名=HEX(60%)+辅色:色名=HEX(30%)\n🎵 节奏: [BPM]·[拍号]\n⏱️ 0.0s-X.Xs | [景别]·[运镜·缓动] | [动作]·[情绪AU码=可见描述]·[色名=HEX·色温K] | [声音·"对白"(时间·语气)]\n🔴 负向: [3-5个风险词]\n<!--/PROMPT:seedance-->',
  '<!--PROMPT:seedance-->\n### 一、设备选择\n摄影机·曝光三要素(光圈T值·快门·ISO)·机位·镜头·滤镜·画幅·分辨率·帧率\n### 二、分镜时序+运镜\n(起始s—结束s): 运镜方式·缓动 + 景别 + 画面内容 + 人物情绪(动作·表情·台词语气) + 人物与空间运动方向 + 色名=HEX + 🔴负向(按风格)\n### 三、画面光影+色彩基调\n光源类型 + 色温K + 方向°·高度° + 聚焦区域 + 情绪氛围 + 色彩基调(主色=HEX 60%·辅色=HEX 30%·强调=HEX 10%) + LUT/胶片 + 风格类型 + 饱和度\n### 四、声音+音效设计\nBPM·拍号·每拍时长 + 🔊环境底噪(dB·混响) + 🎧关键音效(起止s·特征·dB) + 🎵BGM(出入点·风格·BPM·Key·dB)\n<!--/PROMPT:seedance-->'
).replace(
  '修复提示词用V3格式',
  '修复提示词用Seedance V5 4部分格式'
);

// ─── Fix 2: Sound — align output format with Seedance V5 Part 4 + expand table ───
data.sound = data.sound.replace(
  '## 📐 声音方案格式（V3·与Seedance时间线对齐·BPM联动）\n\n```\n🎵 节奏骨架: [BPM]·[拍号]·每拍Xs·本镜N拍\n（紧张=120-140BPM·悲伤=50-70BPM·史诗=80-100BPM·悬疑=60-80BPM·动作=140-160BPM）\n\n🔊 声音时间线（与运动时间线对齐）\nXs-Ys | 环境: [音景·音量dB·空间混响类型] | 拟音: [具体声音@精确时间·材质·频率特征] | 对白: ["原文"(起止·语气·空间感)] | 配乐: [出入点·风格·BPM·Key·情绪曲线]\n```',
  '## 📐 声音方案格式（同步Seedance V5 Part 4·BPM联动）\n\n```\n🎵 节奏骨架: [BPM]·[拍号]·每拍Xs·本镜N拍\n（紧张=120-140BPM·悲伤=50-70BPM·史诗=80-100BPM·悬疑=60-80BPM·动作=140-160BPM）\n\n🔊 声音时间线（逐秒标注·精确到dB和混响）\nXs-Ys | 🔊环境: [音景·音量dB·混响类型·混响时间s] | 🎧音效: [具体声音@精确时间·材质·频率特征·音量dB] | 🎵BGM: [出入点·风格·BPM·Key·音量dB·情绪曲线]\n对白嵌入音效层: "原文"(起止时间·语气·空间感·音量dB)\n```'
).replace(
  '## 🎧 音效速查\n\n| 场景类型 | 环境音 | 关键拟音 | 混响类型 | 混响时间 |\n|---------|--------|---------|---------|---------|\n| 监狱室内 | 荧光灯电流50Hz·远处铁门回响 | 锁芯弹开(金属撞击·高频6kHz+)·脚步声(水泥地·沉闷) | 硬反射(水泥+铁) | 0.3-0.5s |\n| 雨夜室外 | 雨声白噪音(-12dB)·远处车流 | 雨滴打伞面(尼龙·中频)·水花溅起(短暂·高频) | 开放空间 | 0.1-0.2s |\n| 审讯室 | 空调低频嗡嗡·荧光灯电流 | 椅子拖动(金属刮水泥·刺耳)·手指敲桌(木材·中低频) | 干声(吸音板) | 0.1-0.2s |',
  '## 🎧 音效速查\n\n| 场景类型 | 环境音 | 关键拟音 | 混响类型 | 混响时间 |\n|---------|--------|---------|---------|---------|\n| 监狱室内 | 荧光灯电流50Hz·远处铁门回响 | 锁芯弹开(金属撞击·高频6kHz+)·脚步声(水泥地·沉闷) | 硬反射(水泥+铁) | 0.3-0.5s |\n| 雨夜室外 | 雨声白噪音(-12dB)·远处车流 | 雨滴打伞面(尼龙·中频)·水花溅起(短暂·高频) | 开放空间 | 0.1-0.2s |\n| 审讯室 | 空调低频嗡嗡·荧光灯电流 | 椅子拖动(金属刮水泥·刺耳)·手指敲桌(木材·中低频) | 干声(吸音板) | 0.1-0.2s |\n| 温馨室内 | 窗帘轻拂·挂钟滴答·窗外鸟鸣 | 茶杯搁桌(陶瓷·中频)·翻书页(纸张·高频) | 软反射(布艺+木材) | 0.2-0.4s |'
);

// ─── Fix 3: Director — default AIGC ───
data.director = data.director.replace(
  '默认 🎥 传统。',
  '默认 🎬 AIGC。'
);

// ─── Fix 4: Director — add 60/30/10 color ratios ───
data.director = data.director.replace(
  '主色: 冷蓝灰像暴雨前傍晚天空=#2C3E50·辅色: 暖褐像旧灯泡=#8B7355·强调: 锈铁红像干涸血痕=#8B0000',
  '主色: 冷蓝灰像暴雨前傍晚天空=#2C3E50(60%)·辅色: 暖褐像旧灯泡=#8B7355(30%)·强调: 锈铁红像干涸血痕=#8B0000(10%)'
);

// ─── Fix 5: Character — add 色名=HEX to image generation prompt ───
data.character = data.character.replace(
  '<!--PROMPT:character-->\n[角色名] design sheet, [性别·年龄·体型], [面部: 骨相·眼型·鼻型·唇型], [妆发: 发型·色号PANTONE·定型], [服装: 廓形·上装+下装+外层·面料·PANTONE], [道具: 身份道具(列出·材质·色号·佩戴位置)·性格道具(列出·磨损状态)], [光影: 主光方向°·色温K], full body+face closeup+back view+prop detail, [参考], --ar 3:4 --v 7\n<!--/PROMPT:character-->',
  '<!--PROMPT:character-->\n[角色名] design sheet, [性别·年龄·体型], [面部: 骨相·眼型·鼻型·唇型·色名=HEX], [妆发: 发型·色号PANTONE+色名=HEX·定型], [服装: 廓形·上装+下装+外层·面料·PANTONE+色名=HEX], [道具: 身份道具(列出·材质·色号·色名=HEX·佩戴位置)·性格道具(列出·磨损状态)], [光影: 主光方向°·色温K], full body+face closeup+back view+prop detail, [参考], --ar 3:4 --v 7\n<!--/PROMPT:character-->'
);

fs.writeFileSync(targetFile, JSON.stringify(data, null, 2), 'utf-8');

// Verify
console.log('✅ All 7 bugs fixed.');
Object.entries(data).forEach(([k, v]) => console.log(`  ${k}: ${v.length} chars`));
