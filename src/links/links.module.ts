import { Module } from '@nestjs/common';
import { LinksService } from './links.service';
import { LinksController } from './links.controller';
import { TelegramModule } from '../telegram/telegram.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [TelegramModule, PrismaModule],
  providers: [LinksService],
  controllers: [LinksController]
})
export class LinksModule {}
