import { Module, OnModuleInit, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramController } from './telegram.controller';
import { Bot } from 'grammy';

@Module({
  providers: [
    {
      provide: 'TELEGRAM_BOT',
      useFactory: (config: ConfigService) => {
        const token = config.get<string>('BOT_TOKEN');
        return new Bot(token!);
      },
      inject: [ConfigService],
    },
  ],
  controllers: [TelegramController],
  exports: ['TELEGRAM_BOT'],
})
export class TelegramModule implements OnModuleInit {
  constructor(
    @Inject('TELEGRAM_BOT') private readonly tgBot: Bot,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    const url = this.config.get<string>('PUBLIC_URL');
    const path = this.config.get<string>('TG_WEBHOOK_PATH');
    const secret = this.config.get<string>('TG_WEBHOOK_SECRET');

    await this.tgBot.api.setWebhook(`${url}${path}`, {
      secret_token: secret
    });
  }
}
