import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { PrismaService } from './prisma.service';
@Controller()
export class ServiceController {
  constructor(private readonly prisma: PrismaService) {}
  @MessagePattern({ cmd: 'employees.list' })
  list() { return this.prisma.employee.findMany({ where: { isActive: true }, select: { id: true, employeeNo: true, fullName: true, email: true, department: true, role: true }, orderBy: { fullName: 'asc' } }); }
}
