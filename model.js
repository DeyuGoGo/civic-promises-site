export const COUNTIES=['臺北市','新北市','桃園市','臺中市','臺南市','高雄市','基隆市','新竹市','嘉義市','新竹縣','苗栗縣','彰化縣','南投縣','雲林縣','嘉義縣','屏東縣','宜蘭縣','花蓮縣','臺東縣','澎湖縣','金門縣','連江縣'];
export const STAGES={unknown:'未分類／待核對',planning:'規劃',construction:'施工',completed:'完工',operating:'營運',ongoing:'持續執行',paused:'暫停'};
export const normalize=s=>String(s??'').replaceAll('台','臺').toLocaleLowerCase();
export function sourceHref(value){return String(value??'').replace(/&(?:amp;)+/g,'&');}
export function safeUrl(value){try{const u=new URL(sourceHref(value));return ['http:','https:'].includes(u.protocol)?u.href:null;}catch{return null;}}
const dateOK=v=>v===null||(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v);
export function validateDataset(d){
 if(!d||d.schemaVersion!==1||!Array.isArray(d.promises)||!dateOK(d.updatedAt))throw Error('資料需包含 schemaVersion: 1、updatedAt（YYYY-MM-DD 或 null）、promises 陣列。');
 if(d.promises.length>10000)throw Error('一次最多載入 10,000 筆資料。');
 const ids=new Set();
 for(const p of d.promises){
  if(!p||typeof p.id!=='string'||!p.id.trim()||ids.has(p.id))throw Error('每筆政見必須有不重複的 id。');ids.add(p.id);
  if(!COUNTIES.includes(p.county))throw Error(`${p.id}：county 必須使用 22 縣市的標準名稱。`);
  for(const key of ['title','originalQuote','target','deadline','actualProgress','uncertainty'])if(typeof p[key]!=='string'||!p[key].trim())throw Error(`${p.id}：缺少 ${key}；未知請明確寫「待確認」。`);
  if(p.official!==null&&typeof p.official!=='string')throw Error(`${p.id}：official 必須是文字或 null。`);
  if(p.term!==null&&typeof p.term!=='string')throw Error(`${p.id}：term 必須是文字或 null。`);
  if(!Object.hasOwn(STAGES,p.stage)||!dateOK(p.asOf))throw Error(`${p.id}：stage 或 asOf 格式不符。`);
  if(!['unverified','partial','verified','disputed'].includes(p.evidenceStatus))throw Error(`${p.id}：evidenceStatus 格式不符。`);
  if(!Array.isArray(p.sources))throw Error(`${p.id}：sources 必須是陣列。`);
  for(const s of p.sources){if(!s||typeof s.title!=='string'||!s.title.trim()||!safeUrl(s.url)||!dateOK(s.publishedAt)||!['promise','progress','context'].includes(s.type))throw Error(`${p.id}：來源需有 title、安全的 http(s) url、publishedAt 與 type。`);}
  if(p.metric!==null){const m=p.metric;if(!m||typeof m.label!=='string'||typeof m.unit!=='string'||typeof m.basis!=='string'||![m.current,m.target].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0)||m.target<=0)throw Error(`${p.id}：metric 須包含 label、current、target（大於零）、unit、basis，或填 null。`);}
 }
 return d;
}
export function selectPromises(promises,{query='',county='',stage=''}={}){const q=normalize(query.trim());return promises.filter(p=>(!county||p.county===county)&&(!stage||p.stage===stage)&&(!q||normalize([p.title,p.county,p.official,p.originalQuote,p.target,p.actualProgress].join(' ')).includes(q)));}
export function countyRows(promises,{query='',county=''}={}){const q=normalize(query.trim());return COUNTIES.filter(c=>(!county||c===county)&&(!q||normalize(c).includes(q)||selectPromises(promises,{query:q,county:c}).length)).map(c=>({county:c,loaded:promises.filter(p=>p.county===c).length,rank:null,completionRate:null}));}
export function metricLabel(m){return m?`${m.current.toLocaleString('zh-TW')} / ${m.target.toLocaleString('zh-TW')} ${m.unit}`:'尚無可比較數值';}
