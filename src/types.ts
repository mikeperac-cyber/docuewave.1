export interface Theme {
  id: string;
  name: string;
  bg: string;
  ink: string;
  sw: string;
}

export interface Factor {
  title: string;
  icon: string;
  desc: string;
  evidence: string;
  cues: string[];
}

export interface KeyPoint {
  sentence: string;
  idx: number;
  score: number;
  tr?: number;
  base?: number;
}

export interface Section {
  title: string;
  startIdx: number;
}

export interface Keyword {
  term: string;
  count: number;
  score: number;
}

export interface ReadabilityScore {
  fleschReadingEase: number;
  fleschKincaidGrade: number;
  level: string;
  description: string;
  audience: string;
  avgWordsPerSentence: number;
  avgSyllablesPerWord: number;
}

export interface AnalysisResult {
  title: string;
  subtitle: string;
  wc: number;
  readingTime: number;
  sentences: number;
  keywords: Keyword[];
  topKeywords: Keyword[];
  topBigrams: string[];
  keyPoints: KeyPoint[];
  summary: string;
  summaryWords: number;
  summaryRatio: number;
  oneLiner: string;
  factors: Factor[];
  numbers: string[];
  dates: string[];
  entities: string[];
  headings: string[];
  sections: Section[];
  pages: number;
  coverage: boolean[];
  readability: ReadabilityScore;
  analysisReadingTime?: number;
  isCompare?: boolean;
  compareParts?: { name: string; wc: number; summary: string }[];
}

export interface FileItem {
  name: string;
  size: number;
  type?: string;
  text?: string;
}

export interface LibraryItem {
  id: number;
  title: string;
  subtitle: string;
  wc: number;
  pages: number;
  summary: string;
  theme: string;
  date: string;
  raw: string;
  analysis: string;
}

export interface AskHit {
  sentence: string;
  idx: number;
  score: number;
}
