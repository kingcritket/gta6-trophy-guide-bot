# Leonida Ledger — GTA VI Trophy Guide & Tracker

An offline guide and tracker for all 55 PlayStation 5 trophies of Grand
Theft Auto VI, built for make.fun's `gta6-trophy-guide-01` competition.

- **Every trophy** with its official name, description and grade, plus a
  guide in our own words that cites its sources (Exophase and PSNProfiles
  for the official list; PowerPyx's trophy guide & roadmap for the
  difficulty, time, missable warning and 100%-completion counts).
- **Tracker**: checklist saved in the browser (localStorage), export to a
  JSON file and import back, filters by grade and kind, search, a
  missable-only filter, and a spoiler mode that hides story trophies until
  they are earned.
- **Roadmap to the platinum** in three steps, and a **missables page**:
  only one trophy (Positive Mental Attitude) may be missable.
- **Offline**: static files under `app/`, no network requests, no
  tracking, no Rockstar artwork — the look is our own.

## Try it

```
node serve.ts
```

then open http://localhost:8080. `?seed=13` opens the tracker with 13
trophies earned (the state the screenshots were taken in);
`?spoiler=1` turns spoiler mode on.

## Hand it in

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `app/` and `screenshots/` to the output directory and
writes `dossier.json` with the vendored make.fun library.

## Tests

- `node tools/verify-trophies.cjs` — the 55 trophies against the kit's
  official list (names, descriptions, grades, guides).
- `node tools/e2e.mjs` — headless-Chrome end-to-end checks: no network
  requests, spoiler mode, filters, export/import round trip, persistence,
  and the four screenshots.
- `node tools/gatecheck.mjs` — the gate's limits (files, sizes,
  screenshots, references, dossier determinism) against `out/`.

## License

MIT — see `LICENSE`.
