import { AnalysisResult, Factor, KeyPoint, Section, Theme, AskHit, ReadabilityScore } from '../types';

declare global {
  interface Window {
    pdfjsLib?: any;
    mammoth?: any;
    QRCode?: any;
    _dwScroll?: () => void;
  }
}

export const stopwords = new Set(
  "a an and are as at be by for from has he in is it its of on that the to was were will with this that have had what which you we our they them their there then than so if or not no yes but or into out over under about after before through during between among per via etc also such than can could should would may might must will shall being been do does did done because very more most many much such own same than too very just now".split(/\s+/)
);

export const cuePhrases = [
  "in conclusion", "in summary", "key finding", "key point", "important", "crucial",
  "essential", "significant", "result", "results show", "we found", "we recommend",
  "conclusion", "overall", "therefore", "however", "moreover", "first", "second",
  "finally", "notably", "critical"
];

export const themes: Theme[] = [
  { id: "default", name: "Default — Ink", bg: "#ffffff", ink: "#0f172a", sw: "linear-gradient(135deg,#0f172a,#e7dfd8)" },
  { id: "editorial", name: "Editorial — Warm Paper", bg: "#fdfbf7", ink: "#1c1917", sw: "linear-gradient(135deg,#fdfbf7,#fde68a)" },
  { id: "swiss", name: "Swiss — Grid", bg: "#ffffff", ink: "#0f172a", sw: "linear-gradient(135deg,#ffffff,#94a3b8)" },
  { id: "warm", name: "Warm — Sun", bg: "#fefce8", ink: "#422006", sw: "linear-gradient(135deg,#fefce8,#facc15)" },
  { id: "minimal", name: "Minimal — Air", bg: "#f8fafc", ink: "#334155", sw: "linear-gradient(135deg,#f8fafc,#e2e8f0)" },
  { id: "dark", name: "Dark — Focus", bg: "#0f172a", ink: "#e2e8f0", sw: "linear-gradient(135deg,#0f172a,#334155)" },
];

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] || m));
}

export function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function humanSize(b: number): string {
  if (b < 1024) return b + " B";
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
  return (b / 1024 / 1024).toFixed(2) + " MB";
}

export function cleanTextAdvanced(t: string): string {
  if (!t) return "";
  t = t.replace(/(\w)-\n(\w)/g, "$1$2").replace(/(\w)-\s+(\w)/g, (m, a, b) => a.length > 2 ? a + b : m);
  t = t.replace(/\r/g, "").replace(/\u00A0/g, " ").replace(/[ﬁﬂﬀ]/g, m => ({ "ﬁ": "fi", "ﬂ": "fl", "ﬀ": "ff" }[m] || m));
  const lines = t.split("\n");
  const counts = new Map<string, number>();
  lines.forEach(l => {
    const k = l.trim();
    if (k.length > 12 && k.length < 90) counts.set(k, (counts.get(k) || 0) + 1);
  });
  const bad = new Set([...counts.entries()].filter(([_, v]) => v >= 4).map(([k]) => k));
  let out = lines.filter(l => {
    const k = l.trim();
    if (bad.has(k)) return false;
    if (/^\s*\d+\s*$/.test(k)) return false;
    if (/^\s*Page\s+\d+(\s+of\s+\d+)?\s*$/i.test(k)) return false;
    return true;
  }).join("\n");
  out = out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/ {2,}/g, " ").trim();
  return out;
}

export async function extractPdf(file: File, onProgress?: (p: number) => void, renderThumbCanvas?: HTMLCanvasElement | null): Promise<{ text: string; pages: number }> {
  const buf = await file.arrayBuffer();
  const pdfjs = window.pdfjsLib;
  if (!pdfjs) throw new Error("PDF.js library not loaded yet.");
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const numPages = pdf.numPages;

  if (renderThumbCanvas) {
    try {
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 0.5 });
      const ctx = renderThumbCanvas.getContext("2d");
      if (ctx) {
        renderThumbCanvas.width = viewport.width;
        renderThumbCanvas.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport }).promise;
      }
    } catch (e) {
      console.warn("thumb failed", e);
    }
  }

  let full = "";
  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let lastY: number | null = null;
    let str = "";
    content.items.forEach((it: any) => {
      const y = it.transform ? it.transform[5] : null;
      const isNewLine = lastY !== null && y !== null && Math.abs(y - lastY) > 5;
      if (isNewLine) str += "\n";
      else if (str && !str.endsWith("\n") && !str.endsWith(" ")) str += " ";
      str += it.str;
      lastY = y;
    });
    full += str.trim() + "\n\n";
    if (onProgress) onProgress(Math.round((i / numPages) * 100));
    if (i % 4 === 0) await new Promise(r => setTimeout(r, 0));
  }
  return { text: full, pages: numPages };
}

