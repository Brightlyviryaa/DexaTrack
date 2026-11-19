const assert = require('node:assert/strict');
const { test } = require('node:test');
const { resolve } = require('node:path');
const { chromium, expect } = require('@playwright/test');
const { startRuntime } = require('../../attendance-service/src/workforce-test-runtime.cjs');

const origin = 'http://127.0.0.1:15173';
const gatewayPort = 14000;
const location = { name: 'Lokasi uji', latitude: -6.2, longitude: 106.8, radius: 100 };

async function employeePage(browser, runtime, worker) {
  const context = await browser.newContext({
    permissions: ['camera', 'geolocation'],
    geolocation: { latitude: location.latitude, longitude: location.longitude, accuracy: 10 },
  });
  const page = await context.newPage();
  await page.goto(`${origin}/login`);
  await page.getByLabel('Email').fill(worker.email);
  await page.getByLabel('Password', { exact: true }).fill(runtime.initialPassword);
  await page.getByRole('button', { name: 'Masuk' }).click();
  await page.waitForURL('**/employee');
  return page;
}

async function takeSelfie(page, action, retake = false) {
  await page.getByRole('button', { name: `Check-${action} sekarang` }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Aktifkan kamera' }).click();
  await dialog.getByRole('button', { name: 'Ambil selfie' }).click();
  if (retake) {
    await dialog.getByRole('button', { name: 'Ambil ulang' }).click();
    await dialog.getByRole('button', { name: 'Ambil selfie' }).click();
  }
  await dialog.getByRole('button', { name: 'Lanjutkan' }).click();
  return dialog;
}

test('Employee Beranda saves attendance and Histori reads it through the browser and MySQL', { timeout: 180000 }, async () => {
  const runtime = await startRuntime(gatewayPort, origin);
  try {
    const { createServer } = await import('vite');
    const web = await createServer({
      root: resolve(__dirname, '..'),
      server: { host: '127.0.0.1', port: 15173, strictPort: true, proxy: { '/api': `http://127.0.0.1:${gatewayPort}` } },
    });
    try {
      await web.listen();
      const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
      try {
        const [worker, other] = runtime.workers;
        const page = await employeePage(browser, runtime, worker);
        await expect(page.getByRole('button', { name: 'Check-in sekarang' })).toBeDisabled();
        await expect(page.getByText('Lokasi kerja belum diatur')).toBeVisible();
        assert.equal((await runtime.api('/attendance/settings', { ...location, workStartTime: '08:00' }, 'PUT', runtime.hrCookie)).status, 200);
        await page.reload();

        let failedRefresh = false;
        let checkInPosts = 0;
        await page.route('**/api/workforce', route => failedRefresh ? route.fulfill({ status: 503, json: { message: 'Offline' } }) : route.continue());
        await page.route('**/api/attendance', async route => {
          checkInPosts++;
          const response = await route.fetch();
          assert.equal(response.status(), 201);
          failedRefresh = true;
          await route.fulfill({ response });
        });
        const checkIn = await takeSelfie(page, 'in', true);
        await checkIn.getByRole('button', { name: 'Konfirmasi check-in' }).evaluate(button => { button.click(); button.click(); });
        await expect(page.getByText('Check-in sudah tercatat.')).toBeVisible();
        await expect(page.getByText('Data absensi belum mutakhir.', { exact: false })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Check-in sekarang' })).toBeDisabled();
        assert.equal(checkInPosts, 1);
        failedRefresh = false;
        await page.getByRole('button', { name: 'Coba lagi' }).click();
        await expect(page.getByRole('button', { name: 'Check-out sekarang' })).toBeEnabled();
        await page.unroute('**/api/attendance');
        await page.unroute('**/api/workforce');

        const checkOut = await takeSelfie(page, 'out');
        const confirm = checkOut.getByRole('button', { name: 'Konfirmasi check-out' });
        await expect(confirm).toBeDisabled();
        const progress = 'Menyelesaikan pekerjaan uji browser.';
        await checkOut.getByRole('textbox', { name: 'Progress hari ini' }).fill(progress);
        await page.evaluate(() => {
          const gps = navigator.geolocation;
          const getPosition = gps.getCurrentPosition;
          gps.getCurrentPosition = (_success, failure) => {
            gps.getCurrentPosition = getPosition;
            failure({ code: 1 });
          };
        });
        await confirm.click();
        await expect(checkOut.getByRole('alert')).toContainText('Izin lokasi ditolak');
        await expect(checkOut.getByRole('textbox', { name: 'Progress hari ini' })).toHaveText(progress);
        await checkOut.getByRole('button', { name: 'Ubah' }).click();
        await checkOut.getByRole('button', { name: 'Ambil ulang' }).click();
        await checkOut.getByRole('button', { name: 'Ambil selfie' }).click();
        await checkOut.getByRole('button', { name: 'Lanjutkan' }).click();
        await expect(checkOut.getByRole('textbox', { name: 'Progress hari ini' })).toHaveText(progress);
        const response = page.waitForResponse(response => response.url().endsWith('/api/attendance') && response.request().method() === 'POST');
        await confirm.click();
        assert.equal((await response).status(), 201);
        await expect(page.getByRole('button', { name: 'Absensi hari ini selesai' })).toBeDisabled();
        await page.reload();
        await expect(page.getByRole('button', { name: 'Absensi hari ini selesai' })).toBeDisabled();
        await expect(page.locator('.portal-time-pair strong').nth(0)).toHaveText(/^\d{2}[.:]\d{2}$/);
        await expect(page.locator('.portal-time-pair strong').nth(1)).toHaveText(/^\d{2}[.:]\d{2}$/);
        await page.getByRole('button', { name: /Hari ini.*Selesai/ }).click();
        await expect(page.getByRole('textbox', { name: 'Laporan progress' })).toHaveText(progress);
        const attendance = await runtime.dbs.attendance.attendance.findFirstOrThrow({ where: { employeeId: worker.user.employeeId }, include: { evidence: true } });
        assert.ok(attendance.checkInAt && attendance.checkOutAt > attendance.checkInAt);
        assert.deepEqual(attendance.evidence.map(evidence => evidence.eventType).sort(), ['CHECK_IN', 'CHECK_OUT']);

        let workforceRequests = 0;
        await page.route('**/api/workforce', route => {
          workforceRequests++;
          return route.fulfill({ status: 503, json: { message: 'Offline' } });
        });
        const historyUrl = url => url.pathname === '/api/attendance/history';
        let releaseFirstRequest;
        const firstRequest = new Promise(resolve => { releaseFirstRequest = resolve; });
        await page.route(historyUrl, async route => {
          await firstRequest;
          await route.fulfill({ status: 503, json: { message: 'Offline' } });
        }, { times: 1 });
        try {
          await page.goto(`${origin}/employee/histori`);
          await expect(page.getByRole('status')).toHaveText('Memuat riwayat absensi…');
        } finally {
          releaseFirstRequest();
        }
        await expect(page.getByRole('alert')).toHaveText(/Riwayat absensi gagal dimuat/);
        await page.getByRole('button', { name: 'Coba lagi' }).click();
        await page.getByRole('button', { name: /Hari ini.*Selesai/ }).click();
        const detail = page.getByRole('dialog');
        await expect(detail.getByRole('textbox', { name: 'Laporan progress' })).toHaveText(progress);
        await expect(detail.getByText('Koordinat GPS')).toHaveCount(2);
        for (const action of ['Check-in', 'Check-out']) {
          const photo = detail.getByRole('img', { name: `Selfie ${action}` });
          await expect.poll(() => photo.evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
        }
        await detail.getByRole('button', { name: 'Tutup', exact: true }).click();
        const period = page.getByLabel('Periode');
        const currentMonth = attendance.workDate.toISOString().slice(0, 7);
        await expect(period).toHaveValue(currentMonth);
        await period.fill('2020-02');
        await expect(page.getByText('Tidak ada catatan pada periode ini.')).toBeVisible();
        await period.fill('');
        await expect(page.getByText('Pilih bulan untuk melihat riwayat absensi.')).toBeVisible();
        await period.fill(currentMonth);
        await expect(page.getByRole('button', { name: /Hari ini.*Selesai/ })).toBeVisible();
        assert.equal(workforceRequests, 0);

        const rolloverPage = await employeePage(browser, runtime, other);
        const now = new Date();
        const openBeforeMidnight = await takeSelfie(rolloverPage, 'in');
        await rolloverPage.clock.setFixedTime(new Date(now.getTime() + 86400000));
        await expect(openBeforeMidnight.getByRole('alert')).toContainText('Tanggal WIB sudah berganti');
        await expect(openBeforeMidnight.getByRole('button', { name: 'Konfirmasi check-in' })).toBeDisabled();
        await openBeforeMidnight.getByRole('button', { name: 'Tutup', exact: true }).click();
        await rolloverPage.context().close();
        const otherPage = await employeePage(browser, runtime, other);
        let lostResponsePosts = 0;
        await otherPage.route('**/api/attendance', async route => {
          lostResponsePosts++;
          assert.equal((await route.fetch()).status(), 201);
          await route.abort();
        });
        const otherCheckIn = await takeSelfie(otherPage, 'in');
        await otherCheckIn.getByRole('button', { name: 'Konfirmasi check-in' }).click();
        await expect(otherCheckIn.getByRole('button', { name: 'Konfirmasi check-in' })).toBeDisabled();
        await otherCheckIn.getByRole('button', { name: 'Periksa status absensi' }).click();
        await expect(otherPage.getByText('Check-in sudah tercatat.')).toBeVisible();
        await expect(otherPage.getByRole('button', { name: 'Check-out sekarang' })).toBeEnabled();
        assert.equal(lostResponsePosts, 1);
      } finally {
        await browser.close();
      }
    } finally {
      await web.close();
    }
  } finally {
    await runtime.close();
  }
});
