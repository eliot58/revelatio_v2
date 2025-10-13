import { Controller, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { FastifyRequest, FastifyReply } from 'fastify';
import { Bot, webhookCallback } from 'grammy';
import appConfig from 'src/config/app.config';

@Controller('telegram')
export class TelegramController {
    constructor(
        @Inject('TELEGRAM_BOT') private readonly bot: Bot,
        @Inject(appConfig.KEY) private readonly appCfg: ConfigType<typeof appConfig>
    ) { }

    @Post('webhook')
    @HttpCode(200)
    async webhook(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
        const secret = this.appCfg.tg_webhook_secret;
        return webhookCallback(this.bot, 'fastify', { secretToken: secret })(req, res);
    }
}
