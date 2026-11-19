const assert = require('node:assert/strict');
const { test } = require('node:test');
const { resolve } = require('node:path');
const { chromium, expect } = require('@playwright/test');
const { startRuntime } = require('../../attendance-service/src/workforce-test-runtime.cjs');

const origin = 'http://127.0.0.1:15173';
const gatewayPort = 14000;
const unavailable = { status: 503, json: { message: 'Pengajuan belum tersedia. Coba lagi.' } };

async function signIn(browser, runtime, email, home) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${origin}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(runtime.initialPassword);
  await page.getByRole('button', { name: 'Masuk' }).click();
  await page.waitForURL(`**/${home}`);
  return page;
}

async function clickTwice(button) {
  await button.evaluate(element => {
    element.click();
    element.click();
  });
}

test('employee and HR submit, review and reload persisted requests', { timeout: 120000 }, async t => {
  const runtime = await startRuntime(gatewayPort, origin);
  t.after(() => runtime.close());
  const { createServer } = await import('vite');
  const web = await createServer({
    root: resolve(__dirname, '..'),
    server: { host: '127.0.0.1', port: 15173, strictPort: true, proxy: { '/api': `http://127.0.0.1:${gatewayPort}` } },
  });
  t.after(() => web.close());
  await web.listen();
  const browser = await chromium.launch();
  t.after(() => browser.close());

  const [worker, other] = runtime.workers;
  const employee = await signIn(browser, runtime, worker.email, 'employee');
  await employee.getByRole('link', { name: 'Pengajuan', exact: true }).click();
  const reason = 'Cuti keluarga dari pengujian browser';
  const deniedReason = 'Izin dari pengujian browser';
  const createButton = employee.getByRole('button', { name: 'Buat pengajuan' });
  const form = employee.getByRole('dialog');
  const submit = form.getByRole('button', { name: 'Kirim pengajuan' });
  let posts = 0;
  let failRefresh = false;
  await employee.route('**/api/workforce', route => failRefresh ? route.fulfill(unavailable) : route.continue());
  await employee.route('**/api/requests', async route => {
    if (++posts === 1) return route.fulfill(unavailable);
    const response = await route.fetch();
    if (posts === 2) failRefresh = true;
    await route.fulfill({ response });
  });

  await createButton.click();
  await form.getByLabel('Alasan').fill(reason);
  await submit.click();
  await expect(form.getByRole('alert')).toHaveText(unavailable.json.message);
  await expect(form.getByLabel('Alasan')).toHaveValue(reason);
  await clickTwice(submit);
  await expect(form).toBeHidden();
  await expect(employee.getByRole('status')).toContainText('Pengajuan terkirim.');
  const leave = employee.locator('.portal-request-card').filter({ hasText: reason });
  await expect(leave).toContainText('Menunggu');
  await expect(employee.getByRole('button', { name: 'Coba lagi' })).toBeVisible();
  assert.equal(posts, 2);
  assert.equal(await runtime.dbs.attendance.request.count({ where: { employeeId: worker.user.employeeId, reason } }), 1);
  failRefresh = false;
  await employee.getByRole('button', { name: 'Coba lagi' }).click();
  await expect(employee.getByRole('button', { name: 'Coba lagi' })).toBeHidden();
  await employee.reload();
  await expect(leave).toContainText('Menunggu');

  await createButton.click();
  await form.getByLabel('Jenis pengajuan').selectOption('Izin');
  await form.getByLabel('Alasan').fill(deniedReason);
  await submit.click();
  await expect(form).toBeHidden();

  const hr = await signIn(browser, runtime, runtime.hr.email, 'dashboard');
  await hr.getByRole('link', { name: /Pengajuan menunggu/ }).click();
  await expect(hr).toHaveURL(/\/pengajuan\?status=Menunggu$/);
  const status = hr.getByRole('combobox', { name: /^Status/ });
  await expect(status).toHaveValue('Menunggu');
  await status.selectOption('Ditolak');
  await expect(hr).toHaveURL(/status=Ditolak/);
  await hr.goBack();
  await expect(status).toHaveValue('Menunggu');
  await hr.goForward();
  await expect(status).toHaveValue('Ditolak');
  await status.selectOption('Semua status');

  let decisions = 0;
  let failHrRefresh = false;
  await hr.route('**/api/workforce', route => failHrRefresh ? route.fulfill(unavailable) : route.continue());
  await hr.route('**/api/requests/*/decision', async route => {
    decisions++;
    const response = await route.fetch();
    if (decisions === 1) failHrRefresh = true;
    await route.fulfill({ response });
  });
  const hrForm = hr.getByRole('dialog');
  const leaveRow = hr.getByRole('row').filter({ hasText: 'Cuti' });
  const permissionRow = hr.getByRole('row').filter({ hasText: 'Izin' });
  await leaveRow.getByRole('button', { name: /Lihat pengajuan/ }).click();
  await expect(hrForm.getByText(reason)).toBeVisible();
  await clickTwice(hrForm.getByRole('button', { name: 'Setujui' }));
  await expect(hrForm).toBeHidden();
  await expect(leaveRow).toContainText('Disetujui');
  await expect(hr.getByRole('button', { name: 'Coba lagi' })).toBeVisible();
  assert.equal(decisions, 1);
  failHrRefresh = false;
  await hr.getByRole('button', { name: 'Coba lagi' }).click();
  await expect(hr.getByRole('button', { name: 'Coba lagi' })).toBeHidden();
  await permissionRow.getByRole('button', { name: /Lihat pengajuan/ }).click();
  await hrForm.getByRole('button', { name: 'Tolak' }).click();
  await expect(permissionRow).toContainText('Ditolak');

  await hr.reload();
  await expect(leaveRow).toContainText('Disetujui');
  await expect(permissionRow).toContainText('Ditolak');
  await employee.reload();
  await expect(leave).toContainText('Disetujui');
  await expect(employee.locator('.portal-request-card').filter({ hasText: deniedReason })).toContainText('Ditolak');
  const otherEmployee = await signIn(browser, runtime, other.email, 'employee');
  await otherEmployee.getByRole('link', { name: 'Pengajuan', exact: true }).click();
  await expect(otherEmployee.getByText('Belum ada pengajuan')).toBeVisible();
});
