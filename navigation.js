const NAVIGATION_PAGES=new Set(['home','ranking','promises','attainment','bulletins','method','data-tools']);
const homeRoute=()=>({page:'home',policyId:null,county:null});

function encodeRouteValue(value){
 if(typeof value!=='string'||!value.trim()||/[\u0000-\u001f\u007f]/.test(value))throw new TypeError('Route values must be nonempty text without control characters.');
 try{return encodeURIComponent(value);}
 catch{throw new TypeError('Route values must contain valid Unicode.');}
}

export function readRoute(hash){
 const route=typeof hash==='string'?hash.replace(/^#/,''):'';
 if(NAVIGATION_PAGES.has(route))return {...homeRoute(),page:route};
 const match=route.match(/^(policy|county)\/([^/#?]+)$/);
 if(!match)return homeRoute();
 try{
  const value=decodeURIComponent(match[2]);
  encodeRouteValue(value);
  return {...homeRoute(),[match[1]==='policy'?'policyId':'county']:value};
 }catch{return homeRoute();}
}

export function makePolicyHash(id){return '#policy/'+encodeRouteValue(id);}
export function makeCountyHash(name){return '#county/'+encodeRouteValue(name);}

export function policyShareUrl(baseUrl,id){
 const url=new URL(baseUrl);
 if(!['https:','http:'].includes(url.protocol))throw new TypeError('Share URLs must use HTTP or HTTPS.');
 url.search='';
 url.hash=makePolicyHash(id);
 return url.href;
}
