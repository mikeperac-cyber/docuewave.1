import React, { useState, useEffect, useRef } from 'react';
import { AnalysisResult, AskHit } from '../types';
import {
  askDocEngine,
  downloadBlob,
  escapeHtml,
  escapeReg,
  splitSentencesOptimized,
  themes,
} from '../utils/engine';

interface WebpageViewProps {
  analysis: AnalysisResult;
  rawText: string;
  currentTheme: string;
  onOpenTheme: () => void;
  onOpenExport: () => void;
  onUpdateAnalysis: (updated: AnalysisResult) => void;
  onOpenCompare: () => void;
  onDuplicateWebpage: () => void;
  onToggleThemeDark: () => void;
}

export const WebpageView: React.FC<WebpageViewProps> = ({
  analysis,
  rawText,
  currentTheme,
  onOpenTheme,
  onOpenExport,
  onUpdateAnalysis,
  onOpenCompare,
  onDuplicateWebpage,
  onToggleThemeDark,
}) => {
  const [editMode, setEditMode] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [contentWidth, setContentWidth] = useState(860);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [pageSearchQuery, setPageSearchQuery] = useState('');
  const [askQuery, setAskQuery] = useState('');
  const [askHits, setAskHits] = useState<AskHit[] | null>(null);
  const [activeSection, setActiveSection] = useState('s-summary');
  const [readProgress, setReadProgress] = useState(0);

  const qrRef = useRef<HTMLDivElement>(null);
  const webpageRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  // QR Code generation in TOC quick share
  useEffect(() => {
    if (qrRef.current && window.QRCode) {
      qrRef.current.innerHTML = '';
      const text = `${analysis.title} • ${analysis.wc}w • DocuWeave`;
      try {
        new window.QRCode(qrRef.current, { text, width: 120, height: 120 });
      } catch (e) {
        qrRef.current.textContent = 'QR unavailable offline';
      }
    }
  }, [analysis.title, analysis.wc]);

  // Scroll spy & reading progress bar
  useEffect(() => {
    const handleScroll = () => {
      if (!webpageRef.current) return;
      const rect = webpageRef.current.getBoundingClientRect();
      const h = webpageRef.current.offsetHeight - window.innerHeight;
      const scrolled = Math.min(1, Math.max(0, -rect.top / (h || 1)));
      setReadProgress(scrolled * 100);

      const sectionIds = [
        's-summary',
        's-points',
        's-factors',
        's-timeline',
        's-glossary',
        's-insights',
        's-ask',
        's-coverage',
        's-stats',
        's-source',
      ];
      let current = 's-summary';
      sectionIds.forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
          const r = el.getBoundingClientRect();
          if (r.top < 140) current = id;
        }
      });
      setActiveSection(current);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Webpage in-page text search and highlighting
  const searchWebpage = (q: string) => {
    setPageSearchQuery(q);
    if (!webpageRef.current) return;

    // Clear previous marks
    webpageRef.current.querySelectorAll('mark').forEach((m) => {
      const textNode = document.createTextNode(m.textContent || '');
      m.parentNode?.replaceChild(textNode, m);
    });
    webpageRef.current.normalize();

    if (!q || q.trim().length < 2) return;

    const re = new RegExp(`(${escapeReg(q)})`, 'gi');
    const walker = document.createTreeWalker(webpageRef.current, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];

    while (walker.nextNode()) {
      const n = walker.currentNode as Text;
      const parent = n.parentElement;
      if (
        !parent ||
        parent.tagName === 'MARK' ||
        parent.tagName === 'SCRIPT' ||
        parent.closest('.webpage-controls') ||
        parent.closest('.toolbar')
      ) {
        continue;
      }
      if (n.nodeValue && re.test(n.nodeValue)) {
        textNodes.push(n);
      }
    }

    textNodes.forEach((n) => {
      const text = n.nodeValue || '';
      const frag = document.createDocumentFragment();
      let last = 0;
      text.replace(re, (match, _, offset) => {
        frag.appendChild(document.createTextNode(text.slice(last, offset)));
        const mark = document.createElement('mark');
        mark.textContent = match;
        mark.style.background = '#fff1a8';
        mark.style.padding = '1px 2px';
        mark.style.borderRadius = '4px';
        frag.appendChild(mark);
        last = offset + match.length;
        return match;
      });
      frag.appendChild(document.createTextNode(text.slice(last)));
      n.parentNode?.replaceChild(frag, n);
    });

    const first = webpageRef.current.querySelector('mark');
    if (first) {
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Toggle edit mode and sync content changes
  const toggleEdit = () => {
    if (editMode) {
      // Exiting edit mode: save changes
      const updatedTitle = titleRef.current?.innerText.trim() || analysis.title;
      const updatedSubtitle = subtitleRef.current?.innerText.trim() || analysis.subtitle;
      const updatedSummary = summaryRef.current?.innerText.trim() || analysis.summary;

      const updatedPoints = [...document.querySelectorAll('#wPoints li')].map((li, i) => {
        const txt = li.querySelector('.ptxt')?.textContent?.trim() || li.textContent?.trim() || '';
        return {
          sentence: txt,
          idx: parseInt((li as HTMLElement).dataset.idx || String(i)),
          score: analysis.keyPoints[i]?.score || 0,
        };
      });

      onUpdateAnalysis({
        ...analysis,
        title: updatedTitle,
        subtitle: updatedSubtitle,
        summary: updatedSummary,
        keyPoints: updatedPoints,
      });
      setEditMode(false);
    } else {
      setEditMode(true);
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  };

  // Add a key point
  const handleAddPoint = () => {
    const txt = prompt('Add a key point (one sentence):');
    if (!txt || !txt.trim()) return;
    const newPoint = { sentence: txt.trim(), idx: analysis.sentences, score: 0 };
    onUpdateAnalysis({
      ...analysis,
      keyPoints: [...analysis.keyPoints, newPoint],
    });
    if (!editMode) setEditMode(true);
  };

  // Remove a key point
  const handleRemovePoint = (index: number) => {
    const updated = [...analysis.keyPoints];
    updated.splice(index, 1);
    onUpdateAnalysis({ ...analysis, keyPoints: updated });
  };

  // Shuffle / reverse points
  const handleShufflePoints = () => {
    const reversed = [...analysis.keyPoints].reverse();
    onUpdateAnalysis({ ...analysis, keyPoints: reversed });
  };

  // Summary length adjustment (-20 or +40 words)
  const handleRegenerateSummary = (delta: number) => {
    const sents = splitSentencesOptimized(rawText);
    const newTarget = Math.max(60, Math.min(600, analysis.summaryWords + delta));
    const combined = sents
      .map((s, idx) => {
        const sc = analysis.keyPoints.find((k) => k.idx === idx)?.score || 0.5;
        return { sentence: s, idx, score: sc };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.ceil(sents.length * 0.4));
    combined.sort((a, b) => a.idx - b.idx);
    let out: string[] = [];
    let w = 0;
    for (const c of combined) {
      const wl = c.sentence.split(/\s+/).length;
      if (w + wl > newTarget + 18) break;
      out.push(c.sentence);
      w += wl;
      if (w >= newTarget) break;
    }
    const newSummary = out.join(' ');
    const newWords = w;
    const newRatio = Math.round((w / Math.max(1, analysis.wc)) * 100);
    onUpdateAnalysis({
      ...analysis,
      summary: newSummary,
      summaryWords: newWords,
      summaryRatio: newRatio,
    });
  };

  // Ask the document
  const handleAsk = () => {
    if (!askQuery.trim()) {
      setAskHits([]);
      return;
    }
    const hits = askDocEngine(askQuery, rawText);
    setAskHits(hits);
  };

  const handleAskExample = () => {
    const ex = [
      'What are the main risks?',
      'What is the recommendation?',
      'Show numbers and percentages',
      'What is the timeline?',
      'What about costs?',
    ];
    const picked = ex[Math.floor(Math.random() * ex.length)];
    setAskQuery(picked);
    const hits = askDocEngine(picked, rawText);
    setAskHits(hits);
  };

  // Timeline extraction: map dates to sentences
  const timelineItems =
    analysis.dates.length >= 2
      ? analysis.dates.slice(0, 10).map((d) => {
          const sents = splitSentencesOptimized(rawText);
          const hit = sents.find((s) => s.includes(d) || s.includes(d.replace(/\s+/g, ' ')));
          const ctx = hit ? hit.slice(0, 160) : 'Mentioned in document';
          return { date: d, ctx };
        })
      : [];

  // Glossary terms
  const glossaryTerms = [
    ...analysis.topKeywords.slice(0, 8).map((k) => k.term),
    ...analysis.topBigrams.slice(0, 4),
  ].slice(0, 10);

  const copyBriefing = (e: React.MouseEvent<HTMLButtonElement>) => {
    const txt = `Title: ${analysis.title}\nSubtitle: ${analysis.subtitle}\n\nCOMPREHENSIVE SUMMARY (${analysis.summaryWords}w):\n${analysis.summary}\n\nONE LINER:\n${analysis.oneLiner}\n\nKEY POINTS (${analysis.keyPoints.length}):\n${analysis.keyPoints
      .map((p, i) => `${i + 1}. ${p.sentence}`)
      .join('\n')}\n\nIMPORTANT FACTORS:\n${analysis.factors
      .map((f) => `- ${f.title}: ${f.evidence}`)
      .join('\n')}\n\nKeywords: ${analysis.topKeywords.map((k) => k.term).join(', ')}\nNumbers: ${analysis.numbers.join(
      ', '
    )}\nEntities: ${analysis.entities.join(', ')}`;
    navigator.clipboard.writeText(txt).then(() => {
      const btn = e.currentTarget;
      const old = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => {
        btn.textContent = old;
      }, 1200);
    });
  };

  const copyJSON = (e: React.MouseEvent<HTMLButtonElement>) => {
    const j = JSON.stringify({ ...analysis, theme: currentTheme, exportedAt: new Date().toISOString() }, null, 2);
    navigator.clipboard.writeText(j).then(() => {
      const btn = e.currentTarget;
      const old = btn.textContent;
      btn.textContent = 'Copied JSON!';
      setTimeout(() => {
        btn.textContent = old;
      }, 1200);
    });
  };

  const copySource = () => {
    navigator.clipboard.writeText(rawText);
    alert('Source text copied.');
  };

  const currentThemeObj = themes.find((t) => t.id === currentTheme) || themes[0];

  return (
    <section id="result" style={{ display: 'block' }}>
      <div
        className="result-grid"
        style={{
          gridTemplateColumns: isFocusMode ? '1fr' : '300px 1fr',
        }}
      >
        {/* Table of Contents sidebar */}
        <aside className="toc" style={{ display: isFocusMode ? 'none' : 'block' }}>
          <input
            className="toc-search"
            id="tocSearch"
            placeholder="🔍 Search this webpage…"
            value={pageSearchQuery}
            onChange={(e) => searchWebpage(e.target.value)}
          />
          <h4>On this page</h4>
          <a href="#s-summary" className={activeSection === 's-summary' ? 'active' : ''}>
            Comprehensive Summary
          </a>
          <a href="#s-points" className={activeSection === 's-points' ? 'active' : ''}>
            Key Points
          </a>
          <a href="#s-factors" className={activeSection === 's-factors' ? 'active' : ''}>
            Important Factors
          </a>
          <a href="#s-timeline" className={activeSection === 's-timeline' ? 'active' : ''}>
            Timeline
          </a>
          <a href="#s-glossary" className={activeSection === 's-glossary' ? 'active' : ''}>
            Glossary
          </a>
          <a href="#s-insights" className={activeSection === 's-insights' ? 'active' : ''}>
            Insights & Entities
          </a>
          <a href="#s-ask" className={activeSection === 's-ask' ? 'active' : ''}>
            Ask the document
          </a>
          <a href="#s-coverage" className={activeSection === 's-coverage' ? 'active' : ''}>
            Coverage Map
          </a>
          <a href="#s-stats" className={activeSection === 's-stats' ? 'active' : ''}>
            Stats
          </a>
          <a href="#s-source" className={activeSection === 's-source' ? 'active' : ''}>
            Source Text
          </a>

          <div style={{ marginTop: '10px', display: 'grid', gap: '8px' }}>
            <button className="btn small" onClick={onOpenTheme}>
              🎨 Change theme
            </button>
            <button className="btn small" onClick={toggleEdit}>
              ✏️ <span id="editLabel">{editMode ? 'Exit editing' : 'Enable editing'}</span>
            </button>
            <button className="btn small" onClick={onOpenCompare}>
              ⇔ Compare in library
            </button>
          </div>

          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--line)' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>Quick share</div>
            <div
              id="qrcode"
              ref={qrRef}
              style={{
                display: 'grid',
                placeItems: 'center',
                background: '#fff',
                border: '1px solid var(--line)',
                borderRadius: '12px',
                padding: '10px',
                minHeight: '120px',
              }}
            />
            <div style={{ display: 'grid', gap: '6px', marginTop: '8px' }}>
              <button className="btn dark" onClick={onOpenExport}>
                ⬇ Download HTML
              </button>
              <button className="btn" onClick={onOpenExport}>
                ⬇ Markdown
              </button>
              <button className="btn" onClick={copyBriefing}>
                🔗 Copy briefing
              </button>
              <button className="btn" onClick={copyJSON}>
                {'{}'} Copy JSON
              </button>
              <button className="btn" onClick={() => window.print()}>
                ⎙ Print
              </button>
            </div>
          </div>
        </aside>

        {/* Woven Webpage */}
        <article
          className={`webpage ${currentTheme !== 'default' ? `theme-${currentTheme}` : ''}`}
          id="webpage"
          ref={webpageRef}
          style={
            {
              '--theme-bg': currentThemeObj.bg,
              '--theme-ink': currentThemeObj.ink,
            } as React.CSSProperties
          }
        >
          {/* Reading progress bar */}
          <div className="progress-web">
            <i id="readProgress" style={{ width: `${readProgress}%` }} />
          </div>

          {/* Webpage reading & view controls */}
          <div className="webpage-controls">
            <div className="left">
              <button className="btn small" onClick={toggleEdit} title="Inline edit">
                ✏️ {editMode ? 'Done' : 'Edit'}
              </button>
              <button className="btn small" onClick={onOpenTheme} title="Themes">
                🎨 Theme
              </button>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700 }}>
                <span>Aa</span>
                <input
                  type="range"
                  id="fontSlider"
                  min="13"
                  max="19"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                />
                <span id="fontVal">{fontSize}px</span>
              </label>
            </div>

            <div className="right">
              <button
                className="btn small"
                onClick={() => setIsFocusMode(!isFocusMode)}
                id="focusBtn"
                title="Focus mode"
              >
                {isFocusMode ? '◐ Exit Focus' : '◎ Focus'}
              </button>
              <button className="btn small" onClick={onToggleThemeDark} title="Dark reading">
                🌙 Dark
              </button>
              <select
                id="widthSel"
                value={contentWidth}
                onChange={(e) => setContentWidth(Number(e.target.value))}
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: '999px',
                  padding: '6px 8px',
                  fontSize: '11px',
                  background: '#fff',
                }}
              >
                <option value={720}>Narrow</option>
                <option value={860}>Comfort</option>
                <option value={1020}>Wide</option>
              </select>
              <input
                id="pageSearch"
                placeholder="Find in page…"
                value={pageSearchQuery}
                onChange={(e) => searchWebpage(e.target.value)}
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: '999px',
                  padding: '6px 10px',
                  fontSize: '12px',
                  width: '140px',
                }}
              />
            </div>
          </div>

          {/* Webpage Hero */}
          <div className="webpage-hero">
            <div className="kicker" id="wKicker">
              Generated {analysis.isCompare ? 'compare' : 'webpage'} • {analysis.wc.toLocaleString()} words •{' '}
              {analysis.readingTime} min • {analysis.pages} pages • {analysis.summaryWords}w summary
            </div>
            <h1
              id="wTitle"
              ref={titleRef}
              contentEditable={editMode}
              suppressContentEditableWarning
              style={{ outline: editMode ? '1px dashed #fed7aa' : 'none' }}
            >
              {analysis.title}
            </h1>
            <p
              id="wSubtitle"
              ref={subtitleRef}
              contentEditable={editMode}
              suppressContentEditableWarning
              style={{ outline: editMode ? '1px dashed #fed7aa' : 'none' }}
            >
              {analysis.subtitle}
            </p>
            <div className="hero-stats" id="wHeroStats">
              <span className="hero-stat">◐ {analysis.wc.toLocaleString()} words</span>
              <span className="hero-stat">▣ {analysis.keyPoints.length} points</span>
              <span className="hero-stat">⬢ {analysis.factors.length} factors</span>
              <span className="hero-stat">{analysis.topKeywords[0]?.term || 'analysis'} • top</span>
              <span className="hero-stat">{analysis.summaryRatio}% distilled</span>
              {analysis.readability && (
                <span
                  className="hero-stat"
                  title={`Flesch-Kincaid Grade: ${analysis.readability.fleschKincaidGrade.toFixed(1)} (${analysis.readability.level})`}
                >
                  📖 {analysis.readability.level} (Grade {analysis.readability.fleschKincaidGrade.toFixed(1)})
                </span>
              )}
              {analysis.isCompare && <span className="hero-stat">⇔ Compare</span>}
            </div>
          </div>

          {/* Webpage Content Body */}
          <div
            className="webpage-body"
            id="wBody"
            style={{ maxWidth: `${contentWidth}px`, margin: '0 auto', fontSize: `${fontSize}px` }}
          >
            {/* 1. Summary */}
            <div className="section" id="s-summary">
              <h2>
                <span className="h-left">
                  <i style={{ background: 'var(--accent)' }}>◐</i> Comprehensive Summary
                </span>
                <span className="section-actions">
                  <button className="btn small" onClick={() => handleRegenerateSummary(-20)}>
                    − Shorter
                  </button>
                  <button className="btn small" onClick={() => handleRegenerateSummary(40)}>
                    + Longer
                  </button>
                </span>
                <small
                  id="summaryMeta"
                  style={{
                    fontFamily: 'Inter,sans-serif',
                    fontSize: '11px',
                    color: 'var(--muted)',
                    fontWeight: 600,
                    marginLeft: '6px',
                  }}
                >
                  • {analysis.summaryWords}w • {analysis.summaryRatio}% •{' '}
                  {analysis.coverage.filter(Boolean).length}/3 zones
                </small>
              </h2>
              <div
                className={`summary-box ${editMode ? 'editing' : ''}`}
                id="wSummary"
                ref={summaryRef}
                contentEditable={editMode}
                suppressContentEditableWarning
              >
                {analysis.summary}
              </div>
              {analysis.oneLiner && (
                <div className="quote" id="wOneLiner" style={{ marginTop: '10px', display: 'block' }}>
                  <b style={{ fontFamily: 'Fraunces,serif', color: '#7c2d12' }}>In one line:</b>{' '}
                  {analysis.oneLiner}
                </div>
              )}
            </div>

            {/* 2. Key Points */}
            <div className="section" id="s-points">
              <h2>
                <span className="h-left">
                  <i style={{ background: '#0f172a' }}>▣</i> Key Points
                </span>
                <span className="section-actions">
                  <button className="btn small" onClick={handleAddPoint}>
                    + Add
                  </button>
                  <button className="btn small" onClick={handleShufflePoints}>
                    ↻ Re-rank
                  </button>
                </span>
                <small
                  id="pointsMeta"
                  style={{
                    fontFamily: 'Inter,sans-serif',
                    fontSize: '11px',
                    color: 'var(--muted)',
                    fontWeight: 600,
                    marginLeft: '6px',
                  }}
                >
                  • {analysis.keyPoints.length} pts • {analysis.sections.length} secs
                </small>
              </h2>
              <ol className={`points ${editMode ? 'editing' : ''}`} id="wPoints">
                {analysis.keyPoints.map((p, i) => {
                  const secIdx = analysis.sections.findIndex((s) => p.idx >= s.startIdx);
                  const secName = analysis.sections[Math.max(0, secIdx)]?.title || '—';
                  return (
                    <li key={i} data-idx={p.idx} className={editMode ? 'editing' : ''}>
                      <b>{i + 1}</b>
                      <div style={{ flex: 1 }}>
                        <div
                          className="ptxt"
                          contentEditable={editMode}
                          suppressContentEditableWarning
                          style={{ fontSize: '13px', lineHeight: 1.6, color: '#334155' }}
                        >
                          {p.sentence}
                        </div>
                        <div className="meta">
                          <span>§ {secName}</span>
                          <span>
                            #{p.idx + 1} • {p.score.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <button className="del" onClick={() => handleRemovePoint(i)} title="Remove">
                        ✕
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* 3. Important Factors */}
            <div className="section" id="s-factors">
              <h2>
                <i style={{ background: '#0ea5e9' }}>⬢</i> Important Factors{' '}
                <small style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>
                  · click a chip to filter highlights
                </small>
              </h2>
              <div className="factors" id="wFactors">
                {analysis.factors.map((f, idx) => (
                  <div key={idx} className="factor">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '8px',
                          background: '#0f172a',
                          color: '#fff',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: '12px',
                        }}
                      >
                        {f.icon}
                      </span>
                      <h4>{f.title}</h4>
                    </div>
                    <p>{f.evidence || f.desc}</p>
                    <div className="chip-row">
                      {f.cues.map((c, cIdx) => (
                        <span key={cIdx} className="chip" onClick={() => searchWebpage(c)}>
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Timeline */}
            <div className="section" id="s-timeline">
              <h2>
                <i style={{ background: '#7c3aed' }}>◈</i> Timeline{' '}
                <small id="timelineMeta" style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>
                  {timelineItems.length > 0 ? `• ${analysis.dates.length} dates` : '• no dated timeline detected'}
                </small>
              </h2>
              <div className="timeline" id="wTimeline">
                {timelineItems.length > 0 ? (
                  timelineItems.map((it, idx) => (
                    <div key={idx} className="tl-item">
                      <b style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '12px' }}>{it.date}</b>
                      <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px', lineHeight: 1.5 }}>
                        {it.ctx}
                      </div>
                    </div>
                  ))
                ) : (
                  <div
                    style={{
                      border: '1px dashed var(--line)',
                      borderRadius: '12px',
                      padding: '12px',
                      background: '#f8fafc',
                      color: 'var(--muted)',
                      fontSize: '12px',
                    }}
                  >
                    No explicit timeline found — dates/years will appear here automatically when present (e.g., 2024,
                    Jan 15 2026). Try the long demo.
                  </div>
                )}
              </div>
            </div>

            {/* 5. Glossary */}
            <div className="section" id="s-glossary">
              <h2>
                <i style={{ background: '#059669' }}>⬡</i> Glossary{' '}
                <small style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>
                  · key terms in this doc
                </small>
              </h2>
              <div className="glossary" id="wGlossary">
                {glossaryTerms.map((t, idx) => {
                  const sents = splitSentencesOptimized(rawText);
                  const def =
                    sents.find((s) => s.toLowerCase().includes(t.toLowerCase()))?.slice(0, 140) ||
                    'Key term in this document.';
                  return (
                    <div key={idx} className="gloss">
                      <b>{t}</b>
                      <small>{def}</small>
                      <div style={{ marginTop: '6px' }}>
                        <span className="chip" onClick={() => searchWebpage(t)}>
                          # {t}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 6. Insights & Signals */}
            <div className="section" id="s-insights">
              <h2>
                <i style={{ background: '#d97706' }}>✦</i> Insights & Signals
              </h2>
              <div className="summary-box" id="wInsights" style={{ display: 'grid', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <div
                      style={{
                        fontSize: '11px',
                        letterSpacing: '.06em',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        color: 'var(--muted)',
                      }}
                    >
                      Top keywords (TF-IDF)
                    </div>
                    <div className="chip-row" style={{ marginTop: '8px' }}>
                      {analysis.topKeywords.slice(0, 8).map((k, idx) => (
                        <span key={idx} className="chip accent" onClick={() => searchWebpage(k.term)}>
                          {k.term} · {k.count}
                        </span>
                      ))}
                    </div>
                    {analysis.topBigrams.length > 0 && (
                      <div style={{ marginTop: '8px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)' }}>Phrases</div>
                        <div className="chip-row" style={{ marginTop: '6px' }}>
                          {analysis.topBigrams.map((b, idx) => (
                            <span key={idx} className="chip" onClick={() => searchWebpage(b)}>
                              {b}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: '11px',
                        letterSpacing: '.06em',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        color: 'var(--muted)',
                      }}
                    >
                      Numbers & dates
                    </div>
                    <div className="chip-row" style={{ marginTop: '8px' }}>
                      {[...analysis.numbers.slice(0, 7), ...analysis.dates.slice(0, 3)].map((n, idx) => (
                        <span key={idx} className="chip" onClick={() => searchWebpage(n)}>
                          {n}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      letterSpacing: '.06em',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                      color: 'var(--muted)',
                    }}
                  >
                    Entities
                  </div>
                  <div className="chip-row" style={{ marginTop: '8px' }}>
                    {analysis.entities.length > 0 ? (
                      analysis.entities.map((e, idx) => (
                        <span key={idx} className="chip" onClick={() => searchWebpage(e)}>
                          {e}
                        </span>
                      ))
                    ) : (
                      <span className="chip">—</span>
                    )}
                  </div>
                </div>

                {analysis.headings.length > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: '11px',
                        letterSpacing: '.06em',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        color: 'var(--muted)',
                      }}
                    >
                      Sections ({analysis.sections.length})
                    </div>
                    <div className="chip-row" style={{ marginTop: '8px' }}>
                      {analysis.headings.map((h, idx) => (
                        <span key={idx} className="chip">
                          {h}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 7. Ask the Document */}
            <div className="section" id="s-ask">
              <h2>
                <i style={{ background: '#0f172a' }}>⌕</i> Ask the document{' '}
                <small style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>
                  · local TF-IDF search, no API
                </small>
              </h2>
              <div className="ask-box">
                <input
                  id="askInput"
                  placeholder="e.g., What are the risks? Or: Show cost numbers"
                  value={askQuery}
                  onChange={(e) => setAskQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAsk();
                  }}
                />
                <button className="btn dark" onClick={handleAsk}>
                  Ask
                </button>
                <button className="btn" onClick={handleAskExample}>
                  Examples
                </button>
              </div>
              <div className="ask-results" id="askResults">
                {askHits === null ? (
                  <p style={{ color: 'var(--muted)', fontSize: '12px' }}>
                    Type a question — we rank sentences by semantic overlap and highlight matches. Try “What is the
                    recommendation?” or “cost”.
                  </p>
                ) : askHits.length === 0 ? (
                  <p style={{ color: 'var(--muted)', fontSize: '12px' }}>
                    No strong match — try keywords like “cost”, “risk”, “recommendation”, or a phrase from the doc.
                  </p>
                ) : (
                  askHits.map((h, idx) => (
                    <div key={idx} className="ask-hit">
                      <div style={{ fontSize: '12px', lineHeight: 1.6, color: '#334155' }}>{h.sentence}</div>
                      <div
                        style={{
                          fontFamily: 'JetBrains Mono,monospace',
                          fontSize: '10px',
                          color: 'var(--muted)',
                          marginTop: '4px',
                        }}
                      >
                        #{h.idx + 1} • score {h.score.toFixed(2)}{' '}
                        <button
                          className="pill"
                          style={{ padding: '2px 6px', fontSize: '10px', marginLeft: '6px' }}
                          onClick={() => searchWebpage(h.sentence.slice(0, 24))}
                        >
                          Show in doc
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 8. Coverage Map */}
            <div className="section" id="s-coverage">
              <h2>
                <i style={{ background: '#059669' }}>▦</i> Coverage Map
              </h2>
              <div id="wCoverage" style={{ display: 'grid', gap: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px' }}>
                  {analysis.coverage.map((ok, i) => (
                    <div
                      key={i}
                      style={{
                        border: `1px solid ${ok ? '#a7f3d0' : '#fecaca'}`,
                        background: ok ? '#ecfdf5' : '#fef2f2',
                        borderRadius: '12px',
                        padding: '10px',
                        textAlign: 'center',
                      }}
                    >
                      <b style={{ fontSize: '12px', color: ok ? '#065f46' : '#991b1b' }}>
                        {['Introduction', 'Body', 'Conclusion'][i]} {ok ? '✓' : '○'}
                      </b>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                        {ok ? 'covered' : 'not in summary'}
                      </div>
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: '#475569',
                    lineHeight: 1.6,
                    border: '1px solid var(--line)',
                    borderRadius: '12px',
                    padding: '10px',
                    background: '#f8fafc',
                  }}
                >
                  <b>How it works:</b> BM25 TF-IDF + TextRank (20 iter, cosine) + cue/numeric/title/position/section
                  boosts. Key points per-section balanced, summary adaptive ({analysis.summaryRatio}% distilled).
                </div>
              </div>
            </div>

            {/* 9. Stats & Provenance */}
            <div className="section" id="s-stats">
              <h2>
                <i style={{ background: '#d97706' }}>≡</i> Stats & Provenance
              </h2>
              <div className="stats-grid" id="wStats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
                <div className="stat">
                  <b>{analysis.wc.toLocaleString()}</b>
                  <span>Words</span>
                </div>
                <div className="stat">
                  <b>{analysis.sentences}</b>
                  <span>Sentences</span>
                </div>
                <div className="stat">
                  <b>{analysis.readingTime} min</b>
                  <span>Read time</span>
                </div>
                <div className="stat">
                  <b>{analysis.pages}</b>
                  <span>Pages</span>
                </div>
                {analysis.readability && (
                  <>
                    <div className="stat">
                      <b
                        style={{
                          color:
                            analysis.readability.fleschReadingEase >= 60
                              ? '#059669'
                              : analysis.readability.fleschReadingEase >= 40
                              ? '#d97706'
                              : '#7c3aed',
                        }}
                      >
                        {analysis.readability.fleschReadingEase}
                      </b>
                      <span>Reading Ease / 100</span>
                    </div>
                    <div className="stat">
                      <b>Grade {analysis.readability.fleschKincaidGrade.toFixed(1)}</b>
                      <span>Flesch-Kincaid</span>
                    </div>
                  </>
                )}
              </div>

              {analysis.readability && (
                <div
                  id="wReadability"
                  style={{
                    marginTop: '12px',
                    border: '1px solid var(--line)',
                    borderRadius: '14px',
                    padding: '14px 16px',
                    background: '#fff',
                    boxShadow: '0 2px 8px rgba(15,23,42,0.03)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '8px',
                      marginBottom: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          background: 'var(--ink)',
                          color: '#fff',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: '13px',
                        }}
                      >
                        📖
                      </span>
                      <div>
                        <b style={{ fontSize: '13px' }}>Document Readability & Complexity (Flesch-Kincaid)</b>
                        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                          Empirical formula based on average sentence length and syllable density
                        </div>
                      </div>
                    </div>
                    <span
                      style={{
                        background:
                          analysis.readability.fleschReadingEase >= 60
                            ? '#ecfdf5'
                            : analysis.readability.fleschReadingEase >= 40
                            ? '#fffbeb'
                            : '#f5f3ff',
                        color:
                          analysis.readability.fleschReadingEase >= 60
                            ? '#065f46'
                            : analysis.readability.fleschReadingEase >= 40
                            ? '#92400e'
                            : '#5b21b6',
                        border: `1px solid ${
                          analysis.readability.fleschReadingEase >= 60
                            ? '#a7f3d0'
                            : analysis.readability.fleschReadingEase >= 40
                            ? '#fde68a'
                            : '#ddd6fe'
                        }`,
                        borderRadius: '999px',
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: 700,
                        letterSpacing: '.03em',
                      }}
                    >
                      {analysis.readability.level} • Grade {analysis.readability.fleschKincaidGrade.toFixed(1)}
                    </span>
                  </div>

                  {/* Reading Ease Gauge / Bar */}
                  <div style={{ marginBottom: '12px' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '11px',
                        fontWeight: 600,
                        marginBottom: '4px',
                      }}
                    >
                      <span>
                        Reading Ease Score: <b>{analysis.readability.fleschReadingEase}/100</b> (
                        {analysis.readability.level})
                      </span>
                      <span style={{ color: 'var(--muted)' }}>Target: 60–80 (Plain English)</span>
                    </div>
                    <div
                      style={{
                        height: '8px',
                        background: '#f1f5f9',
                        borderRadius: '999px',
                        overflow: 'hidden',
                        position: 'relative',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${analysis.readability.fleschReadingEase}%`,
                          background:
                            analysis.readability.fleschReadingEase >= 60
                              ? 'linear-gradient(90deg, #10b981, #059669)'
                              : analysis.readability.fleschReadingEase >= 40
                              ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                              : 'linear-gradient(90deg, #8b5cf6, #6d28d9)',
                          borderRadius: '999px',
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '9px',
                        color: 'var(--muted)',
                        marginTop: '2px',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                    >
                      <span>0 (Academic / Very Dense)</span>
                      <span>50 (High School)</span>
                      <span>100 (Elementary / Very Easy)</span>
                    </div>
                  </div>

                  {/* Metric Breakdown Grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '8px',
                      marginTop: '10px',
                    }}
                  >
                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid var(--line)',
                        borderRadius: '10px',
                        padding: '10px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '10px',
                          textTransform: 'uppercase',
                          letterSpacing: '.06em',
                          color: 'var(--muted)',
                          fontWeight: 700,
                        }}
                      >
                        Target Audience
                      </div>
                      <b style={{ fontSize: '13px', display: 'block', marginTop: '2px', color: 'var(--ink)' }}>
                        {analysis.readability.audience}
                      </b>
                      <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                        {analysis.readability.description}
                      </div>
                    </div>

                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid var(--line)',
                        borderRadius: '10px',
                        padding: '10px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '10px',
                          textTransform: 'uppercase',
                          letterSpacing: '.06em',
                          color: 'var(--muted)',
                          fontWeight: 700,
                        }}
                      >
                        Avg Sentence Length
                      </div>
                      <b style={{ fontSize: '13px', display: 'block', marginTop: '2px', color: 'var(--ink)' }}>
                        {analysis.readability.avgWordsPerSentence} words / sentence
                      </b>
                      <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                        {analysis.readability.avgWordsPerSentence > 22
                          ? 'Longer sentences; consider breaking up for clarity'
                          : analysis.readability.avgWordsPerSentence < 12
                          ? 'Crisp, concise phrasing'
                          : 'Balanced sentence flow'}
                      </div>
                    </div>

                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid var(--line)',
                        borderRadius: '10px',
                        padding: '10px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '10px',
                          textTransform: 'uppercase',
                          letterSpacing: '.06em',
                          color: 'var(--muted)',
                          fontWeight: 700,
                        }}
                      >
                        Syllable Density
                      </div>
                      <b style={{ fontSize: '13px', display: 'block', marginTop: '2px', color: 'var(--ink)' }}>
                        {analysis.readability.avgSyllablesPerWord} syllables / word
                      </b>
                      <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                        {analysis.readability.avgSyllablesPerWord >= 1.7
                          ? 'High proportion of multisyllabic specialized terms'
                          : 'Predominantly everyday conversational words'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {analysis.isCompare && analysis.compareParts && (
                <div
                  id="wCompare"
                  style={{
                    display: 'block',
                    marginTop: '10px',
                    border: '1px solid var(--line)',
                    borderRadius: '12px',
                    padding: '12px',
                    background: '#f8fafc',
                  }}
                >
                  <b style={{ fontSize: '13px' }}>⇔ Compare — {analysis.compareParts.length} documents</b>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${analysis.compareParts.length},1fr)`,
                      gap: '10px',
                      marginTop: '8px',
                    }}
                  >
                    {analysis.compareParts.map((p, idx) => (
                      <div
                        key={idx}
                        style={{
                          border: '1px solid var(--line)',
                          borderRadius: '10px',
                          padding: '10px',
                          background: '#fff',
                        }}
                      >
                        <b style={{ fontSize: '12px' }}>{p.name}</b>
                        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{p.wc} words</div>
                        <p style={{ fontSize: '12px', lineHeight: 1.5, margin: '6px 0 0', color: '#334155' }}>
                          {p.summary}…
                        </p>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--muted)' }}>
                    Merged webpage above distills all docs together; side-by-side shows each doc’s own summary for quick
                    diff.
                  </div>
                </div>
              )}
            </div>

            {/* 10. Source Text */}
            <div className="section" id="s-source">
              <h2>
                <i style={{ background: '#64748b' }}>≋</i> Source Text{' '}
                <small
                  id="sourceHint"
                  style={{
                    fontFamily: 'Inter,sans-serif',
                    fontSize: '11px',
                    color: 'var(--muted)',
                    fontWeight: 600,
                    marginLeft: '6px',
                  }}
                >
                  • {rawText.length.toLocaleString()} chars • {analysis.sections.length} sections
                </small>
              </h2>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <button
                  className="btn small"
                  onClick={() => searchWebpage(analysis.topKeywords[0]?.term || '')}
                >
                  Highlight key terms
                </button>
                <button className="btn small" onClick={copySource}>
                  Copy source
                </button>
              </div>
              <details style={{ border: '1px solid var(--line)', borderRadius: '12px', padding: '12px', background: '#f8fafc' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}>
                  Show extracted text (first 9000 chars)
                </summary>
                <pre
                  id="wSource"
                  style={{
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'Inter,sans-serif',
                    fontSize: '12px',
                    lineHeight: 1.6,
                    color: '#334155',
                    maxHeight: '420px',
                    overflow: 'auto',
                    margin: '10px 0 0',
                  }}
                >
                  {rawText.slice(0, 9000)}
                  {rawText.length > 9000 ? '\n\n… truncated (full kept for export)' : ''}
                </pre>
              </details>
            </div>
          </div>

          {/* Bottom toolbar */}
          <div className="toolbar">
            <div className="left" style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '11px', color: 'var(--muted)' }}>
              v3 • Local • Library • Themes • Ask • Timeline • Exports • No data leaves device
            </div>
            <div className="right">
              <button className="btn" onClick={() => window.print()}>
                Print
              </button>
              <button className="btn dark" onClick={onOpenExport}>
                Download HTML
              </button>
              <button className="btn primary" onClick={onDuplicateWebpage}>
                Duplicate & Edit
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
};
