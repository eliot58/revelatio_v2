import { Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { Bot, webhookCallback } from 'grammy';

@Controller('telegram')
export class TelegramController {
    constructor(@Inject('TELEGRAM_BOT') private readonly bot: Bot) { }

    @Post('webhook')
    @HttpCode(200)
    async webhook() {
        return webhookCallback(this.bot, 'fastify')
    }
}
