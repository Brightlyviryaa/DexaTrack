import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { ServiceController } from './service.controller';

@Module({ imports: [ConfigModule.forRoot({ isGlobal: true })], controllers: [ServiceController], providers: [PrismaService] })
export class AppModule {}
