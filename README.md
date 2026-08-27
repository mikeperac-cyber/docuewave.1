# DocuWeave — PDF → Beautiful Webpage Studio

> **Turn any PDF or document into a stunning, shareable webpage.** Drag-and-drop, 100% offline, with thorough AI-free analysis — key points, important factors, comprehensive summary — plus library, themes, editor, timeline, glossary, Ask-the-document and one-click exports.

**Live:** Open `index.html` directly or `python -m http.server 5173` → `http://localhost:5173`  
**Repo:** `https://github.com/mikeperac-cyber/docuewave.1` • **Version:** `v3.0` • **License:** MIT

---

## ✨ Demo

| Input | Output |
|---|---|
| Drop a PDF / DOCX / TXT / MD (or paste `Ctrl+V`, or drop **multiple** to merge/compare) | Scroll to a polished webpage with summary, points, factors, timeline, glossary, insights, coverage map, stats |

Try the built-ins: **Try demo** (612w report), **Try long** (~1.2k), **Try compare (2 docs)** (side-by-side).

---

## 🚀 Features

### Core — Make every document its best webpage
- **Universal ingest:** PDF.js (with `transform[5]` line-break reconstruction + first-page thumbnail canvas), Mammoth for DOCX, TXT/MD, paste handler, **multi-file queue** (merge → single analysis)
- **Advanced cleaning:** de-hyphenation `(\w)-\n(\w)`, ligatures `ﬁ→fi`, repeated header/footer stripping (freq ≥4), `Page N of M` & lone numbers removal
- **Thorough analysis (no API):**
  - `cleanTextAdvanced` → `splitSentencesOptimized` (abbrev-safe) → `detectSections` (numbered/all-caps/title-case/keyword → Jaccard mapped)
  - **BM25 TF-IDF** + **TextRank** (cosine similarity, threshold `0.08`, numeric bonus `0.08`, 20 PageRank iterations `d=0.85`)
  - Combined `0.55*TextRank*10 + 0.45*TFIDF` × boosts: position (intro `1.35`, conclusion `1.15`), length, numeric `1.28`, cue-phrase `1.35` (12 cues), title-overlap, section
  - **Adaptive summary** `<400w→48%≤160w | <1500w→210-260w | <5000w→18%≤420w | ≥5000w→13%≤620w` with **must-cover** intro/body/conclusion thirds
  - **Coverage-balanced key points** `selectKeyPointsCoverage` per-section buckets, Jaccard `0.62` dedup
  - **Dynamic factors** `buildFactorsOptimized` — 7 themes scored `hits*1.4 + tfWeight*0.08` + top-bigram cluster, evidence from best sentences

### v3 — Idea-fitting power tools
- **📚 Library (localStorage `dw_lib`):** auto-saves every weave (20 slots), grid, search, open/delete, count badge `libCount`
- **↔️ Multi-doc & Compare:** queue UI, merged `===== DOCUMENT: name =====` text, `isCompareMode` side-by-side `wCompare` (`compareParts`)
- **🎨 Theme Studio (6 themes):** default / editorial / swiss / warm / minimal / dark — `applyTheme(id)` + accent color `setAccent`, `themeModal`, persisted `dw_theme`, export inherits theme. Dark & focus modes.
- **✏️ Live Editor:** `toggleEdit()` `contentEditable` title/subtitle/summary/points, `addPoint`/`removePoint`/`shufflePoints`/`regenerateSummary(±words)`/`duplicateWebpage`, inline save
- **🔍 Search & Reading:** sticky `webpage-controls` + `progress-web #readProgress` + `setupReadingProgress` scroll spy (active TOC), `searchWebpage` TreeWalker `<mark>` (stem `s$` + `includes`), `tocSearch`/`pageSearch`, font slider 13-19px, width 720/860/1020
- **◈ Timeline & ⬡ Glossary:** `wTimeline` from 12 dates regex, `wGlossary` from `topKeywords`+`topBigrams` with context sentence + chip filter
- **⌕ Ask the document:** `askInput` → `askDoc()` TF-IDF Jaccard + stem + `numBoost 1.4`/`cueBoost 1.3`, top5 marked highlights
- **⬇️ Extended Exports:** themed HTML (+ `og:` meta, optional source), Markdown, plain text briefing, JSON, JSON-LD `schema.org Article`, Email HTML (clipboard), **QR** via `QRCode.js` (`qrcode`/`qrLarge` + `downloadQR` PNG), `includeSource` toggle
- **Other polish:** first-page PDF thumbnail canvas, chip→search filters, reading stats `mWords/mPages/mTime`, 5-step progress `Extract→Clean→Score→TextRank→Weave`, self-test bar, keyboard `Esc`/`Ctrl+E`/`Ctrl+S`, `copySource`/`highlightSearch`

