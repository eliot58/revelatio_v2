import { BadRequestException, Controller, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { Bot } from 'grammy';

@Controller('telegram')
export class TelegramController {
    constructor(@Inject('TELEGRAM_BOT') private readonly bot: Bot) { }

    @Post('webhook')
    @HttpCode(200)
    async webhook(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
        const expected = process.env.TG_WEBHOOK_SECRET;
        if (expected) {
            const got = req.headers['x-telegram-bot-api-secret-token'] as string | undefined;
            if (got !== expected) {
                throw new BadRequestException('Bad secret token');
            }
        }

        res.send('ok');

        try {
            await this.bot.handleUpdate(req.body as any);
        } catch (e) {
            // логирование по желанию
        }
    }
}
