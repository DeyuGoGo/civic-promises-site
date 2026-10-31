const FOCUS_PAGES=new Set(['home','mayor','legislator','method']);
const FOCUS_ALIASES={promises:'mayor',attainment:'mayor',bulletins:'method','data-tools':'method',ranking:'home'};

export function readFocusRoute(hash=''){
 const value=String(hash).replace(/^#/,'');
 if(FOCUS_PAGES.has(value))return {page:value,kind:null,id:null};
 if(FOCUS_ALIASES[value])return {page:FOCUS_ALIASES[value],kind:null,id:null};
 const match=value.match(/^(policy|record|county|issue)\/([^/#?]+)$/);
 if(match){
  try{
   const id=decodeURIComponent(match[2]);
   if(!id.trim()||/[\u0000-\u001f\u007f]/.test(id))throw Error('invalid identifier');
   return {page:match[1]==='record'?'legislator':'mayor',kind:match[1],id};
  }catch{}
 }
 return {page:'home',kind:null,id:null};
}

export function focusRecordHash(kind,id){
 if(!['policy','record'].includes(kind)||typeof id!=='string'||!id.trim()||/[\u0000-\u001f\u007f]/.test(id))throw Error('Invalid record');
 return '#'+kind+'/'+encodeURIComponent(id);
}

export function focusShareUrl(base,kind,id){
 const url=new URL(base);
 if(!['http:','https:'].includes(url.protocol))throw Error('Invalid sharing origin');
 url.search='';url.hash=focusRecordHash(kind,id);return url.href;
}

const focusText=value=>String(value??'').replaceAll('台','臺').toLocaleLowerCase().trim();
export function selectFocusPolicies(policies,{topic='',query=''}={}){
 const q=focusText(query);
 return policies.filter(p=>(!topic||p.topic.id===topic)&&(!q||focusText([p.title,p.originalQuote,p.explanation.summary,...p.parts.map(part=>part.label)].join(' ')).includes(q)));
}

export function selectFocusRecords(records,{category='',query=''}={}){
 const q=focusText(query);
 return records.filter(r=>(!category||r.category===category)&&(!q||focusText([r.title,r.summary,r.roleLabel,r.billNumber,r.proposalNumber].join(' ')).includes(q))).sort((a,b)=>String(b.date).localeCompare(String(a.date))||a.id.localeCompare(b.id));
}

export function focusArchiveUrl(route,data){
 if(route.kind==='policy'&&data.archivePolicyIds?.includes(route.id))return './counties.html'+focusRecordHash('policy',route.id);
 if(route.kind==='county'&&data.archiveCounties?.includes(route.id))return './counties.html#county/'+encodeURIComponent(route.id);
 return null;
}
