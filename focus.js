import {readFocusRoute,focusRecordHash,focusShareUrl,selectFocusPolicies,selectFocusRecords,focusArchiveUrl} from './focus-model.js';

const byId=id=>document.getElementById(id);
const html=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const publicTitle='2026 臺北市長選舉｜北市選舉';
const categoryNames={bill:'法律提案與連署',video:'會議發言',speech:'質詢與發言',committee:'委員會工作',oversight:'監督與審查'};
let focusData=null,focusLoading=false,topicFilter='',recordFilter='',activeRecord=null,skipModalClose=0,currentFocusPage='home';
const dialog=byId('record-dialog');

function sourceLink(source,label){
 const url=typeof source==='string'?source:source?.url;
 try{if(!['http:','https:'].includes(new URL(url).protocol))return '';}
 catch{return '';}
 return `<a class="source-link" href="${html(url)}" target="_blank" rel="noopener noreferrer">${html(label||source.title||'官方來源')} <span aria-hidden="true">↗</span></a>`;
}
function stat(value,label,note=''){
 return `<div class="stat-card"><strong class="stat-value">${html(value)}</strong><span class="stat-label">${html(label)}</span>${note?`<small>${html(note)}</small>`:''}</div>`;
}
function setFocusLoad(state){
 byId('load-state').hidden=state==='ready';
 byId('load-message').textContent=state==='loading'?'正在載入選舉資料…':'資料暫時無法載入，請重試。';
 byId('retry-load').hidden=state!=='error';byId('retry-load').disabled=state==='loading';
 byId('main').setAttribute('aria-busy',String(state==='loading'));
}
function personMeta(){
 const t=focusData.taipei,l=focusData.legislature;
 byId('mayor-meta').innerHTML=`<span class="identity-dot mayor-dot" aria-hidden="true"></span><span>臺北市長 · 2022-12-25 起</span>${sourceLink(t.profileSource,'市府職務資料')}`;
 byId('legislator-meta').innerHTML=`<span class="identity-dot legislator-dot" aria-hidden="true"></span><span>第 11 屆立法委員 · ${html(l.profile.startDate)} 起</span>${sourceLink(l.profile.sources?.[0],'立法院委員資料')}`;
}
function renderProfiles(){
 const t=focusData.taipei,l=focusData.legislature;
 byId('profile-cards').innerHTML=`<a class="profile-card mayor-card" href="#mayor"><span class="profile-role">臺北市長 · 施政完成度</span><h2 class="profile-name">蔣萬安</h2><p class="profile-description">對照 2022 選舉公報，追蹤任內政策執行。</p><div class="profile-meta"><strong>${t.summary.policyCount} 條 2022 公報政見</strong><span>${t.summary.partCount} 個分項 · 含估分</span><span>查核紀錄更新 ${html(t.checkedAt)}</span></div><span class="profile-action">查看施政完成度 <span aria-hidden="true">↗</span></span></a><a class="profile-card legislator-card" href="#legislator"><span class="profile-role">立法委員 · 國會工作紀錄</span><h2 class="profile-name">沈伯洋</h2><p class="profile-description">追蹤法律提案、質詢發言與委員會工作。</p><div class="profile-meta"><strong>已收錄 ${l.records.length} 筆官方紀錄</strong><span>依本人角色與議事程序整理</span><span>來源核讀 ${html(l.checkedAt)}</span></div><span class="profile-action">查看立委成績單 <span aria-hidden="true">↗</span></span></a>`;
 byId('home-coverage').textContent='目前收錄蔣萬安市政承諾與沈伯洋國會紀錄，依各自職務呈現。';
}
function renderElection(){
 const e=focusData.election,v=e.voting,t=focusData.taipei;
 const rosterSource=e.candidateList.sources.find(s=>s.id==='taipei-mayor-ballot-register')||e.candidateList.sources[0];
 const commission=e.sources.find(s=>/\/mect\/?$/.test(s.url));
 byId('election-info').innerHTML=`<div><span class="election-meta">投票日</span><strong class="election-date">${html(v.date.replaceAll('-','.'))}</strong><span class="election-meta">${html(v.startTime)}–${html(v.endTime)}</span></div><div class="election-source">${sourceLink(v.sources[0],'官方投票資訊')}${commission?sourceLink(commission,'臺北市選委會'):''}</div>`;
 byId('candidate-list-meta').innerHTML=`${html(e.candidateList.statusAsOf)} 抽籤結果 · 政黨欄為推薦政黨 · 核讀 ${html(e.checkedAt)} ${sourceLink(rosterSource,'官方號次表')}`;
 byId('election-candidates').innerHTML=[...e.candidates].sort((a,b)=>a.ballotNumber-b.ballotNumber).map(c=>{
  const record=c.name==='蔣萬安'?'mayor':c.name==='沈伯洋'?'legislator':null;
  return `<article class="candidate-card">${c.ballotNumber?`<span class="candidate-number" aria-label="${html(c.ballotNumber)} 號">${html(c.ballotNumber)}</span>`:''}<strong class="candidate-name">${html(c.name)}</strong>${c.party?`<span class="candidate-party">${html(c.party==='無'?'無政黨推薦':c.party)}</span>`:''}${record?`<a class="candidate-record" href="#${record}" aria-label="查看${html(c.name)}的履職紀錄">履職紀錄 <span aria-hidden="true">↗</span></a>`:''}</article>`;
 }).join('');
 byId('election-topics').innerHTML=t.topics.filter(topic=>topic.count>0).map(topic=>`<a class="topic-card" href="#issue/${html(topic.id)}"><span class="topic-count">${topic.count} 條市政承諾</span><h3 class="topic-title">${html(topic.label)}</h3><p class="topic-summary">${html(topic.description)}</p><span class="topic-action">查看履行紀錄 <span aria-hidden="true">↗</span></span></a>`).join('');
}
function renderMayor(){
 const t=focusData.taipei,s=t.summary;
 byId('mayor-stats').innerHTML=stat(s.scoreLabel,'2022 公報承諾平均完成度','按適用分項等權平均 · 含估分')+stat(s.policyCount,'條公報政見',`${s.partCount} 個分項`)+stat(`${s.measuredCount} / ${s.applicablePartCount}`,'直接計分分項')+stat(`${s.estimatedCount} / ${s.applicablePartCount}`,'估分分項');
 byId('mayor-topic-filters').innerHTML=`<button class="filter-chip" type="button" data-focus-topic="" aria-pressed="${!topicFilter}">全部 <span>${t.policies.length}</span></button>`+t.topics.filter(item=>item.count>0).map(item=>`<button class="filter-chip" type="button" data-focus-topic="${html(item.id)}" aria-pressed="${topicFilter===item.id}">${html(item.label)} <span>${item.count}</span></button>`).join('');
 renderPolicyList();
}
function renderPolicyList(){
 const rows=selectFocusPolicies(focusData.taipei.policies,{topic:topicFilter,query:byId('mayor-query').value});
 byId('mayor-result').textContent=`${rows.length} / ${focusData.taipei.policies.length} 條政見 · 查核紀錄更新 ${focusData.taipei.checkedAt}`;
 byId('mayor-empty').hidden=rows.length>0;
 byId('mayor-list').innerHTML=rows.map(p=>`<article class="record-card mayor-record"><div class="record-top"><span class="record-role">${html(p.topic.label)}</span><strong class="score">${html(p.scoreLabel)}</strong></div><h2 class="record-title"><button class="record-link" type="button" data-policy="${html(p.id)}">${html(p.title)} <span aria-hidden="true">↗</span></button></h2><p class="record-summary">${html(p.explanation.summary)}</p><div class="record-meta"><span>${html(p.dates.checkedLabel)}</span><span>${p.score.estimated?`估分 ${p.score.estimated}/${p.score.applicable} 項`:'依已核對進度'}</span></div></article>`).join('');
}
function renderLegislator(){
 const l=focusData.legislature,categories=[...new Set(l.records.map(r=>r.category))];
 byId('legislator-stats').innerHTML=stat(l.records.length,'筆已收錄紀錄','本頁核讀範圍')+categories.map(category=>stat(l.records.filter(r=>r.category===category).length,`筆${categoryNames[category]||category}`)).join('');
 byId('legislator-coverage').textContent=`本頁整理已核讀的官方紀錄，並非全部任期紀錄。來源核讀：${l.checkedAt}。`;
 const index=l.officialIndexSnapshot;
 byId('legislator-index').innerHTML=index?`<div class="index-note"><strong>官方影音索引</strong><span>${html(index.count)} 筆影片資料</span>${sourceLink(index.sources[0],'查看完整索引')}<small>${html(index.checkedAt)} 讀取快照 · 影片筆數不等於質詢次數或成效。</small></div>`:'';
 byId('legislator-filters').innerHTML=`<button class="filter-chip" type="button" data-focus-category="" aria-pressed="${!recordFilter}">全部</button>`+categories.map(category=>`<button class="filter-chip" type="button" data-focus-category="${html(category)}" aria-pressed="${recordFilter===category}">${html(categoryNames[category]||category)}</button>`).join('');
 renderLegislativeList();
}
function renderLegislativeList(){
 const rows=selectFocusRecords(focusData.legislature.records,{category:recordFilter,query:byId('legislator-query').value});
 byId('legislator-result').textContent=`${rows.length} / ${focusData.legislature.records.length} 筆已收錄紀錄`;
 byId('legislator-empty').hidden=rows.length>0;
 byId('legislator-list').innerHTML=rows.map(r=>`<article class="record-card legislative-record"><div class="record-top"><span class="record-role">${html(categoryNames[r.category]||r.category)} · ${html(r.roleLabel)}</span><span class="record-date">${html(r.date)}</span></div><h2 class="record-title"><button class="record-link" type="button" data-record="${html(r.id)}">${html(r.title)} <span aria-hidden="true">↗</span></button></h2><p class="record-summary">${html(r.summary)}</p><div class="record-meta"><span class="status-pill">${html(r.status)}</span><span>紀錄截至 ${html(r.statusAsOf||r.date)}</span></div></article>`).join('');
}
function renderSources(){
 const t=focusData.taipei,l=focusData.legislature,e=focusData.election;
 const sources=[...e.sources,{url:t.bulletinSource,title:'2022 臺北市長選舉公報'},{url:t.profileSource,title:'臺北市政府職務資料'},...(l.profile.sources||[])];
 byId('method-sources').innerHTML=`<p>本頁依 ${html(e.candidateList.statusAsOf)} 官方抽籤結果列名；工作程序表預定 ${html(e.candidateList.formalAnnouncementDate)} 公告候選人名單。</p><div class="source-list">${sources.map(source=>`<p>${sourceLink(source)}</p>`).join('')}</div><p>選舉資料核讀：${html(e.checkedAt)}；市政資料查核紀錄更新：${html(t.checkedAt)}；國會來源核讀：${html(l.checkedAt)}。每筆證據另保留原資料日期。</p>`;
}
function sourceDetails(sources=[]){
 const reused=s=>s.verifiedThisRound===false&&s.reusedVerifiedEvidence===true;
 const render=s=>{
  const review=s.verifiedThisRound===true?'已核讀':reused(s)?'沿用先前摘要，最近一輪未重新核讀':s.verifiedThisRound===false?'未完整核讀；未作百分比依據':'';
  const limits=Array.isArray(s.limitations)?s.limitations:s.limitations?[s.limitations]:[];
  return `<div class="evidence-source">${sourceLink(s)}${s.date||s.publishedAt?`<small>${html(s.dateType||(s.publishedAt?'發布日期':'來源日期'))}：${html(s.date||s.publishedAt)}</small>`:''}${s.asOf&&s.asOf!==(s.date||s.publishedAt)?`<small>資料截至：${html(s.asOf)}</small>`:''}${review||s.checkedAt?`<small>${html(review)}${s.checkedAt?` · 核讀 ${html(s.checkedAt)}`:''}</small>`:''}${s.dateNote?`<small>${html(s.dateNote)}</small>`:''}${s.locator?`<small>${html(s.locator)}</small>`:''}${s.evidence?`<p>${html(s.evidence)}</p>`:''}${s.readScope?`<small>核讀範圍：${html(s.readScope)}</small>`:''}${limits.length?`<ul class="limitations">${limits.map(item=>`<li>${html(item)}</li>`).join('')}</ul>`:''}</div>`;
 };
 const prior=sources.filter(reused);
 return sources.filter(s=>!reused(s)).map(render).join('')+(prior.length?`<details class="prior-sources"><summary>先前沿用的來源摘要（${prior.length}）</summary>${prior.map(render).join('')}</details>`:'');
}
function policyDetail(p){
 const parts=p.parts.map(part=>{
  const label=part.status==='not_applicable'?'不適用':part.estimate?`估分 ${part.estimate.percent}%`:part.scored?`${part.percent}%`:'未量化';
  return `<li class="evidence-item"><div class="record-top"><h3>${html(part.label)}</h3><strong>${html(label)}</strong></div><p>${html(part.estimate?.reason||part.reason)}</p>${part.estimate?`<p>${html(part.reason)}</p>`:''}<p class="record-meta">證據日期：${html(part.asOf||'未註明')}${part.lastCheckedAt?` · 查核 ${html(part.lastCheckedAt)}`:''}</p>${part.limitations?.length?`<ul class="limitations">${part.limitations.map(item=>`<li>${html(item)}</li>`).join('')}</ul>`:''}${part.supportingMetrics?.length?`<details><summary>局部進度紀錄</summary>${part.supportingMetrics.map(m=>`<p>${html(m.label)}：${m.lowerBound?'至少 ':''}${html(m.percent)}% · ${html(m.asOf)}</p>${sourceDetails(m.sources)}`).join('')}</details>`:''}<details><summary>判準與來源</summary><p>${html(part.fulfillmentCriterion||part.quoteAnchor)}</p>${sourceDetails(part.sources)}</details>${part.history?.length?`<details><summary>較早紀錄</summary>${part.history.map(item=>`<p>${html(item.asOf)} · ${html(item.reason)}</p>`).join('')}</details>`:''}</li>`;
 }).join('');
 return `<p class="detail-person">蔣萬安 · ${html(p.topic.label)}</p><h2 id="record-title">${html(p.title)}</h2><section class="detail-score"><strong>${html(p.scoreLabel)}</strong><span>公報承諾完成度${p.score.estimated?' · 含估分':''}</span><p>${html(p.explanation.summary)}</p>${p.explanation.reasons.map(reason=>`<p>${html(reason)}</p>`).join('')}</section><div class="detail-dates"><p>${html(p.dates.checkedLabel)}</p><p>${html(p.dates.evidenceLabel)}</p></div><details class="evidence-section"><summary>分項計算與來源（${p.parts.length}）</summary><p>適用分項等權平均；${p.score.estimated} 項採估分。缺證估 0% 不等於確認未實施。</p><ol class="evidence-list">${parts}</ol></details><details class="evidence-section"><summary>公報承諾原文</summary><blockquote>${html(p.originalQuote)}</blockquote><p>${html(p.originalLocator)}</p>${sourceDetails(p.originalSources||[])}${sourceLink(focusData.taipei.bulletinSource,'選舉公報 PDF')}</details><p class="detail-archive"><a href="./counties.html${focusRecordHash('policy',p.id)}">完整歷史查核紀錄 ↗</a></p>`;
}
function legislativeDetail(r){
 return `<p class="detail-person">沈伯洋 · ${html(categoryNames[r.category]||r.category)}</p><h2 id="record-title">${html(r.title)}</h2><div class="detail-score legislative-detail"><span class="record-role">${html(r.roleLabel)}</span><strong class="detail-status">${html(r.status)}</strong><p>${html(r.summary)}</p></div><dl class="detail-facts"><dt>${html(r.dateType||'紀錄日期')}</dt><dd>${html(r.date)}</dd><dt>程序紀錄截至</dt><dd>${html(r.statusAsOf||r.date)}</dd>${r.billNumber?`<dt>議案編號</dt><dd>${html(r.billNumber)}</dd>`:''}${r.proposalNumber?`<dt>提案編號</dt><dd>${html(r.proposalNumber)}</dd>`:''}<dt>本頁來源核讀</dt><dd>${html(focusData.legislature.checkedAt)}</dd></dl>${r.limitations?.length?`<div class="scope-note">${r.limitations.map(item=>`<p>${html(item)}</p>`).join('')}</div>`:''}<section class="evidence-section"><h3>官方紀錄與來源</h3>${sourceDetails(r.sources)}</section>`;
}
function closeFocusDialog(){if(dialog.open){skipModalClose++;dialog.close();}activeRecord=null;}
function showFocusRecord(kind,id){
 const record=kind==='policy'?focusData.taipei.policies.find(p=>p.id===id):focusData.legislature.records.find(r=>r.id===id);
 byId('share-url').hidden=true;byId('share-status').textContent='';
 byId('share-record').hidden=!record;
 if(!record){
  byId('record-content').innerHTML='<h2 id="record-title">找不到這筆紀錄</h2><p>請返回列表選擇其他紀錄。</p>';
  activeRecord={kind,id,found:false};
 }else{
  activeRecord={kind,id,found:true};
  byId('record-content').innerHTML=kind==='policy'?policyDetail(record):legislativeDetail(record);
  document.title=record.title+'｜'+publicTitle;
 }
 dialog.showModal();dialog.scrollTop=0;
}
function applyFocusRoute(){
 const route=readFocusRoute(location.hash);
 if(focusData){const archive=focusArchiveUrl(route,focusData);if(archive){location.replace(archive);return;}}
 closeFocusDialog();currentFocusPage=route.page;
 for(const page of ['home','mayor','legislator','method']){byId(page).setAttribute('tabindex','-1');byId(page).hidden=page!==route.page||(!focusData&&page!=='method');}
 for(const link of document.querySelectorAll('header nav a')){
  if(link.getAttribute('href')==='#'+route.page)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
 }
 document.title=({home:'',mayor:'蔣萬安的施政完成度｜',legislator:'沈伯洋的立委成績單｜',method:'方法與來源｜'}[route.page])+publicTitle;
 if(!focusData)return;
 if(route.kind==='issue'){
  topicFilter=focusData.taipei.topics.some(topic=>topic.id===route.id&&topic.count>0)?route.id:'';
  byId('mayor-query').value='';renderMayor();
 }
 if(['policy','record'].includes(route.kind)){showFocusRecord(route.kind,route.id);return;}
 const view=history.state?.focusView;
 const target=view?.key?byId(route.page).querySelector(`[data-${view.kind}="${CSS.escape(view.key)}"]`):null;
 (target||byId(route.page)).focus({preventScroll:true});
 scrollTo({top:Number.isFinite(view?.top)?view.top:0,behavior:'instant'});
}
function openFocusRecord(kind,id,trigger){
 const parent=location.hash||'#home';
 history.replaceState({...history.state,focusView:{top:scrollY,kind:kind==='policy'?'policy':'record',key:id}},'',parent);
 history.pushState({focusDialog:true,parent},'',focusRecordHash(kind,id));applyFocusRoute();
}
function returnFocusRecord(){
 if(history.state?.focusDialog){history.back();return;}
 const fallback=activeRecord?.kind==='record'?'#legislator':'#mayor';
 history.replaceState(null,'',fallback);applyFocusRoute();
}
function leaveIssueRoute(){
 if(readFocusRoute(location.hash).kind==='issue')history.replaceState(null,'','#mayor');
}
dialog.addEventListener('close',()=>{if(skipModalClose){skipModalClose--;return;}returnFocusRecord();});
dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();});
byId('record-back').onclick=()=>dialog.close();byId('record-close').onclick=()=>dialog.close();
byId('share-record').onclick=async()=>{
 const record=activeRecord;if(!record?.found)return;
 const base=/^https?:/.test(location.href)?location.href:'https://deyugogo.github.io/civic-promises-site/';
 const url=focusShareUrl(base,record.kind,record.id);byId('share-url').value=url;
 try{await navigator.clipboard.writeText(url);if(activeRecord===record)byId('share-status').textContent='已複製連結';}
 catch{if(activeRecord!==record)return;byId('share-url').hidden=false;byId('share-url').focus();byId('share-url').select();byId('share-status').textContent='請複製下方連結';}
};
byId('mayor-list').onclick=event=>{const button=event.target.closest('[data-policy]');if(button)openFocusRecord('policy',button.dataset.policy,button);};
byId('legislator-list').onclick=event=>{const button=event.target.closest('[data-record]');if(button)openFocusRecord('record',button.dataset.record,button);};
byId('mayor-topic-filters').onclick=event=>{const button=event.target.closest('[data-focus-topic]');if(!button||!focusData)return;leaveIssueRoute();topicFilter=button.dataset.focusTopic;renderMayor();byId('mayor-topic-filters').querySelector(`[data-focus-topic="${CSS.escape(topicFilter)}"]`).focus({preventScroll:true});};
byId('legislator-filters').onclick=event=>{const button=event.target.closest('[data-focus-category]');if(!button||!focusData)return;recordFilter=button.dataset.focusCategory;renderLegislator();byId('legislator-filters').querySelector(`[data-focus-category="${CSS.escape(recordFilter)}"]`).focus({preventScroll:true});};
byId('mayor-query').oninput=()=>{if(focusData){leaveIssueRoute();renderPolicyList();}};
byId('legislator-query').oninput=()=>focusData&&renderLegislativeList();
byId('mayor-clear').onclick=()=>{leaveIssueRoute();topicFilter='';byId('mayor-query').value='';renderMayor();byId('mayor-result').setAttribute('tabindex','-1');byId('mayor-result').focus({preventScroll:true});};
byId('legislator-clear').onclick=()=>{recordFilter='';byId('legislator-query').value='';renderLegislator();byId('legislator-result').setAttribute('tabindex','-1');byId('legislator-result').focus({preventScroll:true});};
document.querySelector('.skip-link').onclick=event=>{event.preventDefault();byId(currentFocusPage).focus({preventScroll:true});byId(currentFocusPage).scrollIntoView({block:'start',behavior:'instant'});};
addEventListener('hashchange',applyFocusRoute);
async function loadFocusData(){
 if(focusLoading)return;focusLoading=true;setFocusLoad('loading');
 try{
  const response=await fetch('./data/focus.json',{cache:'no-store'});
  if(!response.ok)throw Error('Unavailable data');
  const loaded=await response.json();
  if(loaded.schemaVersion!==1||!Array.isArray(loaded.taipei?.policies)||!Array.isArray(loaded.legislature?.records)||!Array.isArray(loaded.election?.candidates))throw Error('Invalid data');
  focusData=loaded;renderElection();renderProfiles();personMeta();renderMayor();renderLegislator();renderSources();setFocusLoad('ready');applyFocusRoute();
 }catch{setFocusLoad('error');}finally{focusLoading=false;byId('retry-load').disabled=false;}
}
byId('retry-load').onclick=loadFocusData;
applyFocusRoute();await loadFocusData();
