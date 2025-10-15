import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import appConfig from '../config/app.config';
import { ConfigType } from '@nestjs/config';
import { Chat } from '../../generated/prisma';
import { Bot } from 'grammy';

@Injectable()
export class TelegramService {
    constructor(
        @Inject(appConfig.KEY) private readonly appCfg: ConfigType<typeof appConfig>,
        private readonly prisma: PrismaService
    ) { }

    register(bot: Bot) {
        bot.command('test_invite', async (ctx) => {
            await ctx.reply('Открыть Web App:', {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: 'Open Web App',
                                web_app: { url: 'https://revapi.masonsplay.com/' },
                            },
                        ],
                    ],
                },
            });
        });

        bot.on('chat_join_request', async (ctx) => {
            const chatId = ctx.update.chat_join_request.chat.id;
            const userId = ctx.update.chat_join_request.from.id;
            const inviteLink = ctx.update.chat_join_request.invite_link?.invite_link ?? null;

            if (!inviteLink) {
                await ctx.api.declineChatJoinRequest(chatId, userId);
                return;
            }

            const link = await this.prisma.link.findUnique({ where: { invite_link: inviteLink } });

            if (!link || link.user_id) {
                await ctx.api.declineChatJoinRequest(chatId, userId);
                return;
            }

            await ctx.api.approveChatJoinRequest(chatId, userId);

            await this.prisma.link.update({
                where: { invite_link: inviteLink },
                data: { user_id: BigInt(userId) },
            });
        });

        bot.on('message:left_chat_member', async (ctx) => {
            const chatId = ctx.chat.id;
            const left = ctx.message.left_chat_member;
            const leftUserId = left?.id;
            if (!leftUserId) return;

            const map = this.appCfg.chat_id_map ?? {};
            const pair = Object.entries(map).find(([key, id]) => {
                return Number(id) === Number(chatId);
            });

            if (pair && pair[0]) {
                const chatEnumKey = pair[0] as keyof typeof Chat;
                const chatValue = chatEnumKey as unknown as Chat;

                const link = await this.prisma.link.findFirst({
                    where: {
                        user_id: BigInt(leftUserId),
                        chat: chatValue,
                    },
                });

                if (link) {
                    await this.prisma.link.update({
                        where: { id: link.id },
                        data: { user_id: null },
                    });

                    return;
                }
            }

        });
    }
}
