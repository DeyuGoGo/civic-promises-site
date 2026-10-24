import {ASSESSMENTS} from './assessments-data.js';
export const CURRENT_REVIEW_BATCH='2026-10-21-r5';
// Reviews are attached only to the shipped dataset, never to user-imported IDs.
const assessedPromises=new WeakMap();
export function attachAssessments(data, rows=ASSESSMENTS){
 for(const p of data.promises){
  const a=rows.find(a=>a.id===p.id&&a.quote===p.raw?.quote&&a.county===p.county);
  if(a)assessedPromises.set(p,a);
 }
 return data;
}
export function reviewedAssessment(p){return assessedPromises.get(p)||null;}
// A dated record describes its own stage, independently of a whole-pledge score.
export function progressRecords(a){
 const sources=new Set((a?.sources||[]).filter(s=>s.verifiedThisRound!==false).map(s=>s.url));
 return (Array.isArray(a?.progressUpdates)?a.progressUpdates:[]).filter(v=>
  v&&typeof v.date==='string'&&/^\d{4}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?$/.test(v.date)&&typeof v.stage==='string'&&v.stage.trim()&&typeof v.summary==='string'&&v.summary.trim()&&
  ['execution','preparation','policy','context'].includes(v.kind)&&['本任期','任前背景','時點待釐清'].includes(v.temporalScope)&&
  (v.temporalScope!=='任前背景'||v.kind==='context')&&Array.isArray(v.sourceUrls)&&v.sourceUrls.length&&v.sourceUrls.every(url=>/^https?:\/\//.test(url)&&sources.has(url))
 ).slice().sort((a,b)=>b.date.localeCompare(a.date));
}
export function hasKnownProgress(m){
 if(!m)return false;
 if(m.kind==='zero'&&m.explicitNonImplementation===true)return true;
 if(Array.isArray(m.progressUpdates))return progressRecords(m).some(v=>v.kind!=='context');
 return m.kind!=='unknown'&&(m.assessment===true||Number.isFinite(m.percent));
}
export function assessmentMetric(a){
 if(!a||!['implemented','not_implemented','partial','unknown'].includes(a.verdict)||!a.label||!a.scope||!a.asOf||!a.observedOn||!a.reason||!a.limitations?.length||!Array.isArray(a.sources)||a.sources.some(s=>!/^https?:\/\//.test(s.url)||!s.title||!s.evidence))return null;
 const hasEvidence=a.sources.some(s=>s.verifiedThisRound!==false);
 if(a.basis==='unquantified'){
  if(a.percent!==null||a.verdict==='not_implemented')return null;
  const observation=a.observation;
  if(observation&&(!hasEvidence||!Number.isFinite(observation.value)||!observation.unit||!observation.label))return null;
  const kind=observation?'observed':a.verdict!=='unknown'&&hasEvidence?'progress':'unknown';
  return {...a,kind,date:a.asOf,assessment:true};
 }
 if(!hasEvidence||a.verdict==='unknown'||!Number.isFinite(a.percent)||a.percent<0||(a.basis!=='ratio'&&a.percent>100))return null;
 if(a.verdict==='not_implemented'&&(a.percent!==0||a.explicitNonImplementation!==true))return null;
 if(a.basis==='milestone'&&!((a.verdict==='implemented'&&a.percent===100)||(a.verdict==='not_implemented'&&a.percent===0)))return null;
 if(!['ratio','milestone','reported'].includes(a.basis))return null;
 if(a.basis==='ratio'){
  if(!Number.isFinite(a.numerator)||a.numerator<0||!Number.isFinite(a.denominator)||a.denominator<=0)return null;
  const exact=a.numerator/a.denominator*100,expected=a.capAtTarget?Math.min(100,exact):exact;
  if(!Number.isFinite(expected)||Math.abs(a.percent-expected)>.051)return null;
 }
 const kind=a.verdict==='not_implemented'?'zero':a.basis==='milestone'?'milestone':'limited';
 return {...a,kind,date:a.asOf,barPercent:Math.min(100,a.percent),assessment:true};
}
// Only an explicitly eligible, scoped research metric may produce a percentage.
// Stage words, matching numbers and missing evidence never imply a completion rate.
export function attainmentFor(p){
 const audited=assessmentMetric(reviewedAssessment(p));if(audited)return audited;
 const r=p.raw,m=r?.limitedMetric;
 const unavailable=reason=>({kind:'unknown',percent:null,reason,next:r?.nextEvidenceNeeded||p.uncertainty||'補齊同口徑目標、當期數值與來源。'});
 if(!r)return unavailable('尚未完成計算口徑審核');
 if(!m)return unavailable(!r.current?.sources?.length?'待補後續證據':'待確認目標與現況口徑');
 const limits=m.limitations?.length?m.limitations:r.limitations;
 if(m.eligible!==true||m.not_total_pledge_completion!==true||typeof m.label!=='string'||!m.label.trim()||!Array.isArray(limits)||!limits.length||!r.originalSources?.length||!r.current?.sources?.length||!r.current.dateLabel)return unavailable('限定指標資料不完整');
 if(![m.numerator,m.denominator].every(v=>typeof v==='number'&&Number.isFinite(v))||m.numerator<0||m.denominator<=0)return unavailable('分子／分母需核對');
 const exact=m.numerator/m.denominator*100;
 if(!Number.isFinite(exact))return unavailable('比值超出可計算範圍');
 // Accept source rounding to one decimal; reject contradictory imported figures.
 if(m.percent!==undefined&&(typeof m.percent!=='number'||!Number.isFinite(m.percent)||Math.abs(m.percent-exact)>0.051))return unavailable('來源百分比與分子／分母不一致');
 const percent=Math.round(exact*100)/100;
 return {kind:'limited',percent,barPercent:Math.min(percent,100),numerator:m.numerator,denominator:m.denominator,label:m.label,limitations:limits,date:r.current.dateLabel,status:r.status};
}
export function attainmentSummary(promises){
 const metrics=promises.map(attainmentFor),measurable=metrics.filter(m=>Number.isFinite(m.percent)).length;
 return {total:promises.length,measurable,pending:promises.length-measurable,totalRate:null};
}
