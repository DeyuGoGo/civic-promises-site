const count=value=>Number.isInteger(value)&&value>=0;

// Plain text only. A missing or incomplete denominator is never described as no estimates.
export function estimateCoverage(score){
 if(!score||!['applicable','estimated','measured','unrated'].every(key=>count(score[key]))||
  score.estimated+score.measured+score.unrated!==score.applicable)return '估分資料未齊';
 const {applicable,estimated,unrated}=score;
 if(!applicable)return '無適用分項';
 if(unrated)return estimated?`估分 ${estimated}/${applicable}項 · ${unrated}項待評`:`${unrated}/${applicable}項待評`;
 if(estimated===applicable)return `全數估分 · ${estimated}/${applicable}項`;
 return estimated?`估分 ${estimated}/${applicable}項`:'無估分';
}

function dateStamp(value){
 if(typeof value!=='string')return null;
 const text=value.trim();
 const m=text.match(/^(\d{4})(?:[-/.](\d{1,2})(?:[-/.](\d{1,2}))?|年(?:(\d{1,2})月(?:(\d{1,2})日?)?)?)?$/);
 if(!m)return null;
 const year=Number(m[1]),month=Number(m[2]||m[4]||0),day=Number(m[3]||m[5]||0);
 if(year<1000||month>12||((m[2]||m[4])&&!month)||((m[3]||m[5])&&!day))return null;
 if(day>new Date(Date.UTC(year,month,0)).getUTCDate())return null;
 const pad=n=>String(n).padStart(2,'0');
 return {label:`${year}${month?'-'+pad(month):''}${day?'-'+pad(day):''}`,
  start:Date.UTC(year,month?month-1:0,day||1),
  end:day?Date.UTC(year,month-1,day):month?Date.UTC(year,month,0):Date.UTC(year,11,31)};
}

function evidenceDate(value){
 const result={stamps:[],periods:[],missing:false,detailed:false};
 if(typeof value!=='string'||!value.trim())return {...result,missing:true};
 let metadataOnly=false;
 for(const fragment of value.trim().split(/[;；]/).filter(Boolean)){
  const text=fragment.trim();
  if(/未標|未另載|未提供|不詳|待確認|待核對/.test(text))result.missing=true;
  // School years retain their original calendar; converting them to calendar years invents endpoints.
  if(/^\d{3}(?:[–—~～-]\d{3})?學年度$/.test(text)){
   result.periods.push(text.replace(/[—~～-]/g,'–'));continue;
  }
  const prefix=text.match(/^(\d{4}(?:[-/.]\d{1,2}(?:[-/.]\d{1,2})?|年(?:\d{1,2}月(?:\d{1,2}日?)?)?)?)(?=$|[^\d./-])/);
  if(!prefix){
   if(/發布|公開|公告|報告|查閱|圖檔|版本|更新/.test(text))metadataOnly=true;
   else if(!result.missing)result.detailed=true;
   continue;
  }
  const stamp=dateStamp(prefix[1]);
  if(!stamp){result.missing=true;continue;}
  const remainder=text.slice(prefix[1].length);
  // A leading document date with a different data cutoff is not the outcome date.
  if(/(?:資料|案例)[^）)]*截至/.test(remainder)){
   result.detailed=true;continue;
  }
  // An explicit outcome/program year takes precedence over a later report date in parentheses.
  if(/^\d{4}年?$/.test(prefix[1])&&/^度?(?:成果|方案|營運|上半年|下半年|春節|選舉期間|古厝)/.test(remainder)){
   result.stamps.push(stamp);continue;
  }
  // A report, publication, lookup or image version date cannot silently become the evidence period.
  if(/發布|公開|公告|報告|查閱|圖檔|版本|更新/.test(remainder)){
   metadataOnly=true;continue;
  }
  result.stamps.push(stamp);
 }
 if(!result.stamps.length&&!result.periods.length&&metadataOnly&&!result.missing)result.detailed=true;
 return result;
}

function stampRange(stamps){
 const first=stamps.reduce((a,b)=>b.start<a.start||(b.start===a.start&&b.end>a.end)?b:a);
 const last=stamps.reduce((a,b)=>b.end>a.end||(b.end===a.end&&b.start<a.start)?b:a);
 return first.label===last.label?first.label:`${first.label}–${last.label}`;
}

function evidenceLabel(values){
 const parsed=values.map(evidenceDate),stamps=parsed.flatMap(v=>v.stamps);
 const periods=[...new Set(parsed.flatMap(v=>v.periods))];
 const missing=!values.length||parsed.some(v=>v.missing);
 const detailed=parsed.some(v=>v.detailed)||(stamps.length>0&&periods.length>0);
 let label=stamps.length?stampRange(stamps):periods.length?periods.join('、'):'';
 if(!label)return `證據日期：${missing?detailed?'部分未註明，其餘依來源註記':'未註明':'依分項來源註記'}`;
 if(missing)label+=' · 部分未註明';
 if(detailed)label+=' · 部分期間詳見分項';
 return '證據日期：'+label;
}

function rawChecks(p){
 const raw=p?.raw;
 const dates=[p?.lastCheckedAt,raw?.lastCheckedAt,...(Array.isArray(raw?.researchLog)?raw.researchLog.map(v=>v?.date):[])];
 // completeBulletinResearch copies the catalog-wide observedOn into every raw item.
 // It is a collection date, not proof that this policy was checked on that day.
 if(raw?.collectionSource!=='complete-bulletin')dates.push(raw?.observedOn);
 return dates.map(dateStamp).filter(Boolean);
}

/** Return two plain-text lines. Current parts take precedence over older whole-item records. */
export function policyDateSummary(p,progress){
 const hasParts=Array.isArray(progress?.parts)&&progress.parts.length>0;
 const parts=hasParts?progress.parts.filter(part=>part?.status!=='not_applicable'):[];
 const checks=parts.map(part=>dateStamp(part?.lastCheckedAt));
 const known=checks.filter(Boolean),fallback=known.length?[]:rawChecks(p);
 const dates=known.length?known:fallback;
 let checkedLabel='最近查核：未註明';
 if(dates.length){
  const latest=dates.reduce((a,b)=>b.end>a.end?b:a);
  const partial=known.length&&(known.length!==parts.length||known.some(v=>v.label!==latest.label));
  checkedLabel=`最近查核：${latest.label}${partial?'（部分分項）':fallback.length?'（原條目）':''}`;
 }
 if(hasParts)return {checkedLabel,evidenceLabel:parts.length?evidenceLabel(parts.map(part=>part?.asOf)):'證據日期：無適用分項'};
 const original=p?.raw?.current?.dateLabel??p?.asOf??null;
 return {checkedLabel,evidenceLabel:evidenceLabel([original])};
}
