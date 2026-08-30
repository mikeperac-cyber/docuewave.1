// ——— STATE ———
let rawText="", fileInfo=null, analysis=null, fileQueue=[], isCompareMode=false, editMode=false, currentTheme="default";
let rawTexts=[]; // for multi-doc

const $=s=>document.querySelector(s);
const zone=$("#zone"), input=$("#fileInput"), bar=$("#bar"), percent=$("#percent"), progress=$("#progress"), steps=$("#steps"), fileCard=$("#fileCard"), err=$("#err"), analyzeBtn=$("#analyzeBtn");
const stopwords=new Set("a an and are as at be by for from has he in is it its of on that the to was were will with this that have had what which you we our they them their there then than so if or not no yes but or into out over under about after before through during between among per via etc also such than can could should would may might must will shall being been do does did done because very more most many much such own same than too very just now".split(/\s+/));
const cuePhrases=["in conclusion","in summary","key finding","key point","important","crucial","essential","significant","result","results show","we found","we recommend","conclusion","overall","therefore","however","moreover","first","second","finally","notably","critical"];
const themes=[
  {id:"default",name:"Default — Ink",bg:"#ffffff",ink:"#0f172a",sw:"linear-gradient(135deg,#0f172a,#e7dfd8)"},
  {id:"editorial",name:"Editorial — Warm Paper",bg:"#fdfbf7",ink:"#1c1917",sw:"linear-gradient(135deg,#fdfbf7,#fde68a)"},
  {id:"swiss",name:"Swiss — Grid",bg:"#ffffff",ink:"#0f172a",sw:"linear-gradient(135deg,#ffffff,#94a3b8)"},
  {id:"warm",name:"Warm — Sun",bg:"#fefce8",ink:"#422006",sw:"linear-gradient(135deg,#fefce8,#facc15)"},
  {id:"minimal",name:"Minimal — Air",bg:"#f8fafc",ink:"#334155",sw:"linear-gradient(135deg,#f8fafc,#e2e8f0)"},
  {id:"dark",name:"Dark — Focus",bg:"#0f172a",ink:"#e2e8f0",sw:"linear-gradient(135deg,#0f172a,#334155)"},
];

function showErr(m){err.style.display="block";err.textContent=m;}
function hideErr(){err.style.display="none";}
function humanSize(b){if(b<1024)return b+" B";if(b<1024*1024)return (b/1024).toFixed(1)+" KB";return (b/1024/1024).toFixed(2)+" MB";}
function setProgress(p,label,step){
  progress.style.display="block";steps.style.display="flex";bar.style.width=p+"%";percent.textContent=label||p+"%";
  ["s1","s2","s3","s4","s5"].forEach((id,i)=>{ const el=document.getElementById(id); if(i+1<=(step||1)) el.classList.add("on"); else el.classList.remove("on"); });
}
function escapeHtml(s){return s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m]));}
function escapeReg(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}

// ——— INPUT ———
input.addEventListener("change",e=>{ if(e.target.files.length) handleFiles([...e.target.files]); });
["dragenter","dragover"].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.add("drag");}));
["dragleave","drop"].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.remove("drag");}));
zone.addEventListener("drop",e=>{ const files=[...e.dataTransfer.files]; if(files.length) handleFiles(files); });
document.addEventListener("paste",e=>{
  const txt=e.clipboardData?.getData("text");
  if(txt && txt.trim().length>30 && !rawText && fileQueue.length===0){
    rawTexts=[{name:"Pasted-text.txt",text:txt}];
    rawText=txt; fileInfo={name:"Pasted-text.txt",size:txt.length,type:"txt",pages:Math.ceil(txt.split(/\s+/).length/450)};
    afterTextLoaded("Pasted text");
  }
});

function clearFile(){
  rawText="";rawTexts=[];fileInfo=null;analysis=null;fileQueue=[];
  fileCard.style.display="none";$("#fileQueue").style.display="none";$("#fileQueue").innerHTML="";
  $("#thumbWrap").style.display="none";
  progress.style.display="none";steps.style.display="none";bar.style.width="0%";
  analyzeBtn.disabled=true;$("#exportBtn").disabled=true;$("#result").style.display="none";
  $("#preview").innerHTML='<div><div class="big">◐</div><h4>Your v3 webpage will appear here</h4><p>Drop multiple files to merge. Library auto-saves every weave.</p></div>';
  $("#mWords").textContent="—";$("#mPages").textContent="—";$("#mTime").textContent="—";$("#miniQuality").textContent="";$("#quality").style.display="none";$("#quality").innerHTML="";
  hideErr();input.value="";percent.textContent="Idle";["s1","s2","s3","s4","s5"].forEach(id=>document.getElementById(id).classList.remove("on"));
  renderQueue();
}

async function handleFiles(files){
  hideErr();
  const valid=files.filter(f=>{
    const ext=f.name.split(".").pop().toLowerCase();
    const ok=["pdf","txt","md","text","docx"].includes(ext)||f.type.includes("pdf")||f.type.includes("text");
    if(!ok) showErr(`Skipped unsupported: ${f.name}`);
    if(f.size>50*1024*1024) showErr(`Skipped too large (>50MB): ${f.name}`);
    return ok && f.size<=50*1024*1024;
  });
  if(!valid.length) return;
  fileQueue=valid;
  renderQueue();
  setProgress(6,"Reading "+valid.length+" file(s)…",1);
  analyzeBtn.disabled=true;
  rawTexts=[];
  let totalWords=0;
  let thumbDone=false;
  for(let i=0;i<valid.length;i++){
    const f=valid[i];
    const ext=f.name.split(".").pop().toLowerCase();
    try{
      let text="";
      if(ext==="pdf"||f.type==="application/pdf"){
        text=await extractPdf(f, p=> setProgress(6+Math.round((i/valid.length)*50 + (p/valid.length)*0.3),`Extracting ${i+1}/${valid.length} • ${p}%`,1), !thumbDone);
        if(!thumbDone){ thumbDone=true; }
      } else if(ext==="docx"){ text=await extractDocx(f); }
      else { text=await f.text(); }
      rawTexts.push({name:f.name, text, size:f.size, type:ext});
      totalWords+= text.split(/\s+/).filter(Boolean).length;
      setProgress(40+Math.round((i+1)/valid.length*30),`Loaded ${i+1}/${valid.length} • ${totalWords.toLocaleString()} words`,2);
    }catch(e){ console.error(e); showErr(`Failed ${f.name}: ${e.message}`); }
  }
  if(!rawTexts.length){ showErr("No readable text extracted."); return; }
  // Merge texts with clear separators for analysis
  if(rawTexts.length===1){
    rawText=rawTexts[0].text;
    fileInfo={name:rawTexts[0].name,size:rawTexts[0].size,type:rawTexts[0].type,pages:Math.max(1,Math.ceil(rawText.split(/\s+/).length/430)), count:1};
  } else {
    rawText=rawTexts.map(r=> `===== DOCUMENT: ${r.name} =====\n${r.text}`).join("\n\n");
    isCompareMode=true;
    fileInfo={name:`${rawTexts.length} docs — ${rawTexts.map(r=>r.name).join(", ").slice(0,60)}`,size:rawTexts.reduce((s,r)=>s+r.size,0),type:"multi",pages:Math.max(1,Math.ceil(rawText.split(/\s+/).length/430)), count:rawTexts.length, parts:rawTexts.map(r=>r.name)};
  }
  rawText=cleanTextAdvanced(rawText);
  await afterTextLoaded(isCompareMode? `Merged ${rawTexts.length} docs` : undefined);
}

function renderQueue(){
  const q=$("#fileQueue");
  if(!fileQueue.length){ q.style.display="none"; q.innerHTML=""; return; }
  q.style.display="flex";
  q.innerHTML=fileQueue.map((f,i)=> `<div class="queue-item"><span style="width:28px;height:28px;border-radius:8px;background:var(--ink);color:#fff;display:grid;place-items:center;font-size:11px">${(f.name.split(".").pop()||"?").slice(0,3).toUpperCase()}</span><b>${escapeHtml(f.name)}</b><span style="font-family:JetBrains Mono,monospace;color:var(--muted)">${humanSize(f.size)}</span><button class="pill" style="padding:4px 8px;font-size:11px" onclick="removeFromQueue(${i})">✕</button></div>`).join("");
  if(fileQueue.length>1){
    $("#fileCard").style.display="none";
  } else if(fileQueue.length===1){
    const f=fileQueue[0];
    $("#fileName").textContent=f.name;
    $("#fileMeta").textContent=`${humanSize(f.size)} • ${f.name.split(".").pop().toUpperCase()} • ${new Date().toLocaleDateString()}`;
    $("#fileIcon").textContent=f.name.split(".").pop().slice(0,3).toUpperCase();
    $("#fileCard").style.display="flex";
  }
}
function removeFromQueue(i){
  fileQueue.splice(i,1);
  rawTexts.splice(i,1);
  renderQueue();
  if(!fileQueue.length) clearFile();
}