export async function extractDocx(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const mammoth = window.mammoth;
  if (!mammoth) throw new Error("Mammoth library not loaded yet.");
  const res = await mammoth.extractRawText({ arrayBuffer: buf });
  return res.value || "";
}

export function tokenize(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(t => t.length >= 3 && !stopwords.has(t));
}

export function splitSentencesOptimized(t: string): string[] {
  let s = t.replace(/\n+/g, " ").replace(/\s{2,}/g, " ").trim();
  s = s.replace(/•/g, ". ").replace(/[–—]/g, " ");
  s = s.replace(/\b(e\.g|i\.e|Mr|Ms|Mrs|Dr|vs|etc|Fig|Eq|Ref)\./gi, m => m.replace(".", "<dot>"));
  const parts = s.split(/(?<=[.!?])\s+(?=[A-Z0-9“"(\[])/);
  const out = parts.map(p => p.replace(/<dot>/g, ".").trim()).filter(p => {
    const wc = p.split(/\s+/).length;
    return p.length > 22 && wc > 5 && wc < 70;
  });
  if (out.length < 2) {
    const alt = t.split(/[\n;]+/).map(x => x.trim()).filter(x => x.length > 24 && x.split(/\s+/).length > 5);
    if (alt.length > out.length) return alt;
  }
  return out.length ? out : [s.slice(0, 180)];
}

export function jaccard(a: string, b: string): number {
  const sa = new Set(a.split(/\W+/).filter(Boolean));
  const sb = new Set(b.split(/\W+/).filter(Boolean));
  let inter = 0;
  sa.forEach(x => { if (sb.has(x)) inter++; });
  return inter / (sa.size + sb.size - inter || 1);
}

export function detectSections(text: string, sentences: string[]): Section[] {
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  const headingCandidates: string[] = [];
  lines.forEach(l => {
    if (l.length > 100) return;
    const isNumbered = /^\d+(\.\d+)*[\.\)]\s+[A-Z]/.test(l);
    const isAllCaps = l.length > 5 && l.length < 70 && l === l.toUpperCase() && /[A-Z]{3,}/.test(l) && !/[.!?]$/.test(l);
    const isTitleCase = l.length < 70 && !/[.!?]$/.test(l) && /^[A-Z][a-z]+(\s+[A-Z][a-z]+){1,4}$/.test(l);
    const isKeyword = /^(abstract|executive summary|introduction|background|methods|findings|results|discussion|conclusion|recommendations|roadmap|limitations|references|key findings)/i.test(l);
    if (isNumbered || isAllCaps || isTitleCase || isKeyword) {
      headingCandidates.push(l.replace(/^#+\s*/, "").replace(/^\d+[\.\)]\s*/, "").trim());
    }
  });
  const uniq = [...new Set(headingCandidates)].slice(0, 12);
  if (uniq.length === 0) {
    const n = sentences.length;
    return [
      { title: "Introduction", startIdx: 0 },
      { title: "Body", startIdx: Math.floor(n * 0.33) },
      { title: "Conclusion", startIdx: Math.floor(n * 0.66) }
    ];
  }
  const sections = uniq.map(title => {
    let bestIdx = 0, bestScore = -1;
    sentences.forEach((s, idx) => {
      const score = jaccard(title.toLowerCase(), s.toLowerCase().slice(0, 80));
      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    });
    const fallback = Math.floor(sentences.length * (uniq.indexOf(title) / uniq.length));
    return { title, startIdx: bestScore > 0.25 ? bestIdx : fallback };
  });
  sections.sort((a, b) => a.startIdx - b.startIdx);
  if (sections[0].startIdx !== 0) sections[0].startIdx = 0;
  return sections;
}

export function textRankScores(sentences: string[], baseScores: { score: number }[], onStage?: (stage: string, p: number) => void): number[] {
  const N = sentences.length;
  if (N < 4) return baseScores.map(b => b.score);
  const vecs = sentences.map(s => {
    const toks = tokenize(s);
    const m = new Map<string, number>();
    toks.forEach(t => m.set(t, (m.get(t) || 0) + 1));
    return m;
  });
  const sim = new Array(N).fill(0).map(() => new Array(N).fill(0));
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const a = vecs[i], b = vecs[j];
      let dot = 0, na = 0, nb = 0;
      a.forEach((v, k) => {
        na += v * v;
        if (b.has(k)) dot += v * (b.get(k) || 0);
      });
      b.forEach(v => nb += v * v);
      const cos = dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
      let bonus = 0;
      if (/\d+%|\$/.test(sentences[i]) && /\d+%|\$/.test(sentences[j])) bonus += 0.08;
      sim[i][j] = cos + bonus;
      sim[j][i] = sim[i][j];
    }
  }
  const thresh = 0.08;
  const scores = new Array(N).fill(1 / N);
  const d = 0.85;
  for (let iter = 0; iter < 20; iter++) {
    const next = new Array(N).fill((1 - d) / N);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        if (i === j) continue;
        if (sim[j][i] < thresh) continue;
        let sum = 0;
        for (let k = 0; k < N; k++) {
          if (sim[j][k] >= thresh) sum += sim[j][k];
        }
        if (sum === 0) continue;
        next[i] += d * (sim[j][i] / sum) * scores[j];
      }
    }
    for (let i = 0; i < N; i++) scores[i] = next[i];
    if (onStage && iter % 5 === 0) onStage("textrank", Math.round((iter / 20) * 100));
  }
  const max = Math.max(...scores) || 1;
  return scores.map(s => s / max);
}

