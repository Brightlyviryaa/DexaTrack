import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { digest, email, hashPassword, password, token, verifyPassword } from './security';
test('scrypt passwords use unique salts and reject incorrect, malformed, or legacy hashes', async () => {
  const a = await hashPassword('correct password 123'), b = await hashPassword('correct password 123');
  assert.notEqual(a, b);
  assert.equal(await verifyPassword('correct password 123', a), true);
  assert.equal(await verifyPassword('wrong password', a), false);
  assert.equal(await verifyPassword('x'.repeat(129), a), false);
  assert.equal(await verifyPassword('correct password 123', null), false);
  assert.equal(await verifyPassword('correct password 123', 'scrypt:bad:bad'), false);
});
test('identity boundaries normalize email and reject invalid input', () => {
  assert.equal(email(' User@Example.COM '), 'user@example.com');
  assert.throws(() => email('invalid')); assert.throws(() => email({}));
  assert.throws(() => password('short')); assert.throws(() => password('x'.repeat(129)));
  assert.equal(password('a'.repeat(12)), 'a'.repeat(12));
  const a = token(), b = token(); assert.notEqual(a, b); assert.equal(a.length, 64); assert.notEqual(digest(a), a);
});
