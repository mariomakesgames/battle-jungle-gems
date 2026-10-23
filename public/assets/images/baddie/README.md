# Baddie Club theme

Runtime assets for the Baddie title, level map, gallery and game board. Background and fashion pieces were generated with the built-in imagegen tool. Vector symbols are repository-authored SVGs. No new external artwork is used in this pack; portrait photography retains its separate Pixabay source manifest.

- Six colors retain their match rules: red heels, green corset, blue stockings, purple bra, gold earrings, orange bikini.
- Specials: perfume explosion, directional fan, heart compact. Obstacles: locked jewel cases and gold chains.
- Active board pieces use transparent satin-and-metal product artwork in `pieces-editorial/`, packaged with `python scripts/prepare-editorial-pieces.py`. The earlier flat SVG silhouettes in `pieces/` and detailed PNGs remain as alternative source variants.
- All ordinary and special piece textures load at 256×256 so transforming a piece does not change its display size.
- `baddie_*` keys are scoped to Baddie scenes; game rules continue using the original logical color/type identifiers.

Source artwork and final generation prompts: [reference/baddie-theme](../../../../reference/baddie-theme/README.md).

Repackage from the repository root:

```powershell
python scripts/prepare-baddie-theme.py --background reference/baddie-theme/studio-source.png --pieces reference/baddie-theme/pieces-source.png
```
