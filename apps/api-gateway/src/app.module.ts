import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AuthController } from './auth.controller';
import { GatewayController } from './gateway.controller';
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), ClientsModule.registerAsync([
    { name: 'AUTH', useFactory: () => ({ transport: Transport.TCP, options: { host: process.env.AUTH_HOST ?? '127.0.0.1', port: Number(process.env.AUTH_PORT ?? 3003) } }) },
    { name: 'EMPLOYEES', useFactory: () => ({ transport: Transport.TCP, options: { host: process.env.EMPLOYEES_HOST ?? '127.0.0.1', port: Number(process.env.EMPLOYEES_PORT ?? 3001) } }) },
    { name: 'ATTENDANCE', useFactory: () => ({ transport: Transport.TCP, options: { host: process.env.ATTENDANCE_HOST ?? '127.0.0.1', port: Number(process.env.ATTENDANCE_PORT ?? 3002) } }) },
  ])],
  controllers: [GatewayController, AuthController],
})
export class AppModule {}
