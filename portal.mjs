import {extractForm} from './extract.mjs';
export function dateOf(stamp) {
  return [stamp.slice(0,4), stamp.slice(4,6), stamp.slice(6,8)].join('-');
}
export const labels = {
  reason:'Reason', template:'Report template', visit:'Clinic visit date',
  transmission:'Transmission reason', life:'Battery life', unit:'Battery life unit',
  summary:'Report summary', insights:'CIED technician insights', rhythm:'Underlying rhythm',
  programming:'Reprogramming performed', burden:'AT/AF burden (%)', since:'Burden since',
  vt:'VT/VF episodes', longest:'Longest AT/AF episode', urgency:'Notification urgency'
};
export function formDefaults(c) {
  return {...Object.fromEntries(Object.keys(labels).map(k=>[k,''])),urgency:'Unassigned',...extractForm(c.current.attachment).values};
}
export function reportFields(c) { return {...formDefaults(c),...c.portal}; }
export function formLines(c) {
  if (!c.portal) return [];
  return Object.entries(reportFields(c)).map(([k,v])=>labels[k]+': '+(v||'Not recorded'));
}
const escape=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
function quickView(c,source) {
  const f=c.current.data;
  const value=k=>escape(source[f[k]?.label]?.text??'Not supplied');
  const group=(name,keys)=>'<h4>'+name+'</h4><dl>'+keys.filter(k=>f[k]&&source[f[k].label]).map(k=>'<dt>'+escape(f[k].label)+'</dt><dd>'+value(k)+'</dd>').join('')+'</dl>';
  const leadRows=[['Impedance','imp'],['Capture threshold','cap'],['Pulse width','pw'],['Sensing amplitude','sense'],['Programmed output','out']];
  return '<section class="vendorpage"><div class="eyebrow">INCOMING TRANSMISSION</div><div class="row"><h2>Vendor Quick View</h2><strong>'+escape(c.vendor)+'</strong></div><p>'+escape(c.current.patient)+' · '+dateOf(c.current.time)+' · Synthetic source</p>'+
  '<div class="sourcepaper">'+group('Device status & findings',['model','type','serial','status','voltage','life','alert'])+
  '<h4>Brady leads</h4><table><thead><tr><th>Measurement</th><th>RA</th><th>RV</th></tr></thead><tbody>'+leadRows.map(([l,k])=>'<tr><td>'+l+'</td><td>'+value('RA'+k)+'</td><td>'+value('RV'+k)+'</td></tr>').join('')+'</tbody></table>'+
  group('Brady / AF settings',['mode','lower','upper','av'])+group('Episodes, pacing & therapies',['episode','onset','duration','rate','burden','ap','vp','atp','shock'])+'</div>'+
  '<details><summary>View original vendor PDF</summary><object aria-label="Synthetic source PDF" type="application/pdf" data="data:application/pdf;base64,'+c.current.attachment+'"></object><button class="link" data-action="sourcepdf">Download source PDF</button></details></section>';
}
export function notificationForm(c,locked) {
  const extraction=extractForm(c.current.attachment);
  if(locked&&!c.portal)return '<div class="twopane">'+quickView(c,extraction.source)+'<section class="portalform"><h2>Archived report</h2><p>This report was signed before the structured form was introduced. Its original review note is shown below.</p></section></div>';
  const values=reportFields(c);
  const long=['summary','insights','rhythm','programming'];
  function control(k){
    const attrs=' name="'+k+'" data-portal="1" '+(locked?'disabled':'');
    const v=escape(values[k]);
    let input;
    if(long.includes(k))input='<textarea '+attrs+' maxlength="2000">'+v+'</textarea>';
    else if(k==='urgency'||k==='unit'){
      const choices=k==='urgency'?['Unassigned','Normal','Non-urgent','Urgent']:['','months','years','percent'];
      input='<select '+attrs+'>'+choices.map(o=>'<option '+(o===values[k]?'selected':'')+'>'+o+'</option>').join('')+'</select>';
    }else{
      const type=['since','visit'].includes(k)?'date':['burden','vt','life'].includes(k)?'number':'text';
      input='<input '+attrs+' type="'+type+'" '+(type==='number'?'min="0" step="'+(k==='vt'?'1':'any')+'"':'maxlength="200"')+(k==='burden'?' max="100"':'')+' value="'+v+'" placeholder="Not recorded">';
    }
    const proof=extraction.evidence[k]||[];
    const edited=(c.formOverrides||[]).includes(k)||(!locked&&Object.hasOwn(c.portal||{},k));
    const status=locked&&!c.extraction?'Archived entry':edited?'Reviewer entry':proof.length?(k==='summary'?'Assembled from PDF':'Extracted from PDF'):'Reviewer input';
    const trace=proof.length&&(!locked||c.extraction)?'<details class="fieldproof"><summary>Source evidence</summary>'+proof.map(p=>'<div>Page '+p.page+' · '+escape(p.label)+' = '+escape(p.text)+'</div>').join('')+'</details>':'';
    return '<div class="mapped"><label class="formlabel">'+labels[k]+input+'</label><small class="origin">'+status+'</small>'+trace+'</div>';

  }
  return '<div class="twopane">'+quickView(c,extraction.source)+'<section class="portalform"><div class="eyebrow">CLINICIAN WORKSPACE</div><h2>CIED report form</h2><p>Fields with source evidence are populated from the vendor PDF. Complete or correct the draft before sign-off.</p><div class="extractbar"><strong>'+Object.keys(extraction.values).length+' fields mapped from the vendor PDF</strong>'+(locked?'':'<button class="link" data-action="extract">Re-extract from source →</button>')+'</div><div class="reportstate">Report status · <strong>'+escape(c.stage)+'</strong></div><div class="formgrid">'+Object.keys(labels).map(control).join('')+'</div></section></div>';
}
