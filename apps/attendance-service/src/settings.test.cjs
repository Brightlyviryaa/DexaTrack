const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ServiceController } = require('../dist/service.controller');

const valid = { name: ' Kantor ', latitude: -6.2, longitude: 106.8, radius: 100, workStartTime: '08:00' };
function setup() {
  let stored;
  const tx = {
    workLocation: { create: async ({ data }) => ({ id: 5, ...data }) },
    attendanceSettings: { upsert: async ({ create }) => { stored = create; } },
  };
  const prisma = {
    $transaction: async (operation) => operation(tx),
    attendanceSettings: { findUnique: async () => stored ? { ...stored, workLocation: { name: 'Kantor', latitude: '-6.200000', longitude: '106.800000', radiusMeters: '100.00' } } : null },
  };
  return new ServiceController(prisma, { transaction: prisma.$transaction });
}

test('settings are stored and returned with numeric coordinates', async () => {
  const service = setup();
  assert.equal(await service.settings(), null);
  assert.deepEqual(await service.setSettings(valid), { ...valid, name: 'Kantor' });
});

test('settings reject malformed coordinates, radius and start time', async () => {
  for (const change of [{ latitude: 91 }, { longitude: NaN }, { radius: 0 }, { radius: 1e9 }, { workStartTime: '24:00' }, { name: ' ' }]) {
    await assert.rejects(setup().setSettings({ ...valid, ...change }), error => error.getError().status === 400);
  }
});
