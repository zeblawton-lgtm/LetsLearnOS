#!/usr/bin/env python3
"""Validators for Hidden Search pages (ADR-021).

Every generated page must pass validate_page() before acceptance, and the
batch as a whole must pass check_batch(). Checks are hand-rolled (stdlib
only) and mirror schemas/waldo_page.schema.json exactly — hand-rolling gives
precise, worker-friendly error messages for the repair-retry loop.

Usage:
    python3 scripts/validate_waldo.py content/waldo_pages/*.json
    python3 scripts/validate_waldo.py --job '{"id":...,"theme":...,"tier":N,"target":ID}' page.json

Exit 0 if everything passes; prints per-file errors otherwise.
"""

import argparse
import json
import math
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(HERE, "waldo_config.json")

THEMES_ORDER = ["city-street", "festival", "market", "beach", "forest",
                "gym", "harbor", "train-station", "snowfield", "meadow"]

ID_RE = re.compile(r"^[a-z][a-z0-9-]{2,40}$")
ASSET_RE = re.compile(r"^(pokemon:[0-9]{1,4}|npc:[a-z][a-z-]{1,24}|prop:[a-z][a-z-]{1,24})$")

MAX_THEME_PAGES = 3
MAX_TARGET_PAGES = 2
OCCLUSION_CLAIM_TOLERANCE = 5.0  # percentage points
GRID = 24  # occlusion sampling resolution per axis


def load_config():
    with open(CONFIG_PATH) as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# geometry helpers
# ---------------------------------------------------------------------------

def entity_rect(e, cfg):
    """Center-anchored rect (x, y, w, h) for an entity, using registry aspect."""
    w = e["scale"]
    kind = e.get("type")
    if kind == "npc":
        h = w * cfg["npc_aspect"]
    elif kind == "prop":
        name = e["asset_id"].split(":", 1)[1]
        h = w * cfg["props"].get(name, 1.0)
    else:  # pokemon artwork is square
        h = w
    return (e["x"] - w / 2, e["y"] - h / 2, w, h)


def band_for_y(theme_bands, y):
    for name, (lo, hi) in theme_bands.items():
        if lo <= y <= hi:
            yield name


def compute_occlusion(target, ents, cfg):
    """(occlusion %, samples covered above the lower third) of the target
    bbox by z>=3 entities, via grid sampling. Target renders at z=2."""
    bx = target["x"] - target["scale"] / 2
    by = target["y"] - target["scale"] / 2
    bw = bh = target["scale"]
    occluders = [entity_rect(e, cfg) for e in ents
                 if isinstance(e, dict) and e.get("z_layer", 0) >= 3
                 and all(_num(e.get(k)) for k in ("x", "y", "scale"))]
    covered = upper_covered = 0
    for gy in range(GRID):
        for gx in range(GRID):
            px = bx + (gx + 0.5) * bw / GRID
            py = by + (gy + 0.5) * bh / GRID
            if any(rx <= px <= rx + rw and ry <= py <= ry + rh
                   for rx, ry, rw, rh in occluders):
                covered += 1
                if py < by + bh * (2 / 3):
                    upper_covered += 1
    return 100.0 * covered / (GRID * GRID), upper_covered


def _num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


# ---------------------------------------------------------------------------
# per-page validation
# ---------------------------------------------------------------------------

