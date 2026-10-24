import {formatPolicyPercent} from './policy-progress.js';

// Brief editorial wording for compound promises whose source labels are unusually long.
const EXPLANATION_PLAIN_CASES={
 bulletin_2022_taipei_1_2:[
  '已提供新創實驗場地、青年實習津貼，以及海外人才來台協助。',
  '投資公司是否成立、市民能否入股，目前還找不到證明，這兩項先估0%。'
 ],
 bulletin_2022_taipei_1_4:[
  '萬華故事牆等商圈工程已完成，也已有店家改造成果。',
  '45個商圈已參與定位規劃，但商圈分級的標準與名單還沒找到。',
  '市府認證品牌目前也缺執行證明，這項先估0%。'
 ],
 bulletin_2022_taipei_2_1:[
  '已免費開放有鏡牆、冷氣的練舞場，租借系統也在2024年9月5日接上台北通。',
  '部分據點仍要電話確認，還不能證明所有場地都能直接線上預約。',
  '民間開課與民間補助仍找不到執行證明，這兩項先估0%。'
 ],
 bulletin_2022_taipei_2_2:[
  '動物之家已於2024年8月1日開工，但建築還沒完工。',
  '已有學校辦動保課程，還沒有資料證明所有學校都已辦理。',
  '北捷在2026年4月11日辦過單日寵物列車，還找不到固定寵物車廂的服務證明。'
 ],
 bulletin_2022_taipei_3_3:[
  '青銀換居已有30戶完成，原屋也已交由包租代管。',
  '但還不清楚房子是否租給年輕人，也沒找到市府修繕補助的執行證明，補助這項先估0%。'
 ],
 bulletin_2022_penghu_5_1:[
  '垃圾發電園區已完成可行性審查與公聽會，土地與設廠程序還沒辦完。',
  '園區還沒開始發電，2026年的垃圾也仍送到外縣市焚燒。'
 ]
};
const explanationLength=value=>Array.from(value).length;
function explanationShort(text,max=78){
 const clean=String(text||'').replace(/\s+/g,' ').trim().replace(/[。；，\s]+$/u,'');
 if(explanationLength(clean)<=max)return clean;
 const head=Array.from(clean).slice(0,max-1).join('');
 const boundary=Math.max(head.lastIndexOf('，'),head.lastIndexOf('；'));
 return boundary>max*.45?head.slice(0,boundary):`${head.replace(/[，、；：\s]+$/u,'')}…`;
}
function explanationSentence(text){return `${explanationShort(text)}。`;}
function explanationResult(lines){
 const sentences=lines.filter(line=>String(line||'').replace(/[\s。；，]/gu,'')).slice(0,3).map(explanationSentence);
 return sentences.length?{summary:sentences[0],reasons:sentences.slice(1)}:null;
}
function explanationNames(parts,budget=32){
 const labels=parts.map(p=>String(p.label||p.quoteAnchor||'這項政策'));
 if(explanationLength(labels.join('、'))<=budget)return labels.join('、');
 const suffix=parts.length>1?'等政策':'';
 return explanationShort(labels[0],budget-explanationLength(suffix))+suffix;
}
function explanationIsEstimate(p){
 return !p.scored&&p.estimate&&Number.isFinite(p.estimate.percent)&&p.estimate.percent>=0&&p.estimate.percent<100&&p.estimate.reason;
}
function explanationPlainFact(text){
 let value=String(text||'').replace(/\s+/g,' ').trim()
  .replace(/^(?:保守(?:下限)?估分|依現有證據估分|階段估分)[^：]*：/u,'')
  .replace(/^本輪(?:直接)?(?:重開|核讀)[^，；。]*[，；](?:明列|確認)?/u,'')
  .replace(/^(?:已核對|再次核對|再次核讀|重新查|補核)[^，：。；]*[，：]/u,'')
  .replace(/^本輪追查到/u,'').replace(/可核對/gu,'可確認')
  .replace(/^(?:報告|白皮書)(?:PDF)?(?:第)?[\d–—至、\-]+(?:頁|項)[：，]?/u,'')
  .replace(/^PDF第[\d–—至、\-]+頁[：，]?/u,'')
  .replace(/^(?:白皮書|報告)[^：。；]{0,12}：/u,'')
  .replace(/^[^：。；]{1,16}章[：]/u,'')
  .replace(/^[^，。；]{1,8}章列/u,'').replace(/^明列/u,'')
  .replace(/^原文[^，；。]*，(?=已有)/u,'')
  .replace(/^(?:官方|市府)(?:新聞稿|報告)[^：。；]{0,15}[：]/u,'')
  .replace(/尚欠|仍欠|尚缺/gu,'還缺').replace(/尚無/gu,'還沒有').replace(/尚未/gu,'還沒').replace(/仍待/gu,'還要')
  .replace(/還缺核實/gu,'還不清楚').replace(/細部設計/gu,'詳細設計')
  .replace(/屬當期籌備/gu,'還在籌備').replace(/實測溫度/gu,'溫度');
 value=value.split('。')[0];
 const clauses=value.split('；').filter(clause=>! /^(?:按|以.*(?:認定|計|算)|符合|確認.*(?:措施|服務|行動)|原文|100%|不(?:以|把|將)|採|本次|此為|這是|不代表|歷年活動保留)/u.test(clause.trim()));
 value=clauses.join('；').replace(/，(?:按|依)[^，。]{0,35}(?:估分|認定|判定).*$/u,'')
  .replace(/，(?:符合|確認)(?:原文|措施|服務|增加路線行動|方案推動).*$/u,'')
  .replace(/，符合.*(?:措施|里程碑).*$/u,'')
  .replace(/，原文.*(?:已實施|里程碑).*$/u,'')
  .replace(/，(?:對應.*實施|屬部分.*實施|按.*階段評估)$/u,'')
  .replace(/，整體[^，；。]*缺共同完成標準/u,'，但還不清楚整體改善了多少')
  .replace(/沒有([^，；。]{1,20})整體分母/u,'還沒有$1的整體完成比例')
  .replace(/，不將各標段等權平均當路網完成率/u,'')
  .replace(/，(?:先|暫)?按[^，；。]{0,30}估(?:\d+(?:分|%)|分).*$/u,'')
  .replace(/，不沿用歷史[^；。]*$/u,'');
 return value;
}
function explanationPartFacts(part,count=2){
 return String(part?.reason||'').split('。').slice(0,count).map(explanationPlainFact).filter(Boolean);
}
function explanationProgressFact(part){
 const facts=explanationPartFacts(part);
 if(facts.length)return facts.join('；');
 const estimate=explanationPlainFact(part.estimate?.reason);
 if(estimate)return estimate;
 const evidence=(part.sources||part.extraSources||[]).map(s=>explanationPlainFact(s.evidence)).find(Boolean);
 return evidence||`${explanationNames([part])}已有部分進展，還缺完整成果說明`;
}
function explanationProof(part){
 const direct=explanationPlainFact(part.reason);
 if(direct&&!/原文未訂|認列|里程碑|本次依/u.test(direct))return direct;
 const evidence=(part.sources||part.extraSources||[]).map(s=>explanationPlainFact(s.evidence)).find(Boolean);
 return evidence||direct||`${explanationNames([part])}已完成`;
}
function explanationActual(parts){
 if(parts.length===1&&/(?:沒有|尚無)更新的(?:全線|全園區)/u.test(parts[0].reason||'')){
  const p=parts[0],tail=String(p.reason).split('%').slice(1).join('%').replace(/^[，。；]/u,'')
   .split('。').map(explanationPlainFact).filter(Boolean).join('；').replace(/，先採[^；。]*$/u,'');
  return `${p.label}最後查到的整體進度為${formatPolicyPercent(p.percent)}（${p.asOf}）；${tail}`;
 }
 const dates=[...new Set(parts.map(p=>p.asOf).filter(Boolean))];
 const versionDate=dates.find(date=>/圖檔版本\s*\d{4}-\d{2}/u.test(date)&&/未標統計日/u.test(date));
 if(versionDate){
  const version=versionDate.match(/圖檔版本\s*(\d{4}-\d{2})/u)[1];
  const values=parts.map(p=>`${explanationNames([p],10)}為${formatPolicyPercent(p.percent)}`).join('、');
  return `${values}；${dates.length>1?'部分':''}圖檔為${version}版，未標統計日`;
 }
 const date=dates.length===1&&/^\d{4}-\d{2}-\d{2}$/u.test(dates[0])?`${dates[0]}的資料顯示，`:'';
 return `${date}${parts.map(p=>`${explanationNames([p],16)}為${formatPolicyPercent(p.percent)}`).join('、')}`;
}
function explanationGap(parts){
 const historical=parts.some(p=>p.historical);
 if(parts.length===1&&!historical&&/已能確認|已有個別/u.test(parts[0].reason||'')){
  return `${explanationPartFacts(parts[0]).join('；')}，這項先估0%`;
 }
 return `${explanationNames(parts,historical?29:35)}${historical?'只查到以前的紀錄，現在進度還不清楚':'目前還找不到執行的證明'}，先估0%`;
}

