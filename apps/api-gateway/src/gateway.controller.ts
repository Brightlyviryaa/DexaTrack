import { BadRequestException, Controller, Query, HttpException, Get, Put, Inject, ServiceUnavailableException, Req, ForbiddenException, Post, Param, Res } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Request, Response } from 'express';
import { buildDashboard } from './dashboard';
import { buildAttendanceReport, type AttendanceReportCount } from './attendance-report';
import { readSession } from './auth.controller';
import { firstValueFrom, catchError, timeout } from 'rxjs';
@Controller()
export class GatewayController {
  constructor(@Inject('AUTH') private readonly auth: ClientProxy, @Inject('EMPLOYEES') private readonly employees: ClientProxy, @Inject('ATTENDANCE') private readonly attendance: ClientProxy) {}
  @Get('health') health() { return { status: 'ok', service: 'api-gateway' }; }
  @Get('health/auth') authHealth() { return this.auth.send({ cmd: 'auth.health' }, {}).pipe(timeout(5000), catchError(() => { throw new ServiceUnavailableException('Auth service unavailable'); })); }
  async requireHR(req: Request) {
    const user = await firstValueFrom(this.auth.send({ cmd: 'auth.execute' }, { action: 'me', data: {}, sessionToken: readSession(req) }).pipe(timeout(5000), catchError((e) => { throw new HttpException(e.message ?? 'Auth service unavailable', e.status ?? 503); })));
    if (user.role !== 'HR_ADMIN') throw new ForbiddenException('Akses khusus HR.');
    return user;
  }
  async requireSession(req: Request) {
    return firstValueFrom(this.auth.send({ cmd: 'auth.execute' }, { action: 'me', data: {}, sessionToken: readSession(req) }).pipe(timeout(5000), catchError((e) => { throw new HttpException(e.message ?? 'Auth service unavailable', e.status ?? 503); })));
  }
  async call(client: ClientProxy, cmd: string, data: unknown) {
    return firstValueFrom(client.send({ cmd }, data).pipe(timeout(15000), catchError(e => { throw new HttpException(typeof e.message === 'string' ? e.message : 'Service belum tersedia.', [400, 401, 403, 404, 409, 413].includes(e.status) ? e.status : 503); })));
  }
  async workforceCall(req: Request, action: string, data: unknown = {}) {
    const user = await this.requireSession(req);
    return this.call(this.attendance, 'workforce.execute', { actor: { accountId: user.id, employeeId: user.employeeId, role: user.role }, action, data });
  }
  @Get('workforce') async workforce(@Req() req: Request) {
    const user = await this.requireSession(req);
    const data = await this.call(this.attendance, 'workforce.execute', { actor: { accountId: user.id, employeeId: user.employeeId, role: user.role }, action: 'snapshot', data: {} });
    const ids: number[] = [...new Set<number>([...data.requests, ...data.records].map((r: { employeeId: number }) => r.employeeId))];
    const profiles = user.role === 'HR_ADMIN' ? (ids.length ? await this.call(this.employees, 'employees.profiles', { ids }) : []) : [user.profile];
    const employees = user.role === 'HR_ADMIN' ? await this.call(this.employees, 'employees.list', {}) : [];
    return { ...data, employees: [...employees, ...profiles.filter((p: { id: number }) => p && !employees.some((e: { id: number }) => e.id === p.id))], requests: data.requests.map((r: { employeeId: number }) => { const p = profiles.find((p: { id: number }) => p?.id === r.employeeId); return { ...r, name: p?.fullName ?? `Karyawan #${r.employeeId}`, department: p?.department ?? '' }; }) };
  }
  @Post('attendance') submitAttendance(@Req() req: Request) { return this.workforceCall(req, 'submit', req.body); }
  @Post('requests') createRequest(@Req() req: Request) { return this.workforceCall(req, 'request', req.body); }
  @Post('requests/:id/decision') async decideRequest(@Req() req: Request, @Param('id') id: string) {
    await this.requireHR(req);
    return this.workforceCall(req, 'decide', { id: Number(id), status: req.body?.status });
  }
  @Get('attendance/photos/:id') async photo(@Req() req: Request, @Param('id') id: string, @Res() res: Response) {
    const photo = await this.workforceCall(req, 'photo', { id: Number(id) });
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.type(photo.mime).send(Buffer.from(photo.base64, 'base64'));
  }
  @Get('reports/attendance')
  async attendanceReport(@Req() req: Request, @Query('period') period: string, @Query('q') search: unknown) {
    const user = await this.requireHR(req);
    if (search !== undefined && typeof search !== 'string') throw new BadRequestException('Pencarian tidak valid.');

    const counts: AttendanceReportCount[] = await this.call(this.attendance, 'workforce.execute', {
      actor: { accountId: user.id, employeeId: user.employeeId, role: user.role },
      action: 'attendanceReport',
      data: { period },
    });
    const profiles = counts.length ? await this.call(this.employees, 'employees.profiles', { ids: counts.map(row => row.employeeId) }) : [];
    return buildAttendanceReport(period, search ?? '', counts, profiles);
  }
  @Get('dashboard/summary') async dashboard(@Req() req: Request) {
    await this.requireHR(req);
    const [employees, data] = await Promise.all([this.call(this.employees, 'employees.list', {}), this.workforceCall(req, 'snapshot')]);
    return buildDashboard(employees, data);
  }
  @Get('attendance/settings') async attendanceSettings(@Req() req: Request) {
    await this.requireSession(req);
    return this.attendance.send({ cmd: 'attendance.settings.get' }, {}).pipe(timeout(5000), catchError(() => { throw new ServiceUnavailableException('Attendance service unavailable'); }));
  }
  @Put('attendance/settings') async updateAttendanceSettings(@Req() req: Request) {
    await this.requireHR(req);
    return this.attendance.send({ cmd: 'attendance.settings.set' }, req.body).pipe(timeout(5000), catchError((e) => { throw new HttpException(e.message ?? 'Attendance service unavailable', e.status === 400 ? 400 : 503); }));
  }
  @Get('employees') async findEmployees(@Req() req: Request) { await this.requireHR(req); return this.employees.send({ cmd: 'employees.list' }, {}).pipe(timeout(5000), catchError(() => { throw new ServiceUnavailableException('Employees service unavailable'); })); }
  @Get('attendances') async findAttendance(@Req() req: Request) { await this.requireHR(req); return this.attendance.send({ cmd: 'attendance.list' }, {}).pipe(timeout(5000), catchError(() => { throw new ServiceUnavailableException('Attendance service unavailable'); })); }
}
