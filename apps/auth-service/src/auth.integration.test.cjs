// Runs against dedicated *_test databases only. Never points at application databases.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { execFileSync } = require('node:child_process');
require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { Transport } = require('@nestjs/microservices');

test('real MySQL/TCP/HTTP/SMTP authentication and user lifecycle', { skip: process.env.DEXATRACK_INTEGRATION !== '1', timeout: 300000 }, async t => {
  const root = resolve(__dirname, '../../..');
  const localConfig = readFileSync(resolve(root, '.env'), 'utf8');
  const secret = localConfig.match(/^DEXATRACK_DB_PASSWORD=(.+)$/m)?.[1];
  const smtpPort = localConfig.match(/^DEXATRACK_SMTP_PORT=(.+)$/m)?.[1] ?? '1025';
  const inbox = `http://127.0.0.1:${localConfig.match(/^DEXATRACK_MAILPIT_PORT=(.+)$/m)?.[1] ?? '8025'}`;
  assert.ok(secret, 'Local Docker password must be configured');
  const url = db => `mysql://root:${encodeURIComponent(secret)}@127.0.0.1:3306/dexatrack_${db}_test`;
  for (const [workspace, db] of [['auth-service', 'auth'], ['employees-service', 'employees']]) {
    execFileSync(process.execPath, [resolve(root, 'node_modules/prisma/build/index.js'), 'migrate', 'deploy'], { cwd: resolve(root, 'apps', workspace), env: { ...process.env, DATABASE_URL: url(db) }, stdio: 'pipe' });
  }
  process.env.EMPLOYEES_HOST = '127.0.0.1'; process.env.EMPLOYEES_PORT = '13001';
  process.env.AUTH_HOST = '127.0.0.1'; process.env.AUTH_PORT = '13003';
  process.env.WEB_ORIGIN = 'http://localhost:5173'; process.env.SMTP_HOST = '127.0.0.1'; process.env.SMTP_PORT = smtpPort;
  const apps = [];
  let authDb, employeeDb;
  try {
    process.env.DATABASE_URL = url('employees');
    const employees = await NestFactory.createMicroservice(require('../../employees-service/dist/app.module').AppModule, { transport: Transport.TCP, options: { host: '127.0.0.1', port: 13001 }, logger: false });
    apps.push(employees); await employees.listen();
    employeeDb = employees.get(require('../../employees-service/dist/prisma.service').PrismaService);
    await employeeDb.employee.deleteMany();
    process.env.DATABASE_URL = url('auth');
    const auth = await NestFactory.createMicroservice(require('../dist/app.module').AppModule, { transport: Transport.TCP, options: { host: '127.0.0.1', port: 13003 }, logger: false });
    apps.push(auth); await auth.listen();
    authDb = auth.get(require('../dist/prisma.service').PrismaService);
    await authDb.account.deleteMany();
    const service = auth.get(require('../dist/auth.service').AuthService);
    const gateway = await NestFactory.create(require('../../api-gateway/dist/app.module').AppModule, { logger: false });
    apps.push(gateway); gateway.setGlobalPrefix('api');
    gateway.use(require('../../api-gateway/dist/security').securityMiddleware(process.env.WEB_ORIGIN));
    await gateway.listen(13000, '127.0.0.1');
    const initialPassword = `Initial-${randomBytes(16).toString('hex')}`;
    await service.bootstrap({ fullName: 'Integration HR', email: 'hr@test.example', department: 'HR', password: initialPassword, requestId: randomUUID() });
    let cookie = '';
    async function api(path, data, method = 'POST', withCookie = true, key = randomUUID()) {
      const response = await fetch(`http://127.0.0.1:13000/api${path}`, { method, headers: { Origin: process.env.WEB_ORIGIN, 'X-DexaTrack-Request': '1', 'Content-Type': 'application/json', 'Idempotency-Key': key, ...(withCookie ? { Cookie: cookie } : {}) }, ...(method !== 'GET' ? { body: JSON.stringify(data ?? {}) } : {}) });
      const result = await response.json();
      return { status: response.status, body: result, cookie: response.headers.get('set-cookie')?.split(';')[0], response };
    }
    const login = async (email, password) => { const r = await api('/auth/login', { email, password }); assert.equal(r.status, 200, JSON.stringify(r.body)); cookie = r.cookie; return r; };
    const account = address => authDb.account.findUniqueOrThrow({ where: { email: address } });
    async function mailToken(address) {
      for (let i = 0; i < 15; i++) {
        const box = await (await fetch(`${inbox}/api/v1/messages`)).json();
        const message = box.messages?.find(m => m.To?.some(to => to.Address === address));
        if (message) {
          const detail = await (await fetch(`${inbox}/api/v1/message/${message.ID}`)).json();
          const match = detail.Text?.match(/#token=([a-f0-9]{64})/); if (match) return match[1];
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new Error('Expected activation/reset email in Mailpit');
    }
    let hrCookie, workerCookie;
    await t.test('CSRF, credential checks, cookie session and logout', async () => {
      const denied = await fetch('http://127.0.0.1:13000/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); assert.equal(denied.status, 403);
      assert.equal((await api('/users', null, 'GET')).status, 401);
      assert.equal((await api('/auth/login', { email: 'hr@test.example', password: 'wrong' })).status, 401);
      const r = await login('hr@test.example', initialPassword); assert.match(r.response.headers.get('set-cookie'), /HttpOnly/i); assert.match(r.response.headers.get('set-cookie'), /SameSite=Lax/i);
      assert.equal((await api('/auth/me', null, 'GET')).body.role, 'HR_ADMIN');
      assert.equal((await api('/auth/logout')).status, 200); assert.equal((await api('/auth/me', null, 'GET')).status, 401);
      await login('hr@test.example', initialPassword); hrCookie = cookie;
    });
    await t.test('registration is pending, ignores role injection, and is retryable', async () => {
      const key = randomUUID(), data = { email: 'employee@test.example', fullName: 'Employee Test', password: initialPassword, role: 'HR_ADMIN', isActive: true };
      assert.equal((await api('/auth/register', data, 'POST', false, key)).status, 201);
      assert.equal((await api('/auth/register', data, 'POST', false, key)).status, 201);
      assert.equal(await authDb.account.count({ where: { email: data.email } }), 1);
      const a = await account(data.email); assert.equal(a.role, 'EMPLOYEE'); assert.equal(a.approval, 'PENDING');
      assert.equal((await api('/auth/login', { email: data.email, password: initialPassword })).status, 403);
      assert.equal((await api('/auth/register', data, 'POST', false)).status, 409);
      cookie = hrCookie;
      assert.equal((await api(`/users/${a.id}/approve`, { department: 'Engineering' })).status, 200);
      await login(data.email, initialPassword); workerCookie = cookie;
      assert.equal((await api('/users', null, 'GET')).status, 403);
      assert.equal((await api('/employees', null, 'GET')).status, 403);
    });
    await t.test('session expiry and disablement invalidate access immediately', async () => {
      cookie = workerCookie; const a = await account('employee@test.example');
      await authDb.session.updateMany({ where: { accountId: a.id }, data: { expiresAt: new Date(0) } });
      assert.equal((await api('/auth/me', null, 'GET')).status, 401);
      await login(a.email, initialPassword); workerCookie = cookie; cookie = hrCookie;
      assert.equal((await api(`/users/${a.id}`, { isActive: false }, 'PATCH')).status, 200);
      cookie = workerCookie; assert.equal((await api('/auth/me', null, 'GET')).status, 401);
      cookie = hrCookie; assert.equal((await api(`/users/${a.id}`, { isActive: true }, 'PATCH')).status, 200);
    });
    await t.test('invitations activate once and do not expose password hashes', async () => {
      cookie = hrCookie;
      assert.equal((await api('/users', { email: 'invite@test.example', fullName: 'Invited Test', department: 'Product', role: 'EMPLOYEE' })).status, 201);
      const raw = await mailToken('invite@test.example');
      assert.equal((await api('/auth/activate', { token: raw, password: initialPassword })).status, 200);
      assert.equal((await api('/auth/activate', { token: raw, password: initialPassword })).status, 400);
      const listing = await api('/users', null, 'GET'); assert.ok(!JSON.stringify(listing.body).includes('passwordHash')); assert.ok(!JSON.stringify(listing.body).includes('tokenHash'));
    });
    await t.test('reset token is expiring, single-use, and revokes sessions', async () => {
      await login('employee@test.example', initialPassword); workerCookie = cookie;
      assert.equal((await api('/auth/forgot-password', { email: 'employee@test.example' })).status, 200);
      const raw = await mailToken('employee@test.example');
      const next = `Changed-${randomBytes(16).toString('hex')}`;
      const outcomes = await Promise.all([api('/auth/reset-password', { token: raw, password: next }), api('/auth/reset-password', { token: raw, password: next })]);
      assert.deepEqual(outcomes.map(r => r.status).sort(), [200, 400]);
      cookie = workerCookie; assert.equal((await api('/auth/me', null, 'GET')).status, 401);
      await login('employee@test.example', next);
      const a = await account('employee@test.example'); cookie = hrCookie;
      await api(`/users/${a.id}/reset-password`);
      await authDb.emailToken.updateMany({ where: { accountId: a.id }, data: { expiresAt: new Date(0) } });
      const expired = await mailToken(a.email); assert.equal((await api('/auth/reset-password', { token: expired, password: next })).status, 400);
      assert.equal((await api('/auth/forgot-password', { email: 'missing@test.example' })).body.message, (await api('/auth/forgot-password', { email: 'another-missing@test.example' })).body.message);
    });
    await t.test('email changes synchronize profile and prevent duplicate email', async () => {
      cookie = hrCookie; const a = await account('employee@test.example');
      assert.equal((await api(`/users/${a.id}`, { email: 'invite@test.example' }, 'PATCH')).status, 409);
      assert.equal((await api(`/users/${a.id}`, { email: 'changed@test.example', fullName: 'Changed Name' }, 'PATCH')).status, 200);
      const p = await employeeDb.employee.findUniqueOrThrow({ where: { accountId: a.id } }); assert.equal(p.email, 'changed@test.example'); assert.equal(p.fullName, 'Changed Name');
      assert.equal((await api('/auth/login', { email: 'employee@test.example', password: initialPassword })).status, 401);
    });
    await t.test('a service interruption leaves a durable intent that reconciles without duplicates', async () => {
      cookie = hrCookie;
      await employees.close(); apps.splice(apps.indexOf(employees), 1);
      const key = randomUUID(), data = { email: 'retry@test.example', fullName: 'Retry Person', password: initialPassword };
      assert.equal((await api('/auth/register', data, 'POST', false, key)).status, 503);
      const a = await account(data.email); assert.equal(a.syncing, true);
      process.env.DATABASE_URL = url('employees');
      const replacement = await NestFactory.createMicroservice(require('../../employees-service/dist/app.module').AppModule, { transport: Transport.TCP, options: { host: '127.0.0.1', port: 13001 }, logger: false }); apps.push(replacement); await replacement.listen();
      process.env.DATABASE_URL = url('auth');
      await service.reconcile();
      assert.equal((await account(data.email)).syncing, false);
      const replacementDb = replacement.get(require('../../employees-service/dist/prisma.service').PrismaService);
      assert.equal(await replacementDb.employee.count({ where: { accountId: a.id } }), 1);
      assert.equal((await api('/auth/register', data, 'POST', false, key)).status, 201);
    });
    await t.test('self-demotion and archiving the last administrator are rejected', async () => {
      cookie = hrCookie; const a = await account('hr@test.example');
      assert.equal((await api(`/users/${a.id}`, { role: 'EMPLOYEE' }, 'PATCH')).status, 409);
      assert.equal((await api(`/users/${a.id}`, {}, 'DELETE')).status, 409);
      await assert.rejects(service.bootstrap({ email: 'another-hr@test.example', fullName: 'Other HR', department: 'HR', password: initialPassword, requestId: randomUUID() }));
    });
    await t.test('SMTP failure preserves the invited account for later resend', async () => {
      cookie = hrCookie; process.env.SMTP_PORT = '19999';
      const data = { email: 'smtp-retry@test.example', fullName: 'SMTP Retry', department: 'HR', role: 'EMPLOYEE' };
      const key = randomUUID(); assert.equal((await api('/users', data, 'POST', true, key)).status, 503);
      assert.equal(await authDb.account.count({ where: { email: data.email } }), 1);
      process.env.SMTP_PORT = smtpPort; const a = await account(data.email);
      assert.equal((await api(`/users/${a.id}/reset-password`)).status, 200);
      assert.ok(await mailToken(data.email));
    });
    await t.test('change password and archive retain profile history while revoking access', async () => {
      cookie = hrCookie;
      const a = await account('invite@test.example');
      await login(a.email, initialPassword); const oldCookie = cookie;
      const next = `Own-change-${randomBytes(16).toString('hex')}`;
      assert.equal((await api('/auth/change-password', { currentPassword: 'wrong', password: next })).status, 400);
      assert.equal((await api('/auth/change-password', { currentPassword: initialPassword, password: next })).status, 200);
      cookie = oldCookie; assert.equal((await api('/auth/me', null, 'GET')).status, 401);
      await login(a.email, next); const newCookie = cookie;
      cookie = hrCookie; assert.equal((await api(`/users/${a.id}`, {}, 'DELETE')).status, 200);
      assert.ok((await account(a.email)).archivedAt);
      cookie = newCookie; assert.equal((await api('/auth/me', null, 'GET')).status, 401);
      cookie = hrCookie; assert.equal((await api(`/users/${a.id}`, null, 'GET')).status, 404);
    });
    await t.test('concurrent administrators cannot remove all HR access', async () => {
      cookie = hrCookie;
      const create = await api('/users', { email: 'hr-two@test.example', fullName: 'Second HR', department: 'HR', role: 'HR_ADMIN' }); assert.equal(create.status, 201);
      const raw = await mailToken('hr-two@test.example');
      assert.equal((await api('/auth/activate', { token: raw, password: initialPassword })).status, 200);
      await login('hr-two@test.example', initialPassword); const secondCookie = cookie;
      const first = await account('hr@test.example'), second = await account('hr-two@test.example');
      const requests = [[hrCookie, second.id], [secondCookie, first.id]].map(async ([sessionCookie, id]) => {
        const response = await fetch(`http://127.0.0.1:13000/api/users/${id}`, { method: 'PATCH', headers: { Origin: process.env.WEB_ORIGIN, 'X-DexaTrack-Request': '1', 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID(), Cookie: sessionCookie }, body: JSON.stringify({ role: 'EMPLOYEE' }) });
        return response.status;
      });
      const outcomes = await Promise.all(requests); assert.equal(outcomes.filter(s => s === 200).length, 1); assert.ok(outcomes.includes(401));
      assert.equal(await authDb.account.count({ where: { role: 'HR_ADMIN', approval: 'APPROVED', isActive: true, archivedAt: null } }), 1);
    });
  } finally {
    for (const app of apps.reverse()) await app.close();
  }
});
