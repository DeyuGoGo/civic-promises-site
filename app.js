import {SCORING_RESEARCH} from './scoring-research-data.js';
import {readRoute,makePolicyHash,makeCountyHash,policyShareUrl} from './navigation.js';
import {estimateCoverage,policyDateSummary} from './presentation.js';
import {policyScoreExplanation} from './policy-explanation.js';
import {policyProgress,countyPolicyProgress,formatPolicyPercent,policyScoreLabel} from './policy-progress.js';
import {OVERVIEW_TOPICS,topicFor} from './overview.js';
import {completeBulletinResearch,bulletinAssessments,BULLETIN_REVIEW_BATCH} from './bulletins.js';
import {CURRENT_COLLECTION_BATCH} from './expansion.js';
import {attainmentFor,attachAssessments,reviewedAssessment,progressRecords,hasKnownProgress,CURRENT_REVIEW_BATCH} from './attainment.js';
import {MAP_SHAPES} from './map-data.js';
import {partyStyle,COUNTY_GROUPS,pageFromHash,bulletinPolicyTitle} from './home.js';
import {COUNTIES,STAGES,validateDataset,selectPromises,countyRows,metricLabel,safeUrl,sourceHref} from './model.js';
import {adaptResearch,FIELD_LABELS} from './research.js';
const ingest=d=>d?.cities?adaptResearch(d):validateDataset(d);
const $=id=>document.getElementById(id);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const evidenceLabels={unverified:'尚未查核',partial:'部分證據',verified:'已有查核記錄',disputed:'證據有爭議'};
let data={schemaVersion:1,updatedAt:null,promises:[]};let baseData=null;let sourceVersion=0;
let selectedCounty=null,detailCounty=null,countyTrigger=null,countyTriggerIsMap=false;
let detailTrigger=null,detailSheetScroll=0;
let selectedTopic='';
let lastStaticData=null,dataLoading=false;
let activePolicyId=null,detailReturnHash='#home',countyReturnHash='#home',loadComplete=false;
let skipDetailClose=0,skipCountyClose=0;
let currentPage='home';
function focusSelector(trigger){
 for(const [key,attribute] of [['detail','data-detail'],['city','data-city'],['mapCity','data-map-city'],['county','data-county']]){
  if(trigger?.dataset?.[key])return `[${attribute}="${String(trigger.dataset[key]).replace(/[\\"]/g,'\\$&')}"]`;
 }
 return null;
}
function pushDialogRoute(hash,parent,trigger){
 if(!globalThis.history?.pushState)return;
 const view={left:globalThis.scrollX||0,top:globalThis.scrollY||0,focus:focusSelector(trigger),sheetTop:$('city-sheet').open?$('city-sheet').scrollTop||0:0};
 globalThis.history.replaceState?.({...globalThis.history.state,civicView:view},'',parent);
 globalThis.history.pushState({civicDialog:true,civicParent:parent,civicPage:currentPage},'',hash);
}
function returnDialogRoute(fallback){
 if(globalThis.history?.state?.civicDialog&&globalThis.history.state.civicParent===fallback){globalThis.history.back();return true;}
 if(globalThis.history?.replaceState){globalThis.history.replaceState(null,'',fallback);route();return true;}
 return false;
}
function restoreRouteView(view,page){
 if(view&&typeof view==='object'){
  if($('city-sheet').open)$('city-sheet').scrollTop=Number.isFinite(view.sheetTop)?view.sheetTop:0;
  const target=typeof view.focus==='string'?($('city-sheet').open?$('city-content'):$(page)).querySelector?.(view.focus):null;
  (target||$(page)).focus?.({preventScroll:true});
  globalThis.scrollTo?.({left:Number.isFinite(view.left)?view.left:0,top:Number.isFinite(view.top)?view.top:0,behavior:'instant'});
 }else if(!$('detail').open&&!$('city-sheet').open){
  $(page).focus({preventScroll:true});globalThis.scrollTo?.({top:0,behavior:'instant'});
 }
}
function policyDatesMarkup(p,progress){const dates=policyDateSummary(p,progress);return `<div class="policy-dates"><span>${escape(dates.checkedLabel)}</span><span>${escape(dates.evidenceLabel)}</span></div>`;}
const shortParty=label=>({'中國國民黨':'國民黨','民主進步黨':'民進黨','台灣民眾黨':'民眾黨','無推薦政黨':'無推薦政黨'}[label]||label);
const completionLabel=progress=>policyScoreLabel(progress?.score);
function renderMap(summaries){
 $('taiwan-map').innerHTML=`<svg viewBox="0 0 640 720" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="2022 當選時推薦政黨配色，22縣市政策平均完成度（含保守估分）">${MAP_SHAPES.map(shape=>{const party=partyStyle(data.cities?.find(c=>c.name===shape.name)),summary=summaries.find(c=>c.county===shape.name),rate=completionLabel(summary),[x,y]=shape.label;return `<g class="map-county ${party.className}${shape.inset?' map-island':''}" data-map-city="${shape.name}" tabindex="0" role="button" aria-haspopup="dialog" aria-pressed="${selectedCounty===shape.name}" aria-label="${shape.name}，政策平均完成度（含保守估分）${escape(rate)}，${escape(party.label)}，查看政策列表"><title>${shape.name} · ${escape(rate)} · 2022當選時推薦政黨：${escape(party.label)}</title>${shape.inset?`<rect class="island-frame" x="${shape.inset[0]}" y="${shape.inset[1]}" width="${shape.inset[2]}" height="${shape.inset[3]}" rx="10"/>`:''}<path class="county-shape" d="${shape.d}" fill-rule="evenodd"/><rect class="map-label-hit" x="${x-48}" y="${y-21}" width="96" height="39" rx="5"/><text class="map-label" x="${x}" y="${y-(shape.inset?8:0)}" text-anchor="middle">${shape.name}</text><text class="map-completion-label" x="${x}" y="${y+(shape.inset?10:17)}" text-anchor="middle">${escape(rate)}</text></g>`;}).join('')}<g class="map-leaders" aria-hidden="true">${MAP_SHAPES.filter(shape=>shape.anchor).map(shape=>{const [x,y]=shape.label;return `<path class="map-leader" d="M${shape.anchor.join(',')} L${x<300?x+48:x-48},${y-5}"/><circle class="map-anchor" cx="${shape.anchor[0]}" cy="${shape.anchor[1]}" r="2.4"/>`;}).join('')}</g></svg>`;
}
function renderDirectory(){
 const summaries=countyPolicyProgress(data.promises);renderMap(summaries);renderMethod(summaries);
 $('county-directory').innerHTML=COUNTY_GROUPS.map(([region,names])=>`<section class="county-region" aria-label="${escape(region)}"><h3>${escape(region)}</h3><div class="region-counties">${names.map(name=>{const summary=summaries.find(c=>c.county===name),party=partyStyle(data.cities?.find(c=>c.name===name)),rate=completionLabel(summary);return `<button class="county-rate ${party.className}" type="button" data-city="${name}" aria-haspopup="dialog" aria-pressed="${selectedCounty===name}" title="${summary?.eligible?`${summary.applicable} 個分項；${summary.score.estimated} 項採保守估分`:'查核資料未齊'}" aria-label="${name}，政策平均完成度（含保守估分）${escape(rate)}，${summary?.eligible?`${summary.applicable} 個分項，${summary.score.estimated} 項估分，`: ''}2022當選時推薦政黨：${escape(party.label)}，查看政策列表"><span>${name}</span><strong>${escape(rate).replace('%','<small>%</small>')}</strong><small class="county-party"><i class="party-dot" aria-hidden="true"></i>${escape(shortParty(party.label))}</small><small class="county-coverage">${summary?.eligible?escape(estimateCoverage(summary.score)):'資料待齊'}</small></button>`;}).join('')}</div></section>`).join('');
}
function renderMethod(summaries){
 const eligible=summaries.length===22&&summaries.every(c=>c.eligible);
 const total=eligible?summaries.reduce((n,c)=>({originals:n.originals+c.total,applicable:n.applicable+c.applicable,measured:n.measured+c.score.measured,estimated:n.estimated+c.score.estimated,excluded:n.excluded+c.excludedParts}),{originals:0,applicable:0,measured:0,estimated:0,excluded:0}):null;
 const count=n=>n.toLocaleString('zh-TW');
 $('home-data-summary').innerHTML=total?`<div><span>縣市</span><strong>${summaries.length}</strong></div><div><span>公報政見</span><strong>${count(total.originals)}<small>條</small></strong></div><div><span>適用分項</span><strong>${count(total.applicable)}<small>項</small></strong></div><div><span>直接計分</span><strong>${count(total.measured)}<small>項</small></strong></div><div><span>估分</span><strong>${count(total.estimated)}<small>項</small></strong></div><p>2022 選舉公報 · 另 ${count(total.excluded)} 項不適用</p><small>查核紀錄更新：${escape(SCORING_RESEARCH.followup.checkedAt)}</small>`:'<p>目前資料無可用的整體統計。</p>';
 $('method-data-summary').textContent=total?`${count(total.originals)} 條政見 · ${count(total.applicable)} 適用分項 · ${count(total.measured)} 直接計分 · ${count(total.estimated)} 估分 · ${count(total.excluded)} 不適用`:'目前載入資料不完整，無法顯示全體計分項數；匯入資料不會自動沿用原資料的百分比。';
 $('method-research').innerHTML=`<ol class="method-research-list">${SCORING_RESEARCH.sources.map(s=>`<li><a href="${escape(safeUrl(s.url)||'#')}" target="_blank" rel="noopener noreferrer">${escape(s.title)} ↗</a><small>${escape(s.sourceRole)} · ${escape(s.evidencePeriod||s.sourceDate||'來源未標日期')}</small></li>`).join('')}</ol>`;
}
function openCounty(name,trigger,{fromRoute=false}={}){
 if(!COUNTIES.includes(name))return;
 countyReturnHash=fromRoute?(globalThis.history?.state?.civicParent||'#home'):(globalThis.location?.hash||'#home');
 if(!fromRoute)pushDialogRoute(makeCountyHash(name),countyReturnHash,trigger);
 selectedCounty=name;if(trigger){countyTrigger=trigger;countyTriggerIsMap=!!trigger.dataset?.mapCity;}
 const city=data.cities?.find(c=>c.name===name),pledges=data.promises.filter(p=>p.county===name);
 const categories=OVERVIEW_TOPICS.map(topic=>({...topic,policies:pledges.filter(p=>topicFor(p)===topic.id)})).filter(topic=>topic.policies.length);
 $('city-content').innerHTML=`<div class="county-detail-heading"><div><h2 id="city-title">${name}</h2><p class="city-head">2022 選舉公報 · ${escape(city?.electedHead||'')}</p></div></div>
 <div class="sheet-pledges grouped-policy-list">${categories.length?categories.map(topic=>`<section class="policy-category" data-policy-topic="${topic.id}"><h3>${escape(topic.label)}</h3><div class="flat-policy-list">${topic.policies.map(p=>{
  const progress=policyProgress(p),value=policyScoreLabel(progress?.score);
  return `<button data-detail="${escape(p.id)}" class="sheet-pledge" data-completed="${progress?.isComplete===true}"><span class="sheet-pledge-title">${escape(bulletinPolicyTitle(p))}</span><strong class="policy-list-progress" data-estimated="${!!progress?.score?.estimated}"${value==='—'?' aria-label="尚無可用百分比"':''}>${escape(value)}</strong></button>`;
 }).join('')}</div></section>`).join(''):'<p class="muted">目前尚未載入這個縣市的政見資料。</p>'}</div>
 <details class="sheet-extra"><summary>資料與計算方式</summary><a class="sheet-attainment" href="#attainment" id="sheet-attainment">原始查核紀錄 →</a><a class="sheet-method" href="#method" id="sheet-method">計算方式與資料下載 ↗</a></details>`;
 $('sheet-attainment').onclick=()=>{$('query').value='';$('county').value=name;$('stage').value='';$('attainment-kind').value='';render();$('city-sheet').close();};
 $('sheet-method').onclick=()=>{$('city-sheet').close();};
 renderDirectory();$('city-sheet').showModal();$('city-sheet').scrollTop=0;
}
function policyHistoryMarkup(part){
 const rows=part.history||[];if(!rows.length)return '';
 const stages={completed:'已完成',in_progress:'執行中',not_implemented:'未實施',unknown:'待確認',not_applicable:'不適用'};
 return `<details class="policy-history"><summary>較早紀錄（${rows.length}）</summary><p>保留原證據日期，以下舊數值不重複納入平均。</p><ol>${rows.map(v=>`<li><time>${escape(v.asOf)}</time> · ${escape(stages[v.status]||v.status)}${Number.isFinite(v.percent)?' · '+escape(formatPolicyPercent(v.percent)):''}<p>${escape(v.reason)}</p>${(v.sourceUrls||[]).map((url,i)=>`<a href="${escape(safeUrl(url)||'#')}" target="_blank" rel="noopener noreferrer">歷史來源 ${i+1} ↗</a>`).join(' ')}</li>`).join('')}</ol></details>`;
}
function policyPartsMarkup(p){
 const progress=policyProgress(p);
 if(!progress)return '<p>尚未附掛分項查核資料，無法計算。</p>';
 const score=progress.score;
 const operands=progress.parts.filter(part=>part.status!=='not_applicable').map(part=>part.scored?part.percent:part.estimate?.percent);
 const formula=Number.isFinite(score.percent)?`${operands.length<=10?'（'+operands.join(' + ')+'）':score.sum.toFixed(2)} ÷ ${score.applicable} = ${formatPolicyPercent(score.percent)}`:'';
 return `<div class="parts-summary"><strong><small>整條完成度${score.estimated?'（含估分）':''}</small> ${escape(policyScoreLabel(score))}</strong><span>已確認 ${progress.completed} / ${progress.applicable} 個分項完成${score.estimated?` · ${score.estimated} 項採保守估分`:''}</span></div><p class="completion-item-note">${score.estimated?'實際進度與保守估分一起平均；估分0%只是暫未給完成分，不代表確認沒做。':'所有適用分項均有數值，按分項等權平均。'}</p>${formula?`<p class="score-formula">${escape(formula)}</p>`:''}<ol class="policy-parts">${progress.parts.map(part=>{
  const factualValue=part.status==='not_applicable'?'不適用':part.historical?`${part.percent===null?'未量化':part.percent+'%'} · 歷史紀錄`:part.percent!==null?`${part.lowerBound?'至少 ':''}${formatPolicyPercent(part.percent)}`:part.status==='in_progress'?'已有進度 · 無整項百分比':part.researchReview?'已核對 · 證據不足':'尚無可用百分比';
  const value=part.estimate?`估分 ${formatPolicyPercent(part.estimate.percent)}`:factualValue;
  const tone=part.estimate?'warning':part.status==='completed'?'success':part.status==='in_progress'?'progress':'neutral';
  return `<li class="policy-part"><div class="part-heading"><h4>${escape(part.label)}</h4><strong class="overview-tone ${tone}">${escape(value)}</strong></div>${part.estimate?`<p class="estimate-basis"><strong>估分理由：</strong>${escape(part.estimate.reason)}</p><p class="part-factual-state">查核狀態：${escape(factualValue)}</p>`:''}<p>${escape(part.reason)}</p>${part.supportingMetrics?.length?`<div class="part-evidence-metrics"><span>局部進度紀錄 · 未當作整項百分比</span>${part.supportingMetrics.map(v=>`<p><strong>${escape(v.label)} · ${v.lowerBound?'至少 ':''}${escape(v.percent)}%</strong><small>${escape(v.asOf)}</small>${v.sources?.map((source,i)=>` <a href="${escape(safeUrl(source.url)||'#')}" target="_blank" rel="noopener noreferrer">來源 ${i+1} ↗</a>`).join('')||''}</p>`).join('')}</div>`:''}<p class="part-date">${part.asOf?'證據日期：'+escape(part.asOf):'來源未提供明確資料日期'}${part.historical?' · 僅歷史狀態，未採為目前百分比':''}${part.lastCheckedAt?' · 逐項查核：'+escape(part.lastCheckedAt):''}</p>${policyHistoryMarkup(part)}<details><summary>判準與來源</summary><blockquote>${escape(part.quoteAnchor)}</blockquote>${part.fulfillmentCriterion?`<p>完成標準：${escape(part.fulfillmentCriterion)}</p>`:''}${part.calculation?`<p>計算依據：${escape(`${part.calculation.baseline!==undefined?'（'+part.calculation.current+'−'+part.calculation.baseline+'）÷（'+part.calculation.target+'−'+part.calculation.baseline+'）':part.calculation.numerator+' ÷ '+part.calculation.denominator} × 100`)}</p>`:''}${part.limitations.length?`<ul>${part.limitations.map(l=>`<li>${escape(l)}</li>`).join('')}</ul>`:''}${part.sources.length?part.sources.map(source=>`<article class="source"><a href="${escape(safeUrl(source.url)||'#')}" target="_blank" rel="noopener noreferrer">${escape(source.title)} ↗</a><p>${escape(source.evidence)}</p>${source.publishedAt||source.asOf?`<small>資料日期：${escape(source.publishedAt||source.asOf)}</small>`:''}${source.verifiedThisRound===false?'<small>未完整核讀全文；未作百分比依據。</small>':''}</article>`).join(''):'<p>缺少直接證據；未填0%。</p>'}</details></li>`;
 }).join('')}</ol>`;
}
function closeDataDialogs(){
 detailCounty=null;selectedCounty=null;activePolicyId=null;
 if($('detail').open){skipDetailClose++;$('detail').close();}
 if($('city-sheet').open){skipCountyClose++;$('city-sheet').close();}
}
function route(){
 const current=readRoute(globalThis.location?.hash),isDialog=!!(current.policyId||current.county);
 const page=isDialog&&globalThis.history?.state?.civicDialog?readRoute(globalThis.history.state.civicPage).page:current.page;
 const hadCounty=selectedCounty!==null;
 closeDataDialogs();
 if(hadCounty&&loadComplete)renderDirectory();
 currentPage=page;
 $('home-status').textContent='';
 for(const id of ['home','ranking','promises','attainment','bulletins','method','data-tools'])$(id).hidden=id!==page;
 $('search-tools').hidden=!['ranking','promises','attainment'].includes(page);
 document.title=({home:'2026 縣市首長 政策執行率',ranking:'排行榜',attainment:'進度紀錄',promises:'主要議題',bulletins:'選舉公報全文',method:'評分方法','data-tools':'資料下載'}[page])+(page==='home'?'':'｜2026 縣市首長 政策執行率');
 for(const link of document.querySelectorAll('header nav a')){
  if(link.getAttribute('href')==='#'+page)link.setAttribute('aria-current','page');
  else link.removeAttribute('aria-current');
 }
 $(page).setAttribute('tabindex','-1');
 if(!loadComplete)return;
 if(current.policyId){
  const policy=data.promises.find(p=>p.id===current.policyId);
  if(policy){
   const parent=globalThis.history?.state?.civicParent;
   if(!parent||readRoute(parent).county)openCounty(policy.county,null,{fromRoute:true});
   showDetail(policy.id,null,{fromRoute:true});
  }else status('找不到這條政策，請從縣市或主要議題查找。','error');
 }else if(current.county){
  if(COUNTIES.includes(current.county))openCounty(current.county,null,{fromRoute:true});
  else status('找不到這個縣市，請從縣市列表查找。','error');
 }
 restoreRouteView(isDialog&&current.policyId?null:globalThis.history?.state?.civicView,page);
}