def validate_page(page, cfg, job=None):
    """Return a list of error strings (empty = valid).

    job (optional): {"id", "theme", "tier", "target", "math_hook"} — the brief
    this page was generated from; when given, the page must match it.
    """
    errs = []

    def err(msg):
        errs.append(msg)

    if not isinstance(page, dict):
        return ["page is not a JSON object"]

    allowed_keys = {"id", "theme", "difficulty", "canvas", "target", "decoys",
                    "entities", "density", "hint_text", "math_hook"}
    for k in page:
        if k not in allowed_keys:
            err(f"unknown top-level key {k!r}")
    for k in ("id", "theme", "difficulty", "canvas", "target", "decoys",
              "entities", "hint_text"):
        if k not in page:
            err(f"missing required key {k!r}")
    if errs:
        return errs

    # --- scalars ---
    if not (isinstance(page["id"], str) and ID_RE.match(page["id"])):
        err("id must be kebab-case (^[a-z][a-z0-9-]{2,40}$)")
    if page["theme"] not in cfg["themes"]:
        err(f"theme {page['theme']!r} not in {sorted(cfg['themes'])}")
    if not (isinstance(page["difficulty"], int) and 1 <= page["difficulty"] <= 5):
        err("difficulty must be an integer 1-5")
    if page.get("canvas") != {"w": cfg["canvas"]["w"], "h": cfg["canvas"]["h"]}:
        err(f'canvas must be exactly {{"w": {cfg["canvas"]["w"]}, "h": {cfg["canvas"]["h"]}}}')
    if errs:
        return errs

    tier = cfg["tiers"][str(page["difficulty"])]
    theme_bands = cfg["themes"][page["theme"]]["bands"]
    W, H = cfg["canvas"]["w"], cfg["canvas"]["h"]
    y_min = cfg["interactive_y_min"]

    if job:
        if page["id"] != job["id"]:
            err(f"id must be {job['id']!r} (brief), got {page['id']!r}")
        if page["theme"] != job["theme"]:
            err(f"theme must be {job['theme']!r} (brief)")
        if page["difficulty"] != job["tier"]:
            err(f"difficulty must be {job['tier']} (brief)")

    # --- target ---
    t = page["target"]
    if not isinstance(t, dict):
        return errs + ["target must be an object"]
    for k in ("species", "x", "y", "scale", "bbox", "occlusion_pct"):
        if k not in t:
            err(f"target missing {k!r}")
    if errs:
        return errs
    if str(t["species"]) not in cfg["species"]:
        err(f"target.species {t['species']} not in the bundled allow-list")
    elif str(t["species"]) not in cfg["similarity"]:
        err(f"target.species {t['species']} has no decoy table entry — not a valid target")
    if job and t["species"] != job["target"]:
        err(f"target.species must be {job['target']} (brief)")
    if not (_num(t["scale"]) and t["scale"] >= tier["target_scale_min"]):
        err(f"target.scale must be >= {tier['target_scale_min']} at tier {page['difficulty']}")
    if not (_num(t["y"]) and y_min <= t["y"] <= H - 40):
        err(f"target.y must be in [{y_min}, {H - 40}]")
    if not (_num(t["x"]) and 40 <= t["x"] <= W - 40):
        err(f"target.x must be in [40, {W - 40}]")
    if _num(t.get("scale")) and _num(t.get("x")) and _num(t.get("y")):
        want = [t["x"] - t["scale"] / 2, t["y"] - t["scale"] / 2, t["scale"], t["scale"]]
        got = t.get("bbox")
        if (not isinstance(got, list) or len(got) != 4 or
                any(not _num(v) for v in got) or
                any(abs(a - b) > 0.01 for a, b in zip(got, want))):
            err(f"target.bbox must equal [x-scale/2, y-scale/2, scale, scale] = {want}")
        else:
            bx, by, bw, bh = got
            if bx < 0 or by < 0 or bx + bw > W or by + bh > H:
                err("target.bbox must be fully on-canvas")

    # --- decoys ---
    decoys = page["decoys"]
    if not isinstance(decoys, list):
        return errs + ["decoys must be an array"]
    lo, hi = tier["decoys"]
    if not (lo <= len(decoys) <= hi):
        err(f"decoys count must be {lo}-{hi} at tier {page['difficulty']}, got {len(decoys)}")
    table = cfg["similarity"].get(str(t["species"]), [])
    for i, d in enumerate(decoys):
        tag = f"decoys[{i}]"
        if not isinstance(d, dict):
            err(f"{tag} must be an object"); continue
        extra = set(d) - {"species", "x", "y", "scale", "flip"}
        if extra:
            err(f"{tag} unknown keys {sorted(extra)}")
        if any(k not in d for k in ("species", "x", "y", "scale")):
            err(f"{tag} missing species/x/y/scale"); continue
        if d["species"] == t["species"]:
            err(f"{tag} must not be the target species")
        elif d["species"] not in table:
            err(f"{tag} species {d['species']} not in the decoy table for target "
                f"{t['species']} — pick from {table}")
        if not all(_num(d[k]) for k in ("x", "y", "scale")):
            err(f"{tag} x/y/scale must be numbers"); continue
        dist = math.hypot(d["x"] - t["x"], d["y"] - t["y"])
        if dist > cfg["decoy_max_dist"]:
            err(f"{tag} is {dist:.0f}px from target — must be <= {cfg['decoy_max_dist']}")
        if not (80 <= d["scale"] <= 300):
            err(f"{tag} scale must be 80-300")
        if d["y"] < y_min:
            err(f"{tag} y must be >= {y_min}")

    # --- entities ---
    ents = page["entities"]
    if not isinstance(ents, list):
        return errs + ["entities must be an array"]
    for i, e in enumerate(ents):
        tag = f"entities[{i}]"
        if not isinstance(e, dict):
            err(f"{tag} must be an object"); continue
        extra = set(e) - {"asset_id", "type", "x", "y", "z_layer", "scale", "flip"}
        if extra:
            err(f"{tag} unknown keys {sorted(extra)}")
        if any(k not in e for k in ("asset_id", "type", "x", "y", "z_layer", "scale")):
            err(f"{tag} missing asset_id/type/x/y/z_layer/scale"); continue
        aid = e["asset_id"]
        if not (isinstance(aid, str) and ASSET_RE.match(aid)):
            err(f"{tag} asset_id {aid!r} malformed"); continue
        prefix, name = aid.split(":", 1)
        if e["type"] != prefix:
            err(f"{tag} type {e['type']!r} does not match asset_id prefix {prefix!r}")
        if prefix == "pokemon" and name not in cfg["species"]:
            err(f"{tag} pokemon id {name} not in the bundled allow-list")
        if prefix == "npc" and name not in cfg["npcs"]:
            err(f"{tag} npc {name!r} not in registry {cfg['npcs']}")
        if prefix == "prop" and name not in cfg["props"]:
            err(f"{tag} prop {name!r} not in registry {sorted(cfg['props'])}")
        if not (isinstance(e["z_layer"], int) and 0 <= e["z_layer"] <= 4):
            err(f"{tag} z_layer must be an integer 0-4")
        if not all(_num(e[k]) for k in ("x", "y", "scale")):
            err(f"{tag} x/y/scale must be numbers"); continue
        if not (60 <= e["scale"] <= 700):
            err(f"{tag} scale must be 60-700")
        rx, ry, rw, rh = entity_rect(e, cfg)
        if prefix in ("pokemon", "npc"):
            if rx < 0 or ry < 0 or rx + rw > W or ry + rh > H:
                err(f"{tag} must be fully on-canvas")
            if e["y"] < y_min:
                err(f"{tag} y must be >= {y_min} (top-strip exclusion)")
            if not (60 <= e["scale"] <= 300):
                err(f"{tag} crowd scale must be 60-300")
        else:  # props may bleed up to 25% off the left/right edges only
            if rx < -0.25 * rw or rx + rw > W + 0.25 * rw or ry < 0 or ry + rh > H:
                err(f"{tag} prop bleeds too far off-canvas")

    if errs:
        return errs  # geometry below assumes shapes are sane

    # --- band sanity (species habitats vs theme bands) ---
    def check_band(species_id, y, tag):
        allowed = cfg["species"][str(species_id)]["bands"]
        present = [b for b in allowed if b in theme_bands]
        if not present:
            err(f"{tag}: {cfg['species'][str(species_id)]['name']} needs a "
                f"{'/'.join(allowed)} band but theme {page['theme']!r} has none")
            return
        if not any(b in present for b in band_for_y(theme_bands, y)):
            ranges = {b: theme_bands[b] for b in present}
            err(f"{tag}: y={y:.0f} outside allowed band(s) {ranges}")

    check_band(t["species"], t["y"], "target")
    for i, d in enumerate(decoys):
        check_band(d["species"], d["y"], f"decoys[{i}]")
    for i, e in enumerate(ents):
        if e["type"] == "pokemon":
            check_band(int(e["asset_id"].split(":")[1]), e["y"], f"entities[{i}]")

    # --- density ---
    crowd = sum(1 for e in ents if e["type"] in ("pokemon", "npc")) + len(decoys) + 1
    total = len(ents) + len(decoys) + 1
    lo, hi = tier["total"]
    if crowd < tier["crowd_min"]:
        err(f"crowd count {crowd} below tier minimum {tier['crowd_min']}")
    if not (lo <= total <= hi):
        err(f"total renderables {total} outside tier range {lo}-{hi}")
    if "density" in page:
        d = page["density"]
        if not (isinstance(d, dict) and set(d) <= {"crowd", "total"}):
            err("density must be {crowd, total}")
        else:
            if d.get("crowd") != crowd:
                err(f"density.crowd claims {d.get('crowd')}, actual {crowd}")
            if d.get("total") != total:
                err(f"density.total claims {d.get('total')}, actual {total}")

    # --- occlusion (recomputed by grid sampling; target/decoys sit at z=2) ---
    occl, upper_covered = compute_occlusion(t, ents, cfg)
    if occl > tier["occlusion_max"] + 0.01:
        err(f"recomputed occlusion {occl:.1f}% exceeds tier budget {tier['occlusion_max']}%")
    if upper_covered:
        err("occluders may only overlap the lower third of the target bbox "
            f"({upper_covered} sampled points covered above it)")
    if _num(t["occlusion_pct"]) and abs(t["occlusion_pct"] - occl) > OCCLUSION_CLAIM_TOLERANCE:
        err(f"occlusion_pct claims {t['occlusion_pct']}%, recomputed {occl:.1f}% "
            f"(tolerance {OCCLUSION_CLAIM_TOLERANCE})")

    # --- spacing between crowd members ---
    crowd_rects = [(t["x"], t["y"], t["scale"], "target")]
    crowd_rects += [(d["x"], d["y"], d["scale"], f"decoys[{i}]") for i, d in enumerate(decoys)]
    crowd_rects += [(e["x"], e["y"], e["scale"], f"entities[{i}]")
                    for i, e in enumerate(ents) if e["type"] in ("pokemon", "npc")]
    for i in range(len(crowd_rects)):
        for j in range(i + 1, len(crowd_rects)):
            x1, y1, w1, n1 = crowd_rects[i]
            x2, y2, w2, n2 = crowd_rects[j]
            need = 0.5 * (w1 + w2) / 2
            if math.hypot(x1 - x2, y1 - y2) < need:
                err(f"{n1} and {n2} overlap too much (centers < {need:.0f}px apart)")

    # --- hint ---
    hint = page["hint_text"]
    if not (isinstance(hint, str) and 10 <= len(hint) <= 90):
        err("hint_text must be a 10-90 char string")
    else:
        low = hint.lower()
        for w in cfg["hint_banned_words"]:
            if re.search(rf"\b{re.escape(w)}\b", low):
                err(f"hint_text contains banned word {w!r}")

    # --- math hook ---
    if "math_hook" in page:
        mh = page["math_hook"]
        if page["difficulty"] < 3:
            err("math_hook is only allowed at tiers 3-5")
        if not (isinstance(mh, dict) and set(mh) == {"skill", "max"}):
            err('math_hook must be exactly {"skill", "max"}')
        else:
            if mh["skill"] not in ("count", "add", "subtract", "multiply"):
                err(f"math_hook.skill {mh.get('skill')!r} invalid")
            if not (isinstance(mh["max"], int) and 3 <= mh["max"] <= 12):
                err("math_hook.max must be an integer 3-12")
    if job and job.get("math_hook") and "math_hook" not in page:
        err(f"brief requires math_hook {job['math_hook']}")

    return errs


