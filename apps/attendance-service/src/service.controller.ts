import { Controller } from '@nestjs/common';
import { MessagePattern, RpcException } from '@nestjs/microservices';
import { PrismaService } from './prisma.service';
import { WorkforceService } from './workforce.service';
import { Actor } from './domain';
@Controller()
export class ServiceController {
  constructor(private readonly prisma: PrismaService, private readonly workforce: WorkforceService) {}
  @MessagePattern({ cmd: 'workforce.execute' })
  execute({ actor, action, data }: { actor: Actor; action: string; data: any }) {
    switch (action) {
      case 'snapshot': return this.workforce.snapshot(actor);
      case 'attendanceHistory': return this.workforce.attendanceHistory(actor, data?.period);
      case 'attendanceReport': return this.workforce.attendanceReport(actor, data?.period);
      case 'submit': return this.workforce.submit(actor, data);
      case 'request': return this.workforce.createRequest(actor, data);
      case 'decide': return this.workforce.decide(actor, data);
      case 'photo': return this.workforce.photo(actor, data.id);
      default: throw new RpcException({ status: 400, message: 'Operasi tidak dikenal.' });
    }
  }
  @MessagePattern({ cmd: 'attendance.list' })
  list() { return this.prisma.attendance.findMany({ orderBy: { submittedAt: 'desc' }, take: 100 }); }

  @MessagePattern({ cmd: 'attendance.settings.get' })
  async settings() {
    const settings = await this.prisma.attendanceSettings.findUnique({ where: { id: 1 }, include: { workLocation: true } });
    if (!settings) return null;
    const location = settings.workLocation;
    return { name: location.name, latitude: Number(location.latitude), longitude: Number(location.longitude), radius: Number(location.radiusMeters), workStartTime: settings.workStartTime };
  }

  @MessagePattern({ cmd: 'attendance.settings.set' })
  async setSettings(data: { name: unknown; latitude: unknown; longitude: unknown; radius: unknown; workStartTime: unknown }) {
    if (!data || typeof data.name !== 'string' || !data.name.trim() || data.name.trim().length > 150 ||
        typeof data.latitude !== 'number' || !Number.isFinite(data.latitude) || Math.abs(data.latitude) > 90 ||
        typeof data.longitude !== 'number' || !Number.isFinite(data.longitude) || Math.abs(data.longitude) > 180 ||
        typeof data.radius !== 'number' || !Number.isFinite(data.radius) || data.radius < 0.01 || data.radius > 99999999.99 ||
        typeof data.workStartTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(data.workStartTime)) {
      throw new RpcException({ status: 400, message: 'Pengaturan lokasi atau jam masuk tidak valid.' });
    }
    const { name, latitude, longitude, radius, workStartTime } = data as { name: string; latitude: number; longitude: number; radius: number; workStartTime: string };
    await this.workforce.transaction(async tx => {
      const location = await tx.workLocation.create({ data: { name: name.trim(), latitude, longitude, radiusMeters: radius } });
      await tx.attendanceSettings.upsert({ where: { id: 1 }, create: { id: 1, workLocationId: location.id, workStartTime }, update: { workLocationId: location.id, workStartTime } });
    });
    return this.settings();
  }
}
