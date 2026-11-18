import { All, Controller, HttpException, Inject, Req, Res } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Request, Response } from 'express';
import { firstValueFrom, timeout } from 'rxjs';
const cookieName = 'dexatrack_session';
const readSession = (req: Request) => req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
const routes: Record<string, string> = {
  'POST /auth/register': 'register', 'POST /auth/login': 'login', 'POST /auth/logout': 'logout', 'GET /auth/me': 'me',
  'POST /auth/change-password': 'change-password', 'POST /auth/forgot-password': 'forgot-password',
  'POST /auth/reset-password': 'reset-password', 'POST /auth/activate': 'activate',
  'GET /users': 'users.list', 'POST /users': 'users.create', 'GET /users/:id': 'users.get',
  'PATCH /users/:id': 'users.update', 'DELETE /users/:id': 'users.archive',
  'POST /users/:id/approve': 'users.approve', 'POST /users/:id/reject': 'users.reject', 'POST /users/:id/reset-password': 'users.reset-password',
};
@Controller()
export class AuthController {
  constructor(@Inject('AUTH') private readonly auth: ClientProxy) {}
  @All(['auth/:action', 'users', 'users/:id', 'users/:id/:action'])
  async handle(@Req() req: Request, @Res() res: Response) {
    const path = req.path.replace(/^\/api/, '').replace(/\/users\/\d+/, '/users/:id');
    const action = routes[`${req.method} ${path}`];
    if (!action) throw new HttpException('Endpoint tidak ditemukan.', 404);
    if (req.method !== 'GET' && (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))) throw new HttpException('Payload tidak valid.', 400);
    try {
      const data = { ...req.body, ...(req.params.id ? { id: req.params.id } : {}), requestId: req.headers['idempotency-key'] };
      const result = await firstValueFrom(this.auth.send({ cmd: 'auth.execute' }, { action, data, sessionToken: readSession(req) }).pipe(timeout(45000)));
      const cookieOptions = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production', path: '/api' };
      res.setHeader('Cache-Control', 'no-store');
      if (action === 'login') {
        res.cookie(cookieName, result.sessionToken, { ...cookieOptions, expires: new Date(result.expiresAt) });
        return res.json({ message: 'Berhasil masuk.' });
      }
      if (action === 'logout' || action === 'change-password') res.clearCookie(cookieName, cookieOptions);
      return res.status(action === 'register' || action === 'users.create' ? 201 : 200).json(result);
    } catch (error) {
      const e = error as { status?: number; message?: string };
      const status = [400, 401, 403, 404, 409, 429, 503].includes(e.status ?? 0) ? e.status! : 503;
      if (status === 401) res.clearCookie(cookieName, { path: '/api' });
      throw new HttpException({ message: status === 503 ? e.message ?? 'Auth service belum tersedia.' : e.message }, status);
    }
  }
}
export { readSession };