# ---------------------------------------------------------------------------
# deterministic lead-side repair — fixes the failure modes that don't need
# model creativity: count overshoot, props hanging off-canvas, and crowd
# spacing. Run before validate_page(); anything it can't fix goes back
# through the worker's repair-retry loop.
# ---------------------------------------------------------------------------

def repair_page(page, cfg):
    """Mutates page in place. Returns True if anything changed."""
    try:
        tier = cfg["tiers"][str(page["difficulty"])]
        ents = page["entities"]
        decoys = page["decoys"]
        t = page["target"]
        W, H = cfg["canvas"]["w"], cfg["canvas"]["h"]
    except (KeyError, TypeError):
        return False
    changed = False

    # -- 1) count overshoot: drop z<3 extras from the end (occlusion is
    #       computed from z>=3 only, so this can only relax constraints).
    def counts():
        crowd = sum(1 for e in ents if isinstance(e, dict)
                    and e.get("type") in ("pokemon", "npc")) + len(decoys) + 1
        return crowd, len(ents) + len(decoys) + 1

    crowd, total = counts()
    for i in reversed(range(len(ents))):
        if total <= tier["total"][1]:
            break
        e = ents[i]
        if not isinstance(e, dict) or e.get("z_layer", 3) >= 3:
            continue
        if e.get("type") in ("pokemon", "npc"):
            if crowd - 1 < tier["crowd_min"]:
                continue
            crowd -= 1
        del ents[i]
        total -= 1
        changed = True

    # -- 2) prop bounds: shrink anything taller than the canvas, then clamp
    #       centers so the full rect fits (25% horizontal bleed allowed).
    for e in ents:
        if not (isinstance(e, dict) and e.get("type") == "prop"
                and all(_num(e.get(k)) for k in ("x", "y", "scale"))):
            continue
        aspect = cfg["props"].get(e["asset_id"].split(":", 1)[1], 1.0)
        if e["scale"] * aspect > H:
            e["scale"] = max(60, int(H * 0.95 / aspect))
            changed = True
        w, h = e["scale"], e["scale"] * aspect
        nx = min(max(e["x"], 0.25 * w), W - 0.25 * w)
        ny = min(max(e["y"], h / 2), H - h / 2)
        if (nx, ny) != (e["x"], e["y"]):
            e["x"], e["y"] = nx, ny
            changed = True

    # -- 2.4) creatures fully on-canvas: clamp pokemon/npc centers so their
    #         rect fits (and stays below the top-strip line). y moves must
    #         respect the species' allowed bands for this theme, so clamp
    #         into the nearest legal band range instead of raw canvas edges.
    theme_bands = cfg["themes"].get(page.get("theme"), {}).get("bands", {})
    y_min_i = cfg["interactive_y_min"]
    for e in ents:
        if not (isinstance(e, dict) and e.get("type") in ("pokemon", "npc")
                and all(_num(e.get(k)) for k in ("x", "y", "scale"))):
            continue
        w = e["scale"]
        h = w * (cfg["npc_aspect"] if e["type"] == "npc" else 1.0)
        nx = min(max(e["x"], w / 2), W - w / 2)
        fit_lo, fit_hi = max(h / 2, y_min_i), H - h / 2
        ny = min(max(e["y"], fit_lo), fit_hi)
        if e["type"] == "pokemon" and theme_bands:
            sid = str(e["asset_id"].split(":", 1)[1])
            allowed = cfg["species"].get(sid, {}).get("bands", [])
            ranges = []
            for b in allowed:
                if b in theme_bands:
                    lo, hi = theme_bands[b]
                    lo, hi = max(lo, fit_lo), min(hi, fit_hi)
                    if lo <= hi:
                        ranges.append((lo, hi))
            if ranges and not any(lo <= ny <= hi for lo, hi in ranges):
                lo, hi = min(ranges, key=lambda r: min(abs(ny - r[0]), abs(ny - r[1])))
                ny = min(max(ny, lo), hi)
        if (nx, ny) != (e["x"], e["y"]):
            e["x"], e["y"] = nx, ny
            changed = True

    # -- 2.5) illegal occlusion: z>=3 entities may never cover the upper 2/3
    #         of the target bbox, and may not touch it at all when the tier
    #         budget is 0 (common after the bounds clamp drags a tall prop
    #         onto the target). Push offenders clear horizontally, or drop
    #         them when they can't move.
    if all(_num(t.get(k)) for k in ("x", "y", "scale")):
        bx, by = t["x"] - t["scale"] / 2, t["y"] - t["scale"] / 2
        bw = bh = t["scale"]
        zone_h = bh if tier["occlusion_max"] == 0 else bh * (2 / 3)
        for i in reversed(range(len(ents))):
            e = ents[i]
            if not (isinstance(e, dict) and e.get("z_layer", 0) >= 3
                    and all(_num(e.get(k)) for k in ("x", "y", "scale"))):
                continue
            rx, ry, rw, rh = entity_rect(e, cfg)
            if (rx < bx + bw and rx + rw > bx and ry < by + zone_h and ry + rh > by):
                bleed = 0.25 * rw if e.get("type") == "prop" else 0
                left_x = bx - 2 - rw / 2
                right_x = bx + bw + 2 + rw / 2
                if e["x"] <= t["x"] and left_x - rw / 2 >= -bleed:
                    e["x"] = left_x
                elif right_x + rw / 2 <= W + bleed:
                    e["x"] = right_x
                elif left_x - rw / 2 >= -bleed:
                    e["x"] = left_x
                elif len(ents) + len(decoys) + 1 - 1 >= tier["total"][0] and \
                        e.get("type") == "prop":
                    del ents[i]
                else:
                    continue  # unmovable — leave for the LLM retry
                changed = True

        # Even legal lower-third overlap can exceed the tier budget — keep
        # pushing the largest remaining z>=3 occluder clear until we're in
        # budget (or nothing movable is left).
        for _ in range(12):
            occl, _upper = compute_occlusion(t, ents, cfg)
            if occl <= tier["occlusion_max"] + 0.01:
                break
            best_i, best_area = -1, 0.0
            for i, e in enumerate(ents):
                if not (isinstance(e, dict) and e.get("z_layer", 0) >= 3
                        and all(_num(e.get(k)) for k in ("x", "y", "scale"))):
                    continue
                rx, ry, rw, rh = entity_rect(e, cfg)
                ox = max(0.0, min(bx + bw, rx + rw) - max(bx, rx))
                oy = max(0.0, min(by + bh, ry + rh) - max(by, ry))
                if ox * oy > best_area:
                    best_i, best_area = i, ox * oy
            if best_i < 0:
                break
            e = ents[best_i]
            rw = entity_rect(e, cfg)[2]
            bleed = 0.25 * rw if e.get("type") == "prop" else 0
            left_x = bx - 2 - rw / 2
            right_x = bx + bw + 2 + rw / 2
            if e["x"] <= t["x"] and left_x - rw / 2 >= -bleed:
                e["x"] = left_x
            elif right_x + rw / 2 <= W + bleed:
                e["x"] = right_x
            elif left_x - rw / 2 >= -bleed:
                e["x"] = left_x
            elif (e.get("type") == "prop"
                  and len(ents) + len(decoys) + 1 - 1 >= tier["total"][0]):
                del ents[best_i]
            else:
                break
            changed = True

    # -- 2.6) target bbox is derived data — recompute it outright.
    if all(_num(t.get(k)) for k in ("x", "y", "scale")):
        want = [t["x"] - t["scale"] / 2, t["y"] - t["scale"] / 2, t["scale"], t["scale"]]
        if t.get("bbox") != want:
            t["bbox"] = want
            changed = True

    # -- 2.75) occlusion self-report: the geometry is the truth. When the
    #          recomputed occlusion is legal for the tier, overwrite a
    #          drifting claim rather than bouncing the page to the LLM.
    if all(_num(t.get(k)) for k in ("x", "y", "scale")):
        occl, upper = compute_occlusion(t, ents, cfg)
        if (upper == 0 and occl <= tier["occlusion_max"] + 0.01
                and _num(t.get("occlusion_pct"))
                and abs(t["occlusion_pct"] - occl) > OCCLUSION_CLAIM_TOLERANCE - 0.5):
            t["occlusion_pct"] = round(occl, 1)
            changed = True

    # -- 3) crowd spacing: for each too-close pair, delete a plain crowd
    #       entity when minimums allow, else nudge it away along x (x-only
    #       moves can't break band membership, which is y-based).
    def crowd_members():
        out = [("target", t)]
        out += [("decoy", d) for d in decoys if isinstance(d, dict)]
        out += [("entity", e) for e in ents
                if isinstance(e, dict) and e.get("type") in ("pokemon", "npc")]
        return [(kind, m) for kind, m in out
                if all(_num(m.get(k)) for k in ("x", "y", "scale"))]

    for _ in range(60):  # small fixed budget; each pass fixes one pair
        members = crowd_members()
        pair = None
        for i in range(len(members)):
            for j in range(i + 1, len(members)):
                (k1, m1), (k2, m2) = members[i], members[j]
                need = 0.5 * (m1["scale"] + m2["scale"]) / 2
                if math.hypot(m1["x"] - m2["x"], m1["y"] - m2["y"]) < need:
                    pair = (k1, m1, k2, m2, need)
                    break
            if pair:
                break
        if not pair:
            break
        k1, m1, k2, m2, need = pair
        # pick the mover: prefer a plain entity, then a decoy; never the target
        kind, mover, anchor = ((k2, m2, m1) if k2 != "target" and
                               (k1 == "target" or k2 == "entity") else (k1, m1, m2))
        crowd, total = counts()
        if (kind == "entity" and total - 1 >= tier["total"][0]
                and crowd - 1 > tier["crowd_min"]):
            ents.remove(mover)
            changed = True
            continue
        if kind == "decoy" and len(decoys) > tier["decoys"][0] and total - 1 >= tier["total"][0]:
            decoys.remove(mover)
            changed = True
            continue
        dy = mover["y"] - anchor["y"]
        dx_needed = math.sqrt(max(need ** 2 - dy ** 2, 0)) + 2
        moved = False
        for direction in (1 if mover["x"] >= anchor["x"] else -1,
                          -1 if mover["x"] >= anchor["x"] else 1):
            nx = anchor["x"] + direction * dx_needed
            if not (40 + mover["scale"] / 2 <= nx <= W - 40 - mover["scale"] / 2):
                continue
            if kind == "decoy" and math.hypot(nx - t["x"], mover["y"] - t["y"]) > cfg["decoy_max_dist"]:
                continue
            mover["x"] = nx
            moved = changed = True
            break
        if not moved:
            break  # can't fix this pair deterministically — leave for the LLM

    crowd, total = counts()
    if isinstance(page.get("density"), dict):
        if (page["density"].get("crowd"), page["density"].get("total")) != (crowd, total):
            page["density"] = {"crowd": crowd, "total": total}
            changed = True
    return changed


