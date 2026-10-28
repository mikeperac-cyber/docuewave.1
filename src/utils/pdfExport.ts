import jsPDF from 'jspdf';
import { AnalysisResult } from '../types';

export interface PDFExportOptions {
  includeSource?: boolean;
  rawText?: string;
}

/**
 * Sanitizes strings for standard PDF Helvetica/Courier fonts (avoiding unsupported unicode glyphs).
 */
function cleanForPDF(str: string, keepNewlines = false): string {
  if (!str) return '';
  let res = str
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2026]/g, '...')
    .replace(/[•·]/g, '-')
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B00}-\u{2BFF}\u{25A0}-\u{25FF}\u{2190}-\u{21FF}]/gu, '')
    .replace(/[^\x00-\x7F\xA0-\xFF\r\n]/g, ' ');
  if (!keepNewlines) {
    res = res.replace(/[ \t]+/g, ' ');
  }
  return res.trim();
}

export function exportStructuredPDF(analysis: AnalysisResult, options: PDFExportOptions = {}): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const maxY = pageHeight - margin - 12;

  let y = margin;

  // Helper: check if we need to advance to a new page
  const checkPageBreak = (neededHeight: number): void => {
    if (y + neededHeight > maxY) {
      doc.addPage();
      y = margin + 8;
    }
  };

  // --- BRAND HEADER ---
  doc.setFillColor(15, 23, 42); // #0f172a
  doc.roundedRect(margin, y, 7, 7, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('D/', margin + 1.8, y + 4.8);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('DocuWeave Analysis Report', margin + 10, y + 4.5);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  const dateStr = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  doc.text(dateStr, pageWidth - margin, y + 4.5, { align: 'right' });

  y += 12;

  // --- TITLE & SUBTITLE ---
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  const safeTitle = cleanForPDF(analysis.title);
  const titleLines = doc.splitTextToSize(safeTitle, contentWidth);
  checkPageBreak(titleLines.length * 7 + 10);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 6.5 + 2;

  if (analysis.subtitle) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    const safeSub = cleanForPDF(analysis.subtitle);
    const subLines = doc.splitTextToSize(safeSub, contentWidth);
    checkPageBreak(subLines.length * 4.5 + 4);
    doc.text(subLines, margin, y);
    y += subLines.length * 4.5 + 4;
  }

  // --- METADATA STRIP ---
  checkPageBreak(12);
  doc.setFillColor(248, 250, 252); // #f8fafc
  doc.setDrawColor(226, 232, 240); // #e2e8f0
  doc.roundedRect(margin, y, contentWidth, 9, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);

  const readabilityGrade = analysis.readability
    ? `Grade ${analysis.readability.fleschKincaidGrade.toFixed(1)} (${cleanForPDF(analysis.readability.level)})`
    : 'Standard';

  const estAnalysisRead = analysis.analysisReadingTime ?? Math.max(1, Math.round(((analysis.summaryWords || 200) / 200) * 10) / 10);
  const metaText = `Doc Words: ${analysis.wc.toLocaleString()}  |  Doc Read: ~${analysis.readingTime}m  |  Analysis Read: ~${estAnalysisRead}m (200 WPM)  |  Distilled: ${analysis.summaryRatio}%  |  Readability: ${readabilityGrade}`;
  doc.text(metaText, margin + 4, y + 5.8);
  y += 14;

  // Helper for Section Headings
  const addSectionHeading = (title: string, iconNumber: string) => {
    checkPageBreak(12);
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(margin, y - 0.5, 4.5, 4.5, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(iconNumber, margin + 1.2, y + 2.8);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(title, margin + 7, y + 3.2);

    // subtle underline
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y + 5.5, pageWidth - margin, y + 5.5);
    y += 9;
  };

  // --- 1. EXECUTIVE SUMMARY ---
  addSectionHeading('1. Executive Summary', '1');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);

  const safeSummary = cleanForPDF(analysis.summary);
  const summaryLines = doc.splitTextToSize(safeSummary, contentWidth);
  for (const line of summaryLines) {
    checkPageBreak(5);
    doc.text(line, margin, y);
    y += 4.8;
  }
  y += 3;

  if (analysis.oneLiner) {
    const safeOneLiner = cleanForPDF(analysis.oneLiner);
    const oneLinerLines = doc.splitTextToSize(`Takeaway: ${safeOneLiner}`, contentWidth - 8);
    const boxHeight = oneLinerLines.length * 4.5 + 6;
    checkPageBreak(boxHeight + 4);

    doc.setFillColor(255, 247, 245); // #fff7f5
    doc.setDrawColor(254, 215, 170); // #fed7aa
    doc.roundedRect(margin, y, contentWidth, boxHeight, 2, 2, 'FD');

    // Accent line on left
    doc.setFillColor(255, 77, 46);
    doc.rect(margin, y, 2, boxHeight, 'F');

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(124, 45, 18);
    doc.text(oneLinerLines, margin + 5, y + 5);
    y += boxHeight + 6;
  }

  // --- 2. SALIENT KEY POINTS ---
  if (analysis.keyPoints && analysis.keyPoints.length > 0) {
    addSectionHeading('2. Salient Key Points', '2');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    analysis.keyPoints.forEach((point, i) => {
      const bullet = `${i + 1}.`;
      const safePoint = cleanForPDF(point.sentence);
      const pointLines = doc.splitTextToSize(safePoint, contentWidth - 10);
      const rowHeight = pointLines.length * 4.5 + 2;

      checkPageBreak(rowHeight + 2);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 77, 46);
      doc.text(bullet, margin + 1, y);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      doc.text(pointLines, margin + 7, y);
      y += rowHeight + 1.5;
    });
    y += 4;
  }

  // --- 3. READABILITY & COMPLEXITY (FLESCH-KINCAID) ---
  if (analysis.readability) {
    addSectionHeading('3. Readability & Complexity Profile', '3');

    const r = analysis.readability;
    const cardHeight = 22;
    checkPageBreak(cardHeight + 4);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, contentWidth, cardHeight, 2, 2, 'FD');

    // Box 1: Flesch-Kincaid Grade
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`Grade ${r.fleschKincaidGrade.toFixed(1)}`, margin + 6, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Flesch-Kincaid Grade', margin + 6, y + 10);
    doc.text(`Audience: ${cleanForPDF(r.audience)}`, margin + 6, y + 14);

    // Box 2: Reading Ease
    const col2X = margin + 65;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(r.fleschReadingEase >= 60 ? 5 : 180, r.fleschReadingEase >= 60 ? 150 : 80, 50);
    doc.text(`${r.fleschReadingEase} / 100`, col2X, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Reading Ease Score', col2X, y + 10);
    doc.text(`Rating: ${cleanForPDF(r.level)}`, col2X, y + 14);

    // Box 3: Complexity Breakdown
    const col3X = margin + 120;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text(`- Sentence Length: ${r.avgWordsPerSentence} words/sent`, col3X, y + 6);
    doc.text(`- Syllable Density: ${r.avgSyllablesPerWord} syl/word`, col3X, y + 10);
    doc.text(`- Profile: ${cleanForPDF(r.description)}`, col3X, y + 14);

    y += cardHeight + 6;
  }

  // --- 4. IMPORTANT THEMATIC FACTORS ---
  if (analysis.factors && analysis.factors.length > 0) {
    addSectionHeading('4. Thematic Factors & Evidence', '4');

    analysis.factors.forEach((factor) => {
      const factorText = factor.evidence || factor.desc || '';
      const safeText = cleanForPDF(factorText);
      const textLines = doc.splitTextToSize(safeText, contentWidth - 8);
      const safeCues = factor.cues.map((c) => cleanForPDF(c)).join(' | ');
      const cuesLine = `Key Cues: ${safeCues}`;
      const blockHeight = textLines.length * 4.2 + 10;

      checkPageBreak(blockHeight + 3);

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, y, contentWidth, blockHeight, 1.5, 1.5, 'FD');

      // Factor Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(`[*]  ${cleanForPDF(factor.title)}`, margin + 4, y + 5);

      // Factor Evidence Text
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(textLines, margin + 4, y + 9);

      // Cues
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 116, 139);
      doc.text(cuesLine, margin + 4, y + blockHeight - 2);

      y += blockHeight + 3;
    });
    y += 3;
  }

  // --- 5. TOP KEYWORDS & SIGNALS ---
  if (analysis.topKeywords && analysis.topKeywords.length > 0) {
    addSectionHeading('5. Salient Keywords & Signals', '5');

    checkPageBreak(18);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('Top TF-IDF Keywords:', margin, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    const kwList = analysis.topKeywords.map((k) => `${cleanForPDF(k.term)} (${k.count})`).join(', ');
    const kwLines = doc.splitTextToSize(kwList, contentWidth - 36);
    doc.text(kwLines, margin + 36, y);
    y += Math.max(5, kwLines.length * 4) + 2;

    if (analysis.topBigrams && analysis.topBigrams.length > 0) {
      checkPageBreak(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Key Phrases:', margin, y);
      doc.setFont('helvetica', 'normal');
      doc.text(analysis.topBigrams.slice(0, 5).map((b) => cleanForPDF(b)).join('  |  '), margin + 36, y);
      y += 6;
    }

    if (analysis.numbers && analysis.numbers.length > 0) {
      checkPageBreak(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Key Data Numbers:', margin, y);
      doc.setFont('helvetica', 'normal');
      doc.text(analysis.numbers.slice(0, 8).map((n) => cleanForPDF(n)).join('  |  '), margin + 36, y);
      y += 6;
    }

    if (analysis.entities && analysis.entities.length > 0) {
      checkPageBreak(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Entities Mentioned:', margin, y);
      doc.setFont('helvetica', 'normal');
      doc.text(analysis.entities.slice(0, 6).map((e) => cleanForPDF(e)).join('  |  '), margin + 36, y);
      y += 6;
    }
  }

  // --- 6. OPTIONAL SOURCE TEXT ---
  if (options.includeSource && options.rawText) {
    addSectionHeading('6. Source Document Excerpt', '6');

    doc.setFont('courier', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);

    const rawClean = cleanForPDF(options.rawText, true);
    const sourceSnippet = rawClean.slice(0, 3500) + (rawClean.length > 3500 ? '\n\n[... truncated for PDF overview]' : '');
    const sourceLines = doc.splitTextToSize(sourceSnippet, contentWidth);
    for (const line of sourceLines) {
      checkPageBreak(3.5);
      doc.text(line, margin, y);
      y += 3.5;
    }
  }

  // --- FOOTER ON ALL PAGES ---
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // #94a3b8
    doc.text('DocuWeave Studio - Structured Analysis Report - 100% Offline NLP', margin, pageHeight - 8);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  // Save the PDF
  const cleanTitle = (analysis.title.slice(0, 40).replace(/[^a-z0-9]+/gi, '-') || 'docuweave-analysis') + '.pdf';
  doc.save(cleanTitle);
}
