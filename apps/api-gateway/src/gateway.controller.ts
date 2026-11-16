import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { catchError, timeout } from 'rxjs';
@Controller()
export class GatewayController {
  constructor(@Inject('EMPLOYEES') private readonly employees: ClientProxy, @Inject('ATTENDANCE') private readonly attendance: ClientProxy) {}
  @Get('health') health() { return { status: 'ok', service: 'api-gateway' }; }
  @Get('employees') findEmployees() { return this.employees.send({ cmd: 'employees.list' }, {}).pipe(timeout(5000), catchError(() => { throw new ServiceUnavailableException('Employees service unavailable'); })); }
  @Get('attendances') findAttendance() { return this.attendance.send({ cmd: 'attendance.list' }, {}).pipe(timeout(5000), catchError(() => { throw new ServiceUnavailableException('Attendance service unavailable'); })); }
}