// These layouts read changing quantities and qualifications from the reviewed
// parts, rather than freezing another copy of the latest research numbers.
function explanationScopedLayout(progress){
 const part=id=>progress.parts.find(p=>p.id===id);
 if(progress.id==='bulletin_2022_taichung_9'){
  const local=part('p1'),central=part('p2');
  const started=p=>p?.reason?.match(/已興辦([\d,]+)戶/u)?.[1];
  const completed=p=>p?.reason?.match(/其中([\d,]+)戶(?:已)?完工/u)?.[1];
  if([started(local),started(central),completed(local),completed(central)].every(Boolean)&&local.asOf===central.asOf)return [
   `截至${local.asOf}，市府自辦社宅已啟動${started(local)}戶，中央已啟動${started(central)}戶`,
   `其中實際完工分別為${completed(local)}戶及${completed(central)}戶，其餘仍在施工或等開工，還不能全部入住`,
   '分數依原文的「興辦」目標計算，完工戶數另外列出'
  ];
 }
 if(progress.id==='bulletin_2022_taichung_5'){
  const care=part('p1'),centres=part('p3'),kindergarten=part('p2');
  const coverage=centres?.reason?.match(/涵蓋(\d+)個行政區/u)?.[1];
  const total=centres?.reason?.match(/用\d+除以(\d+)/u)?.[1];
  const unopened=centres?.reason?.match(/。([^。]+)在這份名冊仍未開辦/u)?.[1];
  if(coverage&&total&&unopened)return [
   `親子館涵蓋${total}區中的${coverage}區；${unopened}在這份名冊還沒開辦`,
   explanationProgressFact(care),explanationProof(kindergarten)
  ];
 }
 if(progress.id==='bulletin_2022_tainan_3_3'){
  const delivered=part('p3'),uncertain=part('p2');
  if(delivered?.scored&&delivered.percent===100&&delivered.deliveredBeforeTerm)return [
   `虎頭埤全齡遊憩場已於${delivered.asOf}完工交付，時間在本任期開始前`,
   '2026年9月29日公告部分遊區因災修暫停開放，不能當作現在全部可使用',
   uncertain?.estimate?.percent===0?'關子嶺景觀園區還缺同一範圍的完成證明，這項先估0%':explanationProgressFact(uncertain)
  ];
 }
 if(progress.id==='bulletin_2022_penghu_5_2'){
  const studied=part('p1'),space=part('p2'),support=part('p3');
  if(studied?.scored&&studied.percent===100&&space?.historical)return [
   `${explanationProof(studied)}；完成的是用途研議，不代表會展場館已建成`,
   `指定青創空間只查到${space.asOf}未提供的舊紀錄，現在是否啟用還不清楚，先估0%`,
   support?.scored?explanationProof(support):explanationProgressFact(support)
  ];
 }
 return null;
}

