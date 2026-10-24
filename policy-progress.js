import {POLICY_PROGRESS_CATALOG} from './policy-progress-data.js';
import {BULLETIN_CATALOG} from './bulletins-data.js';
import {reviewedAssessment} from './attainment.js';
import {COUNTIES} from './model.js';
const policyReviewsById=new Map(POLICY_PROGRESS_CATALOG.items.map(row=>[row.id,row]));
const policyEstimatesById=new Map((POLICY_PROGRESS_CATALOG.estimates?.items||[]).map(row=>[`${row.id}/${row.partId}`,row]));
const policyOriginalsByCounty=new Map(BULLETIN_CATALOG.counties.map(c=>[c.county,new Set(c.items.map(i=>i.id))]));
export const POLICY_PROGRESS_METHOD=POLICY_PROGRESS_CATALOG.method;
export function calculatePolicyProgress(parts=[]){
 const classified=parts.map(p=>({...p,scored:p.status!=='not_applicable'&&p.status!=='unknown'&&
  Number.isFinite(p.percent)&&p.percent>=0&&p.percent<=100&&!p.historical&&!p.lowerBound&&
  (p.percent!==100||p.status==='completed')}));
 const active=classified.filter(p=>p.status!=='not_applicable'),quantified=active.filter(p=>p.scored);
 const sum=quantified.reduce((n,p)=>n+p.percent,0),knownPercent=quantified.length?sum/quantified.length:null;
 // A paragraph is one whole promise: a mean of only its known parts is not its progress.
 // Keep the known sum for county arithmetic, but require full coverage for the paragraph percentage.
 const percent=active.length>0&&quantified.length===active.length?knownPercent:null;
 return {parts:classified,applicable:active.length,excluded:parts.length-active.length,
  quantified:quantified.length,unknown:active.length-quantified.length,sum,percent,knownPercent,
  completed:quantified.filter(p=>p.status==='completed').length,
  notImplemented:quantified.filter(p=>p.status==='not_implemented').length,
  isComplete:active.length>0&&active.every(p=>p.scored&&p.status==='completed'),
  inProgress:active.filter(p=>p.status==='in_progress').length,
  historical:active.filter(p=>p.historical).length,
  bounded:active.filter(p=>p.lowerBound&&!p.historical).length,
  coverage:active.length?quantified.length/active.length*100:null,
  state:!active.length?'not_applicable':!quantified.length?'unquantified':quantified.length===active.length?'exact':'partial'};
}
// Editorial estimates are an explicit overlay. Never rewrite the source percent or factual status.
export function calculatePolicyScore(parts=[]){
 const evidence=calculatePolicyProgress(parts),active=evidence.parts.filter(p=>p.status!=='not_applicable');
 const scored=active.map(p=>p.scored?{percent:p.percent,estimated:false}:p.estimate&&Number.isFinite(p.estimate.percent)&&p.estimate.percent>=0&&p.estimate.percent<100&&p.estimate.reason?{percent:p.estimate.percent,estimated:true}:null);
 const rated=scored.filter(Boolean),sum=rated.reduce((n,p)=>n+p.percent,0),estimated=rated.filter(p=>p.estimated).length;
 return {sum,percent:active.length&&rated.length===active.length?sum/active.length:null,applicable:active.length,
  measured:rated.length-estimated,estimated,unrated:active.length-rated.length,isComplete:evidence.isComplete};
}
export function averagePolicyScores(scores=[]){
 const sum=scores.reduce((n,s)=>n+s.sum,0),applicable=scores.reduce((n,s)=>n+s.applicable,0),unrated=scores.reduce((n,s)=>n+s.unrated,0);
 return {sum,applicable,unrated,percent:applicable&&!unrated?sum/applicable:null,
  measured:scores.reduce((n,s)=>n+s.measured,0),estimated:scores.reduce((n,s)=>n+s.estimated,0),
  isComplete:applicable>0&&scores.filter(s=>s.applicable).every(s=>s.isComplete)};
}
export function policyProgress(p){
 const a=reviewedAssessment(p),row=policyReviewsById.get(p?.id);
 if(!p||p.raw?.collectionSource!=='complete-bulletin'||!a||!row||row.quote!==p.originalQuote||row.county!==p.county)return null;
 const sourcesFor=record=>[...(record.sourceIndexes||[]).map(i=>a.sources[i]),...(record.extraSources||[])];
 const parts=row.parts.map(part=>({...part,estimate:policyEstimatesById.get(`${row.id}/${part.id}`)||null,sources:sourcesFor(part),supportingMetrics:(part.supportingMetrics||[]).map(metric=>({...metric,sources:sourcesFor(metric)}))}));
 return {...calculatePolicyProgress(parts),score:calculatePolicyScore(parts),reviewedAt:POLICY_PROGRESS_CATALOG.reviewedAt,id:p.id};
}
// Average the source-backed point percentages, not the per-paragraph averages.
// Unknown, historical-only and lower-bound records keep their evidence but no invented point value.
export function averagePolicyProgress(metrics=[]){
 const applicable=metrics.reduce((n,m)=>n+m.applicable,0),quantified=metrics.reduce((n,m)=>n+m.quantified,0);
 const sum=metrics.reduce((n,m)=>n+m.sum,0),percent=quantified?sum/quantified:null;
 return {applicable,quantified,unknown:applicable-quantified,sum,percent,
  coverage:applicable?quantified/applicable*100:null,
  isComplete:applicable>0&&metrics.filter(m=>m.applicable).every(m=>m.isComplete),
  state:!applicable?'not_applicable':!quantified?'unquantified':quantified===applicable?'exact':'partial'};
}
export function countyPolicyProgress(promises=[]){
 const unique=new Map();
 for(const p of Array.isArray(promises)?promises:[])if(p?.id&&!unique.has(p.id))unique.set(p.id,p);
 return COUNTIES.map(county=>{
  const originalIds=policyOriginalsByCounty.get(county),rows=[...unique.values()].filter(p=>p.county===county&&p.raw?.collectionSource==='complete-bulletin'),metrics=rows.map(policyProgress);
  const eligible=rows.length===originalIds?.size&&rows.every(p=>originalIds.has(p.id))&&metrics.every(Boolean);
  if(!eligible)return {county,eligible:false,total:rows.length,state:'unavailable',sum:0,percent:null,coverage:null,isComplete:false,applicable:0,quantified:0,unknown:0,parts:0,applicableOriginals:0,excludedOriginals:0};
  const applicable=metrics.filter(m=>m.applicable),average=averagePolicyProgress(metrics),score=averagePolicyScores(metrics.map(m=>m.score));
  const {quantified,unknown}=average;
  return {county,eligible:true,total:rows.length,applicableOriginals:applicable.length,excludedOriginals:metrics.length-applicable.length,
   parts:metrics.reduce((n,m)=>n+m.parts.length,0),excludedParts:metrics.reduce((n,m)=>n+m.excluded,0),quantified,unknown,
   completedParts:metrics.reduce((n,m)=>n+m.completed,0),notImplementedParts:metrics.reduce((n,m)=>n+m.notImplemented,0),inProgressParts:metrics.reduce((n,m)=>n+m.inProgress,0),historicalParts:metrics.reduce((n,m)=>n+m.historical,0),boundedParts:metrics.reduce((n,m)=>n+m.bounded,0),
   sum:average.sum,applicable:average.applicable,percent:average.percent,score,coverage:average.coverage,isComplete:average.isComplete,state:average.state};
 });
}
// Boundary labels never round an unfinished value up to 100 or a positive value to zero.
export function formatPolicyPercent(value){
 const rounded=Number(value.toFixed(2));
 if(value>0&&rounded===0)return '<0.01%';
 if(value<100&&rounded===100)return '>99.99%';
 return `${rounded}%`;
}
// Whole-promise labels require all applicable parts; county means have their own explicit scope.
export function policyProgressLabel(progress){
 if(!progress||progress.state==='unavailable')return '—';
 if(progress.state==='not_applicable')return '不適用';
 return Number.isFinite(progress.percent)?formatPolicyPercent(progress.percent):'—';
}
export function policyScoreLabel(score){
 if(!Number.isFinite(score?.percent))return '—';
 if(!score.estimated)return formatPolicyPercent(score.percent);
 // Coarse estimates should not imply two-decimal precision or round an unfinished score to 100.
 const rounded=Math.round(score.percent);
 const label=score.percent>0&&rounded===0?'<1%':score.percent<100&&rounded===100?'>99%':`${rounded}%`;
 return `約 ${label}`;
}
