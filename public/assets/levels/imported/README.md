# Imported Portrait boards

20 layouts adapted from [AlperenGarip/Match3](https://github.com/AlperenGarip/Match3),
commit `d83c68675796f75749c5867d2d0cf24a2d460e1a`.
Copyright (c) 2026 Alperen Garip. See [LICENSE](LICENSE).

Rebuild with `python scripts/import-match3-levels.py` from the pinned original
JSON files in `reference/match3-levels/alperen-garip/original/`.

Portrait levels 1–20 use these layouts. Source rows/columns and move budgets are
retained. A 9- or 10-cell square grid pads smaller rectangles with inactive cells;
all active cells remain in their original relative positions. No layout is cropped.

Box/stone cells become one-hit stone obstacles, vases become two-hit stones.
The goal remains clearing all obstacles. Horizontal/vertical rockets become this
engine's stripe, TNT becomes bomb, and light balls become color bombs, at their
original positions. Their effects follow Jungle Gems mechanics. Source cell codes
are retained on each preplaced powerup and provenance is recorded in each JSON.

This is a layout adaptation, not an exact copy of the source engine or its difficulty.
