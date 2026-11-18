import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { AppModule } from './app.module';
import { AuthService } from './auth.service';
async function hiddenPassword(): Promise<string> {
  if (!process.stdin.isTTY) throw new Error('Bootstrap memerlukan terminal interaktif.');
  process.stdout.write('Password (12–128 karakter): ');
  process.stdin.setRawMode(true); process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const finish = () => { process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.off('data', read); process.stdout.write('\n'); };
    const read = (buffer: Buffer) => {
      for (const char of buffer.toString()) {
        if (char === '\u0003') { finish(); reject(new Error('Dibatalkan.')); return; }
        if (char === '\r' || char === '\n') { finish(); resolve(value); return; }
        if (char === '\u007f') value = value.slice(0, -1); else if (char >= ' ') value += char;
      }
    };
    process.stdin.on('data', read);
  });
}
async function main() {
  const command = process.argv[2];
  if (!['bootstrap', 'reconcile'].includes(command)) throw new Error('Gunakan bootstrap atau reconcile.');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const service = app.get(AuthService);
    if (command === 'reconcile') { await service.reconcile(); console.log('Rekonsiliasi selesai.'); return; }
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const email = await rl.question('Email HR: '), fullName = await rl.question('Nama HR: '), department = await rl.question('Departemen: ');
    rl.close();
    const password = await hiddenPassword();
    await service.bootstrap({ email, fullName, department, password, requestId: randomUUID() });
    console.log('Admin pertama berhasil dibuat.');
  } finally { await app.close(); }
}
main().catch(error => { console.error(error?.getError?.()?.message ?? 'Operasi gagal. Periksa database, employees-service, dan konfigurasi.'); process.exitCode = 1; });
