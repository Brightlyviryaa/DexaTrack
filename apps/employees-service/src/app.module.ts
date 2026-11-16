import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServiceController } from './service.controller';
import { PrismaService } from './prisma.service';
@Module({ imports: [ConfigModule.forRoot({ isGlobal: true })], controllers: [ServiceController], providers: [PrismaService] })
export class AppModule {}