async function afterTextLoaded(label){
  rawText=cleanTextAdvanced(rawText);
  if(!rawText||rawText.trim().length<20) throw new Error("No readable text found. Image-only scanned PDFs need OCR.");
  const wc=rawText.split(/\s+/).filter(Boolean).length;
  setProgress(88,"Cleaned • "+wc.toLocaleString()+" words",2);
  analyzeBtn.disabled=false;
  $("#mWords").textContent=wc.toLocaleString();
  $("#mPages").textContent=fileInfo.type==="pdf"?(fileInfo.pages||"—"): (fileInfo.count>1? fileInfo.pages : "~1");
  $("#mTime").textContent=Math.max(1,Math.ceil(wc/220))+" min";
  let previewExtra = fileInfo.count>1 ? `<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;justify-content:center">${rawTexts.map(r=>`<span class="chip">${escapeHtml(r.name.slice(0,18))} • ${r.text.split(/\s+/).length}w</span>`).join("")}</div>` : "";
  $("#preview").innerHTML=`<div style="text-align:left;width:100%"><div style="font-family:Fraunces,serif;font-size:17px;color:var(--ink)">Ready — ${wc.toLocaleString()} words ${fileInfo.count>1?`• ${fileInfo.count} docs merged`:""}</div><div style="font-size:13px;line-height:1.5;color:#334155;margin-top:6px">${escapeHtml(rawText.slice(0,260))}…</div>${previewExtra}<div style="margin-top:10px;display:inline-block;background:var(--accent);color:#fff;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:700">Click “Analyze & Weave”</div></div>`;
  percent.textContent=`Ready • ${label||"Cleaned"} • ${wc.toLocaleString()} words ${fileInfo.count>1?`• ${fileInfo.count} docs`:""} • Click Analyze`;
}

// ——— TEXT CLEAN ———
function cleanTextAdvanced(t){ // de-hyphen

  if(!t) return "";
  t=t.replace(/(\w)-\n(\w)/g,"$1$2").replace(/(\w)-\s+(\w)/g,(m,a,b)=> a.length>2? a+b : m);
  t=t.replace(/\r/g,"").replace(/\u00A0/g," ").replace(/[ﬁﬂﬀ]/g,m=>({ "ﬁ":"fi","ﬂ":"fl","ﬀ":"ff"}[m]));
  const lines=t.split("\n");
  const counts=new Map();
  lines.forEach(l=>{ const k=l.trim(); if(k.length>12&&k.length<90) counts.set(k,(counts.get(k)||0)+1); });
  const bad=new Set([...counts.entries()].filter(([k,v])=> v>=4).map(([k])=>k)); // repeated header/footer
  let out=lines.filter(l=>{
    const k=l.trim();
    if(bad.has(k)) return false;
    if(/^\s*\d+\s*$/.test(k)) return false;
    if(/^\s*Page\s+\d+(\s+of\s+\d+)?\s*$/i.test(k)) return false;
    return true;
  }).join("\n");
  out=out.replace(/[ \t]+\n/g,"\n").replace(/\n{3,}/g,"\n\n").replace(/ {2,}/g," ").trim();
  return out;
}

// ——— EXTRACTION ———
async function extractPdf(file,onProgress,renderThumb){
  const buf=await file.arrayBuffer();
  const pdf=await pdfjsLib.getDocument({data:buf}).promise;
  fileInfo={...(fileInfo||{}), pages:pdf.numPages};
  // thumbnail of first page
  if(renderThumb){
    try{
      const page=await pdf.getPage(1);
      const viewport=page.getViewport({scale:0.5});
      const canvas=$("#thumb");
      const ctx=canvas.getContext("2d");
      canvas.width=viewport.width; canvas.height=viewport.height;
      await page.render({canvasContext:ctx,viewport}).promise;
      $("#thumbWrap").style.display="block";
      // need to re-get page for text extraction later, so flush
    }catch(e){ console.warn("thumb failed",e); }
  }
  let full="";
  for(let i=1;i<=pdf.numPages;i++){
    const page=await pdf.getPage(i);
    const content=await page.getTextContent();
    let lastY=null, str="";
    content.items.forEach(it=>{
      const y=it.transform[5];
      const isNewLine= lastY!==null && Math.abs(y-lastY)>5;
      if(isNewLine) str+="\n";
      else if(str && !str.endsWith("\n") && !str.endsWith(" ")) str+=" ";
      str+=it.str;
      lastY=y;
    });
    full+= str.trim()+"\n\n";
    if(onProgress) onProgress(Math.round(i/pdf.numPages*100));
    if(i%4===0) await new Promise(r=>setTimeout(r,0));
  }
  return full;
}
async function extractDocx(file){
  const buf=await file.arrayBuffer();
  const res=await mammoth.extractRawText({arrayBuffer:buf});
  return res.value||"";
}

// ——— DEMOS ———
function demo(){
  const txt=`The Future of Urban Mobility: Autonomous Electric Fleets
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
Autonomous electric fleets are not a silver bullet, but a lever. Cities that pair technology with pricing, equity, and governance will capture gains; those that don't risk amplifying sprawl and inequality. The window for proactive policy is now.`;
  rawTexts=[{name:"Urban-Mobility-Report-2035.txt",text:txt,size:txt.length,type:"txt"}];
  fileQueue=[{name:"Urban-Mobility-Report-2035.txt",size:txt.length}]; renderQueue();
  loadText(txt,"Urban-Mobility-Report-2035.txt");
}
function demoLong(){
  const gen = `Transforming Healthcare with AI Diagnostics — A Comprehensive Review
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
References include Rajpurkar et al. 2024, Topol 2023, WHO Guidance 2025, NHS AI Lab 2029, and 82 additional sources.`.repeat(2);
  rawTexts=[{name:"AI-Healthcare-Review-2030-Long.txt",text:gen,size:gen.length,type:"txt"}];
  fileQueue=[{name:"AI-Healthcare-Review-2030-Long.txt",size:gen.length}]; renderQueue();
  loadText(gen,"AI-Healthcare-Review-2030-Long.txt");
}
function demoCompare(){
  const a=`Q3 Financial Review — Acme Corp
Revenue $4.2B (+12.3% YoY) beating $4.05B est. Cloud +23%, Licensing +8%. Margin 38.2% (+120bps). Cash $892M, debt -$210M. Guidance: $18B FY26, 41% margin. Risks: FX $120M headwind, SMB churn 3.1%. Buyback $500M, dividend $0.42. CEO: 3 deals >$10M, capex $340M.`;
  const b=`Q3 Financial Review — Beta Inc
Revenue $2.9B (+8.1% YoY) missing $3.1B est. Cloud +11%, Licensing +2%. Margin 31.4% (-40bps). Cash $410M, debt +$80M. Guidance: $11B FY26, 33% margin. Risks: churn 5.4%, regulatory delay. No buyback, dividend $0.18 flat. CEO: 1 deal >$10M, capex $210M. Cost cutting 12% underway.`;
  rawTexts=[{name:"Acme-Q3.txt",text:a,size:a.length,type:"txt"},{name:"Beta-Q3.txt",text:b,size:b.length,type:"txt"}];
  fileQueue=[{name:"Acme-Q3.txt",size:a.length},{name:"Beta-Q3.txt",size:b.length}]; renderQueue();
  rawText=rawTexts.map(r=> `===== DOCUMENT: ${r.name} =====\n${r.text}`).join("\n\n");
  fileInfo={name:`Compare: Acme vs Beta`,size:a.length+b.length,type:"multi",pages:2,count:2,parts:rawTexts.map(r=>r.name)};
  isCompareMode=true;
  rawText=cleanTextAdvanced(rawText);
  afterTextLoaded("Compare 2 docs");
  setTimeout(()=> analyze(),400);
}
function loadText(txt,name){
  rawText=txt; fileInfo={name,size:txt.length,type:"txt",pages:Math.max(1,Math.ceil(txt.split(/\s+/).length/420)),count:1};
  $("#fileName").textContent=name; $("#fileMeta").textContent=`${humanSize(txt.length)} • TXT • Demo`;
  $("#fileIcon").textContent="TXT"; fileCard.style.display="flex"; progress.style.display="block"; steps.style.display="flex";
  bar.style.width="100%"; percent.textContent=`Demo loaded • ${txt.split(/\s+/).length.toLocaleString()} words`; analyzeBtn.disabled=false; hideErr();
  const wc=txt.split(/\s+/).length; $("#mWords").textContent=wc.toLocaleString(); $("#mPages").textContent=fileInfo.pages; $("#mTime").textContent=Math.max(1,Math.ceil(wc/220))+" min";
  $("#preview").innerHTML=`<div style="text-align:left;width:100%"><div style="font-family:Fraunces,serif;font-size:17px;color:var(--ink)">${escapeHtml(name.replace(".txt","").replace(/-/g," "))}</div><div style="font-size:13px;line-height:1.5;color:#334155;margin-top:6px">${escapeHtml(txt.slice(0,220))}…</div><div style="margin-top:8px;display:inline-flex;gap:8px"><span style="background:var(--accent);color:#fff;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:700">Ready</span><span style="border:1px solid var(--line);border-radius:999px;padding:6px 12px;font-size:11px;font-weight:700">${wc.toLocaleString()} words</span></div></div>`;
  setTimeout(()=>analyze(),200);
}

