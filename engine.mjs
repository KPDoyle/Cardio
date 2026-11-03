import {formLines} from './portal.mjs';
export const vendors=['Boston Scientific','Abbott','Biotronik'];
export const version='demo-1.0';
export const rules={battery:2.7,burden:5};
const specs=[
 ['model','Device model','Device',''],['serial','Serial number','Device',''],['implant','Implant date','Device',''],['firmware','Firmware','Device',''],['type','Device type','Device',''],['mode','Pacing mode','Programming',''],['lower','Lower rate','Programming','bpm'],['upper','Upper rate','Programming','bpm'],['av','AV delay','Programming','ms'],['voltage','Battery voltage','Power','V'],['status','Battery status','Power',''],['life','Projected longevity','Power','months'],
 ...['RA','RV'].flatMap(c=>[['imp','Impedance','Ω'],['cap','Capture threshold','V'],['pw','Pulse width','ms'],['sense','Sensing amplitude','mV'],['out','Programmed output','V'],['pol','Polarity','']].map(([k,l,u])=>[c+k,c+' '+l,'Leads',u])),
 ['ap','Atrial pacing','Counters','%'],['vp','Ventricular pacing','Counters','%'],['burden','AT/AF burden','Counters','%'],['hr','Mean heart rate','Counters','bpm'],['max','Maximum heart rate','Counters','bpm'],['episode','Device classification','Episodes',''],['onset','Episode onset','Episodes',''],['duration','Episode duration','Episodes','s'],['rate','Episode rate','Episodes','bpm'],['atp','ATP sequences','Therapies',''],['shock','Delivered shocks','Therapies',''],['alert','Device alert','Alerts','']];
