import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import appConfig from '../config/app.config';
import { ConfigType } from '@nestjs/config';
import { Chat } from '../../generated/prisma';
import { Bot } from 'grammy';
import { Address } from '@ton/core';
import { RedisService } from '../redis/redis.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class TelegramService {
    constructor(
        @Inject(appConfig.KEY) private readonly appCfg: ConfigType<typeof appConfig>,
        @InjectQueue('telegram') private readonly telegramQueue: Queue,
        private readonly prisma: PrismaService,
        private readonly redis: RedisService
    ) { }

    register(bot: Bot) {
        bot.command('test_invite', async (ctx) => {
            await ctx.reply('Open Web App:', {
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

        bot.command('get', async (ctx) => {
            if (ctx.chat.type !== 'private') {
                return;
            }

            await ctx.reply('Please send your test TON wallet address:');
            bot.on('message:text', async (ctx2) => {
                if (ctx2.chat.type !== 'private') {
                    return;
                }

                const wallet = ctx2.message.text.trim();

                try {
                    const address = Address.parse(wallet);

                    const cache = await this.redis.getKey(`get:${address.toRawString()}`)

                    if (cache) {
                        await ctx2.reply('Please try again after 20 minute.');
                        return;
                    }

                    await this.redis.setKey(`get:${address.toRawString()}`, "1", 1200)
                } catch {
                    await ctx2.reply('❌ Invalid TON address. Please try again.');
                    return;
                }

                const jettons = this.appCfg.jetton_wallets;

                for (const [symbol, jettonWalletBase64] of Object.entries(jettons)) {
                    await this.telegramQueue.add('send_jetton', {
                        destination: wallet,
                        coins: symbol,
                        jettonWallet: jettonWalletBase64
                    }, { delay: 10000 },);
                }

                await ctx2.reply('✅ Jetton transfers have been added to the queue. Please wait for processing.');
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
