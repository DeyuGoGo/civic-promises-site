import {ADDITIONS} from './expanded-data.js';
import {adaptResearch} from './research.js';

export const CURRENT_COLLECTION_BATCH='2026-10-21-r4';

// Ignore typographic differences only; identical promises in different counties remain distinct.
const expansionQuoteKey=value=>String(value??'').normalize('NFKC').replaceAll('台','臺').replace(/[\s\p{P}]/gu,'');
const expansionClone=value=>JSON.parse(JSON.stringify(value));

export function expandResearch(raw,additions=ADDITIONS){
 adaptResearch(raw);
 if(!Array.isArray(additions))throw Error('新增政見資料必須是陣列。');
 const expanded=expansionClone(raw);
 const citiesByName=new Map(expanded.cities.map(city=>[city.name,city]));
 const byId=new Map(),quotesByCounty=new Map();
 for(const city of expanded.cities){
  const quotes=new Set();quotesByCounty.set(city.name,quotes);
  for(const pledge of city.pledges){
   const quoteKey=expansionQuoteKey(pledge.quote);
   byId.set(pledge.id,{county:city.name,quoteKey});quotes.add(quoteKey);
  }
 }
 const originalCount=expanded.metadata.originalSelectedPledgeCount??byId.size;
 let latestObservedOn=expanded.metadata.observedOn;
 for(const addition of additions){
  if(!addition||typeof addition!=='object'||Array.isArray(addition))throw Error('新增政見必須包含 county 與政見欄位。');
  const {county,...pledge}=expansionClone(addition);
  const city=citiesByName.get(county);
  if(!city)throw Error(`新增政見縣市不存在：${county??'未填寫'}`);
  if(typeof pledge.id!=='string'||!pledge.id.trim()||typeof pledge.quote!=='string'||!pledge.quote.trim())throw Error('新增政見缺少 id 或 quote。');
  const quoteKey=expansionQuoteKey(pledge.quote),existing=byId.get(pledge.id);
  if(existing){
   if(existing.county!==county||existing.quoteKey!==quoteKey)throw Error(`政見 id 衝突：${pledge.id}`);
   continue;
  }
  if(quotesByCounty.get(county).has(quoteKey))continue;
  pledge.collectionSource='expansion';
  city.pledges.push(pledge);
  byId.set(pledge.id,{county,quoteKey});quotesByCounty.get(county).add(quoteKey);
  if(/^\d{4}-\d{2}-\d{2}$/.test(pledge.observedOn??'')&&(!latestObservedOn||pledge.observedOn>latestObservedOn))latestObservedOn=pledge.observedOn;
 }
 for(const city of expanded.cities)city.selectedPledgeCount=city.pledges.length;
 const total=expanded.cities.reduce((count,city)=>count+city.pledges.length,0);
 expanded.metadata.selectedPledgeCount=total;
 expanded.metadata.jurisdictionCount=expanded.cities.length;
 expanded.metadata.originalSelectedPledgeCount=originalCount;
 expanded.metadata.expandedPledgeCount=total-originalCount;
 expanded.metadata.coverageWarning=`已收錄 ${total} 項承諾（原始 ${originalCount} 項，新增 ${total-originalCount} 項）；不是完整政見母體，也不代表 ${total} 項成果皆已驗證。`;
 if(latestObservedOn)expanded.metadata.observedOn=latestObservedOn;
 adaptResearch(expanded);
 return expanded;
}