export function selectKeyPointsCoverage(
  combined: { sentence: string; idx: number; len: number; base: number; tr: number; final: number }[],
  k: number,
  sections: Section[],
  sectionForIdx: Map<number, number>,
  N: number
): KeyPoint[] {
  const byFinal = [...combined].sort((a, b) => b.final - a.final);
  const buckets = sections.length >= 3 ? sections.length : 3;
  const perBucket = Math.max(1, Math.ceil(k / buckets));
  const picked: { sentence: string; idx: number; final: number; tr: number; base: number }[] = [];
  const used = new Set<number>();

  for (let bIdx = 0; bIdx < buckets; bIdx++) {
    let count = 0;
    for (const c of byFinal) {
      const sec = sectionForIdx.get(c.idx) ?? Math.floor((c.idx / N) * buckets);
      const bucket = Math.min(buckets - 1, sec);
      if (bucket !== bIdx) continue;
      if (used.has(c.idx)) continue;
      if (picked.some(p => jaccard(p.sentence, c.sentence) > 0.62)) continue;
      picked.push(c);
      used.add(c.idx);
      count++;
      if (count >= perBucket) break;
    }
  }
  if (picked.length < k) {
    for (const c of byFinal) {
      if (used.has(c.idx)) continue;
      if (picked.some(p => jaccard(p.sentence, c.sentence) > 0.62)) continue;
      picked.push(c);
      used.add(c.idx);
      if (picked.length >= k) break;
    }
  }
  if (picked.length < k) {
    for (const c of byFinal) {
      if (used.has(c.idx)) continue;
      picked.push(c);
      if (picked.length >= k) break;
    }
  }
  picked.sort((a, b) => a.idx - b.idx);
  return picked.slice(0, k).map(c => ({
    sentence: c.sentence,
    idx: c.idx,
    score: c.final,
    tr: c.tr,
    base: c.base
  }));
}

export function buildAdaptiveSummary(
  combined: { sentence: string; idx: number; len: number; base: number; tr: number; final: number }[],
  sentences: string[],
  targetWords: number,
  N: number,
  sections: Section[]
): { sentences: string[]; coverage: boolean[] } {
  const sorted = [...combined].sort((a, b) => b.final - a.final);
  const topPool = sorted.slice(0, Math.max(6, Math.ceil(N * 0.38)));
  topPool.sort((a, b) => a.idx - b.idx);
  const thirds: [number, number][] = [
    [0, Math.floor(N * 0.33)],
    [Math.floor(N * 0.33), Math.floor(N * 0.66)],
    [Math.floor(N * 0.66), N]
  ];
  const must = new Set<number>();
  thirds.forEach(([lo, hi]) => {
    const cand = topPool.filter(c => c.idx >= lo && c.idx < hi).sort((a, b) => b.final - a.final)[0];
    if (cand) must.add(cand.idx);
  });
  let out: string[] = [];
  let w = 0;
  const ordered = topPool.slice().sort((a, b) => a.idx - b.idx);
  const poolSet = new Set(topPool.map(c => c.idx));
  must.forEach(idx => {
    if (!poolSet.has(idx)) {
      const c = combined.find(x => x.idx === idx);
      if (c) ordered.push(c);
    }
  });
  ordered.sort((a, b) => a.idx - b.idx);
  const mustOrdered = [...must].sort((a, b) => a - b);
  let added = new Set<number>();
  for (const idx of mustOrdered) {
    const c = combined.find(x => x.idx === idx) || topPool.find(x => x.idx === idx);
    if (c && !added.has(c.idx)) {
      const wl = c.sentence.split(/\s+/).length;
      if (w + wl <= targetWords + 24) {
        out.push(c.sentence);
        w += wl;
        added.add(c.idx);
      }
    }
  }
  for (const c of ordered) {
    if (added.has(c.idx)) continue;
    const wl = c.sentence.split(/\s+/).length;
    if (w + wl > targetWords + 18) continue;
    out.push(c.sentence);
    w += wl;
    added.add(c.idx);
    if (w >= targetWords) break;
  }
  if (out.length < 3) out = sentences.slice(0, Math.min(4, sentences.length));
  out = [...new Set(out)];
  const coverage = thirds.map(([lo, hi]) => out.some(s => {
    const idx = sentences.indexOf(s);
    return idx >= lo && idx < hi;
  }));
  return { sentences: out, coverage };
}

