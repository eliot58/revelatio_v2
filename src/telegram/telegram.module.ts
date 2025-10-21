import { Module, OnModuleInit, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { PrismaModule } from '../prisma/prisma.module';
import appConfig from '../config/app.config';
import { TonModule } from '../ton/ton.module';
import { Bot } from 'grammy';

@Module({
  imports: [
    PrismaModule,
    TonModule.forRootAsync()
  ],
  providers: [
    {
      provide: 'TELEGRAM_BOT',
      inject: [appConfig.KEY],
      useFactory: (appCfg: ConfigType<typeof appConfig>) => {
        const token = appCfg.bot_token;
        return new Bot(token);
      },
    },
    TelegramService,
  ],
  controllers: [TelegramController],
  exports: ['TELEGRAM_BOT'],
})
export class TelegramModule implements OnModuleInit {
  constructor(
    @Inject('TELEGRAM_BOT') private readonly tgBot: Bot,
    @Inject(appConfig.KEY) private readonly appCfg: ConfigType<typeof appConfig>,
    private readonly telegramService: TelegramService
  ) { }

  async onModuleInit() {
    this.telegramService.register(this.tgBot);
    
    const url = this.appCfg.public_url;
    const path = this.appCfg.tg_webhook_path;
    const secret = this.appCfg.tg_webhook_secret;

    await this.tgBot.api.setWebhook(`${url}${path}`, {
      secret_token: secret,
      allowed_updates: ['message', 'chat_join_request'],
      drop_pending_updates: true,
    });
  }
}
