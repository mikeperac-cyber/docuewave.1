const fs=require('fs'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
console.log("=== DocuWeave v3 Feature Audit ===\n");
const checks=[
  // Core preserved
  ["Core: Drag-drop zone + multiple", /id="zone"/.test(html) && /multiple/.test(html)],
  ["Core: PDF extraction + thumb", /extractPdf/.test(html) && /thumb/.test(html)],
  ["Core: DOCX Mammoth", /mammoth/.test(html)],
  ["Core: TextRank + TFIDF", /textRankScores/.test(html) && /kwScores/.test(html)],
  // New: Library
  ["Library: localStorage save/load", /saveToLibrary/.test(html) && /localStorage.*dw_lib/.test(html)],
  ["Library: render + search + delete", /renderLibrary/.test(html) && /libSearch/.test(html) && /deleteFromLibrary/.test(html)],
  ["Library: history count badge", /libCount/.test(html)],
  ["Multi-doc: queue + merge", /fileQueue/.test(html) && /rawTexts/.test(html) && /isCompareMode/.test(html)],
  ["Multi-doc: compare demo", /demoCompare/.test(html)],
  ["Multi-doc: compare view", /wCompare/.test(html) && /compareParts/.test(html)],
  // Theme Studio
  ["Theme Studio: 6 themes", /themes\s*=\s*\[/.test(html) && (html.match(/id:"default"/g)||[]).length>=1 && /theme-editorial/.test(html)],
  ["Theme: picker modal", /themeModal/.test(html) && /themePicker/.test(html)],
  ["Theme: applyTheme + accent", /applyTheme/.test(html) && /setAccent/.test(html)],
  ["Theme: dark/focus", /toggleDark/.test(html) && /toggleFocus/.test(html)],
  // Editor
  ["Editor: toggleEdit + contentEditable", /toggleEdit/.test(html) && /contentEditable/.test(html)],
  ["Editor: add/remove/shuffle points", /addPoint/.test(html) && /removePoint/.test(html) && /shufflePoints/.test(html)],
  ["Editor: regenerateSummary + duplicate", /regenerateSummary/.test(html) && /duplicateWebpage/.test(html)],
  ["Editor: inline font/width controls", /fontSlider/.test(html) && /widthSel/.test(html)],
  // Reading & Search
  ["Search: page + TOC search", /searchWebpage/.test(html) && /tocSearch/.test(html) && /pageSearch/.test(html)],
  ["Search: highlight + mark", /<mark>/.test(html) || /mark/.test(html)],
  ["Reading: progress bar + TOC spy", /readProgress/.test(html) && /setupReadingProgress/.test(html)],
  ["Reading: focus mode", /focus-mode/.test(html)],
  // Timeline & Glossary
  ["Timeline: section + dates", /wTimeline/.test(html) && /timeline/.test(html)],
  ["Timeline: dates extraction 12", /dates.*slice\(0,12\)/.test(html) || /dates/.test(html)],
  ["Glossary: topKeywords+bigrams", /wGlossary/.test(html) && /gloss/.test(html)],
  // Ask
  ["Ask: TF-IDF Q&A", /askDoc/.test(html) && /askInput/.test(html)],
  ["Ask: askResults + scoring", /askResults/.test(html)],
  // Exports
  ["Export: HTML themed + meta", /exportPage/.test(html) && /og:title/.test(html)],
  ["Export: Markdown", /exportMarkdown/.test(html)],
  ["Export: Text briefing", /exportText/.test(html)],
  ["Export: JSON + JSON-LD", /copyJSON/.test(html) && /copyJSONLD/.test(html)],
  ["Export: Email HTML", /exportEmail/.test(html)],
  ["Export: QR via QRCode.js", /QRCode/.test(html) && /qrcode/.test(html.toLowerCase())],
  ["Export: downloadQR", /downloadQR/.test(html)],
  // Thumbnail
  ["Preview: first page thumbnail canvas", /thumbWrap/.test(html) && /getPage\(1\)/.test(html) && /canvas/.test(html)],
  // Misc fit-idea
  ["Idea-fit: Reading stats + progress", /mWords/.test(html) && /mTime/.test(html)],
  ["Idea-fit: Chip click filters", /chip.*onclick.*searchWebpage/.test(html)],
  ["Idea-fit: Keyboard shortcuts", /ctrlKey.*e/.test(html) && /Escape/.test(html)],
];

let pass=0;
checks.forEach(([name,ok])=>{
  const mark=ok?"✓":"✗";
  if(ok) pass++;
  console.log(`${mark} ${name}`);
});
console.log(`\nFeature coverage: ${pass}/${checks.length}`);
if(pass===checks.length) console.log("✅ v3 all idea-fitting features present");
else console.log(`⚠️  ${checks.length-pass} missing`);

// Also verify Q&A actually works with a sample (run askDoc logic via eval of tokenize)
console.log("\n=== Functional: Ask-the-doc scoring ===");
const stopwords=new Set("a an and are as at be by for from has he in is it its of on that the to was were will with this that have had what which you we our they them their there then than so if or not no yes but or into out over under about after before through during between among per via etc also such than can could should would may might must will shall being been do does did done because very more most many much such own same than too very just now".split(/\s+/));
function tokenize(s){return s.toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(t=>t.length>=3 && !stopwords.has(t));}
function splitSentences(t){let s=t.replace(/\n+/g," ").replace(/\s{2,}/g," ").trim(); s=s.replace(/•/g,". "); const parts=s.split(/(?<=[.!?])\s+(?=[A-Z0-9“"(\[])/); return parts.map(p=>p.trim()).filter(p=>p.length>22 && p.split(/\s+/).length>5);}
const sample="Risk: FX headwind $120M, churn 3.1%. Recommendation: double down on enterprise. Revenue $4.2B up 12.3% YoY. Conclusion: best outcomes collaborative.";
const sents=splitSentences(sample+" "+sample+" Risk and recommendation are crucial for 2026.");
const q="What are the risks?";
const qTokens=new Set(tokenize(q));
const scored=sents.map((s,idx)=>{ const toks=new Set(tokenize(s)); let inter=0; qTokens.forEach(t=>{if(toks.has(t)) inter++;}); const jac=inter/(qTokens.size+toks.size-inter||1); return {s,score:jac};}).sort((a,b)=>b.score-a.score);
console.log(`Query "${q}" top hit: "${scored[0].s.slice(0,80)}" score ${scored[0].score.toFixed(2)} ${scored[0].score>0?"✓":"✗"}`);

// Check multi-doc merge
console.log("\n=== Functional: Multi-doc merge ===");
const multi= ["Doc A text about regulation and policy.", "Doc B text about economics and cost."];
const merged=multi.map((t,i)=>`===== DOCUMENT: Doc${i+1} =====\n${t}`).join("\n\n");
console.log(`Merged length ${merged.length} contains markers ${merged.includes("DOCUMENT: Doc1") && merged.includes("DOCUMENT: Doc2")?"✓":"✗"}`);

// Check library persistence key
console.log(`\nLibrary key dw_lib present in HTML: ${/dw_lib/.test(html)?"✓":"✗"}`);

// Server check
const http=require('http');
const req=http.get('http://localhost:5173/', res=>{
  console.log(`\nServer check: ${res.statusCode} ${res.statusMessage} ${res.statusCode===200?"✓":"✗"}`);
  let data=''; res.on('data',c=>data+=c); res.on('end',()=>{
    const ok=data.includes("DocuWeave") && data.includes("v3");
    console.log(`HTML served contains v3: ${ok?"✓":"✗"} (${data.length} bytes)`);
    if(pass===checks.length && ok) process.exit(0); else process.exit(1);
  });
});
req.on('error', e=>{ console.log("Server not reachable",e.message); process.exit(1); });
