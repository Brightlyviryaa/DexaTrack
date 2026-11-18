const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readdir, writeFile, rm } = require('node:fs/promises');
const { join } = require('node:path');
const sharp = require('sharp');
const { startRuntime } = require('./workforce-test-runtime.cjs');
const { workDate } = require('../dist/domain');

test('workforce persists through real MySQL, sessions, TCP and HTTP', {skip:process.env.DEXATRACK_INTEGRATION!=='1',timeout:300000}, async t => {
  const r=await startRuntime();const {api,dbs,hrCookie,workers}=r;const [worker,other]=workers;
  const today=workDate(), yesterday=workDate(new Date(Date.now()-86400000));
  let location={name:'Office',latitude:-6.2,longitude:106.8,radius:100};
  const photo=await sharp({create:{width:64,height:64,channels:3,background:'white'}}).jpeg().toBuffer();
  const evidence=()=>({photo:`data:image/jpeg;base64,${photo.toString('base64')}`,capturedAt:new Date().toISOString(),position:{latitude:-6.2,longitude:106.8,accuracy:10,timestamp:Date.now()},location});
  const submit=(cookie=worker.cookie,kind='in',extra={})=>api('/attendance',{date:today,kind,evidence:evidence(),...extra},'POST',cookie);
  const get=(path,cookie=worker.cookie)=>api(path,null,'GET',cookie);
  const state=async(cookie=worker.cookie)=>(await get('/workforce',cookie)).body;
  const decision=(id,status='Disetujui',cookie=hrCookie)=>api(`/requests/${id}/decision`,{status},'POST',cookie);
  try {
    await t.test('HR scope and default empty data',async()=>{
      assert.equal((await get('/dashboard/summary','')).status,401);
      assert.equal((await get('/dashboard/summary',worker.cookie)).status,403);
      assert.equal((await api('/attendance/settings',{...location,workStartTime:'08:00'},'PUT',worker.cookie)).status,403);
      const s=await state();assert.deepEqual(s.records,[]);assert.deepEqual(s.requests,[]);assert.equal(s.workStartTime,'08:00');assert.equal(s.location,null);
      const summary=(await get('/dashboard/summary',hrCookie)).body;assert.equal(summary.metrics.employees,3);assert.equal(summary.metrics.present,0);
      assert.equal((await api('/attendance/settings',{...location,workStartTime:'08:00'},'PUT',hrCookie)).status,200);
    });
    await t.test('invalid GPS, image, dates, progress and storage failures do not write attendance or leave files',async()=>{
      for(const change of [{latitude:-6.3},{accuracy:101},{timestamp:Date.now()-60000},{longitude:181}]) {
        const e=evidence();Object.assign(e.position,change);assert.equal((await submit(worker.cookie,'in',{evidence:e})).status,400);
      }
      assert.equal((await submit(worker.cookie,'in',{date:yesterday})).status,400);
      const broken=evidence();broken.photo='data:image/jpeg;base64,dGVzdA==';assert.equal((await submit(worker.cookie,'in',{evidence:broken})).status,400);
      assert.equal((await submit(worker.cookie,'out')).status,400);
      assert.equal((await submit(worker.cookie,'in',{evidence:{...evidence(),capturedAt:new Date(Date.now()-16*60000).toISOString()}})).status,400);
      const blocked=join(r.photoDir,'not-a-directory');await writeFile(blocked,'x');process.env.ATTENDANCE_PHOTO_DIR=blocked;
      assert.equal((await submit()).status,503);process.env.ATTENDANCE_PHOTO_DIR=r.photoDir;await rm(blocked);
      assert.equal(await dbs.attendance.attendance.count(),0);assert.deepEqual(await readdir(r.photoDir),[]);
    });
    await t.test('concurrent check-in creates one row and one private photo; owner identity cannot be injected',async()=>{
      const outcomes=await Promise.all([submit(worker.cookie,'in',{employeeId:other.user.employeeId,actor:{role:'HR_ADMIN'}}),submit()]);
      assert.deepEqual(outcomes.map(o=>o.status).sort(),[201,409]);
      assert.equal(await dbs.attendance.attendance.count(),1);assert.equal(await dbs.attendance.attendanceEvidence.count(),1);assert.equal((await readdir(r.photoDir)).length,1);
      const record=(await state()).records[0];assert.equal(record.employeeId,worker.user.employeeId);assert.ok(record.inEvidence.photo.startsWith('/api/attendance/photos/'));
      assert.equal((await state(other.cookie)).records.length,0);
      const path=record.inEvidence.photo.replace('/api','');
      assert.equal((await get(path,'')).status,401);assert.equal((await get(path,other.cookie)).status,404);
      const ownerPhoto=await get(path);assert.equal(ownerPhoto.status,200);assert.deepEqual(ownerPhoto.body,photo);assert.match(ownerPhoto.response.headers.get('cache-control'),/no-store/);
      assert.equal((await get(path,hrCookie)).status,200);
      assert.equal((await get('/attendance/photos/..%2Fsecret')).status,404);
      const relogged=await r.login(worker.email);assert.equal((await state(relogged)).records[0].checkIn,record.checkIn);
    });
    await t.test('monthly report reads the persisted check-in through the gateway', async () => {
      const path = `/reports/attendance?period=${today.slice(0, 7)}`;
      assert.equal((await get(path, '')).status, 401);
      assert.equal((await get(path)).status, 403);
      assert.equal((await get('/reports/attendance?period=2026-13', hrCookie)).status, 400);
      const report = await get(path, hrCookie);
      assert.equal(report.status, 200);
      const row = report.body.rows.find(row => row.employeeId === worker.user.employeeId);
      assert.ok(row);
      assert.equal(row.present + row.late, 1);
      assert.equal(report.body.totalDays, 1);
      assert.equal(report.body.totals.absent, null);
      assert.equal((await get(`${path}&q=no-matching-profile`, hrCookie)).body.totalDays, 0);
    });
    await t.test('policy changes invalidate old location snapshots and retain earlier evidence/start time',async()=>{
      location={...location,name:'New Office',radius:150};
      assert.equal((await api('/attendance/settings',{...location,workStartTime:'09:00'},'PUT',hrCookie)).status,200);
      const s=await state();assert.equal(s.workStartTime,'09:00');assert.equal(s.records[0].workStartTime,'08:00');assert.equal(s.records[0].inEvidence.location.name,'Office');
      const stale=evidence();stale.location={...location,name:'Office',radius:100};assert.equal((await submit(other.cookie,'in',{evidence:stale})).status,409);
      assert.equal((await submit(other.cookie)).status,201);assert.equal((await state(other.cookie)).records[0].workStartTime,'09:00');
    });
    await t.test('checkout and correction races preserve the version, original proof and atomic decision',async()=>{
      const base=(await state()).records[0];
      const request={type:'Koreksi absensi',start:today,end:today,reason:'Correction requested',checkIn:'00:00',baseVersion:base.version};
      assert.equal((await api('/requests',request,'POST',worker.cookie)).status,201);
      assert.equal((await api('/requests',request,'POST',worker.cookie)).status,409);
      const pending=(await state()).requests[0];
      assert.equal((await decision(pending.id,'Disetujui',worker.cookie)).status,403);
      const progress={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Completed work',marks:[{type:'bold'}]}]}]};
      const outcomes=await Promise.all([submit(worker.cookie,'out',{progress}),decision(pending.id)]);
      assert.equal(outcomes[0].status,201);
      assert.ok([201,409].includes(outcomes[1].status));
      const current=(await state()).records[0];assert.ok(current.checkOut);assert.equal(current.inEvidence.photo,base.inEvidence.photo);
      if(outcomes[1].status===409) { assert.equal((await state()).requests[0].status,'Menunggu');assert.equal((await decision(pending.id,'Ditolak')).status,201); }
      const next={...request,baseVersion:current.version};
      assert.equal((await api('/requests',next,'POST',worker.cookie)).status,201);
      const id=(await state()).requests[0].id;
      const decisions=await Promise.all([decision(id),decision(id)]);assert.deepEqual(decisions.map(o=>o.status).sort(),[201,409]);
      const final=(await state()).records[0];assert.equal(final.checkIn,new Date(`${today}T00:00:00+07:00`).toISOString());
      const report = await get(`/reports/attendance?period=${today.slice(0, 7)}`, hrCookie);
      assert.equal(report.status, 200);
      const reportRow = report.body.rows.find(row => row.employeeId === worker.user.employeeId);
      assert.equal(reportRow.present, 1);
      assert.equal(reportRow.late, 0);
      assert.equal(final.inEvidence.photo,base.inEvidence.photo);assert.ok(final.corrections.length>=1);assert.deepEqual(final.progress,progress);
      assert.equal((await submit(worker.cookie,'out',{progress})).status,409);
      assert.equal((await submit(other.cookie,'out',{progress:{type:'doc',content:[{type:'image'}]}})).status,400);
      assert.equal(await dbs.attendance.attendanceEvidence.count({where:{attendance:{employeeId:worker.user.employeeId}}}),2);
    });
    await t.test('leave, sickness and permission decisions persist without fabricating attendance',async()=>{
      for(const type of ['Cuti','Sakit','Izin']) {
        assert.equal((await api('/requests',{type,start:yesterday,end:today,reason:`${type} reason`},'POST',other.cookie)).status,201);
        const pending=(await state(other.cookie)).requests[0];assert.equal((await decision(pending.id,type==='Izin'?'Ditolak':'Disetujui')).status,201);
      }
      assert.equal((await state(other.cookie)).requests.length,3);assert.equal((await state(worker.cookie)).requests.some(q=>q.employeeId===other.user.employeeId),false);
      const report = await get(`/reports/attendance?period=${yesterday.slice(0, 7)}`, hrCookie);
      assert.equal(report.status, 200);
      const reportRow = report.body.rows.find(row => row.employeeId === other.user.employeeId);
      assert.equal(reportRow.sick, 1);
      assert.equal(reportRow.leave, 0);
      await api('/auth/logout',{},'POST',worker.cookie);assert.equal((await state(worker.cookie)).message,'Silakan masuk kembali.');
      worker.cookie=await r.login(worker.email);assert.ok((await state()).records[0].checkOut);
    });
    await t.test('correction with no existing record is concurrent-safe and invents no original evidence',async()=>{
      const request={type:'Koreksi absensi',start:yesterday,end:yesterday,reason:'Forgot attendance',checkIn:'08:00',checkOut:'17:00',baseVersion:0};
      const created=await Promise.all([api('/requests',request,'POST',other.cookie),api('/requests',request,'POST',other.cookie)]);assert.deepEqual(created.map(o=>o.status).sort(),[201,409]);
      const id=(await state(other.cookie)).requests.find(q=>q.type==='Koreksi absensi').id;assert.equal((await decision(id)).status,201);
      const record=(await state(other.cookie)).records.find(q=>q.date===yesterday);assert.equal(record.inEvidence,undefined);assert.equal(record.outEvidence,undefined);assert.equal(record.corrections[0].before.checkIn,null);
      await dbs.attendance.attendance.create({data:{employeeId:r.hr.employeeId,workDate:new Date(`${today}T00:00:00Z`),photoUrl:'legacy'}});
      const summary=(await get('/dashboard/summary',hrCookie)).body;assert.equal(summary.metrics.present,2);assert.equal(summary.metrics.absent,1);
    });
    await t.test('WIB midnight invalidates an open form, and a new day allows a new pair',async()=>{
      const [oldDay, firstDay, nextDay] = [10, 9, 8].map(days => workDate(new Date(Date.now() - days * 86_400_000)));
      const realDate = Date;
      let now = realDate.parse(`${oldDay}T23:59:59+07:00`);
      globalThis.Date = new Proxy(realDate, {
        construct(target, args, newTarget) {
          return Reflect.construct(target, args.length ? args : [now], newTarget);
        },
        get(target, property, receiver) {
          return property === 'now' ? () => now : Reflect.get(target, property, receiver);
        },
      });
      const actor={accountId:worker.user.id,employeeId:worker.user.employeeId,role:'EMPLOYEE'};
      try {
        const payload={date:oldDay,kind:'in',evidence:evidence()};
        now = realDate.parse(`${firstDay}T00:00:00+07:00`);
        await assert.rejects(r.workforce.submit(actor,payload),e=>e.getError().status===400);
        await r.workforce.submit(actor,{date:firstDay,kind:'in',evidence:evidence()});
        await assert.rejects(r.workforce.submit(actor,{date:firstDay,kind:'in',evidence:evidence()}),e=>e.getError().status===409);
        now = realDate.parse(`${nextDay}T00:01:00+07:00`);
        await r.workforce.submit(actor,{date:nextDay,kind:'in',evidence:evidence()});
      } finally {
        globalThis.Date = realDate;
      }
    });
    await t.test('attendance outage returns errors for dashboard and report',async()=>{
      await r.apps[2].close();
      assert.equal((await get('/dashboard/summary',hrCookie)).status,503);
      assert.equal((await get(`/reports/attendance?period=${today.slice(0, 7)}`,hrCookie)).status,503);
    });
  } finally {await r.close();}
});
