import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServiceController } from './service.controller';
import { PrismaService } from './prisma.service';
import { WorkforceService } from './workforce.service';
import { PhotoStore } from './photo-store';
@Module({ imports: [ConfigModule.forRoot({ isGlobal: true })], controllers: [ServiceController], providers: [PrismaService, WorkforceService, PhotoStore] })
export class AppModule {}