const schema=Object.fromEntries(specs.map(row=>[row[0],row]));
export function pdf(lines){
 const esc=s=>String(s).normalize('NFKD').replace(/Ω/g,'ohm').replace(/[^ -~]/g,' ').replace(/[()\\]/g,'\\$&');
 const wrapped=lines.flatMap(l=>String(l).match(/.{1,88}(?:\s|$)|.{1,88}/g)||['']);
 const pages=[]; for(let n=0;n<wrapped.length;n+=45)pages.push(wrapped.slice(n,n+45));
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids ['+pages.map((_,i)=>(4+i*2)+' 0 R').join(' ')+'] /Count '+pages.length+' >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 pages.forEach((page,i)=>{const stream='BT /F1 10 Tf 48 790 Td 15 TL '+page.map(l=>'('+esc(l)+') Tj T*').join('\n')+' ET';objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents '+(5+i*2)+' 0 R >>','<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream')});
 let out='%PDF-1.4\n',offsets=[0];objects.forEach((o,i)=>{offsets.push(out.length);out+=(i+1)+' 0 obj\n'+o+'\nendobj\n'});const start=out.length;return out+'xref\n0 '+offsets.length+'\n0000000000 65535 f \n'+offsets.slice(1).map(x=>String(x).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+offsets.length+' /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF';
}
export function generate(seed,vendor,scenario='routine',prior=false){
 if(!Number.isSafeInteger(seed)||seed<1||seed>999999||!vendors.includes(vendor)||!['routine','battery','burden','legacy'].includes(scenario))throw Error('Invalid generator parameters');
 const abb=vendor===vendors[1],num=seed%37,stamp=prior?'20261003':'20261103',id='SYN-'+seed,src=vendor===vendors[2]?'BIOTRONIK':abb?'MERLIN':'LATITUDE',tick=String(8+seed%7).padStart(2,'0')+String(seed%60).padStart(2,'0');
 const values=[abb?'Assurity (demo)':'Accolade (demo)',src+'-'+seed,'2021-04-18','Demo 2.1','Pacemaker','DDDR',60,130,180,scenario==='battery'&&!prior?2.61:((2.88+num/1000+(prior?.03:0)).toFixed(3)),scenario==='battery'&&!prior?'ERI':'OK',scenario==='battery'&&!prior?4:76+Number(prior),490+num,0.75,0.4,3.4,2.5,'Bipolar',552+num+(prior?12:0),1,0.4,9.5,2.5,'Bipolar',42+num,18+num,scenario==='burden'&&!prior?8.2:0.3,71,122,scenario==='burden'?'AT/AF':'None reported',scenario==='burden'?'03 Nov 2026 06:12':null,scenario==='burden'?240:null,scenario==='burden'?145:null,null,null,scenario==='battery'&&!prior?'ERI reported':'None reported'];
 if(prior&&scenario==='burden'){values[29]='None reported';values[30]=values[31]=values[32]=null}
 if(scenario==='burden'){
  values[0]=abb?'Gallant (demo)':'Resonate (demo)';values[4]='ICD';values[33]=0;values[34]=0;
 }
 if(vendor===vendors[2])values[0]=values[4]+' (Biotronik demo)';
 const msg=id+'-'+src+'-'+stamp;
 const lines=['MSH|^~\\&|'+src+'|DEMO|CARDIONEXUS|DEMO|'+stamp+tick+'+0000||ORU^R01^ORU_R01|'+msg+'|T|2.5.1','PID|1||'+id+'||Participant^Demo'+seed+'||19600415','OBR|1||'+msg+'|CIED^Synthetic device interrogation'];
 specs.forEach(([key,label,,unit],i)=>{if(values[i]==null||(scenario==='legacy'&&key==='RAsense'))return;let val=values[i];if(abb&&key==='voltage'){val=Math.round(Number(val)*1000);unit='mV'}lines.push(['OBX',lines.length-2,unit?'NM':'ST',(vendor===vendors[2]?'BI_':abb?'AB_':'BS_')+key+'^'+label+'^99DEMO','1',val,unit,'','','','F'].join('|'))});
 const attachment=btoa(pdf(['Synthetic vendor report',vendor+' | '+msg,...lines.slice(3).map(l=>{const a=l.split('|');return a[3].split('^')[1]+': '+a[5]+' '+a[6]})]));
 lines.push('OBX|'+(lines.length-2)+'|ED|18750-0^Cardiac electrophysiology report^LN|1|^application^pdf^Base64^'+attachment+'||||||F');return lines.join('\r');
}
export function parse(raw){
 const segs=raw.split('\r').map(r=>r.split('|')),h=segs[0],pid=segs[1],vendor=h[2]==='BIOTRONIK'?vendors[2]:h[2]==='MERLIN'?vendors[1]:h[2]==='LATITUDE'?vendors[0]:null;if(!vendor||h[10]!=='T'||!pid[3].startsWith('SYN-'))throw Error('Only supported test messages are accepted');
 const data={},msg=h[9];let attachment;
 for(const a of segs.filter(s=>s[0]==='OBX')){if(a[2]==='ED'){attachment=a[5].split('^')[4];continue}const code=a[3].split('^')[0],key=code.slice(3);if(!schema[key]||!code.startsWith(vendor===vendors[2]?'BI_':vendor===vendors[1]?'AB_':'BS_'))throw Error('Unknown demo field');const [,label,group,unit]=schema[key];const converted=key==='voltage'&&a[6]==='mV';data[key]={label,group,unit,value:converted?Number(a[5])/1000:a[2]==='NM'?Number(a[5]):a[5],source:msg+' / OBX '+a[1]+' / '+code,raw:a[5],wireUnit:a[6],method:converted?'Unit conversion':'Parsed',parser:version}}
 return {id:msg,patient:pid[3],vendor,time:h[6],data,attachment,raw}
}
export function flags(s,r=rules){return [s.data.voltage.value<r.battery?'Battery voltage':null,s.data.burden.value>r.burden?'AT/AF burden':null].filter(Boolean)}
export function delta(a,b){return typeof a?.value==='number'&&typeof b?.value==='number'?Number((a.value-b.value).toFixed(3)):null}
export function makeCase(seed,vendor,scenario){return {seed,vendor,scenario,id:vendor+'-'+seed,current:parse(generate(seed,vendor,scenario)),prior:parse(generate(seed,vendor,scenario,true)),stage:'Queued',note:'',edits:[],events:[]}}
export function bundle(c){
 const s=c.current,id=s.id,ref=(t,id)=>({reference:t+'/'+id}),p=ref('Patient',s.patient),d=ref('Device',id),date=s.time.slice(0,4)+'-'+s.time.slice(4,6)+'-'+s.time.slice(6,8)+'T'+s.time.slice(8,10)+':'+s.time.slice(10,12)+':00Z';
 const obs=Object.entries(s.data).map(([key,f])=>({resourceType:'Observation',id:id+'-'+key,status:'final',code:{text:f.label},subject:p,device:d,effectiveDateTime:date,...(typeof f.value==='number'?{valueQuantity:{value:f.value,unit:f.unit}}:{valueString:f.value}),note:[{text:f.source+' | '+f.method+' | '+f.parser+' | original '+f.raw+' '+f.wireUnit+ c.edits.filter(e=>e.key===key).map(e=>' | Reviewer correction: '+e.before+' to '+e.after+', '+e.reason).join('')}]}));
 const resources=[{resourceType:'Patient',id:s.patient,identifier:[{value:s.patient}]},{resourceType:'Device',id,patient:p,manufacturer:s.vendor,modelNumber:s.data.model.value,serialNumber:s.data.serial.value},...obs,{resourceType:'DocumentReference',id,status:'current',subject:p,content:[{attachment:{contentType:'application/pdf',data:s.attachment}}]},{resourceType:'DiagnosticReport',id,status:'final',code:{text:'Synthetic CIED interrogation'},subject:p,effectiveDateTime:date,result:obs.map(o=>ref('Observation',o.id)),presentedForm:[{contentType:'application/pdf',title:'Synthetic source report',data:s.attachment}],conclusion:[...formLines(c),c.note,c.clinicianNote].filter(Boolean).join(' | ')}];
 return {resourceType:'Bundle',type:'collection',entry:resources.map(resource=>({fullUrl:'https://example.invalid/fhir/'+resource.resourceType+'/'+resource.id,resource}))}
}