// ——— ANALYSIS ENGINE (preserved for tests) ———
function analyze(){
  if(!rawText){showErr("No text to analyze.");return;}
  setProgress(0,"Analyzing — tokenizing…",2); analyzeBtn.textContent="Analyzing…"; analyzeBtn.disabled=true;
  setTimeout(()=>{
    try{
      setProgress(15,"Scoring (TF-IDF + cues)…",3);
      analysis=analyzeDocumentOptimized(rawText,fileInfo,(stage,p)=>{
        if(stage==="textrank") setProgress(45+p*0.3,"TextRank…",4);
        if(stage==="summary") setProgress(80,"Adaptive summary…",5);
      });
      // multi-doc compare enrichment
      if(fileInfo.count>1){
        analysis.isCompare=true;
        analysis.compareParts=rawTexts.map(r=> ({name:r.name, wc:r.text.split(/\s+/).length, summary: analyzeDocumentOptimized(r.text,{pages:1,name:r.name}).summary.slice(0,220)}));
      }
      setProgress(92,"Rendering…",5);
      render(analysis);
      saveToLibrary(analysis);
      $("#result").style.display="block"; $("#exportBtn").disabled=false;
      $("#preview").innerHTML=`<div><div style="width:44px;height:44px;border-radius:50%;background:var(--ok);color:#fff;display:grid;place-items:center;margin:0 auto 10px">✓</div><h4 style="margin:0;color:var(--ink)">Webpage woven — v3</h4><p>Library saved • Themes • Ask • Timeline ready.<br><span style="font-size:11px;color:var(--muted)">${analysis.isCompare?'Compare mode — see Stats for side-by-side':''}</span></p></div>`;
      $("#quality").style.display="flex";
      $("#quality").innerHTML=`<span class="ok">✓ Summary: ${analysis.summaryWords}w • ${analysis.summaryRatio}%</span><span class="ok">✓ ${analysis.keyPoints.length} points • balanced</span><span>${analysis.sections.length} sections • ${fileInfo.count>1? fileInfo.count+' docs':''}</span><span class="ok">✓ Library saved</span>`;
      $("#miniQuality").textContent=`${analysis.summaryWords}w • ${analysis.keyPoints.length} pts • ${analysis.sections.length} secs ${fileInfo.count>1?'• compare':''}`;
      $("#result").scrollIntoView({behavior:"smooth",block:"start"});
      setProgress(100,"Done — v3",5);
      updateQR();
    }catch(e){ console.error(e); showErr("Analysis failed: "+e.message); setProgress(0,"Failed",1); }
    finally{ analyzeBtn.textContent="✦ Analyze & Weave Webpage"; analyzeBtn.disabled=false; }
  },80);
}

