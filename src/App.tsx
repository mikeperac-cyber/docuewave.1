import React, { useState, useEffect, useRef } from 'react';
import { AnalysisResult, FileItem, LibraryItem } from './types';
import {
  analyzeDocumentOptimized,
  cleanTextAdvanced,
  demoTexts,
  extractDocx,
  extractPdf,
} from './utils/engine';
import { Topbar } from './components/Topbar';
import { HeroUpload } from './components/HeroUpload';
import { WebpageView } from './components/WebpageView';
import { ThemeModal } from './components/ThemeModal';
import { ExportModal } from './components/ExportModal';

export const App: React.FC = () => {
  const [rawText, setRawText] = useState('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem('dw_theme') || 'default');
  const [accentColor, setAccentColor] = useState('#ff4d2e');
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressLabel, setProgressLabel] = useState('Idle');
  const [activeStep, setActiveStep] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [library, setLibrary] = useState<LibraryItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('dw_lib') || '[]');
    } catch {
      return [];
    }
  });
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [showSelfTests, setShowSelfTests] = useState(false);
  const [hasThumb, setHasThumb] = useState(false);

  const thumbCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sync theme changes to body/css
  useEffect(() => {
    localStorage.setItem('dw_theme', currentTheme);
  }, [currentTheme]);

  // Sync accent color to css variables
  const handleAccentChange = (val: string) => {
    setAccentColor(val);
    document.documentElement.style.setProperty('--accent', val);
  };

  // Keyboard shortcuts (Escape, Ctrl+S, etc.)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsThemeModalOpen(false);
        setIsExportModalOpen(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        if (analysis) {
          e.preventDefault();
          setIsExportModalOpen(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [analysis]);

  // Clipboard paste support (paste raw text or markdown)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const txt = e.clipboardData?.getData('text');
      if (txt && txt.trim().length > 30 && !rawText && files.length === 0) {
        const cleaned = cleanTextAdvanced(txt);
        setRawText(cleaned);
        setFiles([{ name: 'Pasted-text.txt', size: txt.length, type: 'txt', text: cleaned }]);
        setProgressPercent(88);
        setProgressLabel(`Pasted text • ${cleaned.split(/\s+/).filter(Boolean).length} words • Click Analyze`);
        setActiveStep(2);
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [rawText, files]);

  // Handle files selection / drag-and-drop
  const handleFilesSelected = async (newFiles: File[]) => {
    setErrorMsg(null);
    const valid = newFiles.filter((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      const ok = ['pdf', 'txt', 'md', 'text', 'docx'].includes(ext) || f.type.includes('pdf') || f.type.includes('text');
      if (!ok) setErrorMsg(`Skipped unsupported: ${f.name}`);
      if (f.size > 50 * 1024 * 1024) setErrorMsg(`Skipped too large (>50MB): ${f.name}`);
      return ok && f.size <= 50 * 1024 * 1024;
    });

    if (!valid.length) return;

    setProgressPercent(6);
    setProgressLabel(`Reading ${valid.length} file(s)…`);
    setActiveStep(1);

    const loadedDocs: { name: string; text: string; size: number; type: string }[] = [];
    let thumbDone = false;

    for (let i = 0; i < valid.length; i++) {
      const f = valid[i];
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      try {
        let text = '';
        if (ext === 'pdf' || f.type === 'application/pdf') {
          const res = await extractPdf(
            f,
            (p) => {
              setProgressPercent(6 + Math.round((i / valid.length) * 50 + (p / valid.length) * 0.3));
              setProgressLabel(`Extracting ${i + 1}/${valid.length} • ${p}%`);
            },
            !thumbDone ? thumbCanvasRef.current : null
          );
          text = res.text;
          if (!thumbDone) {
            thumbDone = true;
            setHasThumb(true);
          }
        } else if (ext === 'docx') {
          text = await extractDocx(f);
        } else {
          text = await f.text();
        }
        loadedDocs.push({ name: f.name, text, size: f.size, type: ext });
      } catch (err: any) {
        console.error(err);
        setErrorMsg(`Failed ${f.name}: ${err.message}`);
      }
    }

    if (!loadedDocs.length) {
      setErrorMsg('No readable text extracted.');
      return;
    }

    let mergedText = '';
    if (loadedDocs.length === 1) {
      mergedText = cleanTextAdvanced(loadedDocs[0].text);
    } else {
      mergedText = cleanTextAdvanced(
        loadedDocs.map((r) => `===== DOCUMENT: ${r.name} =====\n${r.text}`).join('\n\n')
      );
    }

    setFiles(loadedDocs);
    setRawText(mergedText);
    const wc = mergedText.split(/\s+/).filter(Boolean).length;
    setProgressPercent(88);
    setProgressLabel(`Loaded ${loadedDocs.length} file(s) • ${wc.toLocaleString()} words • Ready`);
    setActiveStep(2);
  };

  const handleRemoveFile = (index: number) => {
    const updated = [...files];
    updated.splice(index, 1);
    setFiles(updated);
    if (!updated.length) {
      handleClearAll();
    } else {
      const mergedText = cleanTextAdvanced(
        updated.map((r) => `===== DOCUMENT: ${r.name} =====\n${r.text}`).join('\n\n')
      );
      setRawText(mergedText);
    }
  };

  const handleClearAll = () => {
    setRawText('');
    setFiles([]);
    setAnalysis(null);
    setProgressPercent(0);
    setProgressLabel('Idle');
    setActiveStep(0);
    setErrorMsg(null);
    setHasThumb(false);
  };

  // Run document analysis
  const handleAnalyze = () => {
    if (!rawText.trim()) {
      setErrorMsg('No text to analyze.');
      return;
    }

    setIsAnalyzing(true);
    setProgressPercent(15);
    setProgressLabel('Scoring (TF-IDF + cues)…');
    setActiveStep(3);

    setTimeout(() => {
      try {
        const fileInfo = {
          name: files.length === 1 ? files[0].name : `${files.length} docs`,
          count: files.length,
          pages: Math.max(1, Math.ceil(rawText.split(/\s+/).filter(Boolean).length / 430)),
        };

        const res = analyzeDocumentOptimized(rawText, fileInfo, (stage, p) => {
          if (stage === 'textrank') {
            setProgressPercent(45 + p * 0.3);
            setProgressLabel('TextRank…');
            setActiveStep(4);
          }
          if (stage === 'summary') {
            setProgressPercent(80);
            setProgressLabel('Adaptive summary…');
            setActiveStep(5);
          }
        });

        if (files.length > 1) {
          res.isCompare = true;
          res.compareParts = files.map((r) => ({
            name: r.name,
            wc: (r.text || '').split(/\s+/).filter(Boolean).length,
            summary: analyzeDocumentOptimized(r.text || '', { pages: 1, name: r.name }).summary.slice(0, 220),
          }));
        }

        setAnalysis(res);
        saveToLibrary(res, rawText);
        setProgressPercent(100);
        setProgressLabel('Done — v3');
        setActiveStep(5);

        // Smooth scroll to results
        setTimeout(() => {
          document.getElementById('result')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
      } catch (err: any) {
        console.error(err);
        setErrorMsg('Analysis failed: ' + err.message);
        setProgressPercent(0);
        setProgressLabel('Failed');
      } finally {
        setIsAnalyzing(false);
      }
    }, 100);
  };

  // Library persistence
  const saveToLibrary = (a: AnalysisResult, text: string) => {
    try {
      const existing: LibraryItem[] = JSON.parse(localStorage.getItem('dw_lib') || '[]');
      const entry: LibraryItem = {
        id: Date.now(),
        title: a.title,
        subtitle: a.subtitle.slice(0, 120),
        wc: a.wc,
        pages: a.pages,
        summary: a.summary.slice(0, 220),
        theme: currentTheme,
        date: new Date().toISOString(),
        raw: text.slice(0, 30000),
        analysis: JSON.stringify(a).slice(0, 80000),
      };
      existing.unshift(entry);
      if (existing.length > 20) existing.pop();
      localStorage.setItem('dw_lib', JSON.stringify(existing));
      setLibrary(existing);
    } catch (e) {
      console.warn('Failed to save to library', e);
    }
  };

  const handleSelectLibraryItem = (item: LibraryItem) => {
    setRawText(item.raw);
    setFiles([{ name: item.title, size: item.raw.length, type: 'txt', text: item.raw }]);
    try {
      const parsedAnalysis: AnalysisResult = JSON.parse(item.analysis);
      setAnalysis(parsedAnalysis);
      if (item.theme) setCurrentTheme(item.theme);
      setTimeout(() => {
        document.getElementById('result')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch {
      // Re-run analysis if cache wasn't parsed
      setTimeout(() => handleAnalyze(), 50);
    }
  };

  const handleDeleteLibraryItem = (id: number) => {
    const updated = library.filter((x) => x.id !== id);
    setLibrary(updated);
    localStorage.setItem('dw_lib', JSON.stringify(updated));
  };

  const handleClearLibrary = () => {
    if (window.confirm('Clear all saved webpages?')) {
      localStorage.removeItem('dw_lib');
      setLibrary([]);
    }
  };

  const handleOpenCompare = () => {
    if (library.length < 2) {
      alert('Save at least 2 webpages to compare — analyze two different docs first. They auto-save to Library.');
      setIsLibraryOpen(true);
      return;
    }
    const last2 = library.slice(0, 2);
    alert(
      `Compare ready:\n• ${last2[0].title} (${last2[0].wc}w)\n• ${last2[1].title} (${last2[1].wc}w)\n\nOpen both from Library or drop them together (multi-doc) to get a merged compare webpage.`
    );
    setIsLibraryOpen(true);
  };

  // Duplicate current webpage and open in edit mode
  const handleDuplicateWebpage = () => {
    if (!analysis) return;
    const clone = JSON.parse(JSON.stringify(analysis)) as AnalysisResult;
    clone.title = clone.title + ' — Copy';
    const newRaw = clone.summary + '\n\n' + clone.keyPoints.map((k) => k.sentence).join('\n');
    setRawText(newRaw);
    setAnalysis(clone);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Demo loaders
  const handleLoadDemo = (type: 'short' | 'long' | 'compare') => {
    if (type === 'short') {
      const text = demoTexts.short;
      const fileName = 'Urban-Mobility-Report-2035.txt';
      setRawText(text);
      setFiles([{ name: fileName, size: text.length, type: 'txt', text }]);
      setProgressPercent(100);
      setProgressLabel(`Demo loaded • ${text.split(/\s+/).filter(Boolean).length} words`);
      setTimeout(() => {
        const res = analyzeDocumentOptimized(text, { pages: 1, name: fileName });
        setAnalysis(res);
        saveToLibrary(res, text);
        setTimeout(() => document.getElementById('result')?.scrollIntoView({ behavior: 'smooth' }), 100);
      }, 100);
    } else if (type === 'long') {
      const text = demoTexts.long;
      const fileName = 'AI-Healthcare-Review-2030-Long.txt';
      setRawText(text);
      setFiles([{ name: fileName, size: text.length, type: 'txt', text }]);
      setProgressPercent(100);
      setProgressLabel(`Long demo loaded • ${text.split(/\s+/).filter(Boolean).length} words`);
      setTimeout(() => {
        const res = analyzeDocumentOptimized(text, { pages: 4, name: fileName });
        setAnalysis(res);
        saveToLibrary(res, text);
        setTimeout(() => document.getElementById('result')?.scrollIntoView({ behavior: 'smooth' }), 100);
      }, 100);
    } else if (type === 'compare') {
      const a = demoTexts.compareA;
      const b = demoTexts.compareB;
      const queue = [
        { name: 'Acme-Q3.txt', size: a.length, type: 'txt', text: a },
        { name: 'Beta-Q3.txt', size: b.length, type: 'txt', text: b },
      ];
      setFiles(queue);
      const merged = `===== DOCUMENT: Acme-Q3.txt =====\n${a}\n\n===== DOCUMENT: Beta-Q3.txt =====\n${b}`;
      setRawText(merged);
      setProgressPercent(100);
      setProgressLabel('Compare 2 docs loaded • Analyzing…');
      setTimeout(() => {
        const res = analyzeDocumentOptimized(merged, { count: 2, pages: 2, name: 'Compare: Acme vs Beta' });
        res.isCompare = true;
        res.compareParts = [
          { name: 'Acme-Q3.txt', wc: a.split(/\s+/).length, summary: analyzeDocumentOptimized(a).summary.slice(0, 220) },
          { name: 'Beta-Q3.txt', wc: b.split(/\s+/).length, summary: analyzeDocumentOptimized(b).summary.slice(0, 220) },
        ];
        setAnalysis(res);
        saveToLibrary(res, merged);
        setTimeout(() => document.getElementById('result')?.scrollIntoView({ behavior: 'smooth' }), 100);
      }, 200);
    }
  };

  return (
    <>
      <Topbar
        libraryCount={library.length}
        onToggleLibrary={() => setIsLibraryOpen(!isLibraryOpen)}
        onOpenTheme={() => setIsThemeModalOpen(true)}
        onRunTests={() => setShowSelfTests(!showSelfTests)}
        onOpenExport={() => setIsExportModalOpen(true)}
        hasAnalysis={Boolean(analysis)}
      />

      <main className="shell">
        <HeroUpload
          files={files}
          rawText={rawText}
          analysis={analysis}
          onFilesSelected={handleFilesSelected}
          onRemoveFile={handleRemoveFile}
          onClearAll={handleClearAll}
          onAnalyze={handleAnalyze}
          onLoadDemo={handleLoadDemo}
          progressPercent={progressPercent}
          progressLabel={progressLabel}
          activeStep={activeStep}
          isAnalyzing={isAnalyzing}
          errorMsg={errorMsg}
          library={library}
          isLibraryOpen={isLibraryOpen}
          onSelectLibraryItem={handleSelectLibraryItem}
          onDeleteLibraryItem={handleDeleteLibraryItem}
          onClearLibrary={handleClearLibrary}
          showSelfTests={showSelfTests}
          onToggleSelfTests={() => setShowSelfTests(!showSelfTests)}
          thumbCanvasRef={thumbCanvasRef}
          hasThumb={hasThumb}
        />

        {analysis && (
          <WebpageView
            analysis={analysis}
            rawText={rawText}
            currentTheme={currentTheme}
            onOpenTheme={() => setIsThemeModalOpen(true)}
            onOpenExport={() => setIsExportModalOpen(true)}
            onUpdateAnalysis={(updated) => setAnalysis(updated)}
            onOpenCompare={handleOpenCompare}
            onDuplicateWebpage={handleDuplicateWebpage}
            onToggleThemeDark={() => setCurrentTheme(currentTheme === 'dark' ? 'default' : 'dark')}
          />
        )}

        <footer
          style={{
            padding: '16px 0 30px',
            color: 'var(--muted)',
            fontSize: '11px',
            textAlign: 'center',
            borderTop: '1px solid var(--line)',
            marginTop: '16px',
          }}
        >
          v3 Feature Edition — Library, multi-doc, themes, editor, search, timeline, glossary, Ask, QR share, Markdown — all offline. TextRank+TFIDF+section coverage.
          <br />© 2026 DocuWeave • PDF.js • Mammoth • QRCode.js
        </footer>
      </main>

      <ThemeModal
        isOpen={isThemeModalOpen}
        onClose={() => setIsThemeModalOpen(false)}
        currentTheme={currentTheme}
        onSelectTheme={(id) => setCurrentTheme(id)}
        accentColor={accentColor}
        onAccentChange={handleAccentChange}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        analysis={analysis}
        rawText={rawText}
        currentTheme={currentTheme}
      />
    </>
  );
};
