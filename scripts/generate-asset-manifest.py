#!/usr/bin/env python3
"""
generate-asset-manifest.py — index bundled offline assets.

Scans the app's public asset directories and writes a manifest the ISO build
and QA checks can use to verify the offline asset set. Run after adding or
removing a separately licensed local asset pack.

    python3 scripts/generate-asset-manifest.py
"""
import json
import os
import time

ROOT = os.path.join(os.path.dirname(__file__), "..",
                    "artifacts", "letslearnos", "public")
SPRITES = os.path.join(ROOT, "sprites", "official-artwork")
AUDIO = os.path.join(ROOT, "audio")
OUT = os.path.join(ROOT, "sprites", "manifest.json")


def main():
    sprite_ids = sorted(
        int(f[:-4]) for f in os.listdir(SPRITES)
        if f.endswith(".png") and f[:-4].isdigit()
    ) if os.path.isdir(SPRITES) else []
    audio = sorted(
        f[:-4] for f in os.listdir(AUDIO) if f.endswith(".mp3")
    ) if os.path.isdir(AUDIO) else []

    manifest = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "fallbackSprite": "sprites/fallback.svg",
        "spriteCount": len(sprite_ids),
        "spriteIds": sprite_ids,
        "audioCount": len(audio),
        "audioTracks": audio,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"Wrote {OUT}")
    print(f"  sprites: {len(sprite_ids)}  audio: {len(audio)}")


if __name__ == "__main__":
    main()
