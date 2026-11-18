import { Injectable } from '@nestjs/common';
import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { fail } from './domain';

@Injectable()
export class PhotoStore {
  private root() {
    const root = process.env.ATTENDANCE_PHOTO_DIR;
    if (!root || !isAbsolute(root)) fail('Penyimpanan foto belum dikonfigurasi.', 503);
    return root;
  }
  async validate(value: unknown) {
    if (typeof value !== 'string' || value.length > 2800000) fail('Selfie maksimal 2 MiB.');
    const match = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
    if (!match) fail('Selfie harus berupa JPEG atau PNG.');
    const bytes = Buffer.from(match[2], 'base64');
    if (!bytes.length || bytes.length > 2 * 1024 * 1024 || bytes.toString('base64') !== match[2]) fail('Berkas selfie tidak valid atau terlalu besar.');
    try {
      const image = sharp(bytes, { limitInputPixels: 4_000_000, failOn: 'warning' });
      const metadata = await image.metadata();
      if (metadata.format !== match[1] || !metadata.width || !metadata.height || (metadata.pages ?? 1) > 1) fail('Tipe berkas selfie tidak sesuai.');
      await image.stats();
    } catch { fail('Berkas selfie rusak atau formatnya tidak didukung.'); }
    return { bytes, extension: match[1] === 'jpeg' ? 'jpg' : 'png' };
  }
  async save(photo: { bytes: Buffer; extension: string }) {
    const root = this.root(), key = `${randomUUID()}.${photo.extension}`;
    try {
      await mkdir(root, { recursive: true, mode: 0o700 });
      const handle = await open(join(root, key), 'wx', 0o600);
      try { await handle.writeFile(photo.bytes); await handle.sync(); } finally { await handle.close(); }
      return key;
    } catch {
      await unlink(join(root, key)).catch(() => undefined);
      fail('Selfie belum dapat disimpan. Absensi tidak diubah; coba kembali.', 503);
    }
  }
  async remove(key: string) { await unlink(join(this.root(), key)).catch(() => undefined); }
  async read(key: string) {
    if (!/^[a-f0-9-]{36}\.(jpg|png)$/.test(key)) fail('Foto tidak tersedia.', 404);
    try { return { base64: (await readFile(join(this.root(), key))).toString('base64'), mime: key.endsWith('.jpg') ? 'image/jpeg' : 'image/png' }; }
    catch { fail('Foto belum dapat dibaca dari penyimpanan.', 503); }
  }
}
