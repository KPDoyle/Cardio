// Reads only the literal text streams produced by the synthetic vendor PDF writer.
export function readQuickView(attachment) {
  const fields={};
  let bytes;
  try { bytes=atob(attachment); } catch { return fields; }
  if(!bytes.startsWith('%PDF-1.4')) return fields;
  const streams=[...bytes.matchAll(/\bstream\n([\s\S]*?)\nendstream/g)];
  for(const [index,stream] of streams.entries()) {
    const lines=[...stream[1].matchAll(/\(((?:\\.|[^()\\])*)\) Tj/g)]
      .map(match=>match[1].replace(/\\([()\\])/g,'$1').trim());
    if(index===0&&lines[0]!=='Synthetic vendor report') return {};
    for(const line of lines){
      const colon=line.indexOf(': ');
      if(colon<1)continue;
      const label=line.slice(0,colon);
      if(Object.hasOwn(fields,label))continue;
      fields[label]={text:line.slice(colon+2).trim(),page:index+1,label};
    }
  }
  return fields;
}
export function extractForm(attachment) {
  const source=readQuickView(attachment), values={}, evidence={};
  function set(key,value,labels){values[key]=value;evidence[key]=labels.map(l=>source[l])}
  const life=source['Projected longevity']?.text.match(/^(\d+(?:\.\d+)?) (months|years|%)$/);
  if(life){set('life',life[1],['Projected longevity']);set('unit',life[2]==='%'?'percent':life[2],['Projected longevity'])}
  const burden=source['AT/AF burden']?.text.match(/^(\d+(?:\.\d+)?)\s*%$/);
  if(burden&&Number(burden[1])<=100)set('burden',burden[1],['AT/AF burden']);
  if(source['Device type'])set('template',source['Device type'].text,['Device type']);
  const labels=['Device model','Battery status','Projected longevity','AT/AF burden'];
  if(labels.every(l=>source[l])&&life&&burden)set('summary',source['Device model'].text+' reports battery status '+source['Battery status'].text+', projected longevity '+source['Projected longevity'].text+' and AT/AF burden '+source['AT/AF burden'].text+'.',labels);
  return {values,evidence,source,version:'synthetic-pdf-1'};
}