---

## 🏃 Quick Start

```bash
# 1. Clone
git clone https://github.com/mikeperac-cyber/docuewave.1.git
cd docuewave.1

# 2. Run (no build)
python -m http.server 5173
# or: npx serve .  /  open index.html directly

# 3. Open http://localhost:5173
```

No `npm install` — all deps via CDN:
- `pdf.js@3.11.174` (+ worker)
- `mammoth@1.6.0` (DOCX)
- `qrcodejs@1.0.0` (QR)

Works fully offline after first load (browser cache).

---

## 🧠 How Analysis Guarantees “Best for Every Document”

| Doc size | Target summary | Points | Strategy |
|---|---|---|---|
| `<50w` very-short | 8-35w (≤90%) | `min(sentences,3)` | Keep almost all, avoid over-distilling |
| `<400w` short | 25-65% ≤160w | 5 | High recall |
| `400-1500w` medium | 210-260w | 7 | Balanced |
| `1500-5000w` long | 18% ≤420w | 9 | Aggressive distill |
| `≥5000w` very-long | 13% ≤620w | 10 | Max distill |

Coverage enforcement ensures at least one sentence from intro/body/conclusion thirds enters the summary. Key points are per-section balanced so a 12-page report doesn’t cluster points at the start.

---

## 📤 Exports

- **HTML (themed)** — self-contained, inline `<style>` + theme vars, `og:` tags, optional source `<section>` — host anywhere
- **Markdown** — `# title`, `## Summary`, `## Key Points` list, `## Factors` etc. — Notion/Obsidian ready
- **Plain text** / **Email HTML** (copied for Gmail/Outlook) / **JSON** / **JSON-LD** (paste into `<script type="application/ld+json">`)
- **QR PNG** — encodes `title • wc • DocuWeave` for quick share — `downloadQR()`

All via `downloadBlob()` or `navigator.clipboard`.

---

## 📂 Project Structure

```
PDF to WEBPAGE/
├── index.html              # Single-file app (HTML+CSS+JS, ~108KB) — all features, no build
├── test_optimized_v2.js    # Core engine tests: 8 docs (9w→1.5k) + 19 feature checks
└── test_v3_features.js     # v3 audit: 38 idea-fitting feature checks + server check
```

`index.html` is intentionally single-file for easy hosting (GitHub Pages, Netlify Drop, S3). All logic lives in `<script>`:
- `cleanTextAdvanced`, `extractPdf`, `extractDocx`
- `analyzeDocumentOptimized` + `tokenize`/`splitSentencesOptimized`/`detectSections`/`textRankScores`/`selectKeyPointsCoverage`/`buildAdaptiveSummary`/`buildFactorsOptimized`
- `render` + new `saveToLibrary`/`applyTheme`/`toggleEdit`/`searchWebpage`/`askDoc`/`exportMarkdown` etc.

---

## ✅ Testing

```bash
node test_optimized_v2.js   # 8/8 docs PASS, 19/19 core PASS
node test_v3_features.js    # 38/38 v3 PASS, server 200 OK
```

Or in-app: **▶ Tests** button (auto-runs on load, shows `✓ doc tests + feature checks`).

Live self-test also verifies drag-drop zone, PDF/DOCX extractors, TextRank, adaptive summary, library, theme, Ask, timeline.

---

## ⌨️ Shortcuts

- `Ctrl+V` paste text (no file needed)
- `Ctrl+E` toggle edit, `Ctrl+S` export HTML, `Esc` close modals/exit edit
- Drop multiple files → merged analysis; Library → compare last 2

---

## 🛣️ Roadmap

- [ ] OCR for image-only scanned PDFs (Tesseract.js)
- [ ] Extracted tables → HTML `<table>` in webpage (pdf.js operator list)
- [ ] PWA + offline install + file handler
- [ ] Collaborative share link (WebRTC / IPFS optional)

---

## 🤝 Contributing

PRs welcome — keep `index.html` single-file, no build step, preserve test IDs (`zone`, `extractPdf`, `textRankScores`, `dw_lib`, etc.) so `test_*.js` stay green.

---

## 📄 License

MIT — do anything, keep copyright notice. See `LICENSE` (add if needed).

---

<p align="center">Built with PDF.js • Mammoth • QRCode.js • Fraunces + Inter • TextRank + TF-IDF • 100% client-side</p>
