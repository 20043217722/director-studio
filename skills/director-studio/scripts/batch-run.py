"""
智能批量执行器 v2: 含重试退避、模型降级、算力不足处理。

Usage:
  python batch-run.py [--stage 1-4] [--dry-run] [--retry 5]
  python batch-run.py --node "节点名" [--retry 3]

模型降级链 (自动):
  image: Lib Image -> Seedream 5.0 Pro -> Lib Navo Pro -> Seedream 5.0 Lite
  video: Seedance 1.0 Pro -> Hailuo 2.3 -> Kling 3.0
"""
import subprocess, json, sys, os, time, argparse

LIBTV = os.environ.get("LIBTV_BIN", "libtv")

# 模型降级链
IMAGE_FALLBACK = ["Lib Image", "Seedream 5.0 Pro", "Lib Navo Pro", "Seedream 5.0 Lite"]
VIDEO_FALLBACK = ["Seedance 1.0 Pro", "Hailuo 2.3", "Kling 3.0"]
MAX_RETRIES = 3
RETRY_DELAYS = [5, 15, 45]  # 指数退避秒数

def libtv(*args, timeout=300):
    try:
        r = subprocess.run([LIBTV] + list(args), capture_output=True,
                          text=True, timeout=timeout)
        return r
    except Exception as e:
        return None

def is_quota_error(stderr):
    return "1200000136" in stderr or "算力不足" in stderr

def is_busy_error(stderr):
    return "busy" in stderr.lower() or "queue" in stderr.lower()

def run_node_with_fallback(name, ntype, current_model=None, max_retries=MAX_RETRIES):
    """运行节点，失败时自动降级模型并重试。"""
    fallback_chain = IMAGE_FALLBACK if ntype == "image" else VIDEO_FALLBACK

    # 如果指定了当前模型，从它之后开始降级
    if current_model and current_model in fallback_chain:
        idx = fallback_chain.index(current_model)
        fallback_chain = fallback_chain[idx:]

    for model_idx, model in enumerate(fallback_chain):
        for attempt in range(max_retries):
            delay = RETRY_DELAYS[min(attempt, len(RETRY_DELAYS)-1)]
            if attempt > 0:
                print(f"  [{name}] retry {attempt+1}/{max_retries} with {model} in {delay}s...")
                time.sleep(delay)

            # Update model then run
            r = libtv("node", name, "-s", f"model={model}", timeout=60)
            if r is None or r.returncode != 0:
                continue

            r = libtv("node", name, "--run", timeout=600)
            if r is None:
                print(f"  [{name}] command failed")
                continue

            if r.returncode == 0:
                print(f"  [{name}] SUCCESS ({model})")
                return {"status": "ok", "model": model, "data": r.stdout}

            stderr = r.stderr or ""
            if is_quota_error(stderr):
                print(f"  [{name}] 算力不足 ({model}), trying next model...")
                break  # 跳出重试循环，尝试下一个模型
            elif is_busy_error(stderr):
                continue  # 队列忙，等一会重试
            else:
                print(f"  [{name}] FAILED: {stderr.strip()[:150]}")
                break  # 非算力错误，不重试

    print(f"  [{name}] ALL MODELS EXHAUSTED")
    return {"status": "failed", "model": None}

def get_nodes():
    r = libtv("node", "list", timeout=30)
    if r and r.returncode == 0:
        return json.loads(r.stdout).get("nodes", [])
    return []

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--node", type=str)
    parser.add_argument("--stage", type=int, choices=[1,2,3,4])
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--retry", type=int, default=3)
    args = parser.parse_args()

    MAX_RETRIES = args.retry
    nodes = get_nodes()

    if args.node:
        # Single node mode
        target = next((n for n in nodes if n["name"] == args.node), None)
        if not target:
            print(f"Node '{args.node}' not found")
            sys.exit(1)
        if args.dry_run:
            print(f"[DRY RUN] {args.node} ({target['type']})")
        else:
            run_node_with_fallback(args.node, target["type"], max_retries=MAX_RETRIES)
        sys.exit(0)

    # Stage filter
    import re
    stage_patterns = {1: r"角色定妆", 2: r"场景", 3: r"关键帧|摄影", 4: r"视频"}

    pattern = stage_patterns.get(args.stage, "")
    targets = [n for n in nodes if not pattern or re.search(pattern, n["name"])]
    gen_types = [n for n in targets if n["type"] in ("image", "video")]

    print(f"Stage {args.stage or 'all'}: {len(gen_types)} to generate")
    print("-" * 50)

    results = {"ok": [], "failed": [], "skipped": []}
    for n in gen_types:
        if n["type"] not in ("image", "video"):
            results["skipped"].append(n["name"])
            continue
        if args.dry_run:
            print(f"  [DRY RUN] {n['name']} ({n['type']})")
            continue
        r = run_node_with_fallback(n["name"], n["type"], max_retries=MAX_RETRIES)
        if r["status"] == "ok":
            results["ok"].append(n["name"])
        else:
            results["failed"].append(n["name"])

    print("-" * 50)
    print(f"OK:{len(results['ok'])} FAIL:{len(results['failed'])} "
          f"SKIP:{len(results['skipped'])}")
    with open("batch-results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
