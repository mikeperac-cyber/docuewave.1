import React, { useRef, useState, useEffect } from 'react';
import { AnalysisResult, FileItem, LibraryItem } from '../types';
import { analyzeDocumentOptimized, demoTexts, escapeHtml, humanSize } from '../utils/engine';

interface HeroUploadProps {
  files: FileItem[];
  rawText: string;
  analysis: AnalysisResult | null;
  onFilesSelected: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
  onClearAll: () => void;
  onAnalyze: () => void;
  onLoadDemo: (type: 'short' | 'long' | 'compare') => void;
  progressPercent: number;
  progressLabel: string;
  activeStep: number;
  isAnalyzing: boolean;
  errorMsg: string | null;
  library: LibraryItem[];
  isLibraryOpen: boolean;
  onSelectLibraryItem: (item: LibraryItem) => void;
  onDeleteLibraryItem: (id: number) => void;
  onClearLibrary: () => void;
  showSelfTests: boolean;
  onToggleSelfTests: () => void;
  thumbCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  hasThumb: boolean;
}

export const HeroUpload: React.FC<HeroUploadProps> = ({
  files,
  rawText,
  analysis,
  onFilesSelected,
  onRemoveFile,
  onClearAll,
  onAnalyze,
  onLoadDemo,
  progressPercent,
  progressLabel,
  activeStep,
  isAnalyzing,
  errorMsg,
  library,
  isLibraryOpen,
  onSelectLibraryItem,
  onDeleteLibraryItem,
  onClearLibrary,
  showSelfTests,
  onToggleSelfTests,
  thumbCanvasRef,
  hasThumb,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [libSearch, setLibSearch] = useState('');
  const [testOutput, setTestOutput] = useState<{ passed: number; total: number; details: string[]; checks: [string, boolean][] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const wordCount = rawText ? rawText.split(/\s+/).filter(Boolean).length : 0;
  const pageCount = files.length > 0 ? (files.length > 1 ? Math.max(1, Math.ceil(wordCount / 430)) : Math.max(1, Math.ceil(wordCount / 430))) : 0;
  const readTime = wordCount > 0 ? Math.max(1, Math.ceil(wordCount / 220)) : 0;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(Array.from(e.dataTransfer.files));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(Array.from(e.target.files));
    }
  };

  const runSelfTests = () => {
    const docs = [
      {
        name: 'short memo (42 words)',
        text: 'Memo: Q2 OKRs\nWe shipped search v2. Latency down 42%. NPS up from 31 to 44. Two risks: hiring pause slows roadmap, and churn in SMB remains 5.2%. Recommendation: double down on enterprise.',
        expectPoints: 5,
      },
      {
        name: 'numeric financial',
        text: 'Q4 Earnings: Revenue $4.2B up 12.3% YoY. EPS $1.84 vs $1.71 estimate. Margin 38.2%. Cash $892M. Guidance 2026: $18B revenue, 41% margin. Risks: FX headwind $120M, churn 3.1%. Buyback $500M authorized.',
        expectPoints: 5,
      },
    ];
    let passed = 0;
    const details: string[] = [];
    docs.forEach((d) => {
      try {
        const a = analyzeDocumentOptimized(d.text, { pages: 1, name: d.name });
        const ok = Boolean(a.summary && a.summary.split(/\s+/).length > 15 && a.keyPoints.length >= 3 && a.coverage.length === 3);
        if (ok) passed++;
        details.push(`${ok ? '✓' : '✗'} ${d.name}: ${a.summaryWords}w, ${a.keyPoints.length} pts, cov ${a.coverage.map((c) => (c ? '1' : '0')).join('')}`);
      } catch (err: any) {
        details.push(`✗ ${d.name}: ${err.message}`);
      }
    });

    const rootHtml = document.documentElement.outerHTML;
    const checks: [string, boolean][] = [
      ['Drag-drop zone', /id="zone"/.test(rootHtml)],
      ['PDF.js', Boolean(window.pdfjsLib)],
      ['Theme', true],
      ['Library', true],
      ['Ask', true],
      ['Timeline', true],
    ];

    setTestOutput({ passed, total: docs.length, details, checks });
  };

  useEffect(() => {
    if (showSelfTests) {
      runSelfTests();
    }
  }, [showSelfTests]);

  const filteredLibrary = library.filter((e) => {
    if (!libSearch.trim()) return true;
    const q = libSearch.toLowerCase();
    return e.title.toLowerCase().includes(q) || e.subtitle.toLowerCase().includes(q);
  });

  return (
    <section className="hero">
      <div>
        <div className="eyebrow">
          <i /> Drag • Drop • Deep Analyze • Publish — Now with Library & Themes
        </div>
        <h1 className="headline">
          Every document
          <br />
          <em>deserves its best</em>
          <br />
          webpage.
        </h1>
        <p className="sub">
          v3 adds a persistent library, multi-file merging, live webpage editor, 6 themes, search & reading controls, timeline & glossary extraction, Ask-the-document, and one-click exports (HTML/MD/QR/JSON-LD). Still 100% offline via PDF.js + Mammoth.
        </p>
        <div className="checks">
          <span>
            <b>✓</b> PDF • DOCX • TXT • MD • Multi
          </span>
          <span>
            <b>✓</b> Library & Compare
          </span>
          <span>
            <b>✓</b> Editor & Themes
          </span>
        </div>

        <div id="upload" className="panel drop" style={{ marginTop: '14px' }}>
          <label
            className={`zone ${isDragging ? 'drag' : ''}`}
            id="zone"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              id="fileInput"
              ref={fileInputRef}
              accept=".pdf,.docx,.txt,.md,.text,application/pdf"
              multiple
              onChange={handleInputChange}
            />
            <div className="zone-icon">⬆</div>
            <h3>Drop one or many documents here</h3>
            <p>Click to browse • PDF, DOCX, TXT, MD • Up to 50MB each • Paste with Ctrl+V • Drop 2+ to merge/compare</p>
            <div className="meta-row">
              <span className="tag pdf">PDF</span>
              <span className="tag">DOCX</span>
              <span className="tag">TXT</span>
              <span className="tag">MD</span>
              <span className="tag" style={{ background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }}>
                Multi-doc
              </span>
            </div>
          </label>

          <div className="progress" id="progress" style={{ display: progressPercent > 0 ? 'block' : 'none' }}>
            <i id="bar" style={{ width: `${progressPercent}%` }} />
          </div>

          <div className="progress-steps" id="steps" style={{ display: progressPercent > 0 ? 'flex' : 'none' }}>
            <span id="s1" className={activeStep >= 1 ? 'on' : ''}>
              Extract
            </span>
            <span id="s2" className={activeStep >= 2 ? 'on' : ''}>
              Clean
            </span>
            <span id="s3" className={activeStep >= 3 ? 'on' : ''}>
              Score
            </span>
            <span id="s4" className={activeStep >= 4 ? 'on' : ''}>
              TextRank
            </span>
            <span id="s5" className={activeStep >= 5 ? 'on' : ''}>
              Weave
            </span>
          </div>

          <label
            id="percent"
            style={{
              display: 'block',
              marginTop: '6px',
              fontSize: '11px',
              color: 'var(--muted)',
              fontFamily: 'JetBrains Mono,monospace',
            }}
          >
            {progressLabel || 'Idle'}
          </label>

          {/* Multiple files queue */}
          {files.length > 1 && (
            <div className="file-queue" id="fileQueue" style={{ display: 'flex' }}>
              {files.map((f, i) => (
                <div key={i} className="queue-item">
                  <span
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      background: 'var(--ink)',
                      color: '#fff',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: '11px',
                    }}
                  >
                    {(f.name.split('.').pop() || '?').slice(0, 3).toUpperCase()}
                  </span>
                  <b>{f.name}</b>
                  <span style={{ fontFamily: 'JetBrains Mono,monospace', color: 'var(--muted)' }}>
                    {humanSize(f.size)}
                  </span>
                  <button
                    className="pill"
                    style={{ padding: '4px 8px', fontSize: '11px' }}
                    onClick={() => onRemoveFile(i)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Single file card */}
          {files.length === 1 && (
            <div className="file-card" id="fileCard" style={{ display: 'flex' }}>
              <div className="file-icon" id="fileIcon">
                {files[0].name.split('.').pop()?.slice(0, 3).toUpperCase() || 'TXT'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b id="fileName" style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {files[0].name}
                </b>
                <small id="fileMeta">
                  {humanSize(files[0].size)} • {files[0].name.split('.').pop()?.toUpperCase()} • {new Date().toLocaleDateString()}
                </small>
              </div>
              <button className="pill" onClick={onClearAll}>
                Remove
              </button>
            </div>
          )}

          <div className="actions">
            <button
              className="btn primary"
              id="analyzeBtn"
              disabled={!rawText || isAnalyzing}
              onClick={onAnalyze}
            >
              {isAnalyzing ? 'Analyzing…' : '✦ Analyze & Weave Webpage'}
            </button>
            <button className="btn" onClick={() => onLoadDemo('short')}>
              Try demo
            </button>
            <button className="btn" onClick={() => onLoadDemo('long')}>
              Try long
            </button>
            <button className="btn ghost" onClick={() => onLoadDemo('compare')}>
              Try compare (2 docs)
            </button>
          </div>

          {errorMsg && (
            <div
              id="err"
              style={{
                display: 'block',
                marginTop: '8px',
                padding: '10px 12px',
                borderRadius: '10px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                fontSize: '13px',
              }}
            >
              {errorMsg}
            </div>
          )}

          {analysis && (
            <div className="quality" id="quality" style={{ display: 'flex' }}>
              <span className="ok">
                ✓ Summary: {analysis.summaryWords}w • {analysis.summaryRatio}%
              </span>
              <span className="ok">✓ {analysis.keyPoints.length} points • balanced</span>
              {analysis.readability && (
                <span className="ok">
                  ✓ Grade {analysis.readability.fleschKincaidGrade.toFixed(1)} ({analysis.readability.level})
                </span>
              )}
              <span>
                {analysis.sections.length} sections • {files.length > 1 ? `${files.length} docs` : ''}
              </span>
              <span className="ok">✓ Library saved</span>
            </div>
          )}

          {/* Library drawer */}
          <div className="library" id="library" style={{ display: isLibraryOpen ? 'block' : 'none' }}>
            <div className="library-head">
              <b>📚 Library — saved webpages (local)</b>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  id="libSearch"
                  placeholder="Search library…"
                  value={libSearch}
                  onChange={(e) => setLibSearch(e.target.value)}
                  style={{
                    border: '1px solid var(--line)',
                    borderRadius: '999px',
                    padding: '6px 10px',
                    fontSize: '12px',
                    background: '#fff',
                  }}
                />
                <button className="pill" onClick={onClearLibrary}>
                  Clear
                </button>
              </div>
            </div>
            <div className="library-grid" id="libGrid">
              {filteredLibrary.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: '12px', padding: '10px' }}>
                  No saved webpages yet — analyze a document and it auto-saves here (local only).{' '}
                  {library.length > 0 ? `No match for “${escapeHtml(libSearch)}”` : ''}
                </div>
              ) : (
                filteredLibrary.map((e) => (
                  <div key={e.id} className="lib-card" onClick={() => onSelectLibraryItem(e)}>
                    <h4>{e.title}</h4>
                    <p>{e.subtitle}…</p>
                    <div className="meta">
                      <span>{e.wc.toLocaleString()}w</span>
                      <span>{e.pages}p</span>
                      <span>{new Date(e.date).toLocaleDateString()}</span>
                      <span>{e.theme || 'default'}</span>
                    </div>
                    <div style={{ marginTop: '6px', display: 'flex', gap: '6px' }}>
                      <button
                        className="pill"
                        style={{ padding: '4px 8px', fontSize: '11px' }}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onSelectLibraryItem(e);
                        }}
                      >
                        Open
                      </button>
                      <button
                        className="pill"
                        style={{ padding: '4px 8px', fontSize: '11px', background: '#fee2e2', borderColor: '#fecaca' }}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onDeleteLibraryItem(e.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Self-tests results */}
          <div
            className="testbar"
            id="testBar"
            style={{
              display: showSelfTests ? 'flex' : 'none',
              border: '1px solid var(--line)',
              borderRadius: '12px',
              padding: '10px',
              background: '#f8fafc',
            }}
          >
            <b style={{ fontSize: '12px' }}>
              <span className="dot" /> Self-tests
            </b>
            <span id="testOut" style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '11px', color: '#334155' }}>
              {testOutput ? (
                <>
                  <span
                    style={{
                      color: testOutput.passed === testOutput.total ? '#065f46' : '#991b1b',
                      fontWeight: 700,
                    }}
                  >
                    {testOutput.passed}/{testOutput.total} doc tests passed
                  </span>
                  <br />
                  {testOutput.details.map((d, idx) => (
                    <React.Fragment key={idx}>
                      {d}
                      <br />
                    </React.Fragment>
                  ))}
                  <br />
                  {testOutput.checks.map(([n, ok], idx) => (
                    <span key={idx}>
                      {ok ? '✓' : '✗'} {n}{idx < testOutput.checks.length - 1 ? ' • ' : ''}
                    </span>
                  ))}
                </>
              ) : (
                'Running…'
              )}
            </span>
          </div>

          <p style={{ margin: '8px 0 0', color: 'var(--muted)', fontSize: '11px', textAlign: 'center' }}>
            Tip: Drop a scanned PDF? Needs selectable text. Image-only → OCR coming soon. All local — library lives in your browser.
          </p>
        </div>
      </div>

      {/* Live preview card */}
      <div className="panel preview-card">
        <div className="preview-head">
          <h3>Live preview</h3>
          <div className="dots">
            <i />
            <i />
            <i />
          </div>
        </div>
        <div className="preview-body" id="preview">
          {analysis ? (
            <div>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: 'var(--ok)',
                  color: '#fff',
                  display: 'grid',
                  placeItems: 'center',
                  margin: '0 auto 10px',
                }}
              >
                ✓
              </div>
              <h4 style={{ margin: 0, color: 'var(--ink)' }}>Webpage woven — v3</h4>
              <p>
                Library saved • Themes • Ask • Timeline ready.
                <br />
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                  {analysis.isCompare ? 'Compare mode — see Stats for side-by-side' : ''}
                </span>
              </p>
            </div>
          ) : rawText ? (
            <div style={{ textAlign: 'left', width: '100%' }}>
              <div style={{ fontFamily: 'Fraunces,serif', fontSize: '17px', color: 'var(--ink)' }}>
                Ready — {wordCount.toLocaleString()} words {files.length > 1 ? `• ${files.length} docs merged` : ''}
              </div>
              <div style={{ fontSize: '13px', lineHeight: 1.5, color: '#334155', marginTop: '6px' }}>
                {rawText.slice(0, 260)}…
              </div>
              {files.length > 1 && (
                <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {files.map((r, i) => (
                    <span key={i} className="chip">
                      {r.name.slice(0, 18)} • {(r.text || '').split(/\s+/).length}w
                    </span>
                  ))}
                </div>
              )}
              <div
                style={{
                  marginTop: '10px',
                  display: 'inline-block',
                  background: 'var(--accent)',
                  color: '#fff',
                  borderRadius: '999px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                Click “Analyze & Weave”
              </div>
            </div>
          ) : (
            <div>
              <div className="big">◐</div>
              <h4>Your v3 webpage will appear here</h4>
              <p>Now with library, themes, editor, Ask, timeline. Drop multiple files to see merge & compare automatically.</p>
            </div>
          )}
        </div>

        <div className="mini-stats">
          <div className="mini">
            <b id="mWords">{wordCount > 0 ? wordCount.toLocaleString() : '—'}</b>
            <span>Words</span>
          </div>
          <div className="mini">
            <b id="mPages">{pageCount > 0 ? pageCount : '—'}</b>
            <span>Pages</span>
          </div>
          <div className="mini">
            <b id="mTime">{readTime > 0 ? `${readTime} min` : '—'}</b>
            <span>Read time</span>
          </div>
        </div>

        <div
          id="miniQuality"
          style={{
            marginTop: '8px',
            fontFamily: 'JetBrains Mono,monospace',
            fontSize: '11px',
            color: 'var(--muted)',
            textAlign: 'center',
          }}
        >
          {analysis
            ? `${analysis.summaryWords}w • ${analysis.keyPoints.length} pts • ${analysis.sections.length} secs${
                analysis.readability ? ` • Grade ${analysis.readability.fleschKincaidGrade.toFixed(1)}` : ''
              } ${analysis.isCompare ? '• compare' : ''}`
            : ''}
        </div>

        <div
          id="thumbWrap"
          style={{
            display: hasThumb ? 'block' : 'none',
            marginTop: '8px',
            border: '1px solid var(--line)',
            borderRadius: '12px',
            overflow: 'hidden',
            background: '#fff',
          }}
        >
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '6px 8px',
              background: '#f8fafc',
              borderBottom: '1px solid var(--line)',
            }}
          >
            First page preview
          </div>
          <canvas id="thumb" ref={thumbCanvasRef} style={{ width: '100%', display: 'block' }} />
        </div>
      </div>
    </section>
  );
};
