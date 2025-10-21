import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import appConfig from '../config/app.config';
import { ConfigType } from '@nestjs/config';
import { Chat } from '../../generated/prisma';
import { Bot } from 'grammy';
import { Address } from '@ton/core';
import { TonApiClient } from '@ton-api/client';
import { ContractAdapter } from '@ton-api/ton-adapter';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { SendMode, WalletContractV5R1, beginCell, internal, toNano } from '@ton/ton';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class TelegramService {
    constructor(
        @Inject(appConfig.KEY) private readonly appCfg: ConfigType<typeof appConfig>,
        @Inject("TESTNET_TONAPI_CLIENT") private readonly tonClient: TonApiClient,
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

                await this.sendJettons(wallet)
                await ctx2.reply(`✅ Jettons have been successfully sent to ${wallet}`);
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

    async sendJettons(destination: string) {
        const adapter = new ContractAdapter(this.tonClient);

        const keyPair = await mnemonicToPrivateKey(this.appCfg.seed_phrase);

        const wallet = WalletContractV5R1.create({ workchain: 0, publicKey: keyPair.publicKey });
        const contract = adapter.open(wallet);

        const jettons = this.appCfg.jetton_wallets;

        for (const [symbol, jettonWalletBase64] of Object.entries(jettons)) {
            const jettonWallet = Address.parse(jettonWalletBase64);

            const amount = 10000n * (symbol === 'usdt' ? 1_000_000n : 1_000_000_000n);

            const jettonTransferPayload = beginCell()
            .storeUint(0xf8a7ea5, 32)
            .storeUint(0, 64) 
            .storeCoins(amount)
            .storeAddress(Address.parse(destination))
            .storeAddress(wallet.address)
            .storeBit(false)
            .storeCoins(1n)
            .storeMaybeRef(undefined)
            .endCell();

        const seqno = await contract.getSeqno();

        await contract.sendTransfer({
            seqno,
            secretKey: keyPair.secretKey,
            sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
            messages: [
                internal({
                    to: jettonWallet,
                    value: toNano(0.05),
                    body: jettonTransferPayload
                })
            ]
        });

        }
    }
}
