import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Bot } from 'grammy';

@Injectable()
export class TelegramService {
    constructor(private readonly prisma: PrismaService) { }

    register(bot: Bot) {
        bot.command('start', async (ctx) => {
            const firstName = ctx.from?.first_name || 'there';
            await ctx.reply(
                `Hello, ${firstName}! 👋\n\nWelcome to our bot. I’m here to help you.`
            );
        });

        bot.on('chat_join_request', async (ctx) => {
            const chatId = ctx.update.chat_join_request.chat.id;
            const userId = ctx.update.chat_join_request.from.id;
            const inviteLink = ctx.update.chat_join_request.invite_link?.invite_link;

            console.log(chatId)
            console.log(userId)
            console.log(inviteLink)
        });
    }
}
