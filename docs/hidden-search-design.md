# Hidden Search design

Hidden Search is a deterministic seek-and-find activity. Each page places one
target among characters, villagers, and props on a 3200×1000 virtual canvas.

## Runtime contract

- Accepted pages are committed JSON under `content/waldo_pages`.
- `schemas/waldo_page.schema.json` defines the page format.
- `scripts/validate_waldo.py` validates geometry, density, target count,
  visibility, decoys, and difficulty constraints.
- `scripts/waldo-pack.py` creates the typed frontend module and supports
  `--check` for CI freshness.
- The running app never calls a model, content API, or remote asset host.

## Difficulty

- Tiers increase scene density, decoy count, camouflage, and target size.
- Target hit areas remain at least 88 px.
- Higher tiers may partially cover the lower portion of a target, but the
  validator guarantees sufficient visibility.
- Hints use deterministic UI effects and optional template-based math. A model
  never writes the math prompt or answer.

## Asset behavior

Entities refer to numeric local asset identifiers. A separately licensed local
asset pack can provide matching PNG files. The public build uses the neutral
fallback for missing files, so content validation and gameplay remain usable
without proprietary artwork.

## Updating pages

1. Edit or add JSON that conforms to the schema.
2. Run `python3 scripts/validate_waldo.py <page-or-directory>`.
3. Run `python3 scripts/waldo-pack.py`.
4. Run `python3 scripts/waldo-pack.py --check` and the frontend typecheck.

Only validator-clean, human-reviewed content belongs in the repository.
