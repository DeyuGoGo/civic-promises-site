import {attainmentFor,hasKnownProgress,progressRecords} from './attainment.js';
import {policyProgress} from './policy-progress.js';

export const OVERVIEW_SCOPE='依公報原文的主要內容分類；複合政見只列一個主題，保留完整原文，不拆項重複計數。';
export const OVERVIEW_TOPICS=Object.freeze([
 {id:'transport',label:'交通建設',description:'道路、軌道、公共運輸與通行'},
 {id:'education',label:'育兒教育',description:'托育、學校、青年學習與人才培育'},
 {id:'care',label:'醫療照顧',description:'醫療、長照、健康與社會照顧'},
 {id:'living',label:'居住生活',description:'住宅、生活空間、文化與運動'},
 {id:'economy',label:'產業觀光',description:'就業、產業、農漁業與觀光'},
 {id:'governance',label:'治理永續',description:'政府治理、環境、能源與防災'},
 {id:'other',label:'其他／跨領域',description:'原文未能明確歸入單一主題'}
].map(Object.freeze));

// Keyword rules route the original units for navigation; they do not infer progress.
const topicWords={
 transport:/交通|公路|道路|道安|路網|捷運|輕軌|鐵路|鐵道|高鐵|台鐵|臺鐵|公車|客運|巴士|轉運|接駁|停車|通勤|軌道|機場|航空|航線|渡輪|大橋|通橋|行人|人行道|路平/g,
 education:/育兒|托育|托嬰|夜托|臨托|幼兒|幼童|幼托|幼稚|幼教|親子|兒童|生育|學校|校園|學生|學童|學費|助學|教育|教學|教師|雙語|課程|課後|學習|人才培育/g,
 care:/醫療|醫院|診所|診療|急診|醫師|醫護|救護|後送|健康|健檢|疫苗|癌症|慢性病|長照|照護|照顧|托老|養老|老人|高齡|長者|日照|樂齡|敬老|銀髮|身心障礙|失能|社福|社會福利|婦幼福利|年金|弱勢|脫貧|福祉/g,
 living:/住宅|社宅|住屋|租屋|租金|老宅|老屋|危老|危樓|都更|都市更新|重劃|居住|安居|公園|綠地|運動|體育|休閒|藝文|藝術|文化|圖書|博物館|美術|美學|劇場|音樂|策展|表演|毛孩|動物|寵物|自來水|供水|污水|下水道|生活空間|生活機能/g,
 economy:/產業|企業|創業|新創|產創|工商|商圈|商業|招商|投資|經濟|就業|職涯|勞工|薪資|農業|農民|農漁|漁業|漁民|漁港|畜牧|農產|觀光|旅遊|遊客|旅客|旅宿|商機|加工|科技園區|科技區|科學園區/g,
 governance:/治理|行政|公民|清廉|廉能|政治|參與式|參與預算|公開透明|開放資料|戶政|為民服務|公共服務|性平|性別|族群|財政|負債|債務|稅收|縣庫|市庫|整合平台|溝通平台|縣市整合|非軍事|兩岸|智慧城市|數位|環保|環境|永續|減碳|低碳|淨零|能源|綠能|空污|空品|污染|廢棄|垃圾|回收|防災|防洪|治水|排水|氣候|海岸|生態|保育|治安|消防/g
};
const concreteWords={
 transport:/捷運|公車|軌道|道路|公路|鐵路|停車|通橋/g,
 education:/育兒|托育|托嬰|幼兒|學校|學童|校園|教育|學費/g,
 care:/醫療|醫院|長照|急診|救護|健檢|疫苗|婦幼福利|年金/g,
 living:/住宅|社宅|老宅|公園|美術|圖書|劇場|美學/g,
 economy:/產業|企業|農業|觀光|創業|科技區|產創/g,
 governance:/治理|公開透明|開放資料|戶政|性平|性別|財政|非軍事|淨零|治水|防災/g
};
const text=v=>typeof v==='string'?v:'';
function scoresFor(value){return Object.entries(topicWords).map(([id,pattern])=>({id,score:(value.match(pattern)||[]).length+2*(value.match(concreteWords[id])||[]).length}));}
function uniqueLeader(value){
 const ranked=scoresFor(value).sort((a,b)=>b.score-a.score);
 return ranked[0].score>0&&ranked[0].score!==ranked[1].score?ranked[0].id:null;
}
export function topicFor(p){
 const quote=text(p?.originalQuote)||text(p?.title);
 // A concrete lead before a colon often names the main policy within a long unit.
 const lead=quote.match(/^([^：:]{2,28})[：:]/)?.[1];
 // A station-area place name identifies location, not necessarily a transport policy.
 const policyLead=lead?.replace(/(?:高鐵|臺鐵|台鐵|捷運|車站|機場)(?:站)?(?:特定區|周邊|園區|生活圈)/g,'');
 const leadTopic=policyLead&&uniqueLeader(policyLead);
 if(leadTopic)return leadTopic;
 return uniqueLeader(quote)||(!scoresFor(quote).some(v=>v.score>0)&&uniqueLeader(text(p?.raw?.heading)))||'other';
}

