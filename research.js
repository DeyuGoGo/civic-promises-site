import {COUNTIES,safeUrl} from './model.js';
const requiredText=(v,label)=>{if(typeof v!=='string'||!v.trim())throw Error(`研究資料缺少 ${label}`);};
export function adaptResearch(raw){
 if(!raw?.metadata||!Array.isArray(raw.cities))throw Error('研究資料需包含 metadata 與 cities。');
 if(raw.metadata.rankingEnabled!==false)throw Error('第一版僅接受 rankingEnabled: false。');
 const names=new Set(),ids=new Set();
 for(const c of raw.cities){
  if(!COUNTIES.includes(c.name)||names.has(c.name))throw Error('縣市名稱不正確或重複。');names.add(c.name);
  if(c.rank!==null||c.score!==null||c.rankingEligible!==false)throw Error(`${c.name}：名次與總分必須為 null，且不可排名。`);
  if(!Array.isArray(c.pledges)||c.selectedPledgeCount!==c.pledges.length)throw Error(`${c.name}：選樣筆數不一致。`);
  for(const p of c.pledges){
   requiredText(p.id,'id');requiredText(p.quote,'quote');requiredText(p.summary,'summary');requiredText(p.status,'status');
   if(ids.has(p.id))throw Error('政見 id 重複。');ids.add(p.id);
   if(p.score!==null||p.rankingEligible!==false)throw Error(`${p.id}：不可提供整體分數。`);
   if(!Array.isArray(p.limitations)||!p.limitations.length||!p.current||!Array.isArray(p.originalSources)||!Array.isArray(p.current.sources))throw Error(`${p.id}：缺少來源群組、現況或限制。`);
   for(const s of [...p.originalSources,...p.current.sources])if(!safeUrl(s.url)||!s.title)throw Error(`${p.id}：來源連結或標題不正確。`);
   if(p.limitedMetric!==null&&p.limitedMetric!==undefined){if(!p.limitedMetric.label||!(p.limitedMetric.limitations?.length||p.limitations?.length))throw Error(`${p.id}：限定指標需保留 label 及 limitations。`);}
  }
 }
 if(raw.metadata.jurisdictionCount!==undefined&&raw.metadata.jurisdictionCount!==raw.cities.length)throw Error('縣市總數與 metadata 不一致，請確認資料是否完整。');
 if(raw.metadata.selectedPledgeCount!==undefined&&raw.metadata.selectedPledgeCount!==ids.size)throw Error('政見總數與 metadata 不一致，請確認資料是否完整。');
 return {schemaVersion:1,updatedAt:raw.metadata.observedOn??null,description:raw.metadata.coverageWarning??'選樣資料，非完整政見母體。',research:raw,cities:raw.cities,promises:raw.cities.flatMap(c=>c.pledges.map(p=>({id:p.id,county:c.name,title:p.summary,originalQuote:p.quote,official:c.electedHead,term:`${c.termStart} 至 ${c.scheduledTermEnd}`,target:p.metricDefinition||'原文未定義量化口徑',deadline:[p.deadline,p.deadlineNote].filter(Boolean).join('；')||'原文未明訂',actualProgress:p.status,stage:p.frontendStage||'unknown',stageLabel:p.current.stage||'現況階段未標註',asOf:p.current.dateLabel||null,evidenceStatus:p.current.sources.length?'partial':'unverified',uncertainty:p.limitations.join('；'),metric:null,sources:[],raw:p,city:c})))};
}
export const FIELD_LABELS={actually_supplied_population:'實際供水人口',administrative_population:'行政區人口',candidate_metric:'候選人自述指標',candidate_source_urls:'候選人自述來源',candidate_value:'候選人自述數值',central:'中央',combined:'合計',context_only:'僅作背景',coverage_target:'覆蓋目標',covered_districts:'已覆蓋行政區',definition:'定義',direction:'方向',first_centre_milestones:'首座中心里程碑',formal_care_start_date:'正式收托日期',formal_care_start_date_basis:'正式收托日期依據',formal_centers:'正式中心數',local:'地方',milestone:'里程碑',name:'名稱',not_pledge_denominator:'不可作為承諾分母',observed_on:'查閱日期',opening_ceremony_date:'開幕典禮日期',publication_date:'發布日期',same_formula_confirmed:'已確認同一計算口徑',sources:'來源',stage:'階段',title:'標題',url:'來源連結',eligible:'限定指標可計算',not_total_pledge_completion:'不代表整項承諾完成率',value:'數值',unit:'單位',scope:'適用範圍',metric:'指標定義',note:'說明',date:'資料日期',data_date:'資料日期',deadline:'期限',deadline_interpretation:'期限解讀',first:'第一胎',second:'第二胎',third:'第三胎',third_and_later:'第三胎起',components:'分項目標',named_targets:'具名目標',post_election_elaboration:'選後補充，非原始承諾',separate_longterm_target:'另列長期目標',source:'來源',source_url:'來源連結',source_id:'來源識別',locator:'原件位置',capacity:'容量',capacity_unit:'容量單位',central_program_context:'中央制度背景',published_date:'發布日期',effective_period:'適用期間',age_scope:'年齡範圍',first_child_twd_per_month:'第一名每月金額',second_child_twd_per_month:'第二名每月金額',third_and_later_twd_per_month:'第三名起每月金額',eligibility_note:'資格限制',partial_pre_election_evidence:'部分選前證據',operating_sites_confirmed:'已確認營運據點',planned_not_counted:'規劃中，未計入',candidate_claim:'候選人當時自述',label:'指標名稱',limitations:'適用限制',numerator:'分子',denominator:'分母',percentage:'限定指標百分比',percent:'限定指標百分比（%）',ratio:'限定指標比值',formula:'計算方式',interpretation:'解讀',basis:'計算範圍',current:'當期數值',target:'目標',baseline:'基期',result:'結果',status:'狀態',type:'類型',calculation:'計算說明'};