# ---------------------------------------------------------------------------
# cross-batch validation
# ---------------------------------------------------------------------------

def check_batch(pages, cfg):
    """pages: list of (filename, page). Returns list of error strings."""
    errs = []
    ids, themes, targets = {}, {}, {}
    for fname, p in pages:
        pid = p.get("id")
        if pid in ids:
            errs.append(f"duplicate page id {pid!r} ({ids[pid]} and {fname})")
        ids[pid] = fname
        themes[p.get("theme")] = themes.get(p.get("theme"), 0) + 1
        sp = p.get("target", {}).get("species")
        targets[sp] = targets.get(sp, 0) + 1
    for theme, n in sorted(themes.items()):
        if n > MAX_THEME_PAGES:
            errs.append(f"theme {theme!r} used on {n} pages (max {MAX_THEME_PAGES})")
    for sp, n in sorted(targets.items(), key=lambda kv: str(kv[0])):
        if n > MAX_TARGET_PAGES:
            name = cfg["species"].get(str(sp), {}).get("name", sp)
            errs.append(f"target {name} used on {n} pages (max {MAX_TARGET_PAGES})")
    return errs


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("files", nargs="+")
    ap.add_argument("--job", help="JSON job spec to check the page against")
    args = ap.parse_args()

    cfg = load_config()
    job = json.loads(args.job) if args.job else None
    pages, failed = [], False
    for fname in args.files:
        try:
            page = json.load(open(fname))
        except (OSError, json.JSONDecodeError) as e:
            print(f"{fname}: unreadable ({e})")
            failed = True
            continue
        errs = validate_page(page, cfg, job=job)
        if errs:
            failed = True
            print(f"{fname}: {len(errs)} error(s)")
            for e in errs:
                print(f"  - {e}")
        else:
            print(f"{fname}: OK")
            pages.append((fname, page))
    if len(pages) > 1:
        for e in check_batch(pages, cfg):
            print(f"batch: {e}")
            failed = True
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
