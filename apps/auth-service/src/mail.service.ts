import { Injectable } from '@nestjs/common';
import { createTransport } from 'nodemailer';
@Injectable()
export class MailService {
  async send(to: string, rawToken: string, activation: boolean) {
    const base = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
    const link = `${base}/${activation ? 'activate' : 'reset-password'}#token=${rawToken}`;
    const transport = createTransport({
      host: process.env.SMTP_HOST ?? '127.0.0.1', port: Number(process.env.SMTP_PORT ?? 1025),
      secure: process.env.SMTP_SECURE === 'true',
      ...(process.env.SMTP_USER ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } } : {}),
      connectionTimeout: 5000, socketTimeout: 5000,
    });
    await transport.sendMail({ from: process.env.SMTP_FROM ?? 'DexaTrack <noreply@dexatrack.local>', to,
      subject: activation ? 'Aktifkan akun DexaTrack' : 'Reset password DexaTrack',
      text: `${activation ? 'Tetapkan password pertama' : 'Reset password'} melalui tautan berikut (berlaku 30 menit, sekali pakai):\n${link}\n\nAbaikan jika kamu tidak meminta ini.`,
    });
  }
}
