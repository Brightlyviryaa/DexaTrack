import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PrismaService } from './prisma.service';
import { ServiceController } from './service.controller';
import { AuthService } from './auth.service';
import { MailService } from './mail.service';
@Module({ imports: [ConfigModule.forRoot({ isGlobal: true }), ClientsModule.registerAsync([{ name: 'EMPLOYEES', useFactory: () => ({ transport: Transport.TCP, options: { host: process.env.EMPLOYEES_HOST ?? '127.0.0.1', port: Number(process.env.EMPLOYEES_PORT ?? 3001) } }) }])], controllers: [ServiceController], providers: [PrismaService, AuthService, MailService] })
export class AppModule {}
