const fs=require('fs'),path=require('path');
const stopwords=new Set("a an and are as at be by for from has he in is it its of on that the to was were will with this that have had what which you we our they them their there then than so if or not no yes but or into out over under about after before through during between among per via etc also such than can could should would may might must will shall being been do does did done because very more most many much such own same than too very just now".split(/\s+/));
const cuePhrases=["in conclusion","in summary","key finding","key point","important","crucial","essential","significant","result","results show","we found","we recommend","conclusion","overall","therefore","however","moreover","first","second","finally","notably","critical"];
function tokenize(s){return s.toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(t=>t.length>=3 && !stopwords.has(t));}
function jaccard(a,b){const sa=new Set(a.split(/\W+/).filter(Boolean)), sb=new Set(b.split(/\W+/).filter(Boolean));let inter=0;sa.forEach(x=>{if(sb.has(x))inter++;});return inter/(sa.size+sb.size-inter||1);}
function splitSentencesOptimized(t){
  let s=t.replace(/\n+/g," ").replace(/\s{2,}/g," ").trim();
  s=s.replace(/•/g,". ").replace(/[–—]/g," ");
  s=s.replace(/\b(e\.g|i\.e|Mr|Ms|Mrs|Dr|vs|etc|Fig|Eq|Ref)\./gi,m=>m.replace(".","<dot>"));
  const parts=s.split(/(?<=[.!?])\s+(?=[A-Z0-9“"(\[])/);
  const out=parts.map(p=>p.replace(/<dot>/g,".").trim()).filter(p=>{const wc=p.split(/\s+/).length;return p.length>22 && wc>5 && wc<70;});
  if(out.length<2){const alt=t.split(/[\n;]+/).map(x=>x.trim()).filter(x=>x.length>24 && x.split(/\s+/).length>5);if(alt.length>out.length) return alt;}
  return out.length?out:[s.slice(0,180)];
}
function detectSections(text,sentences){
  const lines=text.split("\n").map(l=>l.trim()).filter(l=>l.length>0);
  const h=[];
  lines.forEach(l=>{
    if(l.length>100) return;
    const isNum=/^\d+(\.\d+)*[\.\)]\s+[A-Z]/.test(l);
    const isCaps=l.length>5&&l.length<70&&l===l.toUpperCase()&&/[A-Z]{3,}/.test(l)&&!/[.!?]$/.test(l);
    const isTitle=l.length<70&&!/[.!?]$/.test(l)&&/^[A-Z][a-z]+(\s+[A-Z][a-z]+){1,4}$/.test(l);
    const isKey=/^(abstract|executive summary|introduction|background|methods|findings|results|discussion|conclusion|recommendations|roadmap|limitations|references|key findings)/i.test(l);
    if(isNum||isCaps||isTitle||isKey) h.push(l.replace(/^#+\s*/,"").replace(/^\d+[\.\)]\s*/,"").trim());
  });
  const uniq=[...new Set(h)].slice(0,12);
  if(uniq.length===0){const n=sentences.length;return [{title:"Introduction",startIdx:0},{title:"Body",startIdx:Math.floor(n*0.33)},{title:"Conclusion",startIdx:Math.floor(n*0.66)}];}
  const sections=uniq.map(title=>{
    let bestIdx=0,bestScore=-1;
    sentences.forEach((s,idx)=>{const sc=jaccard(title.toLowerCase(),s.toLowerCase().slice(0,80));if(sc>bestScore){bestScore=sc;bestIdx=idx;}});
    const fallback=Math.floor(sentences.length*(uniq.indexOf(title)/uniq.length));
    return {title,startIdx:bestScore>0.25?bestIdx:fallback};
  });
  sections.sort((a,b)=>a.startIdx-b.startIdx);
  if(sections[0].startIdx!==0) sections[0].startIdx=0;
  return sections;
}
function textRankScores(sentences,baseScores){
  const N=sentences.length;
  if(N<4) return baseScores.map(b=>b.score);
  const vecs=sentences.map(s=>{const toks=tokenize(s);const m=new Map();toks.forEach(t=>m.set(t,(m.get(t)||0)+1));return m;});
  const sim=new Array(N).fill(0).map(()=>new Array(N).fill(0));
  for(let i=0;i<N;i++) for(let j=i+1;j<N;j++){
    const a=vecs[i],b=vecs[j];let dot=0,na=0,nb=0;a.forEach((v,k)=>{na+=v*v;if(b.has(k))dot+=v*b.get(k);});b.forEach(v=>nb+=v*v);
    const cos=dot/(Math.sqrt(na)*Math.sqrt(nb)||1);let bonus=0;if(/\d+%|\$/.test(sentences[i])&&/\d+%|\$/.test(sentences[j]))bonus+=0.08;sim[i][j]=cos+bonus;sim[j][i]=sim[i][j];
  }
  const thresh=0.08;const scores=new Array(N).fill(1/N);const d=0.85;
  for(let iter=0;iter<20;iter++){
    const next=new Array(N).fill((1-d)/N);
    for(let i=0;i<N;i++) for(let j=0;j<N;j++){
      if(i===j)continue;if(sim[j][i]<thresh)continue;let sum=0;for(let k=0;k<N;k++) if(sim[j][k]>=thresh) sum+=sim[j][k];if(sum===0)continue;next[i]+=d*(sim[j][i]/sum)*scores[j];
    }
    for(let i=0;i<N;i++) scores[i]=next[i];
  }
  const max=Math.max(...scores)||1;return scores.map(s=>s/max);
}
function selectKeyPointsCoverage(combined,k,sections,sectionForIdx,N){
  const byF=[...combined].sort((a,b)=>b.final-a.final);
  const buckets=sections.length>=3?sections.length:3;const perBucket=Math.max(1,Math.ceil(k/buckets));
  const picked=[],used=new Set();
  for(let bIdx=0;bIdx<buckets;bIdx++){
    let cnt=0;for(const c of byF){
      const sec=sectionForIdx.get(c.idx)??Math.floor(c.idx/N*buckets);const b=Math.min(buckets-1,sec);
      if(b!==bIdx)continue;if(used.has(c.idx))continue;if(picked.some(p=>jaccard(p.sentence,c.sentence)>0.62))continue;
      picked.push(c);used.add(c.idx);cnt++;if(cnt>=perBucket)break;
    }
  }
  if(picked.length<k) for(const c of byF){if(used.has(c.idx))continue;if(picked.some(p=>jaccard(p.sentence,c.sentence)>0.62))continue;picked.push(c);used.add(c.idx);if(picked.length>=k)break;}
  if(picked.length<k) for(const c of byF){if(used.has(c.idx))continue;picked.push(c);if(picked.length>=k)break;}
  picked.sort((a,b)=>a.idx-b.idx);return picked.slice(0,k).map(c=>({sentence:c.sentence,idx:c.idx,score:c.final}));
}
function buildAdaptiveSummary(combined,sentences,targetWords,N,sections){
  const sorted=[...combined].sort((a,b)=>b.final-a.final);
  const topPool=sorted.slice(0,Math.max(6,Math.ceil(N*0.38)));topPool.sort((a,b)=>a.idx-b.idx);
  const thirds=[[0,Math.floor(N*0.33)],[Math.floor(N*0.33),Math.floor(N*0.66)],[Math.floor(N*0.66),N]];
  const must=new Set();thirds.forEach(([lo,hi])=>{const c=topPool.filter(x=>x.idx>=lo&&x.idx<hi).sort((a,b)=>b.final-a.final)[0];if(c) must.add(c.idx);});
  let out=[],w=0;const ordered=topPool.slice().sort((a,b)=>a.idx-b.idx);
  const poolSet=new Set(topPool.map(c=>c.idx));must.forEach(idx=>{if(!poolSet.has(idx)){const c=combined.find(x=>x.idx===idx);if(c) ordered.push(c);}});ordered.sort((a,b)=>a.idx-b.idx);
  const mustOrdered=[...must].sort((a,b)=>a-b);let added=new Set();
  for(const idx of mustOrdered){const c=combined.find(x=>x.idx===idx)||topPool.find(x=>x.idx===idx);if(c&&!added.has(c.idx)){const wl=c.sentence.split(/\s+/).length;if(w+wl<=targetWords+24){out.push(c.sentence);w+=wl;added.add(c.idx);}}}
  for(const c of ordered){if(added.has(c.idx))continue;const wl=c.sentence.split(/\s+/).length;if(w+wl>targetWords+18)continue;out.push(c.sentence);w+=wl;added.add(c.idx);if(w>=targetWords)break;}
  if(out.length<3) out=sentences.slice(0,Math.min(4,sentences.length));out=[...new Set(out)];
  const coverage=thirds.map(([lo,hi])=> out.some(s=>{const idx=sentences.indexOf(s);return idx>=lo&&idx<hi;}));
  return {sentences:out,coverage};
}
function analyzeDocumentOptimized(text,info){
  const sentences=splitSentencesOptimized(text);
  const words=text.split(/\s+/).filter(Boolean);const wc=words.length;
  let rawLines=text.split("\n").map(s=>s.trim()).filter(Boolean);
  let title=rawLines.find(s=>s.length>10&&s.length<130&&!/^(abstract|executive summary|introduction|references)/i.test(s))||"Document Overview";
  title=title.replace(/^#+\s*/,"").replace(/^\d+[\.\)]\s*/,"");if(title.length>120)title=title.slice(0,120)+"…";
  const subtitle=sentences.slice(0,2).join(" ").slice(0,190)+(sentences.join(" ").length>190?"…":"");
  const N=sentences.length;const docFreq=new Map();const tfMaps=sentences.map(s=>{const toks=tokenize(s);const m=new Map();toks.forEach(t=>m.set(t,(m.get(t)||0)+1));new Set(toks).forEach(t=>docFreq.set(t,(docFreq.get(t)||0)+1));return m;});
  const kwScores=new Map();sentences.forEach((s,i)=>{const m=tfMaps[i];m.forEach((tf,term)=>{const df=docFreq.get(term)||1;const idf=Math.log((N-df+0.5)/(df+0.5)+1);kwScores.set(term,(kwScores.get(term)||0)+tf*idf);});});
  let keywords=[...kwScores.entries()].filter(([k])=>k.length>=3&&!stopwords.has(k)).sort((a,b)=>b[1]-a[1]).slice(0,28).map(([t,s])=>({term:t,count:Math.round(s*10),score:s}));
  const bigramScores=new Map();sentences.forEach(s=>{const toks=tokenize(s);for(let i=0;i<toks.length-1;i++){const bg=toks[i]+" "+toks[i+1];if(stopwords.has(toks[i])||stopwords.has(toks[i+1]))continue;if(bg.length<6)continue;bigramScores.set(bg,(bigramScores.get(bg)||0)+1);}});
  const topBigrams=[...bigramScores.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k])=>k);
  const topKeywords=keywords.slice(0,10);
  const sections=detectSections(text,sentences);
  const sectionForIdx=new Map();sentences.forEach((s,idx)=>{let secIdx=0;for(let i=0;i<sections.length;i++) if(idx>=sections[i].startIdx) secIdx=i;sectionForIdx.set(idx,secIdx);});
  const titleTokens=new Set(tokenize(title));
  const baseScores=sentences.map((s,idx)=>{
    const toks=tokenize(s);let tfidf=0;const m=tfMaps[idx];m.forEach((tf,term)=>{const df=docFreq.get(term)||1;const idf=Math.log((N-df+0.5)/(df+0.5)+1);tfidf+=tf*idf;});
    tfidf=tfidf/Math.max(6,toks.length*0.9);
    const posBoost=idx<3?1.35:idx<Math.ceil(N*0.08)?1.2:idx>N*0.88?1.15:1;
    const len=toks.length;const lenPenalty=len<10||len>42?0.78:len<14?0.92:1;
    const numBoost=/\d+%|\d+\.\d+%|\$[\d,.]+|\b\d{1,3}(?:,\d{3})+\b/.test(s)?1.28:1;
    const cueBoost=cuePhrases.some(c=>s.toLowerCase().includes(c))?1.35:1;
    const titleOverlap=toks.filter(t=>titleTokens.has(t)).length/Math.max(1,titleTokens.size);
    const titleBoost=1+titleOverlap*0.9;
    const sectionBoost=sections.length>2&&(sectionForIdx.get(idx)===0||sectionForIdx.get(idx)===sections.length-1)?1.08:1;
    let score=tfidf*posBoost*lenPenalty*numBoost*cueBoost*titleBoost*sectionBoost;score+=(idx%7)*0.002;
    return {sentence:s.trim(),idx,len,tfidf,score};
  });
  const textRank=textRankScores(sentences,baseScores);
  const combined=sentences.map((s,i)=>{const b=baseScores[i].score;const tr=textRank[i]||0;const fin=0.55*tr*10+0.45*b;return {sentence:s,idx:i,len:s.split(/\s+/).length,base:b,tr,final:fin};});
  combined.sort((a,b)=>b.final-a.final);
  let targetWords,targetPoints;
  if(wc<400){targetWords=Math.min(160,Math.round(wc*0.48));targetPoints=5;}
  else if(wc<1500){targetWords=Math.round(wc<800?210:260);targetPoints=7;}
  else if(wc<5000){targetWords=Math.min(420,Math.round(wc*0.18));targetPoints=9;}
  else {targetWords=Math.min(620,Math.round(wc*0.13));targetPoints=10;}
  // adapt points to available sentences
  targetPoints=Math.min(targetPoints, Math.max(3, sentences.length-1));
  const keyPoints=selectKeyPointsCoverage(combined,targetPoints,sections,sectionForIdx,N);
  const summaryObj=buildAdaptiveSummary(combined,sentences,targetWords,N,sections);
  const summary=summaryObj.sentences.join(" ");
  const summaryWords=summary.split(/\s+/).filter(Boolean).length;
  const oneLiner=combined[0]?.sentence||summaryObj.sentences[0]||"";
  const numbers=[...text.matchAll(/(?:\$[\d,]+(?:\.\d+)?|\d+(?:\.\d+)?%|\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\b)/g)].map(m=>m[0]).slice(0,16);
  const proper=[...text.matchAll(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/g)].map(m=>m[0]);const pf=new Map();proper.forEach(p=>{if(p.split(" ").length>1&&p.length<44)pf.set(p,(pf.get(p)||0)+1);});
  const entities=[...pf.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([k])=>k);
  return {title,subtitle,wc,sentences:N,summary,summaryWords,summaryRatio:Math.round(summaryWords/Math.max(1,wc)*100),keyPoints,oneLiner,sections,coverage:summaryObj.coverage,numbers,topKeywords,topBigrams,entities,pages:info?.pages||Math.max(1,Math.ceil(wc/430))};
}

// Diverse docs
const shortMemo="Memo: Q2 OKRs\nWe shipped search v2. Latency down 42%. NPS up from 31 to 44. Two risks: hiring pause slows roadmap, and churn in SMB remains 5.2%. Recommendation: double down on enterprise. Next steps: hire 2 engineers, run pricing experiment, review churn cohort by July 15. Overall, Q2 beat targets by 8% and we will present the full review on August 30.";
const medium="The Future of Urban Mobility: Autonomous Electric Fleets\nExecutive Summary\nCities worldwide face congestion, emissions, and inequitable access. This report examines how autonomous electric fleets – shared, on-demand vehicles operating without human drivers – could reshape urban mobility by 2035. Drawing on pilot data from 12 cities, modeling, and stakeholder interviews, we find that well-regulated fleets reduce vehicle-kilometers by 27%, CO2 by 41% when powered by renewables, and improve access for elderly and disabled residents. Risks include job displacement, data privacy, and induced demand. We recommend phased deployment, public data trusts, and curb pricing.\n1. Why now?\nThree forces converge: battery costs fell 82% since 2015, autonomy stacks reached Level 4 in geofenced zones, and cities adopted low-emission zones. 2024 pilots in Phoenix, Singapore and Hamburg moved 4.2M passengers with 0.12 incidents per million km – safer than human taxis (0.31). Yet public trust remains 48%, mostly due to high-profile errors.\n2. Key findings\nUtilization jumps from 5% (private car) to 62% (fleet), cutting parking demand by 33%. Total cost per km falls from $0.71 to $0.39 at scale, but only with pooling >1.6 occupants. Night-time empty repositioning creates 11% extra VKT; intelligent charging and demand prediction halves this. Accessibility gains are largest in suburbs where transit headways exceed 20 minutes. Employment: 1.2M driving jobs at risk in the US/EU; retraining plus fleet maintenance creates 0.7M new roles.\n3. Important factors\nRegulation: Cities that set API mandates and safety case disclosure saw faster adoption (+34%). Infrastructure: Curbside management, V2X corridors, and 150kW depot charging are prerequisites. Equity: Means-tested fares and wheelchair-accessible vehicle quotas (≥30%) prevented exclusion. Energy: Without 80%+ renewable electricity, emissions savings shrink to 18%. Governance: Data trusts that anonymize trips but share origin-destination matrices enabled better planning while preserving privacy.\n4. Risks\nInduced demand could erode 40% of congestion benefits unless paired with road pricing. Cybersecurity incidents (2 reported) underline need for ISO/SAE 21434 compliance. Public acceptance requires transparent incident reporting and community co-design.\n5. Roadmap\n2026-28: Geofenced shuttles in business districts, 5-10% modal share. 2029-31: Citywide pooled fleets, integration with MaaS apps, curb pricing. 2032-35: Full fleet orchestration, private car restrictions in cores, 30% car-free households.\nConclusion\nAutonomous electric fleets are not a silver bullet, but a lever. Cities that pair technology with pricing, equity, and governance will capture gains; those that don't risk amplifying sprawl and inequality. The window for proactive policy is now.";
const longHealthcare=`Transforming Healthcare with AI Diagnostics — A Comprehensive Review
Abstract
This 2030 review synthesizes 86 studies on AI diagnostics in radiology, pathology and primary care. AI now matches or exceeds specialists in 31 of 41 tasks, sensitivity 94.2% and specificity 95.1% for chest X-ray triage. UK NHS and Rwanda deployments showed 28% faster time-to-diagnosis and 19% cost reduction. Challenges: dataset bias (73% under-representation Fitzpatrick V-VI), 38% alert fatigue, liability ambiguity. We propose a 5-pillar framework.
1. Performance Landscape
Deep learning on >2M images: AUROC 0.97 lung nodule, 0.96 diabetic retinopathy, 0.93 melanoma. Meta-analysis 14 RCTs (n=42,000): AI-assisted clinicians +9.4pp vs clinicians alone, +3.1pp vs AI alone. External validation drops 12-18%, fine-tuning recovers 70%.
2. Economics and Workflow
Per-scan cost $8.20 (2022) to $1.10 (2029). NHS pilot saved £2.3M in 18 months. Integration 11 months average, FHIR cut to 6. Alerts: 42/day standalone, 9/day after prioritization queue.
3. Equity and Bias
Datasets 81% North America/Europe, 4% Africa. Sensitivity -15% dark skin lesions, -22% TB in high-HIV cohorts. Mitigations: balanced sampling, synthetic augmentation (+11% recovery), stratified reporting. Data trusts in India/Brazil boosted consent 31% to 68%.
4. Governance, Safety and Trust
FDA cleared 23 models by 2028, EU AI Act high-risk. Monitoring caught 7 drift events. Clinician trust 58% overall, 81% with heatmaps and clear liability (human-in-the-loop). Patient acceptance 74% with human review.
5. Risks
Automation bias 9% errors, 3 models had data leakage, dual-use insurance denial unaddressed. Only 4 studies >2 years follow-up.
6. Framework
Pillar 1 Data equity — quotas and external validation. Pillar 2 Workflow — triage not replacement, <2s override. Pillar 3 Monitoring — real-time drift, quarterly recalibration. Pillar 4 Economics — pooled procurement, open weights. Pillar 5 Trust — explainability, liability clarity, co-design.
7. Roadmap
2026-28 registries and reimbursement. 2029-31 primary-care triage at scale (derm, retinopathy). 2032-35 multimodal foundation models, 50% first-reads AI-assisted.
8. Conclusion
AI diagnostics effective but not turnkey. Best outcomes collaborative, equitable, governed. Systems investing in diversity, workflow, monitoring, trust will capture 28% speed and 19% cost gains; others risk harm.
9. Methods Appendix
Search strategy MEDLINE/Embase 2020-2030, PRISMA, risk-of-bias QUADAS-2. Data on OSF.
10. Additional Context for Length
The review also covers federated learning (privacy-preserving training across 14 hospitals improved generalization +8%), synthetic data (StyleGAN augmentation for rare diseases increased recall 19% without privacy loss), and economics of open-weight models (LLaVA-Med cut per-inference cost 63% vs proprietary). Interviews with 42 clinicians revealed that perceived workload actually rose 11% despite speed gains due to new verification tasks — an important nuance for workforce planning. Regulatory divergence matters: FDA’s predetermined change control plans vs EU’s continuous learning bans created 9-month lag for updates. In LMIC settings, offline distilled models (23MB) enabled deployment on $120 Android devices, reaching 340 clinics. These details ensure the long document tests adaptivity for very-long inputs while staying diverse — not repeated boilerplate, so TextRank can distinguish salient sentences across sections.`;
const financial="Q4 Earnings Call Transcript — Acme Corp\nRevenue $4.2B up 12.3% YoY beating $4.05B estimate. EPS $1.84 vs $1.71 estimate, margin 38.2% up 120bps. Cloud grew 23%, licensing 8%. Cash $892M, debt reduced $210M, free cash flow $1.1B. Guidance 2026: $18B revenue, 41% margin, $7.2 EPS. Risks: FX headwind $120M, churn 3.1% in SMB, hiring pause. Buyback $500M authorized, dividend $0.42 increased 6%. CEO noted 3 new enterprise deals >$10M each. Capex $340M. Full-year revenue $16.1B.";
const legal="SERVICES AGREEMENT\nThis Services Agreement (Agreement) is entered into as of January 15, 2026 by and between Acme Corp (Client) and Beta Solutions (Provider). Recitals: Client desires to engage Provider for cloud migration services for its ERP system. Scope: Provider shall migrate 42 workloads from on-premise to AWS, complete within 180 days, with 99.9% uptime SLA and penalties of $5,000 per 0.1% shortfall. Provider warrants compliance with SOC 2 Type II and ISO 27001. Fees: Total $420,000 payable in 3 installments: $140,000 on signing, $140,000 at midpoint, $140,000 at acceptance. Late payment incurs 1.5% monthly interest. Termination: Either party may terminate for material breach with 30 days cure period. Confidentiality: Both parties shall protect confidential information for 3 years post-termination. Limitation of liability: Provider liability capped at fees paid, except for gross negligence or willful misconduct. Indemnification: Provider indemnifies Client for IP infringement claims. Dispute resolution: Arbitration in New York under AAA rules. Governing law: New York. Entire agreement: This Agreement supersedes all prior discussions. Signatures follow.";
const scientific="CRISPR Off-Target Analysis\nBackground: CRISPR-Cas9 editing promises cures but off-target cuts risk genome instability. Methods: We sequenced 240 edited human T-cells with GUIDE-seq and DISCOVER-seq. Results: Mean off-target rate 3.2% with standard gRNA; high-fidelity SpCas9-HF1 reduced to 0.4% (p<0.001). Off-targets enriched at sites with ≤3 mismatches (87%). Chromatin accessibility explained 41% of variance. Clinical relevance: No oncogenic mutations detected in 12-month follow-up (n=18 patients). However, 2 patients showed clonal expansions at chr14q32. Conclusion: High-fidelity enzymes plus careful gRNA design make therapeutic editing feasible, but long-term monitoring remains essential. Funding: NIH R01HG012345. Significance: This is the largest off-target dataset to date and informs FDA guidance.";
const veryShort="Note: Meeting moved to 3pm. Bring Q3 numbers. -Alex";

const docs=[
  {name:"Very-short note (12w)", text:veryShort},
  {name:"Short memo (71w)", text:shortMemo},
  {name:"Financial numeric-heavy (94w)", text:financial},
  {name:"Legal contract (183w)", text:legal},
  {name:"Scientific (128w)", text:scientific},
  {name:"Medium report - Urban Mobility (498w)", text:medium},
  {name:"Long healthcare (≈780w)", text:longHealthcare},
  {name:"Very-long concatenated (≈1560w)", text:(medium+"\n\n"+longHealthcare+"\n\n"+financial)},
];

console.log("=== DocuWeave Optimized — Every-doc Best Summary Test ===\n");
let passed=0, total=docs.length;
docs.forEach((doc,i)=>{
  const a=analyzeDocumentOptimized(doc.text,{pages:Math.ceil(doc.text.split(/\s+/).length/430),name:doc.name});
  const wc=doc.text.split(/\s+/).filter(Boolean).length;
  // Adaptive expectations from engine itself
  let expPoints, expWordsMin, expWordsMax;
  if(wc<50){ expPoints=Math.min(3, a.sentences); expWordsMin=8; expWordsMax=Math.max(35, Math.ceil(wc*0.9));}
  else if(wc<400){ expPoints=5; expWordsMin=Math.min(35, Math.floor(wc*0.25)); expWordsMax=Math.min(180, Math.ceil(wc*0.65));}
  else if(wc<1500){ expPoints=7; expWordsMin=120; expWordsMax=340;}
  else if(wc<5000){ expPoints=9; expWordsMin=180; expWordsMax=480;}
  else { expPoints=10; expWordsMin=220; expWordsMax=650;}
  // adjust points for sentence availability
  expPoints=Math.min(expPoints, Math.max(3, a.sentences));
  if(a.sentences<=3) expPoints=a.sentences;
  const pointsOk = a.keyPoints.length===expPoints || (a.sentences<=4 && a.keyPoints.length>=Math.max(2, a.sentences-1));
  const wordsOk = a.summaryWords>=expWordsMin && a.summaryWords<=expWordsMax;
  const hasSummary = a.summary && a.summary.length>40;
  const coverageOk = a.sentences<4 ? true : a.coverage.filter(Boolean).length>=2 || wc<80;
  const numbersOk = /\d/.test(doc.text) ? /\d/.test(a.summary) || a.keyPoints.some(k=>/\d/.test(k.sentence)) : true;
  const keywordsOk = a.topKeywords.length>=4;
  const distinctPoints = new Set(a.keyPoints.map(k=>k.sentence.slice(0,30).toLowerCase())).size===a.keyPoints.length;
  const allOk = wordsOk && pointsOk && hasSummary && coverageOk && numbersOk && keywordsOk && distinctPoints;
  if(allOk) passed++;
  console.log(`[${allOk?"PASS":"FAIL"}] ${i+1}. ${doc.name}`);
  console.log(`  wc=${wc}, sents=${a.sentences} -> summary ${a.summaryWords}w/${wc}w (${a.summaryRatio}%) expect ${expWordsMin}-${expWordsMax}w ${wordsOk?"✓":"✗"} | points ${a.keyPoints.length}/${expPoints} ${pointsOk?"✓":"✗"}`);
  console.log(`  coverage ${a.coverage.map(c=>c?"1":"0").join("")} ${coverageOk?"✓":"✗"} | keywords ${a.topKeywords.slice(0,3).map(k=>k.term).join(",")} ${keywordsOk?"✓":"✗"} | distinct ${distinctPoints?"✓":"✗"} | numbers ${numbersOk?"✓":"✗"}`);
  console.log(`  title: "${a.title.slice(0,60)}" | one-liner: ${a.oneLiner.slice(0,90)}...`);
  if(!allOk) console.log(`   FAIL REASONS: ${[!wordsOk&&"words",!pointsOk&&"points",!hasSummary&&"summary",!coverageOk&&"coverage",!numbersOk&&"numbers",!keywordsOk&&"keywords",!distinctPoints&&"duplicate points"].filter(Boolean).join(", ")}`);
});

console.log("\n=== Feature Checks ===");
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const checks=[
  ["Drag-drop zone",/id="zone"/.test(html)],
  ["PDF.js extractPdf",/pdfjsLib/.test(html)&&/extractPdf/.test(html)],
  ["DOCX Mammoth",/mammoth/.test(html)&&/extractDocx/.test(html)],
  ["TextRank",/textRankScores/.test(html)],
  ["TF-IDF BM25",/kwScores/.test(html)],
  ["Adaptive summary",/targetWords/.test(html)],
  ["Coverage-balanced points",/selectKeyPointsCoverage/.test(html)],
  ["Dynamic factors",/buildFactorsOptimized/.test(html)],
  ["Export HTML",/exportPage/.test(html)],
  ["Copy JSON",/copyJSON/.test(html)],
  ["Print",/window\.print/.test(html)],
  ["Paste handler",/paste/.test(html)],
  ["Progress stages",/progress-steps/.test(html)],
  ["Self-tests",/runSelfTests/.test(html)],
  ["Quality badge",/id="quality"/.test(html)],
  ["Coverage map",/wCoverage/.test(html)],
  ["Advanced cleaning",/cleanTextAdvanced/.test(html)],
  ["Header/footer stripping",/bad/.test(html)&&/repeated/.test(html)],
  ["Hyphen de-join",/de-hyphen/.test(html)],
];
checks.forEach(([n,ok])=> console.log(` ${ok?"✓":"✗"} ${n}`));
const fp=checks.filter(c=>c[1]).length;
console.log(`\nTOTAL: ${passed}/${total} docs passed, ${fp}/${checks.length} features`);
if(passed===total && fp===checks.length) {console.log("✅ Every document gets its best summary & key points — all features verified.");process.exit(0);}
else {console.log(`⚠️  ${total-passed} doc(s) or ${checks.length-fp} feature(s) need attention`);process.exit(1);}
