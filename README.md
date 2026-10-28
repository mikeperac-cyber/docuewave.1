# DocuWeave — Turn PDFs into Beautiful, Publishable Webpages

> Turn dense documents into polished, readable web stories in minutes.

DocuWeave is a lightweight document-to-web studio that transforms PDFs, DOCX files, pasted text, and merged documents into elegant, shareable webpages — without needing external AI APIs or a complicated workflow.

Whether you're summarizing research, preparing a briefing, building a knowledge base, or turning a report into a beautiful shareable page, DocuWeave helps you move from raw source material to polished output fast.

## Why teams and creators use DocuWeave

- Transform reports, lecture notes, PDFs, and articles into readable web pages
- Extract the important ideas automatically with built-in analysis
- Turn long-form content into clear summaries, highlights, and structured narratives
- Customize the result with themes, typography, layouts, and export options
- Work completely offline with no external AI dependency

## The idea in one sentence

DocuWeave takes the chaos of documents and turns it into clean, elegant, browser-ready content you can read, search, compare, edit, and share.

---

## What DocuWeave does

### From raw document to clear narrative

Upload a PDF, DOCX, TXT, or Markdown file — or paste text directly — and DocuWeave cleans, structures, and analyzes the content.

It identifies:

- key points and standout insights
- summary sections and document structure
- important factors and themes
- related dates, events, and glossary terms
- relevant excerpts for fast lookup and Q&A

### Built for reading, not just processing

Instead of leaving you with a wall of text, DocuWeave assembles a presentation-ready webpage with:

- readable summaries and key takeaways
- highlights and section-aware organization
- timeline and glossary extraction
- searchable in-page reading experience
- export-ready formats for sharing and archiving

### Make it yours

Customize every weave with:

- multiple visual themes
- accent colors and editable page content
- live in-page editing
- local library for saved pages
- multi-document comparison and merge workflows

---

## Features that make it stand out

### Smart document ingestion

- PDF upload with page rendering and thumbnail support
- DOCX parsing with Mammoth
- TXT and Markdown support
- paste-from-clipboard workflow
- multi-file queue for combined document analysis

### Powerful analysis engine

- advanced text cleaning and normalization
- section detection and structure-aware grouping
- TF-IDF + TextRank based insight extraction
- summary balancing for intro, body, and conclusion coverage
- deduplicated key points with weighted relevance
- dynamic factor extraction across major thematic dimensions

### Beautiful webpage studio

- 6 design themes with instant visual switching
- inline editing for title, subtitle, summary, and key points
- reading toolbar and sticky navigation
- in-page search with highlighted matches
- adjustable font size and layout width
- timeline and glossary modules
- multi-document compare mode

### Built for sharing and reuse

- save pages locally in your personal library
- export as themed HTML, Markdown, text brief, JSON, JSON-LD, email HTML, and QR code images
- generate open graph-friendly webpage output
- keep your work private and offline

---

## Built for real-world use cases

### Researchers and analysts
Create readable summaries from dense reports, studies, and source materials without starting from scratch.

### Students and learners
Turn notes, assigned readings, and PDFs into organized study pages with key takeaways and searchability.

### Teams and knowledge workers
Turn internal documents, briefs, and research into polished web pages that are easier to review and share.

### Creators and publishers
Repurpose long-form content into elegant, readable, presentation-ready digital pages.

---

## Getting started

### Development

```bash
npm run dev
```

The app runs locally on `http://0.0.0.0:3000`.

### Production build

```bash
npm run build
```

This performs TypeScript checks and builds the app with Vite.

---

## Quick shortcuts

- `Ctrl+V` / `Cmd+V`: Paste text directly
- `Ctrl+E` / `Cmd+E`: Toggle live webpage editor
- `Ctrl+S` / `Cmd+S`: Open export modal
- `Esc`: Close modal windows or exit edit mode

---

## Tech stack

Built with:

- React 19
- TypeScript
- Vite
- PDF.js
- Mammoth
- QRCode.js
- TextRank + TF-IDF

## License

MIT

---

<p align="center"><strong>DocuWeave:</strong> Turn documents into something people actually want to read.</p>