globalThis.addEventListener?.('hashchange',route);
const skipLink=document.querySelector?.('.skip');
if(skipLink)skipLink.onclick=e=>{e.preventDefault();$(currentPage).focus({preventScroll:true});$(currentPage).scrollIntoView({block:'start',behavior:'instant'});};
$('taiwan-map').onclick=e=>{const btn=e.target.closest('[data-map-city]');if(btn)openCounty(btn.dataset.mapCity,btn);};
$('taiwan-map').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){const btn=e.target.closest('[data-map-city]');if(btn){e.preventDefault();openCounty(btn.dataset.mapCity,btn);}}};
$('county-directory').onclick=e=>{const btn=e.target.closest('[data-city]');if(btn)openCounty(btn.dataset.city,btn);};
$('city-content').onclick=e=>{const btn=e.target.closest('[data-detail]');if(btn)showDetail(btn.dataset.detail,btn);};
$('city-sheet').addEventListener('close',()=>{
 if(skipCountyClose){skipCountyClose--;return;}
 if($('detail').open)return;
 const current=readRoute(globalThis.location?.hash);
 if(current.county&&returnDialogRoute(countyReturnHash))return;
 const closedCounty=selectedCounty;selectedCounty=null;renderDirectory();
 const page=pageFromHash(countyReturnHash);
 if(!['home','ranking'].includes(page)||current.page!==page)return;
 const selector=page==='home'?`[${countyTriggerIsMap?'data-map-city':'data-city'}="${closedCounty}"]`:`[data-county="${closedCounty}"]`;
 (document.querySelector?.(selector)||countyTrigger)?.focus({preventScroll:true});
});
$('detail').addEventListener('close',()=>{
 if(skipDetailClose){skipDetailClose--;return;}
 activePolicyId=null;
 if(readRoute(globalThis.location?.hash).policyId&&returnDialogRoute(detailReturnHash)){detailTrigger=null;return;}
 if(detailCounty){detailCounty=null;$('city-sheet').showModal();$('city-sheet').scrollTop=detailSheetScroll;}
 detailTrigger?.focus?.({preventScroll:true});detailTrigger=null;
});
$('detail-back').onclick=()=>$('detail').close();
$('copy-policy-link').onclick=async()=>{
 if(!activePolicyId||data!==baseData)return;
 const copiedPolicy=activePolicyId;
 try{
  const base=/^https?:/.test(globalThis.location?.href||'')?globalThis.location.href:'https://deyugogo.github.io/civic-promises-site/';
  const url=policyShareUrl(base,copiedPolicy);
  $('policy-share-url').value=url;
  if(!globalThis.navigator?.clipboard?.writeText)throw Error('clipboard unavailable');
  await globalThis.navigator.clipboard.writeText(url);
  if(activePolicyId===copiedPolicy)$('policy-share-status').textContent='已複製政策連結';
 }catch{
  if(activePolicyId!==copiedPolicy)return;
  $('policy-share-url').hidden=false;$('policy-share-url').focus();$('policy-share-url').select?.();
  $('policy-share-status').textContent='請複製下方連結';
 }
};
for(const [button,target] of [['jump-counties','county-directory'],['jump-topics','home-topics']])$(button).onclick=()=>{$(target).scrollIntoView({block:'start',behavior:'instant'});$(target).focus({preventScroll:true});};
const homeMapMedia=globalThis.matchMedia?.('(max-width:600px)');
if(homeMapMedia){const syncMap=()=>{$('home-map-toggle').open=!homeMapMedia.matches;};syncMap();homeMapMedia.addEventListener?.('change',syncMap);}
$('import-trigger').onclick=()=>$('import-file').click();
$('county').insertAdjacentHTML('beforeend',COUNTIES.map(c=>`<option>${c}</option>`).join(''));
$('stage').insertAdjacentHTML('beforeend',Object.entries(STAGES).map(([v,t])=>`<option value="${v}">${t}</option>`).join(''));
const filters=()=>({query:$('query').value,county:$('county').value,stage:$('stage').value});
function render(){
 if(lastStaticData!==data){renderDirectory();renderBulletins();lastStaticData=data;}
 const f=filters(),rows=countyRows(data.promises,f),ps=selectPromises(data.promises,f);
 renderAttainment();
 if(data.cities)rows.sort((a,b)=>(data.cities.find(c=>c.name===a.county)?.displayOrder??99)-(data.cities.find(c=>c.name===b.county)?.displayOrder??99));
 $('loaded-count').textContent=String(data.promises.length);
 $('coverage-warning').textContent=data.research?.metadata.coverageWarning||'未提供縣市排名。';
 $('stage-filter').hidden=!!data.research&&!data.promises.some(p=>p.stage!=='unknown');
 $('county-result').textContent=`顯示 ${rows.length} / 22 縣市`;
 $('county-rows').innerHTML=rows.map(r=>`<tr><td aria-label="暫不排名">—</td><td>${r.county}${data.cities?`<small class="head-name">2022 當選：${escape(data.cities.find(c=>c.name===r.county)?.electedHead||'待確認')}</small>`:''}</td><td>尚無法計算</td><td><span class="pill">未提供排名</span></td><td>${r.loaded} 項</td><td><button class="row-link" data-county="${r.county}" aria-label="查看${r.county}政見">查看政見 ↗</button></td></tr>`).join('');
 $('county-empty').hidden=rows.length>0;$('county-rows').closest('.table-wrap').hidden=!rows.length;
 renderTopics(ps);
 $('updated-at').textContent=data.research?.metadata.completeBulletins?`查核紀錄更新：${SCORING_RESEARCH.followup.checkedAt}`:`資料${data.research?'查閱':'整理'}日期：${data.updatedAt??'尚未提供'}`;
}
function renderTopics(ps){
 const groups=OVERVIEW_TOPICS.map(topic=>({...topic,policies:ps.filter(p=>topicFor(p)===topic.id)}));
 $('topic-all').setAttribute('aria-pressed',String(!selectedTopic));
 $('topic-filters').innerHTML=groups.map(topic=>`<button type="button" class="topic-choice" data-topic="${topic.id}" aria-pressed="${selectedTopic===topic.id}" aria-controls="promise-list"><span class="topic-choice-top"><strong>${escape(topic.label)}</strong><span>${topic.policies.length}<small> 條</small></span></span><span class="topic-description">${escape(topic.description)}</span></button>`).join('');
 const shown=groups.filter(topic=>(!selectedTopic||topic.id===selectedTopic)&&topic.policies.length);
 const count=shown.reduce((sum,topic)=>sum+topic.policies.length,0);
 const label=OVERVIEW_TOPICS.find(topic=>topic.id===selectedTopic)?.label||'全部議題';
 $('promise-result').textContent=`${label} · ${count} 條政見`;
 $('promise-list').innerHTML=shown.map(topic=>`<section class="topic-results" data-topic-group="${topic.id}" aria-label="${escape(topic.label)}"><div class="topic-results-heading"><h3>${escape(topic.label)}</h3><span>${topic.policies.length} 條</span></div><div class="topic-policy-list">${topic.policies.map(p=>{
  if(p.raw?.collectionSource==='complete-bulletin'){
   const score=policyProgress(p)?.score,value=policyScoreLabel(score);
   return `<article class="topic-policy"><button type="button" data-detail="${escape(p.id)}" class="topic-policy-button"><span class="topic-policy-copy"><span class="topic-policy-county">${escape(p.county)} · ${escape(p.official||'首長待確認')}</span><span class="topic-policy-title">${escape(bulletinPolicyTitle(p))}</span></span><strong class="topic-policy-score" data-estimated="${!!score?.estimated}"${value==='—'?' aria-label="尚無可用百分比"':''}>${escape(value)}</strong><span class="topic-policy-arrow" aria-hidden="true">↗</span></button></article>`;
  }
  const m=attainmentFor(p),a=m.assessment?m:null;
  return `<article class="promise-card"><div class="card-top"><span>${escape(p.county)} · ${escape(p.official||'首長待確認')}</span><span class="pill">${escape(a?.label||(p.raw?'階段見證據':STAGES[p.stage]))}</span></div><h3>${escape(p.title)}</h3><p>${escape(a?.scope||p.actualProgress)}</p>${p.raw?'':`<p>單項數值：${escape(metricLabel(p.metric))}</p>`}<div class="card-bottom"><span>${a?(a.kind==='unknown'?'已追查，證據待補':'已有查核記錄'):evidenceLabels[p.evidenceStatus]} · ${escape(a?.date||p.asOf||'統計日期待確認')}</span><button class="row-link" data-detail="${escape(p.id)}">查看證據 ↗</button></div></article>`;
 }).join('')}</div></section>`).join('');
 $('promise-empty').hidden=count>0||!loadComplete;
 if(!count)$('promise-empty-message').textContent=data.promises.length?'沒有符合條件的政見。':'目前沒有可顯示的政見資料。';
 $('promise-empty-reset').hidden=!data.promises.length;
}
function auditSources(a){return a?.sources?.map(s=>`<article class="source"><a href="${escape(safeUrl(s.url)||'#')}" target="_blank" rel="noopener noreferrer">${escape(s.title)} ↗</a><p>${escape(s.publishedAt||'發布日期未列')} · ${escape(s.sourceType)}${s.verifiedThisRound===false?' · 未完整核讀':''}</p><p>${escape(s.evidence)}</p></article>`).join('')||'';}
function researchTrail(entries){return entries.map(v=>{
 if(typeof v==='string')return `<li>${escape(v)}</li>`;
 const words=v.queries||v.keywords,where=v.locator||(v.locatedPdfPages?.length?'PDF第'+v.locatedPdfPages.join('、')+'頁':'');
 return `<li><strong>${escape([v.date,v.action||v.method].filter(Boolean).join(' · '))}</strong>${v.document?`<p>${safeUrl(v.url)?`<a href="${escape(safeUrl(v.url))}" target="_blank" rel="noopener noreferrer">${escape(v.document)} ↗</a>`:escape(v.document)}${where?' · '+escape(where):''}</p>`:''}${words?.length?`<p>檢索：${escape(words.join('、'))}</p>`:''}${v.result?`<p>${escape(v.result)}</p>`:''}${v.unresolved?`<p>待補：${escape(v.unresolved)}</p>`:''}</li>`;
 }).join('');}
