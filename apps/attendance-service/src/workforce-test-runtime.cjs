// Dedicated local test databases only. This harness never opens an application database.
const { readFileSync } = require('node:fs');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { resolve, join } = require('node:path');
const { execFileSync } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { Transport } = require('@nestjs/microservices');
const { json } = require('express');
async function startRuntime(gatewayPort = 14000, webOrigin = 'http://localhost:5173') {
  const root = resolve(__dirname, '../../..');
  const config = readFileSync(resolve(root, '.env'), 'utf8');
  const password = config.match(/^DEXATRACK_DB_PASSWORD=(.+)$/m)?.[1];
  if (!password) throw new Error('Configure local Docker MySQL in root .env first');
  const url = db => `mysql://root:${encodeURIComponent(password)}@127.0.0.1:3306/dexatrack_${db}_test`;
  const { PrismaClient } = require('../generated/client');
  const admin = new PrismaClient({ datasourceUrl: url('attendance').replace('/dexatrack_attendance_test','/mysql') });
  try { await admin.$executeRawUnsafe('CREATE DATABASE IF NOT EXISTS dexatrack_attendance_test'); } finally { await admin.$disconnect(); }
  for (const db of ['auth','employees','attendance']) execFileSync(process.execPath, [resolve(root,'node_modules/prisma/build/index.js'),'migrate','deploy'], { cwd:resolve(root,'apps',`${db}-service`),env:{...process.env,DATABASE_URL:url(db)},stdio:'pipe' });
  const photoDir = await mkdtemp(join(tmpdir(),'dexatrack-photos-'));
  Object.assign(process.env,{ EMPLOYEES_HOST:'127.0.0.1',EMPLOYEES_PORT:'14001',ATTENDANCE_HOST:'127.0.0.1',ATTENDANCE_PORT:'14002',AUTH_HOST:'127.0.0.1',AUTH_PORT:'14003',WEB_ORIGIN:webOrigin,ATTENDANCE_PHOTO_DIR:photoDir,SMTP_HOST:'127.0.0.1',SMTP_PORT:config.match(/^DEXATRACK_SMTP_PORT=(.+)$/m)?.[1]??'1025' });
  const apps = [], dbs = {};
  async function close() { for (const app of [...apps].reverse()) await app.close(); await rm(photoDir,{recursive:true,force:true}); }
  try {
    for (const [name,port] of [['employees',14001],['auth',14003],['attendance',14002]]) {
      process.env.DATABASE_URL=url(name);
      const app = await NestFactory.createMicroservice(require(`../../${name}-service/dist/app.module`).AppModule,{transport:Transport.TCP,options:{host:'127.0.0.1',port},logger:false});
      apps.push(app); await app.listen();
      dbs[name]=app.get(require(`../../${name}-service/dist/prisma.service`).PrismaService);
    }
    for (const model of ['attendanceCorrection','attendanceEvidence','request','attendance','attendanceSettings','workLocation']) await dbs.attendance[model].deleteMany();
    await dbs.auth.account.deleteMany(); await dbs.employees.employee.deleteMany();
    const gateway = await NestFactory.create(require('../../api-gateway/dist/app.module').AppModule,{logger:false,bodyParser:false});
    gateway.setGlobalPrefix('api');gateway.use(json({limit:'3mb'}));gateway.use(require('../../api-gateway/dist/security').securityMiddleware(process.env.WEB_ORIGIN));
    apps.push(gateway);await gateway.listen(gatewayPort,'127.0.0.1');
    const initialPassword=`Workforce-${randomBytes(16).toString('hex')}`;
    const authService=apps[1].get(require('../../auth-service/dist/auth.service').AuthService);
    await authService.bootstrap({fullName:'Workforce HR',email:'workforce-hr@test.example',department:'HR',password:initialPassword,requestId:randomUUID()});
    async function api(path,data,method='POST',cookie='') {
      const response=await fetch(`http://127.0.0.1:${gatewayPort}/api${path}`,{method,headers:{Origin:process.env.WEB_ORIGIN,'X-DexaTrack-Request':'1','Content-Type':'application/json','Idempotency-Key':randomUUID(),Cookie:cookie},...(method==='GET'?{}:{body:JSON.stringify(data??{})})});
      const body=response.headers.get('content-type')?.includes('application/json')?await response.json():Buffer.from(await response.arrayBuffer());
      return {status:response.status,body,cookie:response.headers.get('set-cookie')?.split(';')[0],response};
    }
    async function login(email) { const result=await api('/auth/login',{email,password:initialPassword});if(result.status!==200)throw new Error(JSON.stringify(result.body));return result.cookie; }
    const hrCookie=await login('workforce-hr@test.example');
    const workers=[];
    for(const [i,name] of [[1,'Workforce Employee'],[2,'Other Employee']]) {
      const email=`workforce-${i}@test.example`;
      const registered=await api('/auth/register',{email,password:initialPassword,fullName:name}); if(registered.status!==201)throw new Error(JSON.stringify(registered.body));
      const account=await dbs.auth.account.findUniqueOrThrow({where:{email}});
      const approved=await api(`/users/${account.id}/approve`,{department:'Engineering'},'POST',hrCookie); if(approved.status!==200)throw new Error(JSON.stringify(approved.body));
      const cookie=await login(email);const me=await api('/auth/me',null,'GET',cookie);workers.push({cookie,user:me.body,email});
    }
    const hr=(await api('/auth/me',null,'GET',hrCookie)).body;
    return {root,apps,dbs,photoDir,api,close,login,hrCookie,hr,workers,initialPassword,workforce:apps[2].get(require('../dist/workforce.service').WorkforceService)};
  } catch(error) {await close();throw error;}
}
module.exports={startRuntime};
