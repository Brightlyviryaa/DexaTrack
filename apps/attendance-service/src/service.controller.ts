import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { PrismaService } from './prisma.service';
@Controller()
export class ServiceController {
  constructor(private readonly prisma: PrismaService) {}
  @MessagePattern({ cmd: 'attendance.list' })
  list() { return this.prisma.attendance.findMany({ orderBy: { submittedAt: 'desc' }, take: 100 }); }
}
