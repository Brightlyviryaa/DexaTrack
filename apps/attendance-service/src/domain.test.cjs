const { test } = require('node:test');
const assert = require('node:assert/strict');
const { workDate, validDate, validatePosition, validateProgress, actorCheck } = require('../dist/domain');
const { PhotoStore } = require('../dist/photo-store');
const sharp = require('sharp');
const location = {name:'Office',latitude:-6.2,longitude:106.8,radius:100};
const now = new Date('2026-11-16T16:59:59Z');
const fix = {...location,accuracy:10,timestamp:now.getTime()};
const invalid = error => error.getError().status === 400;
test('WIB rollover and real calendar dates', () => {
  assert.equal(workDate(now),'2026-11-16'); assert.equal(workDate(new Date('2026-11-16T17:00:00Z')),'2026-11-17');
  for (const v of ['2026-02-30','2026-13-01','not-date',null]) assert.equal(validDate(v),false);
  assert.equal(validDate('2028-02-29'),true);
});
test('GPS rejects out-of-radius, stale, future, inaccurate and malformed fixes', () => {
  assert.equal(validatePosition(fix,location,now),0);
  for (const change of [{latitude:-6.3},{accuracy:101},{accuracy:-1},{timestamp:now.getTime()-30001},{timestamp:now.getTime()+5001},{latitude:NaN},{longitude:181},{timestamp:'0'}]) assert.throws(()=>validatePosition({...fix,...change},location,now),invalid);
  assert.throws(()=>actorCheck({accountId:1,employeeId:1,role:'EMPLOYEE'},true),e=>e.getError().status===403);
});
test('progress allows only the supported text document and enforces the real 10000 character boundary', () => {
  const doc = text => ({type:'doc',content:[{type:'paragraph',content:[{type:'text',text,marks:[{type:'bold'}]}]}]});
  validateProgress(doc('a'.repeat(10000)));
  for (const v of [doc('a'.repeat(10001)),doc('  '),{type:'doc',content:[{type:'image',attrs:{src:'https://evil'}}]}, {type:'doc',content:[{type:'doc'}]}, {type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'x',marks:[{type:'link',attrs:{href:'javascript:evil'}}]}]}]}]) assert.throws(()=>validateProgress(v),invalid);
  validateProgress({type:'doc',content:[{type:'orderedList',attrs:{start:1,type:null},content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'done'}]}]}]}]});
});
test('selfie rejects MIME spoofing, broken images, oversized files and excessive pixel counts', async () => {
  const store = new PhotoStore();
  const png = await sharp({create:{width:10,height:10,channels:3,background:'white'}}).png().toBuffer();
  assert.equal((await store.validate(`data:image/png;base64,${png.toString('base64')}`)).bytes.length,png.length);
  for (const value of [`data:image/jpeg;base64,${png.toString('base64')}`,'data:image/jpeg;base64,dGVzdA==','data:image/svg+xml;base64,PHN2Zz4=', 'x'.repeat(2800001)]) await assert.rejects(store.validate(value),invalid);
  const huge = await sharp({create:{width:2100,height:2100,channels:3,background:'white'}}).png().toBuffer();
  await assert.rejects(store.validate(`data:image/png;base64,${huge.toString('base64')}`),invalid);
});
