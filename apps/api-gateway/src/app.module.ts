import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { GatewayController } from './gateway.controller';
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), ClientsModule.register([
    { name: 'EMPLOYEES', transport: Transport.TCP, options: { host: process.env.EMPLOYEES_HOST ?? '127.0.0.1', port: Number(process.env.EMPLOYEES_PORT ?? 3001) } },
    { name: 'ATTENDANCE', transport: Transport.TCP, options: { host: process.env.ATTENDANCE_HOST ?? '127.0.0.1', port: Number(process.env.ATTENDANCE_PORT ?? 3002) } },
  ])],
  controllers: [GatewayController],
})
export class AppModule {}
