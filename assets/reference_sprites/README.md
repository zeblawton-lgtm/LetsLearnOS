# Optional local artwork staging

This directory intentionally contains no artwork. Administrators may use it as
a local staging area for files they are legally permitted to use.

Runtime artwork belongs at:

```text
artifacts/letslearnos/public/sprites/official-artwork/<numeric-id>.png
```

After adding or removing local assets, run:

```bash
python3 scripts/generate-asset-manifest.py
python3 scripts/verify-assets.py --repository
```

The application never downloads missing artwork at runtime. Missing files use
the bundled neutral fallback. Do not commit restricted or unlicensed assets.
