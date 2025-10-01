import { Controller, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyRequest, FastifyReply } from 'fastify';
import { Bot, webhookCallback } from 'grammy';

@Controller('telegram')
export class TelegramController {
    constructor(
        @Inject('TELEGRAM_BOT') private readonly bot: Bot,
        private readonly config: ConfigService
    ) { }

    @Post('webhook')
    @HttpCode(200)
    async webhook(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
        const secret = this.config.get<string>('TG_WEBHOOK_SECRET');
        return webhookCallback(this.bot, 'fastify', { secretToken: secret })(req, res);
    }
}
