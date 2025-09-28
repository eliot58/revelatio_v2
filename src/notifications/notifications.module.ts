import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { HttpModule } from '@nestjs/axios';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
    TelegramModule
  ],
  providers: [NotificationsService]
})
export class NotificationsModule {}