function progressMarkup(m,compact){
 const records=progressRecords(m);if(!records.length)return '';
 const known=records.filter(v=>v.kind!=='context');
 const lead=known[0]||records[0],rest=records.filter(v=>v!==lead);
 const entry=v=>`<li class="progress-entry ${v.kind==='context'?'background-record':''}"><div class="progress-entry-meta"><time>${escape(v.date)}</time><span>${escape(v.kind==='context'?v.temporalScope==='任前背景'?'任前背景':'相關背景':v.stage)}</span></div><p>${escape(v.summary)}</p>${v.temporalScope==='時點待釐清'?'<p class="progress-timing-note">實際發生時間待釐清；依來源日期列示。</p>':''}<div class="progress-source-links">${v.sourceUrls.map((url,i)=>`<a href="${escape(safeUrl(url))}" target="_blank" rel="noopener noreferrer">來源${v.sourceUrls.length>1?' '+(i+1):''} ↗</a>`).join('')}</div></li>`;
 return `<section class="known-progress" aria-label="已確認的進度與歷史紀錄"><h4>${known.length?'可確認進度／狀態':'目前可確認的背景'}</h4><ol>${entry(lead)}${compact?'':rest.map(entry).join('')}</ol>${compact&&rest.length?`<details><summary>更多進度與背景（${rest.length}）</summary><ol>${rest.map(entry).join('')}</ol></details>`:''}</section>`;
}
function metricMarkup(m,compact=false,wholeProgress=null){
 const hasPercent=Number.isFinite(m.percent);
 if(!m.assessment&&!hasPercent)return '';
 const formula=m.numerator!==undefined?`${m.numerator.toLocaleString('zh-TW')} ÷ ${m.denominator.toLocaleString('zh-TW')} × 100${m.capAtTarget?' · 達標率封頂100%':''}`:m.kind==='milestone'?'僅限此里程碑':m.kind==='zero'?(m.historical?'歷史時點確認未實施':'已確認未實施'):m.reportedLabel||'官方公布工程進度';
 let main;
 if(m.kind==='observed')main=`<p class="metric-scope">${escape(m.observation.label)} · 現況數值</p><div class="rate-line observation-value"><strong>${escape(m.observation.valueLabel??m.observation.value)}<small>${escape(m.observation.unit)}</small></strong></div><p class="observation-change">${escape(m.observation.changeLabel||'僅此地點與日期；不換算達成率')}</p>`;
 else if(m.percent===100&&wholeProgress&&!wholeProgress.isComplete)main=`<p class="metric-scope">${escape(m.label)}</p><p class="stage-result">部分里程碑已實施</p><p class="rate-meaning">此紀錄只涵蓋部分措施；整條完成度依適用分項平均。</p>`;
 else if(m.kind==='milestone')main=`<p class="metric-scope">${escape(m.label)}</p><div class="milestone-result"><strong>100<small>%</small></strong><span>已執行完成</span></div>`;
 else if(hasPercent)main=`<p class="metric-scope">${escape(m.label)}</p><div class="rate-line"><strong>${m.lowerBound?'<em>'+escape(m.boundLabel||'至少')+'</em>':''}${m.percent.toLocaleString('zh-TW',{maximumFractionDigits:2})}<small>%</small></strong><span>${escape(formula)}</span></div><div class="rate-track" aria-hidden="true"><i style="width:${m.barPercent}%"></i></div>`;
 else main=progressRecords(m).length?'':`<p class="stage-result">${escape(m.label)}</p>`;
 const meaning=compact&&!hasPercent?(m.reason||m.scope||''):m.scope||'限定範圍的比值，非整項政見完成率。';
 const brief=compact&&!hasPercent&&meaning.length>110?meaning.slice(0,110)+'…':meaning;
 const latest=m.latestCount!==undefined?`<p class="latest-count">最新數量：${escape(m.latestCount)}學區（${escape(m.latestCountAsOf)}）；當期分母待核。</p>`:'';
 const secondary=m.supplementaryMetrics?.length?`<details class="subitem-progress" ${!hasPercent?'open':''}><summary>分項進度（${m.supplementaryMetrics.length}）</summary>${m.supplementaryMetrics.map(v=>`<p><strong>${escape(v.label)}：${Number.isFinite(v.percent)?(v.lowerBound?escape(v.boundLabel||'至少'):'')+escape(v.percent)+'%':escape(v.value??'見資料')}${Number.isFinite(v.numerator)&&Number.isFinite(v.denominator)?'（'+escape(v.numerator)+'／'+escape(v.denominator)+'）':''}</strong>${v.asOf?'<br>資料日期：'+escape(v.asOf):''}<br>${escape(v.scope)}</p>`).join('')}</details>`:'';
 return `${m.historical?`<p class="historical-marker">歷史紀錄 · ${escape(m.date)}<br>不代表目前狀態</p>`:''}${main}${compact&&progressRecords(m).length?'':`<p class="rate-meaning">${escape(brief)}${m.percent>100?' 數值超過目標，圖條上限100%。':''}</p>`}${progressMarkup(m,compact)}${latest}${secondary}<p class="attainment-date">${progressRecords(m).length?'整條判讀截至':'資料日期'}：${escape(m.date)}${m.observedOn?' · 查閱 '+escape(m.observedOn):''}</p><details class="metric-limits"><summary>查核紀錄與來源${m.sources?'（'+m.sources.length+'）':''}</summary>${m.reason?`<p>${escape(m.reason)}</p>`:''}${m.researchLog?.length?`<h4>追查紀錄</h4><ul>${researchTrail(m.researchLog)}</ul>`:''}<ul>${m.limitations.map(l=>`<li>${escape(l)}</li>`).join('')}</ul>${auditSources(m)}</details>`;
}
function attainmentEvidenceMarkup(p,m){
 const progress=policyProgress(p);
 const record=m.assessment||Number.isFinite(m.percent)?metricMarkup(m,true,progress):`<p class="pending-rate">— <span>${p.raw?.collectionSource==='expansion'?'原文已核讀，執行進度待查':escape(m.reason)}</span></p><details class="metric-limits"><summary>目前資料與待查項目</summary><p>${escape(p.actualProgress)}</p><p>${escape(m.next)}</p></details>`;
 if(!progress)return record;
 return `<div class="overall-policy-score"><span>整條政策完成度</span><strong>${escape(policyScoreLabel(progress.score))}</strong><small>${escape(estimateCoverage(progress.score))}</small></div>${policyDatesMarkup(p,progress)}<section class="record-metric" aria-label="分項與歷史進度"><h4>分項與歷史進度</h4>${record}</section>`;
}
const hasPercentage=m=>Number.isFinite(m.percent)||m.supplementaryMetrics?.some(v=>Number.isFinite(v.percent));
const hasZeroEvidence=m=>m.kind==='zero'||m.supplementaryMetrics?.some(v=>v.percent===0&&v.explicitNonImplementation===true);
function renderAttainment(){
 const ps=selectPromises(data.promises,{query:$('query').value,county:$('county').value});
 const assessed=ps.map(p=>({p,m:attainmentFor(p)})),kind=$('attainment-kind').value;
 const summary={total:ps.length,measurable:assessed.filter(({m})=>hasPercentage(m)).length,known:assessed.filter(({m})=>hasKnownProgress(m)).length};summary.pending=summary.total-summary.known;
 $('attainment-total').textContent=String(summary.total);
 $('attainment-measurable').textContent=String(summary.measurable);
 $('attainment-known').textContent=String(summary.known);
 $('attainment-pending').textContent=String(summary.pending);
 const isNew=p=>p.raw?.collectionBatch===CURRENT_COLLECTION_BATCH||p.raw?.collectionBatch===BULLETIN_REVIEW_BATCH;
 const isRechecked=m=>m.reviewBatch===BULLETIN_REVIEW_BATCH||(m.reviewBatch===CURRENT_REVIEW_BATCH&&['new21','old9'].includes(m.followUpGroup));
 const isFollowUp=m=>!!m.followUpBatch&&m.followUpBatch===data.research?.metadata.latestFollowUp?.batch;
 const followUpCount=assessed.filter(({m})=>isFollowUp(m)).length;
 $('attainment-followup-option').textContent=`近期查核（${followUpCount}條）`;
 $('attainment-coverage').textContent=data.research?.metadata.completeBulletins?`22 縣市 · ${data.promises.length} 條公報政見 · 含歷史紀錄及局部指標`:`${data.promises.length} 條收錄政見 · 非完整公報`;
 const priority=({p,m})=>isFollowUp(m)?-2:progressRecords(m).some(v=>v.kind!=='context')?-1:m.kind==='limited'&&m.basis==='reported'&&m.percent<100?0:m.kind==='zero'?1:m.kind==='limited'&&m.percent<100?2:m.kind==='observed'?3:m.kind==='progress'?4:m.kind==='milestone'?5:m.kind==='limited'?6:p.raw?.collectionSource==='expansion'?8:7;
 const items=assessed.filter(({p,m})=>!kind||(kind==='new'?isNew(p):kind==='followup'?isFollowUp(m):kind==='updates'?progressRecords(m).length>0:kind==='progress'?hasKnownProgress(m):kind==='rechecked'?isRechecked(m):kind==='completed'?m.percent===100&&m.verdict==='implemented':kind==='measurable'?hasPercentage(m):kind==='zero'?hasZeroEvidence(m):kind==='unknown'?!hasKnownProgress(m):m.kind===kind)).sort((a,b)=>priority(a)-priority(b)||((progressRecords(b.m).find(v=>v.kind!=='context')?.date||'').localeCompare(progressRecords(a.m).find(v=>v.kind!=='context')?.date||'')));
 $('attainment-result').textContent=`顯示 ${items.length} / ${summary.total} 項已收錄政見`;
 $('attainment-empty').hidden=items.length>0||!loadComplete;
 if(!items.length)$('attainment-empty-message').textContent=kind==='zero'?'目前沒有確認未實施的紀錄。':'沒有符合條件的項目。';
 $('attainment-empty-reset').hidden=!data.promises.length;
 $('attainment-list').innerHTML=items.map(({p,m})=>`<article class="attainment-card ${m.kind}"><div class="attainment-card-top"><span>${escape(p.county)} · ${escape(p.official||'首長待確認')}</span><span class="pill">${{limited:m.basis==='reported'?(m.reportedLabel?'官方公布進度':'工程進度'):'量化子指標',milestone:'政策／里程碑',zero:m.historical?'歷史未實施':'未實施',observed:'現況數值',progress:'有進度紀錄',unknown:hasKnownProgress(m)?'有階段紀錄':p.raw?.collectionSource==='expansion'&&!m.assessment?'新增收錄':'證據待補'}[m.kind]}</span></div><p class="bulletin-locator">${escape(p.raw?.originalLocator||'')}</p>${p.raw?.collectionSource==='complete-bulletin'?`<h3>${escape(p.originalQuote.length>64?p.originalQuote.slice(0,64)+'…':p.originalQuote)}</h3><details class="original-quote"><summary>公報原文</summary><p>${escape(p.originalQuote)}</p></details>`:`<h3>${escape(p.originalQuote||p.title)}</h3>`}${attainmentEvidenceMarkup(p,m)}<button class="row-link" data-detail="${escape(p.id)}">查看承諾與證據 ↗</button></article>`).join('');
}
function showDetail(id,trigger,{fromRoute=false}={}){
 const p=data.promises.find(p=>p.id===id);if(!p)return;
 activePolicyId=id;
 detailReturnHash=fromRoute?(globalThis.history?.state?.civicParent||makeCountyHash(p.county)):(globalThis.location?.hash||'#home');
 if(!fromRoute)pushDialogRoute(makePolicyHash(id),detailReturnHash,trigger);
 document.title=`${bulletinPolicyTitle(p).slice(0,70)}｜${p.county}｜2026 縣市首長 政策執行率`;
 $('copy-policy-link').hidden=data!==baseData;
 $('policy-share-url').hidden=true;$('policy-share-status').textContent='';
 detailTrigger=trigger||null;
 if($('city-sheet').open){detailCounty=selectedCounty;detailSheetScroll=$('city-sheet').scrollTop;skipCountyClose++;$('city-sheet').close();}else detailCounty=null;
 $('detail-back').textContent=detailCounty?'← 返回政策列表':'← 返回項目';
 if(p.raw){showResearchDetail(p);return;}
 const field=(label,value)=>`<dl><dt>${label}</dt><dd>${escape(value)}</dd></dl>`;
 $('detail-content').innerHTML=`<h2 id="detail-title">${escape(bulletinPolicyTitle(p))}</h2><p class="detail-meta">${p.county} · ${escape(p.official||'首長待確認')} · 任期 ${escape(p.term||'待確認')}<br>資料編號 ${escape(p.id)} · 統計日期 ${escape(p.asOf??'待確認')}</p><h3>承諾原文</h3><blockquote>${escape(p.originalQuote)}</blockquote><div class="detail-grid">${field('可衡量目標',p.target)}${field('承諾期限',p.deadline)}${field('執行階段',STAGES[p.stage])}${field('實際進度',p.actualProgress)}${field('證據狀態',evidenceLabels[p.evidenceStatus])}${field('單項數值進度',metricLabel(p.metric))}</div>${p.metric?`<p class="muted">${escape(p.metric.label)} · 計算範圍：${escape(p.metric.basis)}</p>`:''}<div class="notice"><div><strong>不確定性與判讀限制</strong><p>${escape(p.uncertainty)}</p><p>本項進度不代表縣市總體完成率，也不作為目前排名依據。</p></div></div><h3>原始來源 <small>(${p.sources.length})</small></h3>${p.sources.length?p.sources.map(s=>`<div class="source"><a href="${escape(safeUrl(s.url)||'#')}" target="_blank" rel="noopener noreferrer">${escape(s.title)} ↗</a><p>${{promise:'承諾來源',progress:'進度來源',context:'背景資料'}[s.type]} · 發布日期 ${s.publishedAt??'未提供'}</p><p>${escape(s.url)}</p>${s.note?`<p>${escape(s.note)}</p>`:''}</div>`).join(''):'<p class="muted">尚未提供原始來源，此項資料不可視為已查證。</p>'}`;
 $('detail').showModal();
}
$('filters').onsubmit=e=>e.preventDefault();
$('query').oninput=render;$('county').onchange=render;$('stage').onchange=render;
$('filters').onreset=e=>{e.preventDefault();resetFilters();render();};
$('county-rows').onclick=e=>{const btn=e.target.closest('[data-county]');if(btn){$('county').value=btn.dataset.county;$('stage').value='';render();openCounty(btn.dataset.county,btn);}};
$('attainment-list').onclick=e=>{const btn=e.target.closest('[data-detail]');if(btn)showDetail(btn.dataset.detail,btn);};
$('attainment-kind').onchange=renderAttainment;
$('promise-list').onclick=e=>{const btn=e.target.closest('[data-detail]');if(btn)showDetail(btn.dataset.detail,btn);};
$('topic-filters').onclick=e=>{const btn=e.target.closest('[data-topic]');if(!btn||!OVERVIEW_TOPICS.some(topic=>topic.id===btn.dataset.topic))return;selectedTopic=btn.dataset.topic;renderTopics(selectPromises(data.promises,filters()));document.querySelector?.(`[data-topic="${selectedTopic}"]`)?.focus?.({preventScroll:true});};
$('topic-all').onclick=()=>{selectedTopic='';renderTopics(selectPromises(data.promises,filters()));};
$('home-topics').onclick=e=>{const btn=e.target.closest('[data-home-topic]');if(!btn||!OVERVIEW_TOPICS.some(topic=>topic.id===btn.dataset.homeTopic))return;resetFilters();selectedTopic=btn.dataset.homeTopic;render();globalThis.location.hash='#promises';};
for(const d of document.querySelectorAll('dialog')){d.querySelector('.close').onclick=()=>d.close();d.addEventListener('click',e=>{if(e.target===d){const b=d.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)d.close();}});}
function status(message,kind=''){$('home-status').textContent=kind?message:'';$('load-status').textContent=message;$('load-status').className=`load-status ${kind}`;}
function resetFilters(){$('query').value='';$('county').value='';$('stage').value='';$('attainment-kind').value='';selectedTopic='';}
for(const [button,result] of [['promise-empty-reset','promise-result'],['attainment-empty-reset','attainment-result']])$(button).onclick=()=>{resetFilters();render();$(result).setAttribute('tabindex','-1');$(result).focus({preventScroll:true});};
function datasetStatus(state){
 $('main').setAttribute('data-ready',String(loadComplete));
 $('dataset-status').hidden=state==='ready';
 $('dataset-message').textContent=state==='loading'?'正在載入政策資料…':state==='error'?'資料暫時無法載入，請重試。':'';
 $('retry-data').hidden=state!=='error';$('retry-data').disabled=state==='loading';
 $('main').setAttribute('aria-busy',String(state==='loading'));
}
$('import-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;const version=++sourceVersion;try{if(file.size>5*1024*1024)throw Error('檔案大小不得超過 5 MB。');const imported=ingest(JSON.parse(await file.text()));if(version!==sourceVersion)return;data=imported;loadComplete=true;datasetStatus('ready');closeDataDialogs();resetFilters();render();status(`已匯入 ${file.name}（${data.promises.length} 項）；未經本站查核，未上傳或儲存。`,'preview-mode');}catch(error){status(`匯入失敗，保留原有資料：${error.message}`,'error');}finally{e.target.value='';}};
$('restore').onclick=()=>{if(!baseData){datasetStatus('error');status('網站資料尚未載入成功，請重新載入。','error');return;}sourceVersion++;data=baseData;loadComplete=true;datasetStatus('ready');closeDataDialogs();resetFilters();render();status('已恢復網站資料。');};
async function loadSiteData(){
 if(dataLoading)return;
 dataLoading=true;const version=sourceVersion;datasetStatus('loading');
 try{
  const response=await fetch('./data/promises.json',{cache:'no-store'});
  if(!response.ok)throw Error(`HTTP ${response.status}`);
  const shipped=await response.json();
  baseData=shipped?.cities?attachAssessments(ingest(completeBulletinResearch(shipped)),bulletinAssessments()):attachAssessments(ingest(shipped));
  if(version===sourceVersion||!loadComplete){data=baseData;loadComplete=true;datasetStatus('ready');render();status('');route();}
 }catch{if(version===sourceVersion||!loadComplete)datasetStatus('error');}
 finally{dataLoading=false;if(version!==sourceVersion&&loadComplete)datasetStatus('ready');$('retry-data').disabled=false;}
}
$('retry-data').onclick=loadSiteData;
route();render();
await loadSiteData();

function readable(value){
 if(value===null||value===undefined)return '<span class="muted">未提供／待核對</span>';
 if(typeof value==='boolean')return value?'是':'否';
 if(typeof value==='number')return value.toLocaleString('zh-TW');
 if(Array.isArray(value))return '<ul>'+value.map(v=>'<li>'+readable(v)+'</li>').join('')+'</ul>';
 if(typeof value==='object')return '<dl class="nested-data">'+Object.entries(value).map(([k,v])=>`<dt>${escape(FIELD_LABELS[k]||k)}</dt><dd>${readable(v)}</dd>`).join('')+'</dl>';
 if(typeof value==='string'&&safeUrl(value))return `<a href="${escape(sourceHref(value))}" target="_blank" rel="noopener noreferrer">查看原始來源 ↗</a>`;
 return escape(value);
}
function sourceGroup(sources){return sources.length?sources.map(s=>`<article class="source"><a href="${escape(safeUrl(s.url)||'#')}" target="_blank" rel="noopener noreferrer">${escape(s.title)} ↗</a><p>${escape(s.type||'來源類型未標註')} · 發布日期：${escape(s.dateLabel||'未提供')}</p>${['period','role','locator','strength'].filter(k=>s[k]!=null).map(k=>`<p><strong>${{period:'資料期間',role:'用途',locator:'原件位置',strength:'證據限制'}[k]}：</strong>${escape(s[k])}</p>`).join('')}<p class="source-url">${escape(s.url)}</p></article>`).join(''):'<p class="muted">尚無可用來源。</p>';}
function showResearchDetail(p){const r=p.raw,c=p.city,m=attainmentFor(p);
 if(r.collectionSource==='complete-bulletin'){
  const topic=OVERVIEW_TOPICS.find(t=>t.id===topicFor(p)),progress=policyProgress(p),explanation=policyScoreExplanation(progress);
  $('detail-content').innerHTML=`<p class="detail-crumb">${escape(c.name)} / ${escape(topic?.label||'其他／跨領域')}</p><h2 id="detail-title">${escape(bulletinPolicyTitle(p))}</h2>
  <section class="policy-verdict" aria-label="給分理由"><div class="verdict-score"><strong>${escape(policyScoreLabel(progress?.score))}</strong><span>GPT6協助評分 · ${progress?.score?.estimated?'含估分':'依已核對進度'}</span></div>${policyDatesMarkup(p,progress)}<h3>給分理由</h3><p class="verdict-summary">${escape(explanation.summary)}</p>${explanation.reasons.length?`<div class="verdict-reasons">${explanation.reasons.map(reason=>`<p>${escape(reason)}</p>`).join('')}</div>`:''}</section>
  <details class="detail-section full-evidence"><summary>分項計算與來源</summary><section class="detail-current"><h3>逐項核對政策進度</h3>${policyPartsMarkup(p)}</section></details>
  <details class="detail-section archive-evidence"><summary>公報原文與完整查核</summary><details class="detail-section"><summary>查核紀錄</summary>${m.assessment?metricMarkup(m,false,policyProgress(p)):`<p>${escape(r.status)}</p>`}</details><details class="detail-section"><summary>當時承諾了什麼？</summary><blockquote>${escape(r.quote)}</blockquote><p class="muted">${escape(r.originalLocator||'原件位置待補')}</p><h3>原承諾來源</h3>${sourceGroup(r.originalSources)}</details><details class="detail-section"><summary>後續證據與背景（${r.current.sources.length}）</summary>${sourceGroup(r.current.sources)}</details><details class="detail-section"><summary>範圍與期限</summary><h3>目標與定義</h3><p>${escape(r.metricDefinition||'原文未明訂量化定義')}</p>${readable(r.target)}<h3>期限與基期</h3><p>${escape(r.deadline||'原文未明訂期限')}</p>${readable(r.baseline)}<h3>進度與資料期間</h3><p>${escape(r.status)}</p><p>資料日期：${escape(r.current.dateLabel||'未提供')}</p><p>階段：${escape(r.current.stage||'待核對')}</p><dl class="nested-data"><dt>當期數值（非整項完成率）</dt><dd>${readable(r.current.value)} ${escape(r.current.unit||'')}</dd><dt>適用範圍</dt><dd>${escape(r.current.scope||'待核對')}</dd></dl><h3>不確定性與判讀限制</h3><ul>${r.limitations.map(v=>`<li>${escape(v)}</li>`).join('')}</ul><p>${escape(r.nextEvidenceNeeded||'')}</p><p class="muted">資料編號：${escape(r.id)}</p></details><details class="detail-section"><summary>首長在職資訊與責任歸屬</summary><p>現任／代理：${escape(c.currentHead)} · ${escape(c.currentHeadNote)}</p><p>${escape(c.partyLabel)}：${escape(c.electionParty)}</p><p>任期：${escape(p.term)}</p>${sourceGroup([{url:c.currentHeadSource,title:'首長在職資訊來源',type:'研究資料所列來源'},{url:c.electionSource,title:'2022 選舉結果來源',type:'中選會'}])}</details></details>`;
  $('detail').showModal();$('detail').scrollTop=0;return;
 }
 $('detail-content').innerHTML=`<h2 id="detail-title">${escape(bulletinPolicyTitle(p))}</h2><p class="detail-meta">${c.name} · 2022 當選人：${escape(c.electedHead)}<br>任期：${escape(p.term)}<br>資料編號：${escape(r.id)} · 查閱日期：${escape(r.observedOn||'未提供')}</p><details class="head-context"><summary>首長在職資訊與責任歸屬</summary><p>現任／代理：${escape(c.currentHead)} · ${escape(c.currentHeadNote)}</p><p>${escape(c.partyLabel)}：${escape(c.electionParty)}</p>${sourceGroup([{url:c.currentHeadSource,title:'首長在職資訊來源',type:'研究資料所列來源'},{url:c.electionSource,title:'2022 選舉結果來源',type:'中選會'}])}</details><h3>承諾原文</h3><blockquote>${escape(r.quote)}</blockquote><p class="muted">${escape(r.originalLocator||'原件頁碼／段落尚未補齊')}</p><div class="detail-grid"><div><h3>目標與定義</h3><p>${escape(r.metricDefinition||'未明訂量化定義')}</p>${readable(r.target)}</div><div><h3>期限</h3><p>${escape(r.deadline||'原文未明訂')}</p><p class="muted">${escape(r.deadlineNote||'尚未提供期限說明，不自動以任期終點替代。')}</p><h3>基期</h3>${readable(r.baseline)}</div></div>${m.assessment?`<section class="review-update"><h3>最新查核 · ${escape(m.observedOn)}</h3>${metricMarkup(m,false,policyProgress(p))}</section>`:''}<h3>進度與資料期間</h3><p>${escape(r.status)}</p><div class="notice"><div><strong>階段：${escape(r.current.stage||'原資料未另標註，請依下方證據判讀')}</strong><p>資料日期／原標籤：${escape(r.current.dateLabel||'未提供')}</p><p>${escape(r.current.dateMeaning||'查閱日期不等於資料期間。')}</p></div></div><dl class="nested-data"><dt>當期數值（非整項完成率）</dt><dd>${readable(r.current.value)} ${escape(r.current.unit||'')}</dd><dt>適用範圍</dt><dd>${escape(r.current.scope||'尚未提供')}</dd></dl>${r.limitedMetric?`<div class="limited-metric"><h3>限定指標，非整項承諾完成率</h3><p><strong>${escape(r.limitedMetric.label)}</strong></p>${readable(Object.fromEntries(Object.entries(r.limitedMetric).filter(([k])=>!['eligible','not_total_pledge_completion','label','limitations'].includes(k))))}<p class="muted">本指標只描述上述限定範圍，並非整項承諾或首長總體達成率。</p><ul>${(r.limitedMetric.limitations||r.limitations).map(v=>`<li>${escape(v)}</li>`).join('')}</ul></div>`:''}<h3>不確定性與判讀限制</h3><ul>${r.limitations.map(v=>`<li>${escape(v)}</li>`).join('')}</ul><p class="muted">${escape(r.nextEvidenceNeeded||'待補後續證據')}</p><h3>原承諾來源</h3>${sourceGroup(r.originalSources)}<h3>後續證據與背景</h3>${sourceGroup(r.current.sources)}<div class="notice"><p>規劃、施工、完工、營運與社會成效分開判讀。官方自述不等於獨立查核；所有縣市目前暫不排名。</p></div>`;
 $('detail').showModal();
}

function renderBulletins(){
 const cities=data.cities?.filter(c=>c.bulletin)||[];
 $('bulletin-summary').textContent=cities.length?`${cities.length}份公報 · ${data.promises.length}個原條目 · 2022當選人政見欄`: '目前資料未附完整公報；恢復網站資料即可查看。';
 $('bulletin-library').innerHTML=cities.map(c=>`<article class="bulletin-document"><div class="bulletin-document-head"><div><h3>${escape(c.name)}</h3><p>${escape(c.electedHead)} · ${c.pledges.length}個原條目</p></div><span class="party-badge ${partyStyle(c).className}"><i class="party-dot" aria-hidden="true"></i>${escape(shortParty(partyStyle(c).label))}</span></div><div class="bulletin-actions"><a href="${escape(safeUrl(c.bulletin.sourceUrl)||'#')}#page=${c.bulletin.pages[0]}" target="_blank" rel="noopener noreferrer">公報PDF ↗</a><button class="row-link" data-bulletin-county="${escape(c.name)}">政見進度 →</button></div><details><summary>政見原文</summary><p class="bulletin-full-text">${escape(c.bulletin.fullText)}</p></details></article>`).join('');
}
$('bulletin-library').onclick=e=>{const b=e.target.closest('[data-bulletin-county]');if(!b)return;resetFilters();$('county').value=b.dataset.bulletinCounty;render();globalThis.location.hash='#attainment';};