/** Describe delivered work and remaining gaps without recalculating any score. */
export function policyScoreExplanation(progress){
 if(!progress)return {summary:'目前還沒有足夠資料說明進度。',reasons:[]};
 const active=(progress.parts||[]).filter(p=>p.status!=='not_applicable');
 if(!active.length)return {summary:'這條是政治立場或任前背景，不計完成度。',reasons:[]};
 const plain=EXPLANATION_PLAIN_CASES[progress.id];
 if(plain)return {summary:plain[0],reasons:plain.slice(1)};
 const scoped=explanationScopedLayout(progress);
 if(scoped)return explanationResult(scoped);
 const done=active.filter(p=>p.scored&&p.status==='completed'&&p.percent===100);
 const zero=active.filter(p=>p.scored&&p.status==='not_implemented'&&p.percent===0);
 const actual=active.filter(p=>p.scored&&!done.includes(p)&&!zero.includes(p));
 const estimates=active.filter(explanationIsEstimate),gaps=estimates.filter(p=>p.estimate.percent===0),positive=estimates.filter(p=>p.estimate.percent>0);
 const lines=[];
 if(done.length)lines.push(explanationProof(done[0]));
 if(actual.length)lines.push(explanationActual(actual));
 let positiveIncluded=false;
 if(!lines.length&&positive.length){lines.push(explanationProgressFact(positive[0]));positiveIncluded=true;}
 if(zero.length&&gaps.length){
  lines.push(`${explanationNames(zero,16)}還沒做到；${explanationGap(gaps)}`);
 }else if(zero.length){
  lines.push(zero.map(p=>explanationPlainFact(p.reason)||`${explanationNames([p])}還沒做到`).join('；'));
 }else if(gaps.length){
  lines.push(explanationGap(gaps));
 }
 if(positive.length&&!positiveIncluded&&lines.length<3){
  const facts=positive.map(explanationProgressFact).filter(Boolean);
  if(facts.length)lines.push(facts.slice(0,2).join('；'));
 }
 if(done.length===active.length&&done.length>1)lines.push(explanationProof(done[1]));
 if(!lines.length)lines.push(`${explanationNames(active)}目前還找不到足夠的執行資料`);
 return explanationResult(lines)||{summary:'目前還沒有足夠資料說明進度。',reasons:[]};
}