export function buildFactorsOptimized(
  text: string,
  topKeywords: { term: string; count: number; score: number }[],
  topBigrams: string[],
  sentences: string[],
  sections: Section[],
  allKeywords: { term: string; count: number; score: number }[]
): Factor[] {
  const lower = text.toLowerCase();
  const pool = [
    ...topBigrams.map(b => ({
      title: b.split(" ").map(w => w[0].toUpperCase() + w.slice(1)).join(" "),
      cues: b.split(" "),
      icon: "⬢",
      desc: "Recurring theme"
    })),
    ...topKeywords.slice(0, 4).map(k => ({
      title: k.term[0].toUpperCase() + k.term.slice(1),
      cues: [k.term],
      icon: "◈",
      desc: "High salience"
    }))
  ];
  const themesList = [
    { title: "Regulation & Governance", icon: "⚖", cues: ["regulation", "policy", "governance", "compliance", "mandate", "disclosure", "trust", "act", "framework"], desc: "Rules and oversight." },
    { title: "Economics & Value", icon: "◈", cues: ["cost", "price", "saving", "investment", "market", "revenue", "economics", "procurement"], desc: "Cost, scale and value." },
    { title: "Technology & Infrastructure", icon: "⬢", cues: ["battery", "autonom", "infrastructure", "charging", "platform", "model", "system", "deployment", "integration"], desc: "Technical stack." },
    { title: "Equity & Access", icon: "♥", cues: ["equity", "access", "bias", "disparit", "elderly", "disabled", "community", "consent", "demographic"], desc: "Who benefits." },
    { title: "Environment & Energy", icon: "⬡", cues: ["emission", "co2", "renewable", "energy", "climate", "carbon", "sustain"], desc: "Climate impact." },
    { title: "Risks & Safety", icon: "⚠", cues: ["risk", "safety", "failure", "incident", "error", "liability", "privacy", "drift", "bias"], desc: "Downsides." },
    { title: "Performance & Evidence", icon: "◎", cues: ["sensitivity", "specificity", "accuracy", "auroc", "trial", "rct", "performance", "meta-analysis"], desc: "Evidence base." },
  ];
  const scored = themesList.map(th => {
    let hits = 0, tfWeight = 0;
    th.cues.forEach(c => {
      if (lower.includes(c)) {
        hits++;
        const kw = allKeywords.find(k => c.includes(k.term) || k.term.includes(c));
        if (kw) tfWeight += kw.score;
      }
    });
    const ev = sentences.filter(s => th.cues.some(c => s.toLowerCase().includes(c))).slice(0, 2).join(" ").slice(0, 280);
    return { ...th, hits, tfWeight, evidence: ev, score: hits * 1.4 + tfWeight * 0.08 };
  }).sort((a, b) => b.score - a.score);

  let chosen = scored.filter(t => t.hits > 0).slice(0, 4);
  if (chosen.length < 3) chosen = scored.slice(0, 3);
  const covered = new Set(chosen.flatMap(c => c.cues));
  const extra = pool.find(p => !covered.has(p.cues[0]) && !chosen.some(c => c.title.toLowerCase() === p.title.toLowerCase()));
  if (extra && chosen.length < 4 && extra.title.length > 3) {
    chosen.push({
      title: extra.title,
      icon: extra.icon,
      cues: extra.cues,
      desc: extra.desc,
      evidence: sentences.find(s => s.toLowerCase().includes(extra.cues[0]))?.slice(0, 240) || extra.title,
      hits: 2,
      score: 5,
      tfWeight: 0
    });
  }
  return chosen.slice(0, 4).map(th => ({
    title: th.title,
    icon: th.icon,
    desc: th.desc,
    evidence: th.evidence || sentences.find(s => th.cues.some(c => s.toLowerCase().includes(c)))?.slice(0, 240) || topKeywords.slice(0, 3).map(k => k.term).join(", "),
    cues: th.cues.slice(0, 5)
  }));
}

export function countWordSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;

  // Normalize common suffixes and endings
  let clean = w
    .replace(/(?:[^laeiouy]|ed|es|e)$/, '')
    .replace(/^y/, '');

  const matches = clean.match(/[aeiouy]{1,2}/g);
  return matches ? Math.max(1, matches.length) : 1;
}

