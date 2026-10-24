import {BULLETIN_CATALOG} from './bulletins-data.js';
import {adaptResearch} from './research.js';

export const BULLETIN_REVIEW_BATCH='2026-10-21-bulletin-full';
export const bulletinAssessments=()=>BULLETIN_CATALOG.counties.flatMap(c=>c.items.map(i=>i.assessment).filter(Boolean));

// A separate canonical collection: original bulletin units replace the former sample.
// Never merge full paragraphs and their previously selected subclauses into a denominator.
export function completeBulletinResearch(raw,catalog=BULLETIN_CATALOG){
 adaptResearch(raw);
 const result=JSON.parse(JSON.stringify(raw)),seen=new Set();
 if(catalog.counties.length!==22||new Set(catalog.counties.map(c=>c.county)).size!==22)throw Error('公報需完整涵蓋22縣市。');
 for(const city of result.cities){
  const c=catalog.counties.find(c=>c.county===city.name);
  if(!c||c.candidate!==city.electedHead||!c.extractionVerified||!c.fullText||!c.items.length)throw Error(`${city.name}公報身分或原文未確認。`);
  city.bulletin={...c,items:undefined};
  city.pledges=c.items.map(item=>{
   if(seen.has(item.id)||!item.quote||!item.locator||!c.pages.includes(item.page))throw Error('公報條目重複或定位不完整。');
   seen.add(item.id);const a=item.assessment;
   if(a&&(a.id!==item.id||a.quote!==item.quote||a.county!==c.county))throw Error(`${item.id}查核與原文不符。`);
   return {id:item.id,quote:item.quote,summary:item.quote.length>68?item.quote.slice(0,68)+'…':item.quote,heading:item.heading,originalLocator:item.locator,
    collectionSource:'complete-bulletin',collectionBatch:BULLETIN_REVIEW_BATCH,linkedLegacyIds:item.linkedLegacyIds||[],
    observedOn:catalog.observedOn,score:null,rankingEligible:false,limitedMetric:null,
    status:a?.reason||'原公報已核讀，後續證據整理中。',frontendStage:'unknown',
    target:null,baseline:null,deadline:null,metricDefinition:'按公報原條目核對全部承諾；分項成果另外說明，不將局部完成當整條完成。',
    limitations:a?.limitations?.length?a.limitations:['尚待取得對應執行證據，無法推斷已完成或未實施。'],
    originalSources:[{url:c.sourceUrl+'#page='+item.page,title:`2022${city.name}長選舉公報 · ${c.candidate}`,type:'中選會原始選舉公報',dateLabel:'2022',locator:item.locator}],
    current:{stage:a?.label||'待查',dateLabel:a?.asOf||null,scope:a?.scope||item.quote,value:null,sources:(a?.sources||[]).map(s=>({...s,dateLabel:s.publishedAt,type:s.sourceType}))},
    nextEvidenceNeeded:a?.limitations?.join('；')||'逐項查閱官方成果、工程進度及審計資料。'};
  });city.selectedPledgeCount=city.pledges.length;
 }
 result.metadata={...result.metadata,observedOn:catalog.observedOn,jurisdictionCount:22,selectedPledgeCount:seen.size,
  collectionScope:'2022年22縣市當選人選舉公報政見欄',completeBulletins:true,bulletinCount:22,
  latestFollowUp:catalog.latestFollowUp||null,
  originalSelectedPledgeCount:undefined,expandedPledgeCount:undefined,
  coverageWarning:`已逐欄核對22縣市2022當選人公報，共${seen.size}個原條目。依原編號列項，複合段落不拆句灌水；標題口號保留於全文。公報收錄完整，不代表成果全部已確認。`};
 adaptResearch(result);return result;
}
