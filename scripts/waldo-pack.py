#!/usr/bin/env python3
"""Pack accepted Hidden Search pages into the frontend content module.

Reads every page in content/waldo_pages/*.json, re-runs the full validator
(including cross-batch checks) as a safety gate, and emits
artifacts/letslearnos/src/content/search-pages.gen.ts — a typed, bundled,
offline module. Run after any batch:

    python3 scripts/waldo-pack.py
    python3 scripts/waldo-pack.py --check  # CI/read-only freshness gate
"""

import argparse
import glob
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from validate_waldo import load_config, validate_page, check_batch  # noqa: E402

PAGES_DIR = os.path.join(HERE, "..", "content", "waldo_pages")
OUT_PATH = os.path.join(HERE, "..", "artifacts", "letslearnos", "src",
                        "content", "search-pages.gen.ts")

HEADER = """\
// ---------------------------------------------------------------------------
// GENERATED FILE — do not edit. Emitted by scripts/waldo-pack.py from the
// accepted pages in content/waldo_pages/ (ADR-021 Hidden Search pipeline).
// Regenerate with: python3 scripts/waldo-pack.py
// ---------------------------------------------------------------------------
import type { SearchPage } from "./search";

export const searchPages: SearchPage[] = """


def to_ts_page(page):
    return {
        "id": page["id"],
        "theme": page["theme"],
        "difficulty": page["difficulty"],
        "target": {
            "species": page["target"]["species"],
            "x": page["target"]["x"],
            "y": page["target"]["y"],
            "scale": page["target"]["scale"],
            "occlusionPct": page["target"]["occlusion_pct"],
        },
        "decoys": [
            {k: v for k, v in d.items()} for d in page["decoys"]
        ],
        "entities": [
            {
                "assetId": e["asset_id"],
                "type": e["type"],
                "x": e["x"],
                "y": e["y"],
                "zLayer": e["z_layer"],
                "scale": e["scale"],
                **({"flip": True} if e.get("flip") else {}),
            }
            for e in page["entities"]
        ],
        "hintText": page["hint_text"],
        **({"mathHook": page["math_hook"]} if page.get("math_hook") else {}),
    }


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="fail if the generated TypeScript differs; do not write files",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    cfg = load_config()
    files = sorted(glob.glob(os.path.join(PAGES_DIR, "*.json")))
    pages, bad = [], 0
    for fname in files:
        with open(fname, encoding="utf-8") as source:
            page = json.load(source)
        errs = validate_page(page, cfg)
        if errs:
            bad += 1
            print(f"ERROR {os.path.basename(fname)}: {errs[:3]}")
            continue
        pages.append((fname, page))
    batch_errs = check_batch(pages, cfg)
    if batch_errs:
        for e in batch_errs:
            print(f"BATCH ERROR: {e}")
        return 1
    if bad:
        print(f"refusing to pack: {bad} page(s) failed validation")
        return 1
    if not pages:
        print("no valid pages found")
        return 1

    # Stable order: tier then id, so the ordering (and the emitted file) is
    # deterministic regardless of directory listing order.
    pages.sort(key=lambda fp: (fp[1]["difficulty"], fp[1]["id"]))
    ts_pages = [to_ts_page(p) for _, p in pages]
    body = json.dumps(ts_pages, indent=2, ensure_ascii=False)
    expected = HEADER + body + ";\n"

    if args.check:
        try:
            with open(OUT_PATH, encoding="utf-8") as generated:
                actual = generated.read()
        except FileNotFoundError:
            actual = ""
        if actual != expected:
            print("generated Hidden Search content is stale")
            print("run: python3 scripts/waldo-pack.py")
            return 1
    else:
        with open(OUT_PATH, "w", encoding="utf-8") as generated:
            generated.write(expected)

    tiers = {}
    for _, p in pages:
        tiers[p["difficulty"]] = tiers.get(p["difficulty"], 0) + 1
    verb = "verified" if args.check else "packed"
    print(f"{verb} {len(pages)} pages -> {os.path.relpath(OUT_PATH, os.path.join(HERE, '..'))}"
          f" (by tier: {dict(sorted(tiers.items()))})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
