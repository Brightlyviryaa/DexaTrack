import { Controller } from '@nestjs/common';
import { MessagePattern, RpcException } from '@nestjs/microservices';
import { randomUUID } from 'node:crypto';
import { PrismaService } from './prisma.service';
@Controller()
export class ServiceController {
  constructor(private readonly prisma: PrismaService) {}
  @MessagePattern({ cmd: 'employees.list' })
  list() { return this.prisma.employee.findMany({ where: { isActive: true }, select: { id: true, employeeNo: true, fullName: true, email: true, department: true, isActive: true }, orderBy: { fullName: 'asc' } }); }
  @MessagePattern({ cmd: 'employees.profiles' })
  profiles(data: { ids: number[] }) {
    if (!Array.isArray(data.ids) || data.ids.some(id => !Number.isSafeInteger(id) || id < 1)) throw new RpcException({ status: 400, message: 'ID profil tidak valid.' });
    return this.prisma.employee.findMany({ where: { id: { in: data.ids } }, select: { id: true, employeeNo: true, fullName: true, department: true, email: true, isActive: true } });
  }
  @MessagePattern({ cmd: 'employees.sync' })
  async sync(data: { accountId: number; employeeId: number | null; fullName: string; department: string; email: string; isActive: boolean }) {
    if (!Number.isSafeInteger(data.accountId) || data.accountId < 1 || typeof data.fullName !== 'string' || !data.fullName.trim() || data.fullName.length > 150 || typeof data.email !== 'string' || data.email.length > 191 || typeof data.department !== 'string' || data.department.length > 100 || typeof data.isActive !== 'boolean') throw new RpcException({ status: 400, message: 'Profil tidak valid.' });
    try {
      return await this.prisma.$transaction(async tx => {
        const linked = await tx.employee.findUnique({ where: { accountId: data.accountId } });
        const existing = linked ?? (data.employeeId ? await tx.employee.findUnique({ where: { id: data.employeeId } }) : null);
        if (existing?.accountId && existing.accountId !== data.accountId) throw new RpcException({ status: 409, message: 'Profil sudah terhubung ke akun lain.' });
        const values = { accountId: data.accountId, fullName: data.fullName, email: data.email, department: data.department || null, isActive: data.isActive };
        return existing ? tx.employee.update({ where: { id: existing.id }, data: values }) : tx.employee.create({ data: { ...values, employeeNo: randomUUID() } });
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new RpcException({ status: 409, message: 'Email profil sudah digunakan.' });
      throw error;
    }
  }
}
