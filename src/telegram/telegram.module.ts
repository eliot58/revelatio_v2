import { Module, OnModuleInit, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { Bot } from 'grammy';

@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: 'TELEGRAM_BOT',
      useFactory: (config: ConfigService) => {
        const token = config.get<string>('BOT_TOKEN');
        return new Bot(token!);
      },
      inject: [ConfigService],
    },
    TelegramService,
  ],
  controllers: [TelegramController],
  exports: ['TELEGRAM_BOT'],
})
export class TelegramModule implements OnModuleInit {
  constructor(
    @Inject('TELEGRAM_BOT') private readonly tgBot: Bot,
    private readonly telegramService: TelegramService, 
    private readonly config: ConfigService,
  ) { }

  async onModuleInit() {
    this.telegramService.register(this.tgBot);
    
    const url = this.config.get<string>('PUBLIC_URL');
    const path = this.config.get<string>('TG_WEBHOOK_PATH');
    const secret = this.config.get<string>('TG_WEBHOOK_SECRET');

    await this.tgBot.api.setWebhook(`${url}${path}`, {
      secret_token: secret
    });
  }
}
