import test from 'node:test';
import assert from 'node:assert/strict';
import {vendors,generate,makeCase,flags,bundle,delta,pdf} from './engine.mjs';
for(const vendor of vendors){
 test(vendor+' seeded normalisation, history and traceability',()=>{
 const c=makeCase(82,vendor,'battery');assert.equal(c.current.raw,generate(82,vendor,'battery'));
 assert.deepEqual(flags(c.current),['Battery voltage']);assert.equal(c.current.data.voltage.value,2.61);
 assert.ok(delta(c.current.data.voltage,c.prior.data.voltage)<0);
 for(const f of Object.values(c.current.data)){assert.ok(f.source.includes(c.current.id));assert.ok(f.parser)}
 assert.ok(atob(c.current.attachment).startsWith('%PDF-1.4'));
 assert.deepEqual(flags(c.current,{battery:2.61,burden:100}),[]);
 });
 test(vendor+' episodes, missing values and FHIR internal references',()=>{
 const c=makeCase(111,vendor,'burden');assert.deepEqual(flags(c.current),['AT/AF burden']);assert.equal(c.current.data.duration.value,240);assert.equal(c.current.data.shock.value,'0');
 assert.equal(makeCase(111,vendor,'legacy').current.data.RAsense,undefined);
 const b=bundle(c);const resources=b.entry.map(e=>e.resource),dr=resources.find(r=>r.resourceType==='DiagnosticReport');
 assert.equal(dr.result.length,Object.keys(c.current.data).length);
 for(const ref of dr.result)assert.ok(resources.some(r=>r.resourceType+'/'+r.id===ref.reference));
 assert.equal(resources.find(r=>r.resourceType==='DocumentReference').content[0].attachment.data,c.current.attachment);
 });
}
test('long reports paginate',()=>assert.match(pdf(Array(120).fill('Test report')),/\/Count 3/));
test('signed portal fields export alongside independent device observations',()=>{
 const c=makeCase(201,'Biotronik','routine');
 c.portal={insights:'Demo source reviewed',urgency:'Normal',burden:'0.4'};
 const resources=bundle(c).entry.map(x=>x.resource);
 assert.match(resources.find(r=>r.resourceType==='DiagnosticReport').conclusion,/CIED technician insights: Demo source reviewed/);
 assert.equal(resources.find(r=>r.id.endsWith('-burden')).valueQuantity.value,0.3);
});
import {extractForm} from './extract.mjs';
import {reportFields} from './portal.mjs';
test('report prefill reads vendor PDF bytes and retains independent human entries',()=>{
 const c=makeCase(212,'Biotronik','routine');
 c.current.attachment=btoa(pdf(['Synthetic vendor report','Projected longevity: 19 months','AT/AF burden: 4.6 %']));
 const extraction=extractForm(c.current.attachment);
 assert.equal(extraction.values.life,'19');assert.equal(extraction.values.burden,'4.6');
 assert.equal(extraction.evidence.life[0].page,1);
 assert.equal(reportFields(c).summary,'');assert.equal(reportFields(c).rhythm,'');
 c.portal={life:'18'};assert.equal(reportFields(c).life,'18');assert.equal(extraction.values.life,'19');
 assert.deepEqual(extractForm('broken').values,{});
});
test('review draft compares transmissions, preserves overrides and leaves old signed reports intact',()=>{
 const c=makeCase(123,'Biotronik','burden');
 assert.match(reportFields(c).insights,/0.3% to 8.2%/);
 assert.match(reportFields(c).recommendation,/change in burden/);
 c.portal={insights:'Technician interpretation'};
 assert.equal(reportFields(c).insights,c.portal.insights);
 c.stage='Signed';
 assert.deepEqual(reportFields(c),c.portal);
});
