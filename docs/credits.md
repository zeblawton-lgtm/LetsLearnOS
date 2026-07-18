# Assets, credits, and licensing

## Public repository boundary

LetsLearnOS does not ship proprietary character artwork or commercial music.
The public build contains a neutral SVG fallback and works without an asset
pack. Users are responsible for ensuring they have the necessary rights before
adding, sharing, or publishing optional artwork or music.

Optional local asset locations are:

```text
artifacts/letslearnos/public/sprites/official-artwork/<numeric-id>.png
artifacts/letslearnos/public/audio/<track-name>.mp3
```

The generated asset manifest records only files present at build time.

The bundled character guide contains factual names, identifiers, and type
associations. Its short descriptive sentences are generated locally from that
metadata; LetsLearnOS does not redistribute third-party game descriptions.

## Original sound effects

Correct, retry, tap, and celebration cues are synthesized at runtime with the
Web Audio API. No sound-effect recordings are bundled.

## Maps

Canada, Central America, and South America outlines were derived from the
[Click That 'Hood](https://github.com/codeforgermany/click_that_hood) boundary
data, licensed under MIT (Copyright Code for America, 2013–2021). The resulting
paths are stored in the frontend content modules. The United States outline
source and license are documented in its source-file header.

## Fonts

Inter and Nunito are bundled as `.woff2` files. Both use the SIL Open Font
License 1.1 and permit redistribution. Their upstream copyright and license
notices are included beside the font files as `Inter-OFL.txt` and
`Nunito-OFL.txt`. Sources:
[Inter](https://fonts.google.com/specimen/Inter) and
[Nunito](https://fonts.google.com/specimen/Nunito).

## Trademarks and services

Third-party names and trademarks belong to their respective owners. LetsLearnOS
is not affiliated with or endorsed by Nintendo, Game Freak, The Pokémon Company,
or OpenAI. OpenAI narration is an optional administrator-configured service.