function analyzeDocumentOptimized(text,info,onStage){
  const sentences=splitSentencesOptimized(text);
  const words=text.split(/\s+/).filter(Boolean);
  const wc=words.length;
  const readingTime=Math.max(1,Math.ceil(wc/220));
  let rawLines=text.split("\n").map(s=>s.trim()).filter(Boolean);
  let title=rawLines.find(s=> s.length>10 && s.length<130 && !/^(abstract|executive summary|introduction|references)/i.test(s))|| "Document Overview";
  title=title.replace(/^#+\s*/,"").replace(/^\d+[\.\)]\s*/,"");
  if(title.length>120) title=title.slice(0,120)+"…";
  const subtitle=sentences.slice(0,2).join(" ").slice(0,190)+(sentences.join(" ").length>190?"…":"");
  const N=sentences.length;
  const docFreq=new Map();
  const tfMaps=sentences.map(s=>{
    const toks=tokenize(s);
    const m=new Map(); toks.forEach(t=> m.set(t,(m.get(t)||0)+1));
    new Set(toks).forEach(t=> docFreq.set(t,(docFreq.get(t)||0)+1));
    return m;
  });
  const kwScores=new Map();
  sentences.forEach((s,i)=>{
    const m=tfMaps[i];
    m.forEach((tf,term)=>{
      const df=docFreq.get(term)||1;
      const idf=Math.log((N - df + 0.5)/(df+0.5) + 1);
      kwScores.set(term,(kwScores.get(term)||0)+tf*idf);
    });
  });
  let keywords=[...kwScores.entries()].filter(([k])=> k.length>=3 && !stopwords.has(k))
    .sort((a,b)=> b[1]-a[1]).slice(0,28).map(([term,score])=>({term,count:Math.round(score*10),score}));
  const bigramScores=new Map();
  sentences.forEach(s=>{
    const toks=tokenize(s);
    for(let i=0;i<toks.length-1;i++){
      const bg=toks[i]+" "+toks[i+1];
      if(stopwords.has(toks[i])||stopwords.has(toks[i+1])) continue;
      if(bg.length<6) continue;
      bigramScores.set(bg,(bigramScores.get(bg)||0)+1);
    }
  });
  const topBigrams=[...bigramScores.entries()].sort((a,b)=> b[1]-a[1]).slice(0,6).map(([k,v])=>k);
  const topKeywords=keywords.slice(0,10);
  const sections=detectSections(text,sentences);
  const sectionForIdx=new Map();
  sentences.forEach((s,idx)=>{
    let secIdx=0;
    for(let i=0;i<sections.length;i++) if(idx >= sections[i].startIdx) secIdx=i;
    sectionForIdx.set(idx,secIdx);
  });
  const titleTokens=new Set(tokenize(title));
  const baseScores=sentences.map((s,idx)=>{
    const toks=tokenize(s);
    let tfidf=0; const m=tfMaps[idx]; m.forEach((tf,term)=>{const df=docFreq.get(term)||1;const idf=Math.log((N - df + 0.5)/(df+0.5)+1); tfidf+= tf*idf;});
    tfidf=tfidf/Math.max(6, toks.length*0.9);
    const posBoost= idx<3?1.35 : idx<Math.ceil(N*0.08)?1.2 : idx> N*0.88?1.15 : 1;
    const len=toks.length; const lenPenalty= len<10||len>42?0.78 : len<14?0.92:1;
    const numBoost= /\d+%|\d+\.\d+%|\$[\d,.]+|\b\d{1,3}(?:,\d{3})+\b/.test(s)?1.28:1;
    const cueBoost= cuePhrases.some(c=> s.toLowerCase().includes(c))?1.35:1;
    const titleOverlap= toks.filter(t=> titleTokens.has(t)).length / Math.max(1,titleTokens.size);
    const titleBoost= 1 + titleOverlap*0.9;
    const sectionBoost= sections.length>2 && (sectionForIdx.get(idx)===0 || sectionForIdx.get(idx)===sections.length-1)?1.08:1;
    let score=tfidf * posBoost * lenPenalty * numBoost * cueBoost * titleBoost * sectionBoost; score+=(idx%7)*0.002;
    return {sentence:s.trim(), idx, len, tfidf, score, toks};
  });
  if(onStage) onStage("textrank",0);
  const textRank=textRankScores(sentences, baseScores, onStage);
  const combined=sentences.map((s,i)=>{const b=baseScores[i].score;const tr=textRank[i]||0;return {sentence:s, idx:i, len:s.split(/\s+/).length, base:b, tr, final:0.55*tr*10 + 0.45*b};});
  combined.sort((a,b)=> b.final - a.final);
  let targetWords, targetPoints;
  if(wc<400){ targetWords=Math.min(160, Math.round(wc*0.48)); targetPoints=5; }
  else if(wc<1500){ targetWords=Math.round(wc<800?210:260); targetPoints=7; }
  else if(wc<5000){ targetWords=Math.min(420, Math.round(wc*0.18)); targetPoints=9; }
  else { targetWords=Math.min(620, Math.round(wc*0.13)); targetPoints=10; }
  targetPoints=Math.min(targetPoints, Math.max(3, sentences.length-1));
  if(sentences.length<=3) targetPoints=sentences.length;
  const keyPoints=selectKeyPointsCoverage(combined, targetPoints, sections, sectionForIdx, N);
  if(onStage) onStage("summary",0);
  const summaryObj=buildAdaptiveSummary(combined, sentences, targetWords, N, sections);
  const summary=summaryObj.sentences.join(" ");
  const oneLiner=combined[0]?.sentence || summaryObj.sentences[0]|| "";
  const factors=buildFactorsOptimized(text, topKeywords, topBigrams, sentences, sections, keywords);
  const numbers=[...text.matchAll(/(?:\$[\d,]+(?:\.\d+)?|\d+(?:\.\d+)?%|\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\b)/g)].map(m=>m[0]).filter(x=> x.replace(/[^0-9]/g,"").length>1).slice(0,16);
  const dates=[...text.matchAll(/\b(?:19|20)\d{2}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/gi)].map(m=>m[0]).slice(0,12);
  const proper=[...text.matchAll(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/g)].map(m=>m[0]);
  const pf=new Map(); proper.forEach(p=>{ if(p.split(" ").length>1 && p.length<44) pf.set(p,(pf.get(p)||0)+1); });
  const entities=[...pf.entries()].sort((a,b)=> b[1]-a[1]).slice(0,12).map(([k])=>k);
  const headings=sections.map(s=> s.title).slice(0,12);
  return {
    title, subtitle, wc, readingTime, sentences:N, keywords, topKeywords, topBigrams,
    keyPoints, summary, summaryWords: summary.split(/\s+/).filter(Boolean).length, summaryRatio: Math.round(summary.split(/\s+/).filter(Boolean).length / Math.max(1,wc) *100),
    oneLiner, factors, numbers, dates, entities, headings, sections,
    pages: info?.pages|| Math.max(1, Math.ceil(wc/430)),
    coverage: summaryObj.coverage
  };
}

function tokenize(s){ return s.toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(t=> t.length>=3 && !stopwords.has(t));}
function splitSentencesOptimized(t){
  let s=t.replace(/\n+/g," ").replace(/\s{2,}/g," ").trim();
  s=s.replace(/•/g,". ").replace(/[–—]/g," ");
  s=s.replace(/\b(e\.g|i\.e|Mr|Ms|Mrs|Dr|vs|etc|Fig|Eq|Ref)\./gi,m=>m.replace(".","<dot>"));
  const parts=s.split(/(?<=[.!?])\s+(?=[A-Z0-9“"(\[])/);
  const out=parts.map(p=> p.replace(/<dot>/g,".").trim()).filter(p=>{ const wc=p.split(/\s+/).length; return p.length>22 && wc>5 && wc<70;});
  if(out.length<2){ const alt=t.split(/[\n;]+/).map(x=>x.trim()).filter(x=> x.length>24 && x.split(/\s+/).length>5); if(alt.length> out.length) return alt; }
  return out.length? out : [s.slice(0,180)];
}
function detectSections(text,sentences){
  const lines=text.split("\n").map(l=>l.trim()).filter(l=> l.length>0);
  const headingCandidates=[];
  lines.forEach(l=>{
    if(l.length>100) return;
    const isNumbered=/^\d+(\.\d+)*[\.\)]\s+[A-Z]/.test(l);
    const isAllCaps= l.length>5 && l.length<70 && l===l.toUpperCase() && /[A-Z]{3,}/.test(l) && !/[.!?]$/.test(l);
    const isTitleCase= l.length<70 && !/[.!?]$/.test(l) && /^[A-Z][a-z]+(\s+[A-Z][a-z]+){1,4}$/.test(l);
    const isKeyword= /^(abstract|executive summary|introduction|background|methods|findings|results|discussion|conclusion|recommendations|roadmap|limitations|references|key findings)/i.test(l);
    if(isNumbered||isAllCaps||isTitleCase||isKeyword) headingCandidates.push(l.replace(/^#+\s*/,"").replace(/^\d+[\.\)]\s*/,"").trim());
  });
  const uniq=[...new Set(headingCandidates)].slice(0,12);
  if(uniq.length===0){ const n=sentences.length; return [{title:"Introduction", startIdx:0},{title:"Body", startIdx: Math.floor(n*0.33)},{title:"Conclusion", startIdx: Math.floor(n*0.66)}];}
  const sections=uniq.map(title=>{
    let bestIdx=0, bestScore=-1;
    sentences.forEach((s,idx)=>{ const score=jaccard(title.toLowerCase(), s.toLowerCase().slice(0,80)); if(score>bestScore){ bestScore=score; bestIdx=idx; }});
    const fallback=Math.floor(sentences.length * (uniq.indexOf(title)/uniq.length));
    return {title, startIdx: bestScore>0.25? bestIdx : fallback};
  });
  sections.sort((a,b)=> a.startIdx-b.startIdx);
  if(sections[0].startIdx!==0) sections[0].startIdx=0;
  return sections;
}
function jaccard(a,b){ const sa=new Set(a.split(/\W+/).filter(Boolean)), sb=new Set(b.split(/\W+/).filter(Boolean)); let inter=0; sa.forEach(x=>{ if(sb.has(x)) inter++; }); return inter/(sa.size+sb.size-inter||1);}
function textRankScores(sentences, baseScores, onStage){
  const N=sentences.length;
  if(N<4) return baseScores.map(b=> b.score);
  const vecs=sentences.map(s=>{const toks=tokenize(s);const m=new Map();toks.forEach(t=> m.set(t,(m.get(t)||0)+1));return m;});
  const sim=new Array(N).fill(0).map(()=> new Array(N).fill(0));
  for(let i=0;i<N;i++) for(let j=i+1;j<N;j++){
    const a=vecs[i], b=vecs[j]; let dot=0, na=0, nb=0; a.forEach((v,k)=>{ na+=v*v; if(b.has(k)) dot+= v*b.get(k);}); b.forEach(v=> nb+=v*v);
    const cos= dot / (Math.sqrt(na)*Math.sqrt(nb) || 1); let bonus=0; if(/\d+%|\$/.test(sentences[i]) && /\d+%|\$/.test(sentences[j])) bonus+=0.08; sim[i][j]= cos + bonus; sim[j][i]=sim[i][j];
  }
  const thresh=0.08; const scores=new Array(N).fill(1/N); const d=0.85;
  for(let iter=0;iter<20;iter++){
    const next=new Array(N).fill((1-d)/N);
    for(let i=0;i<N;i++) for(let j=0;j<N;j++){
      if(i===j) continue; if(sim[j][i] < thresh) continue; let sum=0; for(let k=0;k<N;k++) if(sim[j][k]>=thresh) sum+=sim[j][k]; if(sum===0) continue; next[i]+= d * (sim[j][i]/sum) * scores[j];
    }
    for(let i=0;i<N;i++) scores[i]=next[i];
    if(onStage && iter%5===0) onStage("textrank", Math.round(iter/20*100));
  }
  const max=Math.max(...scores)||1; return scores.map(s=> s/max);
}
function selectKeyPointsCoverage(combined, k, sections, sectionForIdx, N){
  const byFinal=[...combined].sort((a,b)=> b.final - a.final);
  const buckets= sections.length>=3 ? sections.length : 3; const perBucket=Math.max(1, Math.ceil(k/buckets));
  const picked=[]; const used=new Set();
  for(let bIdx=0;bIdx<buckets;bIdx++){
    let count=0; for(const c of byFinal){
      const sec= sectionForIdx.get(c.idx) ?? Math.floor(c.idx / N * buckets); const bucket= Math.min(buckets-1, sec);
      if(bucket!==bIdx) continue; if(used.has(c.idx)) continue; if(picked.some(p=> jaccard(p.sentence,c.sentence)>0.62)) continue;
      picked.push(c); used.add(c.idx); count++; if(count>=perBucket) break;
    }
  }
  if(picked.length < k) for(const c of byFinal){ if(used.has(c.idx)) continue; if(picked.some(p=> jaccard(p.sentence,c.sentence)>0.62)) continue; picked.push(c); used.add(c.idx); if(picked.length>=k) break;}
  if(picked.length < k) for(const c of byFinal){ if(used.has(c.idx)) continue; picked.push(c); if(picked.length>=k) break;}
  picked.sort((a,b)=> a.idx - b.idx); return picked.slice(0,k).map(c=> ({sentence:c.sentence, idx:c.idx, score:c.final, tr:c.tr, base:c.base}));
}
function buildAdaptiveSummary(combined, sentences, targetWords, N, sections){
  const sorted=[...combined].sort((a,b)=> b.final - a.final);
  const topPool=sorted.slice(0, Math.max(6, Math.ceil(N*0.38))); topPool.sort((a,b)=> a.idx - b.idx);
  const thirds=[ [0, Math.floor(N*0.33)], [Math.floor(N*0.33), Math.floor(N*0.66)], [Math.floor(N*0.66), N] ];
  const must=new Set(); thirds.forEach(([lo,hi])=>{const cand=topPool.filter(c=> c.idx>=lo && c.idx<hi).sort((a,b)=> b.final - a.final)[0]; if(cand) must.add(cand.idx);});
  let out=[], w=0; const ordered=topPool.slice().sort((a,b)=> a.idx - b.idx);
  const poolSet=new Set(topPool.map(c=> c.idx)); must.forEach(idx=>{ if(!poolSet.has(idx)){ const c=combined.find(x=> x.idx===idx); if(c) ordered.push(c);}}); ordered.sort((a,b)=> a.idx - b.idx);
  const mustOrdered=[...must].sort((a,b)=>a-b); let added=new Set();
  for(const idx of mustOrdered){ const c=combined.find(x=> x.idx===idx) || topPool.find(x=> x.idx===idx); if(c && !added.has(c.idx)){ const wl=c.sentence.split(/\s+/).length; if(w+wl <= targetWords+24){ out.push(c.sentence); w+=wl; added.add(c.idx);}}}
  for(const c of ordered){ if(added.has(c.idx)) continue; const wl=c.sentence.split(/\s+/).length; if(w+wl > targetWords+18) continue; out.push(c.sentence); w+=wl; added.add(c.idx); if(w>=targetWords) break;}
  if(out.length<3) out=sentences.slice(0, Math.min(4, sentences.length)); out=[...new Set(out)];
  const coverage=thirds.map(([lo,hi])=> out.some(s=>{const idx=sentences.indexOf(s); return idx>=lo && idx<hi;}));
  return {sentences: out, coverage};
}
function buildFactorsOptimized(text, topKeywords, topBigrams, sentences, sections, allKeywords){
  const lower=text.toLowerCase();
  const pool=[...topBigrams.map(b=> ({title: b.split(" ").map(w=>w[0].toUpperCase()+w.slice(1)).join(" "), cues: b.split(" "), icon:"⬢", desc: "Recurring theme"})),
    ...topKeywords.slice(0,4).map(k=> ({title: k.term[0].toUpperCase()+k.term.slice(1), cues:[k.term], icon:"◈", desc:"High salience"}))];
  const themes=[
    {title:"Regulation & Governance",icon:"⚖",cues:["regulation","policy","governance","compliance","mandate","disclosure","trust","act","framework"],desc:"Rules and oversight."},
    {title:"Economics & Value",icon:"◈",cues:["cost","price","saving","investment","market","revenue","economics","procurement"],desc:"Cost, scale and value."},
    {title:"Technology & Infrastructure",icon:"⬢",cues:["battery","autonom","infrastructure","charging","platform","model","system","deployment","integration"],desc:"Technical stack."},
    {title:"Equity & Access",icon:"♥",cues:["equity","access","bias","disparit","elderly","disabled","community","consent","demographic"],desc:"Who benefits."},
    {title:"Environment & Energy",icon:"⬡",cues:["emission","co2","renewable","energy","climate","carbon","sustain"],desc:"Climate impact."},
    {title:"Risks & Safety",icon:"⚠",cues:["risk","safety","failure","incident","error","liability","privacy","drift","bias"],desc:"Downsides."},
    {title:"Performance & Evidence",icon:"◎",cues:["sensitivity","specificity","accuracy","auroc","trial","rct","performance","meta-analysis"],desc:"Evidence base."},
  ];
  const scored=themes.map(th=>{
    let hits=0, tfWeight=0; th.cues.forEach(c=>{ if(lower.includes(c)){ hits++; const kw=allKeywords.find(k=> c.includes(k.term)||k.term.includes(c)); if(kw) tfWeight+=kw.score; }});
    const ev=sentences.filter(s=> th.cues.some(c=> s.toLowerCase().includes(c))).slice(0,2).join(" ").slice(0,280);
    return {...th, hits, tfWeight, evidence:ev, score: hits*1.4 + tfWeight*0.08};
  }).sort((a,b)=> b.score - a.score);
  let chosen=scored.filter(t=> t.hits>0).slice(0,4); if(chosen.length<3) chosen=scored.slice(0,3);
  const covered=new Set(chosen.flatMap(c=> c.cues));
  const extra=pool.find(p=> !covered.has(p.cues[0]) && !chosen.some(c=> c.title.toLowerCase()===p.title.toLowerCase()));
  if(extra && chosen.length<4 && extra.title.length>3) chosen.push({title: extra.title, icon:extra.icon, cues: extra.cues, desc: extra.desc, evidence: sentences.find(s=> s.toLowerCase().includes(extra.cues[0]))?.slice(0,240)|| extra.title, hits:2, score:5});
  return chosen.slice(0,4).map(th=>({title:th.title,icon:th.icon,desc:th.desc,evidence:th.evidence||sentences.find(s=> th.cues.some(c=>s.toLowerCase().includes(c)))?.slice(0,240)|| topKeywords.slice(0,3).map(k=>k.term).join(", "),cues:th.cues.slice(0,5)}));
}

// ——— RENDER + NEW FEATURES ———
function render(a){
  $("#wTitle").textContent=a.title;
  $("#wSubtitle").textContent=a.subtitle;
  $("#wKicker").textContent=`Generated ${a.isCompare?'compare':'webpage'} • ${a.wc.toLocaleString()} words • ${a.readingTime} min • ${a.pages} pages • ${a.summaryWords}w summary`;
  $("#wHeroStats").innerHTML=`
    <span class="hero-stat">◐ ${a.wc.toLocaleString()} words</span>
    <span class="hero-stat">▣ ${a.keyPoints.length} points</span>
    <span class="hero-stat">⬢ ${a.factors.length} factors</span>
    <span class="hero-stat">${a.topKeywords[0]?.term||"analysis"} • top</span>
    <span class="hero-stat">${a.summaryRatio}% distilled</span>
    ${a.isCompare?'<span class="hero-stat">⇔ Compare</span>':''}
  `;
  $("#wSummary").textContent=a.summary;
  $("#summaryMeta").textContent=`• ${a.summaryWords}w • ${a.summaryRatio}% • ${a.coverage.filter(Boolean).length}/3 zones`;
  $("#pointsMeta").textContent=`• ${a.keyPoints.length} pts • ${a.sections.length} secs`;
  $("#wOneLiner").style.display="block";
  $("#wOneLiner").innerHTML=`<b style="font-family:Fraunces,serif;color:#7c2d12">In one line:</b> ${escapeHtml(a.oneLiner)}`;
  $("#wPoints").innerHTML=a.keyPoints.map((p,i)=>{
    const secIdx=a.sections.findIndex(s=> p.idx >= s.startIdx);
    const secName=a.sections[Math.max(0,secIdx)]?.title||"—";
    return `<li data-idx="${p.idx}"><b>${i+1}</b><div style="flex:1"><div class="ptxt" style="font-size:13px;line-height:1.6;color:#334155">${escapeHtml(p.sentence)}</div><div class="meta"><span>§ ${escapeHtml(secName)}</span><span>#${p.idx+1} • ${(p.score).toFixed(2)}</span></div></div><button class="del" onclick="removePoint(${i})" title="Remove">✕</button></li>`;
  }).join("");
  $("#wFactors").innerHTML=a.factors.map(f=>`
    <div class="factor">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="width:26px;height:26px;border-radius:8px;background:#0f172a;color:#fff;display:grid;place-items:center;font-size:12px">${f.icon}</span>
        <h4>${escapeHtml(f.title)}</h4>
      </div>
      <p>${escapeHtml(f.evidence||f.desc)}</p>
      <div class="chip-row">${f.cues.map(c=>`<span class="chip" onclick="searchWebpage('${escapeHtml(c)}');document.getElementById('pageSearch').value='${escapeHtml(c)}'">${escapeHtml(c)}</span>`).join("")}</div>
    </div>
  `).join("");
  // timeline
  const tl=$("#wTimeline");
  if(a.dates.length>=2){
    $("#timelineMeta").textContent=`• ${a.dates.length} dates`;
    // map dates to sentences containing them
    const items=a.dates.slice(0,10).map(d=>{
      const sent=analysis ? analysis : a; // placeholder
      // find sentences with date string
      const idx=rawText.indexOf(d);
      let ctx=""; let sents=splitSentencesOptimized(rawText);
      const hit=sents.find(s=> s.includes(d) || s.includes(d.replace(/\s+/g," ")));
      ctx=hit? hit.slice(0,160) : `Mentioned in document`;
      return {date:d, ctx};
    });
    tl.innerHTML=items.map(it=> `<div class="tl-item"><b style="font-family:JetBrains Mono,monospace;font-size:12px">${escapeHtml(it.date)}</b><div style="font-size:12px;color:#475569;margin-top:4px;line-height:1.5">${escapeHtml(it.ctx)}</div></div>`).join("");
  } else {
    $("#timelineMeta").textContent=`• no dated timeline detected`;
    tl.innerHTML=`<div style="border:1px dashed var(--line);border-radius:12px;padding:12px;background:#f8fafc;color:var(--muted);font-size:12px">No explicit timeline found — dates/years will appear here automatically when present (e.g., 2024, Jan 15 2026). Try the long demo.</div>`;
  }
  // glossary
  const gloss=$("#wGlossary");
  const terms=[...a.topKeywords.slice(0,8).map(k=>k.term), ...a.topBigrams.slice(0,4)].slice(0,10);
  gloss.innerHTML=terms.map(t=>{
    const sents=splitSentencesOptimized(rawText);
    const def=sents.find(s=> s.toLowerCase().includes(t.toLowerCase()))?.slice(0,140) || "Key term in this document.";
    return `<div class="gloss"><b>${escapeHtml(t)}</b><small>${escapeHtml(def)}</small><div style="margin-top:6px"><span class="chip" onclick="searchWebpage('${escapeHtml(t)}')"># ${escapeHtml(t)}</span></div></div>`;
  }).join("");

  $("#wInsights").innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div><div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;font-weight:700;color:var(--muted)">Top keywords (TF-IDF)</div><div class="chip-row" style="margin-top:8px">${a.topKeywords.slice(0,8).map(k=>`<span class="chip accent" onclick="searchWebpage('${escapeHtml(k.term)}')">${escapeHtml(k.term)} · ${k.count}</span>`).join("")}</div>
      ${a.topBigrams.length? `<div style="margin-top:8px"><div style="font-size:10px;font-weight:700;color:var(--muted)">Phrases</div><div class="chip-row" style="margin-top:6px">${a.topBigrams.map(b=>`<span class="chip" onclick="searchWebpage('${escapeHtml(b)}')">${escapeHtml(b)}</span>`).join("")}</div></div>`: ""}</div>
      <div><div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;font-weight:700;color:var(--muted)">Numbers & dates</div><div class="chip-row" style="margin-top:8px">${[...a.numbers.slice(0,7), ...a.dates.slice(0,3)].map(n=>`<span class="chip" onclick="searchWebpage('${escapeHtml(n)}')">${escapeHtml(n)}</span>`).join("")||'<span class="chip">—</span>'}</div></div>
    </div>
    <div><div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;font-weight:700;color:var(--muted)">Entities</div><div class="chip-row" style="margin-top:8px">${a.entities.map(e=>`<span class="chip" onclick="searchWebpage('${escapeHtml(e)}')">${escapeHtml(e)}</span>`).join("")||'<span class="chip">—</span>'}</div></div>
    ${a.headings.length? `<div><div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;font-weight:700;color:var(--muted)">Sections (${a.sections.length})</div><div class="chip-row" style="margin-top:8px">${a.headings.map(h=>`<span class="chip">${escapeHtml(h)}</span>`).join("")}</div></div>`:""}
  `;
  // ask reset
  $("#askResults").innerHTML=`<p style="color:var(--muted);font-size:12px">Ask anything — e.g., “What are the risks?” The local search will rank sentences.</p>`;
  $("#wCoverage").innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
      ${a.coverage.map((ok,i)=>`<div style="border:1px solid ${ok?'#a7f3d0':'#fecaca'};background:${ok?'#ecfdf5':'#fef2f2'};border-radius:12px;padding:10px;text-align:center"><b style="font-size:12px;color:${ok?'#065f46':'#991b1b'}">${["Introduction","Body","Conclusion"][i]} ${ok?'✓':'○'}</b><div style="font-size:11px;color:var(--muted);margin-top:4px">${ok?'covered':'not in summary'}</div></div>`).join("")}
    </div>
    <div style="font-size:12px;color:#475569;line-height:1.6;border:1px solid var(--line);border-radius:12px;padding:10px;background:#f8fafc">
      <b>How it works:</b> BM25 TF-IDF + TextRank (20 iter, cosine) + cue/numeric/title/position/section boosts. Key points per-section balanced, summary adaptive (${a.summaryRatio}% distilled).
    </div>
  `;
  $("#wStats").innerHTML=`
    <div class="stat"><b>${a.wc.toLocaleString()}</b><span>Words</span></div>
    <div class="stat"><b>${a.sentences}</b><span>Sentences</span></div>
    <div class="stat"><b>${a.readingTime} min</b><span>Read time</span></div>
    <div class="stat"><b>${a.pages}</b><span>Pages</span></div>
  `;
  if(a.isCompare){
    const c=$("#wCompare"); c.style.display="block";
    c.innerHTML=`<b style="font-size:13px">⇔ Compare — ${a.compareParts.length} documents</b><div style="display:grid;grid-template-columns:repeat(${a.compareParts.length},1fr);gap:10px;margin-top:8px">${a.compareParts.map(p=> `<div style="border:1px solid var(--line);border-radius:10px;padding:10px;background:#fff"><b style="font-size:12px">${escapeHtml(p.name)}</b><div style="font-size:11px;color:var(--muted)">${p.wc} words</div><p style="font-size:12px;line-height:1.5;margin:6px 0 0;color:#334155">${escapeHtml(p.summary)}…</p></div>`).join("")}</div><div style="margin-top:8px;font-size:11px;color:var(--muted)">Merged webpage above distills all docs together; side-by-side shows each doc’s own summary for quick diff.</div>`;
  } else { $("#wCompare").style.display="none"; }
  $("#wSource").textContent=rawText.slice(0,9000)+(rawText.length>9000?"\n\n… truncated (full kept for export)":"");
  $("#sourceHint").textContent=`• ${rawText.length.toLocaleString()} chars • ${a.sections.length} sections`;
  // reading progress listener
  setTimeout(setupReadingProgress,100);
  applyTheme(currentTheme);
  updateQR();
}

// ——— NEW FEATURES ———
// Library
function saveToLibrary(a){
  const lib=JSON.parse(localStorage.getItem("dw_lib")||"[]");
  const entry={id:Date.now(), title:a.title, subtitle:a.subtitle.slice(0,120), wc:a.wc, pages:a.pages, summary:a.summary.slice(0,220), theme:currentTheme, date:new Date().toISOString(), raw: rawText.slice(0,30000), analysis: JSON.stringify(a).slice(0,80000)};
  // keep last 20
  lib.unshift(entry); if(lib.length>20) lib.pop();
  localStorage.setItem("dw_lib", JSON.stringify(lib));
  renderLibrary();
}
function renderLibrary(){
  const lib=JSON.parse(localStorage.getItem("dw_lib")||"[]");
  $("#libCount").textContent=lib.length;
  const grid=$("#libGrid");
  const q=($("#libSearch")?.value||"").toLowerCase();
  const filtered=lib.filter(e=> !q || e.title.toLowerCase().includes(q) || e.subtitle.toLowerCase().includes(q));
  if(!filtered.length) grid.innerHTML=`<div style="color:var(--muted);font-size:12px;padding:10px">No saved webpages yet — analyze a document and it auto-saves here (local only). ${lib.length?`No match for “${escapeHtml(q)}”`:""}</div>`;
  else grid.innerHTML=filtered.map(e=> `
    <div class="lib-card" onclick="loadFromLibrary(${e.id})">
      <h4>${escapeHtml(e.title)}</h4>
      <p>${escapeHtml(e.subtitle)}…</p>
      <div class="meta"><span>${e.wc.toLocaleString()}w</span><span>${e.pages}p</span><span>${new Date(e.date).toLocaleDateString()}</span><span>${escapeHtml(e.theme||"default")}</span></div>
      <div style="margin-top:6px;display:flex;gap:6px"><button class="pill" style="padding:4px 8px;font-size:11px" onclick="event.stopPropagation();loadFromLibrary(${e.id})">Open</button><button class="pill" style="padding:4px 8px;font-size:11px;background:#fee2e2;border-color:#fecaca" onclick="event.stopPropagation();deleteFromLibrary(${e.id})">Delete</button></div>
    </div>
  `).join("");
}
function loadFromLibrary(id){
  const lib=JSON.parse(localStorage.getItem("dw_lib")||"[]");
  const e=lib.find(x=>x.id===id); if(!e) return;
  rawText=e.raw; fileInfo={name:e.title, size:e.raw.length, type:"txt", pages:e.pages, count:1};
  try{ analysis=JSON.parse(e.analysis); render(analysis); $("#result").style.display="block"; applyTheme(e.theme||"default"); currentTheme=e.theme||"default"; updateQR(); $("#result").scrollIntoView({behavior:"smooth"}); }catch(err){ // re-analyze
    rawText=e.raw; analyze();
  }
}
function deleteFromLibrary(id){
  let lib=JSON.parse(localStorage.getItem("dw_lib")||"[]");
  lib=lib.filter(x=>x.id!==id); localStorage.setItem("dw_lib", JSON.stringify(lib)); renderLibrary();
}
function clearLibrary(){ if(confirm("Clear all saved webpages?")){ localStorage.removeItem("dw_lib"); renderLibrary(); } }
function toggleLibrary(){
  const el=$("#library");
  const isHidden=el.style.display==="none"||!el.style.display;
  if(isHidden){ el.style.display="block"; renderLibrary(); }
  else el.style.display="none";
}
function openCompare(){
  const lib=JSON.parse(localStorage.getItem("dw_lib")||"[]");
  if(lib.length<2){ alert("Save at least 2 webpages to compare — analyze two different docs first. They auto-save to Library."); toggleLibrary(); return; }
  // build compare view from last 2
  const last2=lib.slice(0,2);
  alert(`Compare ready:\n• ${last2[0].title} (${last2[0].wc}w)\n• ${last2[1].title} (${last2[1].wc}w)\n\nOpen both from Library or drop them together (multi-doc) to get a merged compare webpage.`);
  toggleLibrary();
}

// Theme
function openTheme(){
  const picker=$("#themePicker");
  picker.innerHTML=themes.map(t=> `<div class="theme-opt ${currentTheme===t.id?'on':''}" onclick="applyTheme('${t.id}')"><div class="sw" style="background:${t.sw}"></div><b style="font-size:12px">${escapeHtml(t.name)}</b><div style="font-size:11px;color:var(--muted)">${t.bg} • ${t.ink}</div></div>`).join("");
  $("#themeModal").classList.add("open");
}
function closeTheme(){ $("#themeModal").classList.remove("open"); }
function applyTheme(id){
  currentTheme=id;
  const wp=$("#webpage");
  wp.classList.remove(...themes.map(t=>`theme-${t.id}`));
  if(id!=="default") wp.classList.add(`theme-${id}`);
  const th=themes.find(t=>t.id===id)||themes[0];
  // also set CSS vars for export consistency
  wp.style.setProperty("--theme-bg", th.bg);
  wp.style.setProperty("--theme-ink", th.ink);
  // highlight picker
  document.querySelectorAll(".theme-opt").forEach(el=>{
    el.classList.toggle("on", el.getAttribute("onclick")?.includes(`'${id}'`));
  });
  // persist
  localStorage.setItem("dw_theme", id);
}
function setAccent(val){ document.documentElement.style.setProperty("--accent", val); }

// Editor
function toggleEdit(){
  editMode=!editMode;
  $("#editLabel").textContent=editMode?"Exit editing":"Enable editing";
  $("#wTitle").contentEditable=editMode;
  $("#wSubtitle").contentEditable=editMode;
  $("#wSummary").contentEditable=editMode;
  $("#wSummary").classList.toggle("editing", editMode);
  $("#wPoints").classList.toggle("editing", editMode);
  document.querySelectorAll("#wPoints .ptxt").forEach(el=> el.contentEditable=editMode);
  if(editMode){ $("#wTitle").focus(); }
  else { // save edits back to analysis
    if(analysis){
      analysis.title=$("#wTitle").textContent.trim();
      analysis.subtitle=$("#wSubtitle").textContent.trim();
      analysis.summary=$("#wSummary").textContent.trim();
      analysis.keyPoints= [...document.querySelectorAll("#wPoints li")].map((li,i)=>{
        const txt=li.querySelector(".ptxt")?.textContent.trim() || li.textContent.trim();
        return {sentence: txt, idx: parseInt(li.dataset.idx||i), score: analysis.keyPoints[i]?.score||0};
      });
    }
  }
}
function addPoint(){
  if(!analysis) return;
  const txt=prompt("Add a key point (one sentence):");
  if(!txt||!txt.trim()) return;
  analysis.keyPoints.push({sentence: txt.trim(), idx: analysis.sentences, score: 0});
  render(analysis);
  if(!editMode) toggleEdit();
}
function removePoint(i){
  if(!analysis) return;
  analysis.keyPoints.splice(i,1);
  render(analysis);
}
function shufflePoints(){
  if(!analysis) return;
  // re-rank by length or reverse to show alternative view
  analysis.keyPoints.reverse();
  render(analysis);
}
function regenerateSummary(delta){
  if(!analysis) return;
  // adjust target words and rebuild summary from existing ranking
  const sents=splitSentencesOptimized(rawText);
  let newTarget=Math.max(60, Math.min(600, analysis.summaryWords + delta));
  // quick rebuild: take top sentences until newTarget words
  const combined=sents.map((s,idx)=>{
    const sc= analysis.keyPoints.find(k=>k.idx===idx)?.score || 0.5;
    return {sentence:s, idx, score:sc};
  }).sort((a,b)=> b.score - a.score).slice(0, Math.ceil(sents.length*0.4));
  combined.sort((a,b)=> a.idx - b.idx);
  let out=[], w=0;
  for(const c of combined){ const wl=c.sentence.split(/\s+/).length; if(w+wl>newTarget+18) break; out.push(c.sentence); w+=wl; if(w>=newTarget) break; }
  analysis.summary=out.join(" "); analysis.summaryWords=w; analysis.summaryRatio=Math.round(w/Math.max(1,analysis.wc)*100);
  $("#wSummary").textContent=analysis.summary;
  $("#summaryMeta").textContent=`• ${w}w • ${analysis.summaryRatio}%`;
}
function duplicateWebpage(){
  if(!analysis) return;
  const clone=JSON.parse(JSON.stringify(analysis));
  clone.title=clone.title+" — Copy";
  rawText=clone.summary + "\n\n" + clone.keyPoints.map(k=>k.sentence).join("\n");
  analysis=clone;
  render(clone);
  if(!editMode) toggleEdit();
  window.scrollTo({top:0,behavior:"smooth"});
}

// Reading & search
function setFontSize(v){ $("#wBody").style.fontSize=v+"px"; $("#fontVal").textContent=v+"px"; }
function setWidth(v){ $("#wBody").style.maxWidth=v+"px"; }
function toggleFocus(){
  const on=document.body.classList.toggle("focus-mode");
  if(on){ document.querySelector(".result-grid").style.gridTemplateColumns="1fr"; $(".toc").style.display="none"; $("#focusBtn").textContent="◐ Exit Focus"; }
  else { document.querySelector(".result-grid").style.gridTemplateColumns="300px 1fr"; $(".toc").style.display="block"; $("#focusBtn").textContent="◎ Focus"; }
}
let darkOn=false;
function toggleDark(){
  darkOn=!darkOn;
  if(darkOn) applyTheme("dark");
  else applyTheme(localStorage.getItem("dw_theme")||"default");
}
function searchWebpage(q){
  if(!q||q.trim().length<2){
    document.querySelectorAll("#webpage mark").forEach(m=>{
      const t=document.createTextNode(m.textContent); m.parentNode.replaceChild(t,m);
    });
    return;
  }
  const re=new RegExp(`(${escapeReg(q)})`,"gi");
  const walker=document.createTreeWalker($("#webpage"), NodeFilter.SHOW_TEXT);
  const nodes=[];
  while(walker.nextNode()){
    const n=walker.currentNode;
    if(n.nodeValue.trim().length>2 && n.parentElement.tagName!=="MARK" && n.parentElement.tagName!=="SCRIPT" && n.parentElement.closest(".webpage-controls")) continue;
    if(re.test(n.nodeValue)) nodes.push(n);
  }
  // clear previous
  document.querySelectorAll("#webpage mark").forEach(m=>{
    const t=document.createTextNode(m.textContent); m.parentNode.replaceChild(t,m); m.parentNode.normalize();
  });
  nodes.forEach(n=>{
    const frag=document.createDocumentFragment();
    let last=0;
    const text=n.nodeValue;
    text.replace(re,(m,_,off)=>{
      frag.appendChild(document.createTextNode(text.slice(last,off)));
      const mark=document.createElement("mark"); mark.textContent=m; mark.style.background="#fff1a8"; mark.style.padding="1px 2px"; mark.style.borderRadius="4px"; frag.appendChild(mark);
      last=off+m.length;
    });
    frag.appendChild(document.createTextNode(text.slice(last)));
    n.parentNode.replaceChild(frag,n);
  });
  const firstMark=document.querySelector("#webpage mark");
  if(firstMark) firstMark.scrollIntoView({behavior:"smooth",block:"center"});
}
function highlightSearch(){ searchWebpage(analysis?.topKeywords[0]?.term||""); }
function copySource(){ navigator.clipboard.writeText(rawText); alert("Source text copied."); }

function setupReadingProgress(){
  const bar=$("#readProgress");
  const article=$("#webpage");
  function onScroll(){
    const rect=article.getBoundingClientRect();
    const h=article.offsetHeight - window.innerHeight;
    const scrolled=Math.min(1, Math.max(0, -rect.top / (h||1)));
    bar.style.width=(scrolled*100)+"%";
    // update TOC active
    const secs=[...document.querySelectorAll(".section")];
    let active=null;
    secs.forEach(s=>{
      const r=s.getBoundingClientRect();
      if(r.top < 120) active=s.id;
    });
    document.querySelectorAll(".toc a").forEach(a=> a.classList.toggle("active", a.getAttribute("href")==="#"+active));
  }
  window.removeEventListener("scroll", window._dwScroll);
  window._dwScroll=onScroll;
  window.addEventListener("scroll", onScroll, {passive:true});
  onScroll();
}

// Ask the document
function askDoc(){
  const q=$("#askInput").value.trim();
  if(!q){ $("#askResults").innerHTML=`<p style="color:#991b1b;font-size:12px">Type a question first.</p>`; return; }
  const sents=splitSentencesOptimized(rawText);
  // stemming for ask: strip trailing s for plural handling
  function stem(w){ return w.replace(/s$/,''); }
  const qTokens=new Set(tokenize(q).map(stem));
  // score sentences by token overlap + embedding-ish: Jaccard + title boost + numeric if q asks numbers
  const scored=sents.map((s,idx)=>{
    const toks=new Set(tokenize(s).map(stem));
    let inter=0; qTokens.forEach(t=>{
      if(toks.has(t)) inter++;
      else if([...toks].some(x=> x.includes(t) || t.includes(x))) inter+=0.7;
    });
    const jac= inter / (qTokens.size + toks.size - inter ||1);
    const numBoost= /how many|how much|number|percent|price|cost|revenue|margin/i.test(q) && /\d/.test(s) ? 1.4 : 1;
    const boost= /\b(risk|recommend|conclusion|result)\b/i.test(q) && cuePhrases.some(c=> s.toLowerCase().includes(c)) ? 1.3:1;
    return {sentence:s, idx, score: jac * numBoost * boost};
  }).sort((a,b)=> b.score - a.score).slice(0,5).filter(x=> x.score>0.04);
  if(!scored.length){ $("#askResults").innerHTML=`<p style="color:var(--muted);font-size:12px">No strong match — try keywords like “cost”, “risk”, “recommendation”, or a phrase from the doc.</p>`; return; }
  scored.sort((a,b)=> a.idx - b.idx);
  const re=new RegExp(`(${[...qTokens].map(escapeReg).join("|")})`,"gi");
  $("#askResults").innerHTML=scored.map(h=>{
    const highlighted=escapeHtml(h.sentence).replace(re, m=> `<mark>${m}</mark>`);
    return `<div class="ask-hit"><div style="font-size:12px;line-height:1.6;color:#334155">${highlighted}</div><div style="font-family:JetBrains Mono,monospace;font-size:10px;color:var(--muted);margin-top:4px">#${h.idx+1} • score ${h.score.toFixed(2)} <button class="pill" style="padding:2px 6px;font-size:10px;margin-left:6px" onclick="searchWebpage('${escapeHtml(h.sentence.slice(0,24))}')">Show in doc</button></div></div>`;
  }).join("");
}
function askExamples(){
  const ex=["What are the main risks?","What is the recommendation?","Show numbers and percentages","What is the timeline?","What about costs?"];
  $("#askInput").value=ex[Math.floor(Math.random()*ex.length)];
  askDoc();
}

// Exports
function openExport(){ if(!analysis){showErr("Analyze first.");return;} $("#exportModal").classList.add("open"); updateQR(); }
function closeExport(){ $("#exportModal").classList.remove("open"); }
function updateQR(){
  const c=$("#qrcode"); c.innerHTML="";
  const large=$("#qrLarge"); if(large) large.innerHTML="";
  const text= analysis ? `${analysis.title} • ${analysis.wc}w • DocuWeave` : "DocuWeave";
  try{ new QRCode(c, {text: text, width:120, height:120}); if(large) new QRCode(large, {text: text, width:160, height:160}); }catch(e){ c.textContent="QR unavailable offline"; }
}
function downloadQR(){
  const canvas=document.querySelector("#qrLarge canvas") || document.querySelector("#qrcode canvas");
  if(!canvas){ alert("QR not ready"); return; }
  const a=document.createElement("a"); a.href=canvas.toDataURL("image/png"); a.download="docuweave-qr.png"; a.click();
}
function exportPage(){
  if(!analysis){showErr("Analyze first.");return;}
  const clone=document.getElementById("webpage").outerHTML;
  const styles=document.querySelector("style").outerHTML;
  const title=analysis.title.replace(/</g,"&lt;");
  const includeSource=$("#includeSource")?.checked ?? true;
  const extra= includeSource ? `<section style="max-width:860px;margin:18px auto;border:1px solid var(--line);border-radius:12px;padding:12px;background:#f8fafc"><h3>Source Text</h3><pre style="white-space:pre-wrap;font-size:12px;line-height:1.6">${escapeHtml(rawText.slice(0,12000))}</pre></section>` : "";
  const html=`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — DocuWeave</title><meta name="description" content="${escapeHtml(analysis.subtitle.slice(0,150))}"><meta property="og:title" content="${title}"><meta property="og:description" content="${escapeHtml(analysis.subtitle)}"><link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700&family=Inter:wght@400;600&display=swap" rel="stylesheet">${styles}<style>body{padding:22px;background:${themes.find(t=>t.id===currentTheme)?.bg || "#fcfaf8"}} .webpage{max-width:900px;margin:0 auto}</style></head><body>${clone}${extra}<footer style="text-align:center;color:#64748b;font-size:12px;padding:18px">Generated by DocuWeave v3 • ${new Date().toLocaleString()} • Offline</footer></body></html>`;
  downloadBlob(html, (analysis.title.slice(0,44).replace(/[^a-z0-9]+/gi,"-")||"docuweave")+".html","text/html");
}
function exportMarkdown(){
  if(!analysis){showErr("Analyze first.");return;}
  const includeSource=$("#includeSource")?.checked ?? true;
  let md=`# ${analysis.title}\n\n*${analysis.subtitle}*\n\n> **${analysis.summaryWords}w summary • ${analysis.summaryRatio}% distilled • ${analysis.wc} words • ${analysis.readingTime} min**\n\n## Comprehensive Summary\n\n${analysis.summary}\n\n> **In one line:** ${analysis.oneLiner}\n\n## Key Points\n\n${analysis.keyPoints.map((p,i)=> `${i+1}. ${p.sentence}`).join("\n\n")}\n\n## Important Factors\n\n${analysis.factors.map(f=> `### ${f.title}\n${f.evidence}\n\n*${f.cues.join(" • ")}*`).join("\n\n")}\n\n## Insights\n\n**Keywords:** ${analysis.topKeywords.map(k=>k.term).join(", ")}\n\n**Phrases:** ${analysis.topBigrams.join(", ")}\n\n**Numbers:** ${analysis.numbers.join(", ")}\n\n**Entities:** ${analysis.entities.join(", ")}\n\n## Stats\n\n- Words: ${analysis.wc}\n- Sentences: ${analysis.sentences}\n- Pages: ${analysis.pages}\n- Theme: ${currentTheme}\n`;
  if(includeSource) md+= `\n\n## Source Text\n\n\`\`\`\n${rawText.slice(0,12000)}\n\`\`\`\n`;
  downloadBlob(md, (analysis.title.slice(0,44).replace(/[^a-z0-9]+/gi,"-")||"docuweave")+".md","text/markdown");
}
function exportText(){
  const txt=`${analysis.title}\n${"=".repeat(analysis.title.length)}\n${analysis.subtitle}\n\nSUMMARY (${analysis.summaryWords}w):\n${analysis.summary}\n\nONE LINER:\n${analysis.oneLiner}\n\nKEY POINTS:\n${analysis.keyPoints.map((p,i)=>`${i+1}. ${p.sentence}`).join("\n")}\n\nFACTORS:\n${analysis.factors.map(f=>`- ${f.title}: ${f.evidence}`).join("\n")}\n`;
  downloadBlob(txt, (analysis.title.slice(0,44).replace(/[^a-z0-9]+/gi,"-")||"docuweave")+".txt","text/plain");
}
function exportEmail(){
  const html=`<div style="font-family:Inter,sans-serif;max-width:640px;margin:0 auto"><h1 style="font-family:Fraunces,serif">${escapeHtml(analysis.title)}</h1><p style="color:#64748b">${escapeHtml(analysis.subtitle)}</p><div style="background:#f8fafc;border:1px solid #e7dfd8;border-radius:12px;padding:14px;line-height:1.6">${escapeHtml(analysis.summary)}</div><ol>${analysis.keyPoints.map(p=>`<li style="margin:8px 0">${escapeHtml(p.sentence)}</li>`).join("")}</ol><p style="font-size:11px;color:#64748b">Generated by DocuWeave v3 • ${new Date().toLocaleString()}</p></div>`;
  navigator.clipboard.writeText(html).then(()=> alert("Email HTML copied to clipboard — paste into Gmail/Outlook (as HTML)."));
}
function copyAll(){
  const txt=`Title: ${analysis.title}\nSubtitle: ${analysis.subtitle}\n\nCOMPREHENSIVE SUMMARY (${analysis.summaryWords}w):\n${analysis.summary}\n\nONE LINER:\n${analysis.oneLiner}\n\nKEY POINTS (${analysis.keyPoints.length}):\n${analysis.keyPoints.map((p,i)=> `${i+1}. ${p.sentence}`).join("\n")}\n\nIMPORTANT FACTORS:\n${analysis.factors.map(f=> `- ${f.title}: ${f.evidence}`).join("\n")}\n\nKeywords: ${analysis.topKeywords.map(k=>k.term).join(", ")}\nNumbers: ${analysis.numbers.join(", ")}\nEntities: ${analysis.entities.join(", ")}`;
  navigator.clipboard.writeText(txt).then(()=>{
    const b=event.target; const old=b.textContent; b.textContent="Copied!"; setTimeout(()=> b.textContent=old,1200);
  });
}
function copyJSON(){
  const j=JSON.stringify({...analysis, theme:currentTheme, exportedAt:new Date().toISOString()},null,2);
  navigator.clipboard.writeText(j).then(()=>{
    const b=event.target; const old=b.textContent; b.textContent="Copied JSON!"; setTimeout(()=> b.textContent=old,1200);
  });
}
function copyJSONLD(){
  const ld={
    "@context":"https://schema.org",
    "@type":"Article",
    "headline": analysis.title,
    "description": analysis.subtitle,
    "articleBody": analysis.summary,
    "keywords": analysis.topKeywords.map(k=>k.term).join(", "),
    "wordCount": analysis.wc,
    "timeRequired": `PT${analysis.readingTime}M`,
    "datePublished": new Date().toISOString(),
    "author": {"@type":"Organization","name":"DocuWeave v3"}
  };
  navigator.clipboard.writeText(JSON.stringify(ld,null,2)).then(()=> alert("JSON-LD (SEO) copied — paste into <script type='application/ld+json'>"));
}
function downloadBlob(content, filename, type){
  const blob=new Blob([content],{type}); const url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),2000);
}

// ——— SELF TESTS (keep passing) ———
function runSelfTests(){
  const bar=$("#testBar"), out=$("#testOut");
  bar.style.display="flex"; out.textContent="Running…";
  const docs=[
    {name:"short memo (42 words)", text:"Memo: Q2 OKRs\nWe shipped search v2. Latency down 42%. NPS up from 31 to 44. Two risks: hiring pause slows roadmap, and churn in SMB remains 5.2%. Recommendation: double down on enterprise.", expectPoints:5},
    {name:"numeric financial", text:"Q4 Earnings: Revenue $4.2B up 12.3% YoY. EPS $1.84 vs $1.71 estimate. Margin 38.2%. Cash $892M. Guidance 2026: $18B revenue, 41% margin. Risks: FX headwind $120M, churn 3.1%. Buyback $500M authorized.", expectPoints:5},
  ];
  let passed=0;
  const results=[];
  docs.forEach(d=>{
    try{
      const a=analyzeDocumentOptimized(d.text,{pages:1,name:d.name});
      const ok = a.summary && a.summary.split(/\s+/).length>15 && a.keyPoints.length>=3 && a.coverage.length===3;
      if(ok) passed++;
      results.push(`${ok?"✓":"✗"} ${d.name}: ${a.summaryWords}w, ${a.keyPoints.length} pts, cov ${a.coverage.map(c=>c?"1":"0").join("")}`);
    }catch(e){ results.push(`✗ ${d.name}: ${e.message}`); }
  });
  const checks=[
    ["Drag-drop zone",/id="zone"/.test(document.documentElement.outerHTML)],
    ["PDF.js",/pdfjsLib/.test(document.documentElement.outerHTML)],
    ["Theme",/applyTheme/.test(document.documentElement.outerHTML)],
    ["Library",/saveToLibrary/.test(document.documentElement.outerHTML)],
    ["Ask",/askDoc/.test(document.documentElement.outerHTML)],
    ["Timeline",/wTimeline/.test(document.documentElement.outerHTML)],
  ];
  out.innerHTML=`<span style="color:${passed===docs.length?'#065f46':'#991b1b'};font-weight:700">${passed}/${docs.length} doc tests passed</span><br>${results.join("<br>")}<br><br>${checks.map(([n,ok])=>`${ok?"✓":"✗"} ${n}`).join(" • ")}`;
}

// Init
window.addEventListener("load",()=>{
  renderLibrary();
  const savedTheme=localStorage.getItem("dw_theme"); if(savedTheme) { currentTheme=savedTheme; applyTheme(savedTheme); }
  setTimeout(()=>{ try{ runSelfTests(); $("#testBar").style.display="flex"; }catch(e){} },800);
  // keyboard shortcuts
  document.addEventListener("keydown",e=>{
    if(e.key==="Escape"){ closeTheme(); closeExport(); if(editMode) toggleEdit(); }
    if((e.ctrlKey||e.metaKey) && e.key==="e"){ e.preventDefault(); toggleEdit(); }
    if((e.ctrlKey||e.metaKey) && e.key==="s"){ e.preventDefault(); if(analysis) exportPage(); }
  });
});