const historicalZeroFor=m=>m?.percent===0&&m.explicitNonImplementation===true&&m.historical===true||
 (m?.supplementaryMetrics||[]).some(v=>v.percent===0&&v.explicitNonImplementation===true&&v.historical===true);
export function overviewSummary(promises=[]){
 const rows=Array.isArray(promises)?promises:[];
 const metrics=rows.map(p=>attainmentFor(p||{}));
 const known=metrics.filter(hasKnownProgress).length;
 const counts=new Map(OVERVIEW_TOPICS.map(t=>[t.id,0]));
 for(const p of rows){const id=topicFor(p);counts.set(id,counts.get(id)+1);}
 return {total:rows.length,known,pending:rows.length-known,
  completed:rows.filter(p=>policyProgress(p)?.isComplete===true).length,
  historicalZero:metrics.filter(historicalZeroFor).length,
  topics:OVERVIEW_TOPICS.map(({id,label})=>({id,label,count:counts.get(id)}))};
}

function scopeDetail(m,extra=''){
 return [...new Set([extra,m.scope,...(m.limitations||[])].filter(Boolean))].join('；').replace(/([。；])；/g,'$1')||m.reason||'待補直接證據。';
}
const formatPercent=metric=>`${text(metric.boundLabel)||(metric.lowerBound?'至少':'')}${Number(metric.percent.toFixed(3))}%`;
export function compactProgress(p){
 const m=attainmentFor(p||{}),date=m.date||null,scopedLabel=m.label||null;
 if(m.kind==='zero'&&m.explicitNonImplementation===true){
  return {label:m.historical?`歷史未實施 · ${date}`:'已確認未實施',scopedLabel,value:'0%',date,tone:'warning',
   detail:scopeDetail(m,m.historical?'僅代表此歷史時點，不代表目前狀態。':'')};
 }
 if(m.percent===100&&m.verdict==='implemented'){
  return {label:'已確認實施',scopedLabel,value:formatPercent(m),date,tone:'success',detail:scopeDetail(m,m.label)};
 }
 if(Number.isFinite(m.percent)){
  return {label:'限定指標進度',scopedLabel,value:formatPercent(m),date,tone:'progress',detail:scopeDetail(m,`${m.label}；不代表整條政見完成率。`)};
 }
 const supplementary=(m.supplementaryMetrics||[]).filter(v=>Number.isFinite(v.percent)&&v.percent>=0&&v.scope&&v.asOf)
  .slice().sort((a,b)=>String(b.asOf).localeCompare(String(a.asOf)));
 const sub=supplementary[0];
 if(sub){
  const historicalZero=sub.percent===0&&sub.explicitNonImplementation===true&&sub.historical===true;
  return {label:historicalZero?`歷史分項未實施 · ${sub.asOf}`:'分項指標進度',scopedLabel:sub.label,value:formatPercent(sub),date:sub.asOf,
   tone:historicalZero?'warning':'progress',detail:scopeDetail(m,`${sub.label}；${sub.scope}；僅限這個分項，不代表整條政見完成率。${historicalZero?'此為歷史紀錄，不代表目前狀態。':''}`)};
 }
 // Background can be newer than an implementation record. Never promote it to execution.
 const record=progressRecords(m).find(v=>v.kind!=='context');
 if(record){
  const labels={execution:'已有執行紀錄',preparation:'已有籌備紀錄',policy:'已有政策／狀態紀錄'};
  return {label:labels[record.kind],scopedLabel,date:record.date,tone:'progress',detail:scopeDetail(m,`${record.stage}：${record.summary}`)};
 }
 if(hasKnownProgress(m))return {label:'已有進度證據',scopedLabel,date,tone:'progress',detail:scopeDetail(m,m.reason||m.label)};
 return {label:'尚待直接證據',scopedLabel,date,tone:'neutral',detail:scopeDetail(m,m.reason)};
}
