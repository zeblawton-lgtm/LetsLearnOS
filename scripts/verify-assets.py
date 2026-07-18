#!/usr/bin/env python3
"""Verify the manifest-declared offline assets used by the application.

The default check validates manifest structure, counts, and non-empty files.
`--repository` additionally rejects manifest assets hidden by .gitignore. In a
clean CI checkout, existence plus that ignore check proves the curated set was
actually committed rather than left in a developer-only download cache.
"""

import argparse
import json
import os
import subprocess
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC_ROOT = os.path.join(REPO_ROOT, "artifacts", "letslearnos", "public")
MANIFEST_PATH = os.path.join(PUBLIC_ROOT, "sprites", "manifest.json")


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--repository",
        action="store_true",
        help="also fail when a declared asset is excluded by .gitignore",
    )
    return parser.parse_args()


def relative(path):
    return os.path.relpath(path, REPO_ROOT)


def ignored_by_git(path):
    result = subprocess.run(
        ["git", "check-ignore", "--quiet", "--no-index", "--", relative(path)],
        cwd=REPO_ROOT,
        check=False,
    )
    return result.returncode == 0


def main():
    args = parse_args()
    errors = []

    try:
        with open(MANIFEST_PATH, encoding="utf-8") as source:
            manifest = json.load(source)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"asset manifest could not be read: {exc}", file=sys.stderr)
        return 1

    sprite_ids = manifest.get("spriteIds")
    audio_tracks = manifest.get("audioTracks")
    if not isinstance(sprite_ids, list) or not all(isinstance(value, int) for value in sprite_ids):
        errors.append("spriteIds must be a list of integers")
        sprite_ids = []
    if not isinstance(audio_tracks, list) or not all(isinstance(value, str) for value in audio_tracks):
        errors.append("audioTracks must be a list of strings")
        audio_tracks = []

    if sprite_ids != sorted(set(sprite_ids)):
        errors.append("spriteIds must be sorted and unique")
    if audio_tracks != sorted(set(audio_tracks)):
        errors.append("audioTracks must be sorted and unique")
    if manifest.get("spriteCount") != len(sprite_ids):
        errors.append("spriteCount does not match spriteIds")
    if manifest.get("audioCount") != len(audio_tracks):
        errors.append("audioCount does not match audioTracks")

    files = [
        os.path.join(PUBLIC_ROOT, str(manifest.get("fallbackSprite", ""))),
        *(os.path.join(PUBLIC_ROOT, "sprites", "official-artwork", f"{sprite_id}.png")
          for sprite_id in sprite_ids),
        *(os.path.join(PUBLIC_ROOT, "audio", f"{track}.mp3") for track in audio_tracks),
    ]
    for path in files:
        if not os.path.isfile(path) or os.path.getsize(path) == 0:
            errors.append(f"missing or empty: {relative(path)}")
        elif args.repository and ignored_by_git(path):
            errors.append(f"manifest asset is ignored by git: {relative(path)}")

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    mode = "repository" if args.repository else "filesystem"
    print(
        f"verified {len(sprite_ids)} sprites, {len(audio_tracks)} audio tracks, "
        f"and fallback ({mode} mode)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
