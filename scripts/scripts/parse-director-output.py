"""
导演输出解析器: 从导演智能体的文本输出中自动提取角色/场景/分镜列表,
生成可直接喂给 libtv 的节点清单 JSON。

Usage: python parse-director-output.py <导演输出文本文件>
       python parse-director-output.py --stdin  (从管道读取)
Output: JSON { characters: [...], scenes: [...], shots: [...] }
"""
import sys, re, json

def parse(text: str) -> dict:
    result = {"characters": [], "scenes": [], "shots": []}

    # 1. 提取资产分发清单中的角色
    char_section = re.search(r"人物造型\s*[→>]\s*(.+?)(?=
[^-]|

|\Z)", text)
    if char_section:
        # 尝试从人物造型描述中提取角色名
        char_names = re.findall(r"[「『]([^」』]+)[」』]", text)
        descs = re.findall(r"(?:人物|角色|主角|配角)[：:]\s*(.+?)(?=
|$)", text)
        for i, name in enumerate(char_names[:10]):
            result["characters"].append({
                "name": name,
                "description": descs[i] if i < len(descs) else "",
            })

    # 2. 提取场景
    scene_section = re.search(r"场景设计\s*[→>]\s*(.+?)(?=
[^-]|

|\Z)", text)
    scene_names = re.findall(r"场景[：:]\s*(.+?)(?=
|$)", text)
    for s in scene_names[:10]:
        result["scenes"].append({"name": s.strip()})

    # 3. 提取分镜 (按 ━━━ 分隔符)
    shot_blocks = re.split(r"━{3,}\s*分镜\d+\s*━{3,}", text)
    if len(shot_blocks) <= 1:
        # 尝试其他分隔格式
        shot_blocks = re.split(r"(?:镜号|分镜)\s*(\d+)", text)

    shot_num = 0
    for block in shot_blocks:
        if len(block.strip()) < 20:
            continue
        shot_num += 1
        shot = {"number": shot_num, "raw": block.strip()[:500]}
        # 提取景别
        jb = re.findall(r"景别[：:]\s*(.+?)(?=
|$)", block)
        if jb: shot["scene_size"] = jb[0].strip()
        # 提取机位
        jw = re.findall(r"机位[：:]\s*(.+?)(?=
|$)", block)
        if jw: shot["camera_position"] = jw[0].strip()
        # 提取运动
        yd = re.findall(r"(?:镜头运动|运动)[：:]\s*(.+?)(?=
|$)", block)
        if yd: shot["movement"] = yd[0].strip()
        # 提取时长
        sc = re.findall(r"时长[：:]\s*(\d+)", block)
        if sc: shot["duration_sec"] = int(sc[0])
        # 提取画面
        hm = re.findall(r"画面内容[：:]\s*(.+?)(?=
|$)", block)
        if hm: shot["visual"] = hm[0].strip()

        result["shots"].append(shot)

    return result

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--stdin":
        text = sys.stdin.read()
    elif len(sys.argv) > 1:
        with open(sys.argv[1], "r", encoding="utf-8") as f:
            text = f.read()
    else:
        print("Usage: python parse-director-output.py <file>", file=sys.stderr)
        sys.exit(1)

    result = parse(text)
    json.dump(result, sys.stdout, ensure_ascii=False, indent=2)
