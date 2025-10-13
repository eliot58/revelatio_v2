import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { HttpModule } from '@nestjs/axios';
import { TelegramModule } from '../telegram/telegram.module';
import { RedisModule } from '../redis/redis.module';
import { TonModule } from '../ton/ton.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
    TelegramModule,
    RedisModule,
    TonModule.forRootAsync()
  ],
  providers: [NotificationsService]
})
export class NotificationsModule {}
