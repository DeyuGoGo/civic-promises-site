// Color comes exclusively from the research record's electionParty, never currentHead.
export const PARTY_STYLES=Object.freeze({
 '中國國民黨':{className:'party-kmt',label:'中國國民黨'},
 '民主進步黨':{className:'party-dpp',label:'民主進步黨'},
 '台灣民眾黨':{className:'party-tpp',label:'台灣民眾黨'},
 '無推薦政黨':{className:'party-none',label:'無推薦政黨'}
});
export function partyStyle(city){return PARTY_STYLES[city?.electionParty]||{className:'party-unknown',label:city?.electionParty||'政黨資料待補'};}
// Use an explicit title in the bulletin; otherwise retain the original item, without truncation.
export function bulletinPolicyTitle(p){
 if(p?.raw?.collectionSource!=='complete-bulletin')return p?.title||p?.originalQuote||'';
 const quote=String(p.originalQuote||'').trim(),heading=String(p.raw.heading||'').trim();
 const clean=text=>text.replace(/^(?:[＋+•]\s*|[一二三四五六七八九十百\d]+[、.．]\s*|\d+\s+)/,'').trim();
 const colon=quote.match(/^([^：:。；\n]{1,48})[：:]/);
 if(colon)return clean(colon[1]);
 if(heading&&quote.startsWith(heading))return clean(heading);
 // Taoyuan's numbered entries explicitly separate the title from the body with spaces.
 if(p.county==='桃園市'){
  const numbered=quote.match(/^\d+\s+([^\s]+)\s+/);
  if(numbered)return numbered[1];
 }
 return clean(quote);
}
export const COUNTY_GROUPS=[
 ['北部',['臺北市','新北市','桃園市','基隆市','新竹縣','新竹市','宜蘭縣']],
 ['中部',['苗栗縣','臺中市','彰化縣','南投縣','雲林縣']],
 ['南部',['嘉義縣','嘉義市','臺南市','高雄市','屏東縣']],
 ['東部',['花蓮縣','臺東縣']],
 ['離島',['澎湖縣','金門縣','連江縣']]
];
export function pageFromHash(hash){const id=String(hash||'').replace(/^#/,'');return ['home','ranking','promises','attainment','bulletins','method','data-tools'].includes(id)?id:'home';}
