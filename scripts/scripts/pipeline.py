"""
Dreambox 管线自动化脚本。
从预设配置一键创建 libtv 画布全流程节点。
Usage: python pipeline.py <项目名称> [preset]
       preset: realistic | animation | tvc (default: realistic)
"""
import subprocess, json, sys, os, time
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent
LIBTV = os.environ.get("LIBTV_BIN", "libtv")
WORKSPACE_ID = "2658324"

def run(*args, timeout=30, capture=True):
    cmd = [LIBTV] + list(args)
    r = subprocess.run(cmd, capture_output=capture, text=True, timeout=timeout)
    if r.returncode != 0 and r.stderr.strip():
        print(f"  [WARN] {r.stderr.strip()[:120]}", file=sys.stderr)
    if capture and r.stdout.strip():
        try: return json.loads(r.stdout)
        except: return r.stdout.strip()
    return None

def node(name, ntype, prompt="", model=None, left=None, x=0, y=0):
    args = ["--x", str(x), "--y", str(y), "node", "create", name, "-t", ntype]
    if prompt: args += ["--prompt", prompt]
    if model: args += ["-s", f"model={model}"]
    if left:
        for ln in left if isinstance(left, list) else [left]:
            args += ["--left", ln]
    r = run(*args)
    key = r.get("nodeKey","?") if r else "?"
    print(f"  [{ntype:8s}] {name:30s} -> {key}")
    return r

# Presets
REALISTIC = {
    "label": "真人短剧",
    "img_model": "Lib Image",
    "vid_model": "Seedance 1.0 Pro",
    "stages": [
        ("前期策划", [
            {"name": "剧本", "ntype": "script", "x": 0, "y": 0},
            {"name": "分镜脚本", "ntype": "storyboard", "x": 400, "y": 0},
            {"name": "美术指导-视觉DNA", "ntype": "text", "x": 0, "y": 600},
        ]),
        ("角色场景", [
            {"name": "人物造型-主角", "ntype": "image", "model": "Lib Image", "x": 800, "y": -300},
            {"name": "人物造型-配角", "ntype": "image", "model": "Lib Image", "x": 800, "y": 0},
            {"name": "场景-主场景", "ntype": "image", "model": "Lib Image", "x": 800, "y": 300},
        ]),
        ("生成输出", [
            {"name": "摄影指导-分镜1", "ntype": "image", "model": "Lib Image", "x": 1200, "y": -200},
            {"name": "视频-分镜1", "ntype": "video", "model": "Seedance 1.0 Pro", "x": 1600, "y": -200},
            {"name": "声音设计", "ntype": "audio", "x": 1600, "y": 400},
        ]),
    ]
}

ANIMATION = dict(REALISTIC)
ANIMATION["label"] = "动画短片"
ANIMATION["vid_model"] = "Kling 3.0"
for s in ANIMATION["stages"]:
    for n in s[1]:
        if n.get("model") == "Seedance 1.0 Pro":
            n["model"] = "Kling 3.0"

TVC = dict(REALISTIC)
TVC["label"] = "广告TVC"
TVC["vid_model"] = "Seedance 2.0 VIP"
for s in TVC["stages"]:
    for n in s[1]:
        if n.get("model") == "Seedance 1.0 Pro":
            n["model"] = "Seedance 2.0 VIP"

PRESETS = {"realistic": REALISTIC, "animation": ANIMATION, "tvc": TVC}

if __name__ == "__main__":
    name = sys.argv[1] if len(sys.argv) > 1 else "Dreambox项目"
    preset_key = sys.argv[2] if len(sys.argv) > 2 else "realistic"
    cfg = PRESETS.get(preset_key, REALISTIC)

    print(f"\n{'='*60}")
    print(f"  Dreambox Pipeline: {cfg['label']}")
    print(f"  Canvas: {name}")
    print(f"  Image: {cfg['img_model']} | Video: {cfg['vid_model']}")
    print(f"{'='*60}\n")

    # Bind workspace & create canvas
    run("workspace", "use", WORKSPACE_ID)
    result = run("project", "create", name, "-d", f"Dreambox {cfg['label']} 管线")
    uuid = result["projectMeta"]["uuid"]
    run("project", "use", uuid)
    print(f"\n[Canvas] https://www.liblib.tv/canvas?projectId={uuid}\n")

    # Create all nodes
    for stage_name, nodes in cfg["stages"]:
        print(f"-- {stage_name} --")
        for n in nodes:
            node(n["name"], n["ntype"],
                 prompt=n.get("prompt", ""),
                 model=n.get("model"),
                 x=n.get("x", 0), y=n.get("y", 0))

    print(f"\n{'='*60}")
    print(f"  Pipeline Complete!")
    print(f"  https://www.liblib.tv/canvas?projectId={uuid}")
    print(f"{'='*60}")