export function calculateReadability(words: string[], sentences: string[]): ReadabilityScore {
  const totalWords = Math.max(1, words.length);
  const totalSentences = Math.max(1, sentences.length);

  let totalSyllables = 0;
  for (const w of words) {
    totalSyllables += countWordSyllables(w);
  }

  const avgWordsPerSentence = parseFloat((totalWords / totalSentences).toFixed(1));
  const avgSyllablesPerWord = parseFloat((totalSyllables / totalWords).toFixed(2));

  // Flesch Reading Ease Formula:
  // 206.835 - 1.015 * (total words / total sentences) - 84.6 * (total syllables / total words)
  const rawEase = 206.835 - 1.015 * (totalWords / totalSentences) - 84.6 * (totalSyllables / totalWords);
  const fleschReadingEase = Math.max(0, Math.min(100, parseFloat(rawEase.toFixed(1))));

  // Flesch-Kincaid Grade Level Formula:
  // 0.39 * (total words / total sentences) + 11.8 * (total syllables / total words) - 15.59
  const rawGrade = 0.39 * (totalWords / totalSentences) + 11.8 * (totalSyllables / totalWords) - 15.59;
  const fleschKincaidGrade = Math.max(1, parseFloat(rawGrade.toFixed(1)));

  let level = "Standard";
  let description = "Accessible to general adult audiences";
  let audience = "8th & 9th Grade";

  if (fleschReadingEase >= 90) {
    level = "Very Easy";
    description = "Conversational, short sentences and everyday vocabulary";
    audience = "5th Grade (Elementary)";
  } else if (fleschReadingEase >= 80) {
    level = "Easy";
    description = "Smooth, effortless reading for casual audiences";
    audience = "6th Grade";
  } else if (fleschReadingEase >= 70) {
    level = "Fairly Easy";
    description = "Informative plain English, easy to skim and absorb";
    audience = "7th Grade";
  } else if (fleschReadingEase >= 60) {
    level = "Standard";
    description = "Clear business or consumer text; typical news article style";
    audience = "8th & 9th Grade";
  } else if (fleschReadingEase >= 50) {
    level = "Fairly Difficult";
    description = "Professional or analytical text with moderate vocabulary";
    audience = "10th to 12th Grade (High School)";
  } else if (fleschReadingEase >= 30) {
    level = "Difficult";
    description = "Dense technical, academic, or financial material";
    audience = "College Level";
  } else {
    level = "Very Difficult";
    description = "Complex specialized literature, legal briefs, or scientific papers";
    audience = "Graduate / Subject Specialists";
  }

  return {
    fleschReadingEase,
    fleschKincaidGrade,
    level,
    description,
    audience,
    avgWordsPerSentence,
    avgSyllablesPerWord,
  };
}

