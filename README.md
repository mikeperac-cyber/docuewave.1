# DocuWeave — PDF → Beautiful Webpage Studio (React + TypeScript)

> **Turn any PDF or document into a stunning, shareable webpage.** Drag-and-drop, 100% offline, with thorough AI-free analysis — key points, important factors, comprehensive summary — plus library, themes, editor, timeline, glossary, Ask-the-document and one-click exports.

**Framework:** React 19 + TypeScript + Vite  
**License:** MIT  

---

## ✨ Features

### Core Document Ingest & Analysis (No External AI API Required)
- **Universal Ingest:** PDF.js (with line-break reconstruction + first-page thumbnail canvas), Mammoth for DOCX, plain text (TXT/MD), paste handler (`Ctrl+V`), and **multi-file queue** for merging documents.
- **Advanced Text Cleaning:** de-hyphenation, ligature normalization (`ﬁ→fi`), repeated header/footer removal, page number stripping.
- **Natural Language Analysis Engine:**
  - `cleanTextAdvanced` → `splitSentencesOptimized` → `detectSections` (numbered/all-caps/title-case/keyword mapped).
  - **BM25 TF-IDF** + **TextRank** (cosine graph similarity, numeric bonus, 20 PageRank iterations).
  - Combined `0.55*TextRank*10 + 0.45*TFIDF` with positional, cue-phrase, title, and section boosts.
  - **Adaptive summary** with intro/body/conclusion thirds coverage guarantee.
  - **Coverage-balanced key points** with Jaccard deduplication.
  - **Dynamic factors** across 7 thematic dimensions with direct textual evidence.

### Interactive Webpage Studio
- **📚 Local Library (`localStorage.dw_lib`):** auto-saves every woven webpage (up to 20 slots), with search, open, and delete.
- **↔️ Multi-doc & Compare:** drop multiple files to merge them into a unified overview and view side-by-side comparative summaries.
- **🎨 Theme Studio (6 Themes):** Default (Ink), Editorial (Warm Paper), Swiss (Grid), Warm (Sun), Minimal (Air), and Dark (Focus) with custom accent color picker.
- **✏️ Live In-Page Editor:** inline editable title, subtitle, summary, and key points; add/delete/re-rank points; regenerate summary length.
- **🔍 Reading & Search Controls:** sticky reading toolbar, scroll-spy table of contents, in-page search with `<mark>` highlighting, font size adjustment (13px–19px), layout width switch (Narrow, Comfort, Wide), and focus mode.
- **◈ Timeline & ⬡ Glossary:** automatic date/event timeline extraction and salient term glossary with keyword filter chips.
- **⌕ Ask the Document:** offline TF-IDF semantic question-answering ranking relevant sentences with match highlights.
- **⬇️ Exports:** themed self-contained HTML (with OpenGraph meta), Markdown, plain text briefing, JSON, JSON-LD Schema.org Article, email HTML, and offline QR code image generation.

---

## 🏃 Getting Started

### Development
```bash
npm run dev
```
Listens on `http://0.0.0.0:3000`.

### Production Build
```bash
npm run build
```
Type checks with `tsc` and compiles via Vite.

---

## ⌨️ Shortcuts

- `Ctrl+V` / `Cmd+V`: Paste text directly
- `Ctrl+E` / `Cmd+E`: Toggle live webpage editor
- `Ctrl+S` / `Cmd+S`: Open export modal
- `Esc`: Close open modals or exit edit mode

---

<p align="center">Built with React • TypeScript • Vite • PDF.js • Mammoth • QRCode.js • TextRank + TF-IDF</p>
