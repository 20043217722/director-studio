"""
Vision Review: 后生成质量审核器。
整合 libtv download + vision 分析，对生成结果进行自动评分和建议。

两层审核：
  L1 (自动): 元数据检查 — 生成是否成功、图片尺寸、URL有效性
  L2 (vision): 调用 vision.py 进行内容质量评估（需API key），
      或输出下载路径供 Codex view_image 手动审核。

Usage:
  python vision-review.py --node "节点名" [--l2]
  python vision-review.py --stage 1 [--l2]
"""
import subprocess, json, sys, os, time, argparse
from pathlib import Path

LIBTV = os.environ.get("LIBTV_BIN", "libtv")
VISION_PY = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..",
                         ".agents", "skills", "vision", "vision.py")
OUTPUT_DIR = os.path.join(os.getcwd(), "dreambox-output")
REVIEW_LOG = os.path.join(os.getcwd(), "review-log.json")

def run(*args, timeout=60):
    try:
        r = subprocess.run([LIBTV] + list(args), capture_output=True,
                          text=True, timeout=timeout)
        if r.stdout.strip():
            return json.loads(r.stdout) if r.returncode == 0 else None
    except:
        pass
    return None

def download_node(name, out_dir):
    """Download generated assets from a node."""
    os.makedirs(out_dir, exist_ok=True)
    r = subprocess.run([LIBTV, "download", "-n", name, "-o", out_dir],
                      capture_output=True, text=True, timeout=120)
    print(f"  [DOWNLOAD] {name} -> {out_dir}")
    if r.returncode != 0:
        print(f"  [WARN] download: {r.stderr.strip()[:200]}")
    # Find downloaded files
    files = []
    for f in os.listdir(out_dir):
        if f.endswith((".png", ".jpg", ".jpeg", ".webp", ".mp4")):
            files.append(os.path.join(out_dir, f))
    return files

def l1_check(node_name, node_data):
    """L1: metadata check."""
    issues = []
    data = node_data.get("data", {})
    urls = data.get("url", [])
    ntype = data.get("type", "")

    # Check generation state
    task_info = data.get("taskInfo", {})
    if task_info.get("status") != "success":
        issues.append(f"generation status: {task_info.get('status', 'unknown')}")

    # Check URL existence
    if ntype in ("image", "video") and not urls:
        issues.append("no output URL")
    elif urls:
        print(f"  [L1] {len(urls)} output(s), type={ntype}")

    verdict = "PASS" if not issues else "FAIL"
    return {"verdict": verdict, "issues": issues, "type": ntype, "urls": urls}

def l2_vision(image_path, prompt_context):
    """L2: vision model review (requires API key)."""
    if not os.path.exists(VISION_PY):
        return {"verdict": "SKIP", "reason": "vision.py not found"}

    analysis_prompt = f"""Analyze this AI-generated image for quality issues. 
Context: {prompt_context[:500]}

Evaluate on these criteria (1-5 each):
1. Subject clarity: Is the main subject clearly defined?
2. Composition: Is the composition balanced and intentional?
3. Anatomical accuracy: Are faces/body parts/objects correctly formed?
4. Style consistency: Does it match the intended style?
5. Artifacts: Are there visible AI artifacts?

Respond ONLY with JSON: {{"subject_clarity": N, "composition": N, "anatomy": N, "style": N, "artifacts": N, "overall": N, "verdict": "KEEP"|"REGENERATE", "notes": "brief reason"}}"""

    try:
        r = subprocess.run(
            ["python", VISION_PY, image_path, analysis_prompt],
            capture_output=True, text=True, timeout=120)
        if r.returncode == 0 and r.stdout.strip():
            try:
                return json.loads(r.stdout)
            except:
                return {"verdict": "REVIEW", "raw": r.stdout[:300]}
        else:
            return {"verdict": "SKIP", "reason": r.stderr.strip()[:200]}
    except Exception as e:
        return {"verdict": "SKIP", "reason": str(e)[:200]}

def review_node(name, do_l2=False):
    """Full review of one node."""
    print(f"\n{'='*50}")
    print(f"  REVIEW: {name}")
    print(f"{'='*50}")

    # Get node data
    data = run("node", name)
    if not data:
        print(f"  [ERROR] Cannot get node data for '{name}'")
        return {"name": name, "l1": {"verdict": "ERROR"}, "l2": None}

    # L1 check
    l1 = l1_check(name, data)
    print(f"  L1: {l1['verdict']}")

    # L2 check
    l2 = None
    if do_l2 and l1["urls"]:
        out_dir = os.path.join(OUTPUT_DIR, name.replace(" ", "_"))
        files = download_node(name, out_dir)
        if files:
            print(f"  L2: analyzing {len(files)} file(s)...")
            l2 = l2_vision(files[0], json.dumps(data.get("data", {}).get("params", {})))
            print(f"  L2 verdict: {l2.get('verdict', '?')}")

    result = {"name": name, "l1": l1, "l2": l2}
    return result

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--node", type=str, help="Review a single node")
    parser.add_argument("--all", action="store_true", help="Review all image/video nodes")
    parser.add_argument("--l2", action="store_true", help="Enable L2 vision analysis")
    args = parser.parse_args()

    results = []

    if args.node:
        results.append(review_node(args.node, args.l2))
    elif args.all:
        nodes = run("node", "list")
        if nodes:
            for n in nodes.get("nodes", []):
                if n.get("type") in ("image", "video"):
                    results.append(review_node(n["name"], args.l2))
    else:
        print("Usage: --node NAME | --all")
        sys.exit(1)

    # Save review log
    with open(REVIEW_LOG, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    # Summary
    passed = sum(1 for r in results if r["l1"]["verdict"] == "PASS")
    print(f"\n{'='*50}")
    print(f"  REVIEW COMPLETE: {passed}/{len(results)} passed L1")
    print(f"  Log: {REVIEW_LOG}")
    print(f"{'='*50}")