export function analyzeDocumentOptimized(
  text: string,
  info?: { pages?: number; name?: string; count?: number },
  onStage?: (stage: string, p: number) => void
): AnalysisResult {
  const sentences = splitSentencesOptimized(text);
  const words = text.split(/\s+/).filter(Boolean);
  const wc = words.length;
  const readingTime = Math.max(1, Math.ceil(wc / 220));
  let rawLines = text.split("\n").map(s => s.trim()).filter(Boolean);
  let title = rawLines.find(s => s.length > 10 && s.length < 130 && !/^(abstract|executive summary|introduction|references)/i.test(s)) || "Document Overview";
  title = title.replace(/^#+\s*/, "").replace(/^\d+[\.\)]\s*/, "");
  if (title.length > 120) title = title.slice(0, 120) + "…";
  const subtitle = sentences.slice(0, 2).join(" ").slice(0, 190) + (sentences.join(" ").length > 190 ? "…" : "");
  const N = sentences.length;
  const docFreq = new Map<string, number>();
  const tfMaps = sentences.map(s => {
    const toks = tokenize(s);
    const m = new Map<string, number>();
    toks.forEach(t => m.set(t, (m.get(t) || 0) + 1));
    new Set(toks).forEach(t => docFreq.set(t, (docFreq.get(t) || 0) + 1));
    return m;
  });
  const kwScores = new Map<string, number>();
  sentences.forEach((_, i) => {
    const m = tfMaps[i];
    m.forEach((tf, term) => {
      const df = docFreq.get(term) || 1;
      const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);
      kwScores.set(term, (kwScores.get(term) || 0) + tf * idf);
    });
  });
  let keywords = [...kwScores.entries()]
    .filter(([k]) => k.length >= 3 && !stopwords.has(k))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 28)
    .map(([term, score]) => ({ term, count: Math.round(score * 10), score }));

  const bigramScores = new Map<string, number>();
  sentences.forEach(s => {
    const toks = tokenize(s);
    for (let i = 0; i < toks.length - 1; i++) {
      const bg = toks[i] + " " + toks[i + 1];
      if (stopwords.has(toks[i]) || stopwords.has(toks[i + 1])) continue;
      if (bg.length < 6) continue;
      bigramScores.set(bg, (bigramScores.get(bg) || 0) + 1);
    }
  });
  const topBigrams = [...bigramScores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k]) => k);
  const topKeywords = keywords.slice(0, 10);
  const sections = detectSections(text, sentences);
  const sectionForIdx = new Map<number, number>();
  sentences.forEach((_, idx) => {
    let secIdx = 0;
    for (let i = 0; i < sections.length; i++) {
      if (idx >= sections[i].startIdx) secIdx = i;
    }
    sectionForIdx.set(idx, secIdx);
  });
  const titleTokens = new Set(tokenize(title));
  const baseScores = sentences.map((s, idx) => {
    const toks = tokenize(s);
    let tfidf = 0;
    const m = tfMaps[idx];
    m.forEach((tf, term) => {
      const df = docFreq.get(term) || 1;
      const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);
      tfidf += tf * idf;
    });
    tfidf = tfidf / Math.max(6, toks.length * 0.9);
    const posBoost = idx < 3 ? 1.35 : idx < Math.ceil(N * 0.08) ? 1.2 : idx > N * 0.88 ? 1.15 : 1;
    const len = toks.length;
    const lenPenalty = len < 10 || len > 42 ? 0.78 : len < 14 ? 0.92 : 1;
    const numBoost = /\d+%|\d+\.\d+%|\$[\d,.]+|\b\d{1,3}(?:,\d{3})+\b/.test(s) ? 1.28 : 1;
    const cueBoost = cuePhrases.some(c => s.toLowerCase().includes(c)) ? 1.35 : 1;
    const titleOverlap = toks.filter(t => titleTokens.has(t)).length / Math.max(1, titleTokens.size);
    const titleBoost = 1 + titleOverlap * 0.9;
    const sectionBoost = sections.length > 2 && (sectionForIdx.get(idx) === 0 || sectionForIdx.get(idx) === sections.length - 1) ? 1.08 : 1;
    let score = tfidf * posBoost * lenPenalty * numBoost * cueBoost * titleBoost * sectionBoost;
    score += (idx % 7) * 0.002;
    return { sentence: s.trim(), idx, len, tfidf, score, toks };
  });

  if (onStage) onStage("textrank", 0);
  const textRank = textRankScores(sentences, baseScores, onStage);
  const combined = sentences.map((s, i) => {
    const b = baseScores[i].score;
    const tr = textRank[i] || 0;
    return { sentence: s, idx: i, len: s.split(/\s+/).length, base: b, tr, final: 0.55 * tr * 10 + 0.45 * b };
  });
  combined.sort((a, b) => b.final - a.final);

  let targetWords: number, targetPoints: number;
  if (wc < 400) { targetWords = Math.min(160, Math.round(wc * 0.48)); targetPoints = 5; }
  else if (wc < 1500) { targetWords = Math.round(wc < 800 ? 210 : 260); targetPoints = 7; }
  else if (wc < 5000) { targetWords = Math.min(420, Math.round(wc * 0.18)); targetPoints = 9; }
  else { targetWords = Math.min(620, Math.round(wc * 0.13)); targetPoints = 10; }

  targetPoints = Math.min(targetPoints, Math.max(3, sentences.length - 1));
  if (sentences.length <= 3) targetPoints = sentences.length;

  const keyPoints = selectKeyPointsCoverage(combined, targetPoints, sections, sectionForIdx, N);
  if (onStage) onStage("summary", 0);
  const summaryObj = buildAdaptiveSummary(combined, sentences, targetWords, N, sections);
  const summary = summaryObj.sentences.join(" ");
  const oneLiner = combined[0]?.sentence || summaryObj.sentences[0] || "";
  const factors = buildFactorsOptimized(text, topKeywords, topBigrams, sentences, sections, keywords);
  const numbers = [...text.matchAll(/(?:\$[\d,]+(?:\.\d+)?|\d+(?:\.\d+)?%|\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\b)/g)].map(m => m[0]).filter(x => x.replace(/[^0-9]/g, "").length > 1).slice(0, 16);
  const dates = [...text.matchAll(/\b(?:19|20)\d{2}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/gi)].map(m => m[0]).slice(0, 12);
  const proper = [...text.matchAll(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/g)].map(m => m[0]);
  const pf = new Map<string, number>();
  proper.forEach(p => { if (p.split(" ").length > 1 && p.length < 44) pf.set(p, (pf.get(p) || 0) + 1); });
  const entities = [...pf.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k]) => k);
  const headings = sections.map(s => s.title).slice(0, 12);

  return {
    title,
    subtitle,
    wc,
    readingTime,
    sentences: N,
    keywords,
    topKeywords,
    topBigrams,
    keyPoints,
    summary,
    summaryWords: summary.split(/\s+/).filter(Boolean).length,
    summaryRatio: Math.round((summary.split(/\s+/).filter(Boolean).length / Math.max(1, wc)) * 100),
    oneLiner,
    factors,
    numbers,
    dates,
    entities,
    headings,
    sections,
    pages: info?.pages || Math.max(1, Math.ceil(wc / 430)),
    coverage: summaryObj.coverage,
    readability: calculateReadability(words, sentences),
    analysisReadingTime: Math.max(
      0.5,
      Math.round(
        ((summary.split(/\s+/).filter(Boolean).length +
          keyPoints.reduce((acc, p) => acc + p.sentence.split(/\s+/).filter(Boolean).length, 0)) /
          200) *
          10
      ) / 10
    ),
  };
}

export function askDocEngine(q: string, rawText: string): AskHit[] {
  const sents = splitSentencesOptimized(rawText);
  function stem(w: string) { return w.replace(/s$/, ''); }
  const qTokens = new Set(tokenize(q).map(stem));
  const scored = sents.map((s, idx) => {
    const toks = new Set(tokenize(s).map(stem));
    let inter = 0;
    qTokens.forEach(t => {
      if (toks.has(t)) inter++;
      else if ([...toks].some(x => x.includes(t) || t.includes(x))) inter += 0.7;
    });
    const jac = inter / (qTokens.size + toks.size - inter || 1);
    const numBoost = /how many|how much|number|percent|price|cost|revenue|margin/i.test(q) && /\d/.test(s) ? 1.4 : 1;
    const boost = /\b(risk|recommend|conclusion|result)\b/i.test(q) && cuePhrases.some(c => s.toLowerCase().includes(c)) ? 1.3 : 1;
    return { sentence: s, idx, score: jac * numBoost * boost };
  }).sort((a, b) => b.score - a.score).slice(0, 5).filter(x => x.score > 0.04);
  scored.sort((a, b) => a.idx - b.idx);
  return scored;
}

export function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const demoTexts = {
  short: `The Future of Urban Mobility: Autonomous Electric Fleets
Executive Summary
Cities worldwide face congestion, emissions, and inequitable access. This report examines how autonomous electric fleets – shared, on-demand vehicles operating without human drivers – could reshape urban mobility by 2035. Drawing on pilot data from 12 cities, modeling, and stakeholder interviews, we find that well-regulated fleets reduce vehicle-kilometers by 27%, CO2 by 41% when powered by renewables, and improve access for elderly and disabled residents. Risks include job displacement, data privacy, and induced demand. We recommend phased deployment, public data trusts, and curb pricing.
1. Why now?
Three forces converge: battery costs fell 82% since 2015, autonomy stacks reached Level 4 in geofenced zones, and cities adopted low-emission zones. 2024 pilots in Phoenix, Singapore and Hamburg moved 4.2M passengers with 0.12 incidents per million km – safer than human taxis (0.31). Yet public trust remains 48%, mostly due to high-profile errors.
2. Key findings
• Utilization jumps from 5% (private car) to 62% (fleet), cutting parking demand by 33%.
• Total cost per km falls from $0.71 to $0.39 at scale, but only with pooling >1.6 occupants.
• Night-time empty repositioning creates 11% extra VKT; intelligent charging and demand prediction halves this.
• Accessibility gains are largest in suburbs where transit headways exceed 20 minutes.
• Employment: 1.2M driving jobs at risk in the US/EU; retraining plus fleet maintenance creates 0.7M new roles.
3. Important factors for success
Regulation: Cities that set API mandates and safety case disclosure saw faster adoption (+34%).
Infrastructure: Curbside management, V2X corridors, and 150kW depot charging are prerequisites.
Equity: Means-tested fares and wheelchair-accessible vehicle quotas (≥30%) prevented exclusion.
Energy: Without 80%+ renewable electricity, emissions savings shrink to 18%.
Governance: Data trusts that anonymize trips but share origin-destination matrices enabled better planning while preserving privacy.
4. Risks and mitigations
Induced demand could erode 40% of congestion benefits unless paired with road pricing. Cybersecurity incidents (2 reported) underline need for ISO/SAE 21434 compliance. Public acceptance requires transparent incident reporting and community co-design.
5. Roadmap
2026-28: Geofenced shuttles in business districts, 5-10% modal share.
2029-31: Citywide pooled fleets, integration with MaaS apps, curb pricing.
2032-35: Full fleet orchestration, private car restrictions in cores, 30% car-free households.
Conclusion
Autonomous electric fleets are not a silver bullet, but a lever. Cities that pair technology with pricing, equity, and governance will capture gains; those that don't risk amplifying sprawl and inequality. The window for proactive policy is now.`,

  long: `Transforming Healthcare with AI Diagnostics — A Comprehensive Review
Abstract
This 2030 review synthesizes 86 studies on AI diagnostics in radiology, pathology and primary care. AI systems now match or exceed specialist performance in 31 of 41 tasks, with mean sensitivity 94.2% and specificity 95.1% for chest X-ray triage. Deployment at scale in the UK NHS and Rwanda showed 28% faster time-to-diagnosis and 19% cost reduction, but highlighted challenges: dataset bias (Fitzpatrick V-VI under-representation 73%), workflow integration (38% alert fatigue), and liability ambiguity. We propose a 5-pillar governance framework.
1. Performance Landscape
Deep learning models trained on >2M images achieve AUROC 0.97 for lung nodule detection, 0.96 for diabetic retinopathy, and 0.93 for melanoma classification. Meta-analysis of 14 RCTs (n=42,000) found AI-assisted clinicians improved accuracy by +9.4pp versus clinicians alone, and +3.1pp versus AI alone — underscoring complementarity. Crucially, performance degrades 12-18% on external validation; site-specific fine-tuning recovers 70% of loss.
2. Economics and Workflow
Per-scan cost fell from $8.20 (2022) to $1.10 (2029) with distilled models. NHS pilot (3 hospitals, 18 months) saved £2.3M, mostly via reduced missed cancellations. However, integration time averaged 11 months; FHIR mandates cut this to 6 months. Alert burden: standalone AI generated 42 alerts/day/radiologist; integration with prioritization queue cut false positives to 9/day.
3. Equity and Bias
Datasets are skewed: 81% North American/European, 4% African. This yields 15% lower sensitivity for dark skin lesions and 22% higher false negatives for tuberculosis in high-HIV cohorts. Mitigations: balanced sampling, synthetic augmentation (+11% sensitivity recovery), and stratified reporting. Community-led data trusts in India and Brazil increased consent rates from 31% to 68%.
4. Governance, Safety, and Trust
Regulatory evolution: FDA 510(k) for 23 models by 2028, EU AI Act high-risk classification. Continuous monitoring caught 7 drift events (COVID-era shift). Clinician trust (survey n=1,240) was 58% overall, 81% when explainability heatmaps were provided and liability was clarified as “human-in-the-loop”. Patient acceptance was 74% if a human reviewed the AI output.
5. Risks and Unknowns
Over-reliance: 9% of errors were automation bias cases where clinicians dismissed correct intuition. Data leakage affected 3 published models. Dual-use concerns (insurance denial) remain unaddressed. Long-term outcomes data is sparse — only 4 studies tracked >2 years.
6. Pillar Framework for Scale
Pillar 1: Data equity — mandate demographic quotas and external validation.
Pillar 2: Workflow — embed AI as triage, not replacement; keep human override <2s away.
Pillar 3: Monitoring — real-time drift detection and quarterly recalibration.
Pillar 4: Economics — pooled procurement and open-weight baselines to avoid lock-in.
Pillar 5: Trust — explainability, liability clarity, patient co-design.
7. Roadmap to 2035
Phase A (2026-28): National imaging registries, reimbursement codes.
Phase B (2029-31): Primary-care triage (derm, retinopathy) at population scale.
Phase C (2032-35): Multimodal foundation models with longitudinal records; 50% of first-reads AI-assisted.
Conclusion
AI diagnostics are effective but not turnkey. Evidence shows best outcomes are collaborative, equitable, and governed. Systems that invest in data diversity, workflow fit, monitoring, and trust will realize the 28% speed and 19% cost gains; those chasing raw accuracy alone risk harm and waste. Call to action: implement the 5-pillar framework before procurement.
Limitations
Heterogeneous study designs, publication bias, limited LMIC data, and rapid model turnover constrain generalizability. We excluded generative LLMs for report drafting — a separate review is needed.
References include Rajpurkar et al. 2024, Topol 2023, WHO Guidance 2025, NHS AI Lab 2029, and 82 additional sources.`.repeat(2),

  compareA: `Q3 Financial Review — Acme Corp
Revenue $4.2B (+12.3% YoY) beating $4.05B est. Cloud +23%, Licensing +8%. Margin 38.2% (+120bps). Cash $892M, debt -$210M. Guidance: $18B FY26, 41% margin. Risks: FX $120M headwind, SMB churn 3.1%. Buyback $500M, dividend $0.42. CEO: 3 deals >$10M, capex $340M.`,

  compareB: `Q3 Financial Review — Beta Inc
Revenue $2.9B (+8.1% YoY) missing $3.1B est. Cloud +11%, Licensing +2%. Margin 31.4% (-40bps). Cash $410M, debt +$80M. Guidance: $11B FY26, 33% margin. Risks: churn 5.4%, regulatory delay. No buyback, dividend $0.18 flat. CEO: 1 deal >$10M, capex $210M. Cost cutting 12% underway.`
};
