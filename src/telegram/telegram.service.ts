import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import appConfig from '../config/app.config';
import { ConfigType } from '@nestjs/config';
import { Chat } from '../../generated/prisma';
import { Bot } from 'grammy';
import { Address } from '@ton/core';
import { RedisService } from '../redis/redis.service';
import { TonApiClient } from '@ton-api/client';
import { ContractAdapter } from '@ton-api/ton-adapter';
import { HighloadWalletV3 } from '../wrappers/highload-v3';
import { mnemonicToWalletKey } from "@ton/crypto";
import { OutActionSendMsg, SendMode, beginCell, internal, toNano } from '@ton/ton';
import { HighloadQueryId } from '../wrappers/highload-query';
import { randomInt } from 'crypto';

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
            if (ctx.chat.type !== 'private') return;

            const userId = ctx.from?.id;
            if (!userId) return;

            const awaitingKey = `awaiting:get:${userId}`;
            const WAIT_TTL = 5 * 60;

            const existing = await this.redis.getKey(awaitingKey);
            if (existing) {
                await ctx.reply("I'm already waiting for your wallet address. Please send it.");
                return;
            }

            await this.redis.setKey(awaitingKey, "1", WAIT_TTL);
            await ctx.reply('Please send your test TON wallet address:');
        });

        bot.on('message:text', async (ctx) => {
            if (ctx.chat.type !== 'private') return;

            const userId = ctx.from?.id;
            if (!userId) return;

            const awaitingKey = `awaiting:get:${userId}`;
            const isWaiting = await this.redis.getKey(awaitingKey);
            if (!isWaiting) return;

            await this.redis.deleteKey(awaitingKey);

            const wallet = ctx.message.text.trim();

            try {
                const address = Address.parse(wallet);

                const cache = await this.redis.getKey(`get:${address.toRawString()}`);
                if (cache) {
                    await ctx.reply('You can only request jettons once per 20 minutes. Please try again later.');
                    return;
                }

                await this.redis.setKey(`get:${address.toRawString()}`, "1", 1200);
            } catch {
                await ctx.reply('❌ Invalid TON address. Please try again.');
                return;
            }

            try {
                await this.sendJettons(wallet);
                await ctx.reply(`✅ Jettons have been successfully sent to ${wallet}`);
            } catch (e) {
                await ctx.reply('❌ Error sending jettons. Please try again later.');
            }
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

        const walletMnemonicArray = this.appCfg.seed_phrase;
        const walletKeyPair = await mnemonicToWalletKey(walletMnemonicArray);
        const wallet = adapter.open(
            HighloadWalletV3.createFromAddress(
                Address.parse("0QCbj-iw6NIa2inaQfwHNDaTXMQ9yXcdgTqAmkmuEeFEnURh")
            )
        );

        const actions: OutActionSendMsg[] = [];

        const jettons = this.appCfg.jetton_wallets;

        const hlqRedisKey = `hlq:${wallet.address.toRawString()}`;

        const MAX_SHIFT = 8191;
        const MAX_BIT_NUMBER = 1022;

        const timeout = 60 * 60;
        const redisTTL = timeout * 2;

        let queryHandler: HighloadQueryId | null = null;
        try {
            const raw = await this.redis.getKey(hlqRedisKey);
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    const shift = BigInt(parsed.shift);
                    const bitNumber = BigInt(parsed.bitNumber);
                    queryHandler = HighloadQueryId.fromShiftAndBitNumber(shift, bitNumber);
                } catch (e) {
                    queryHandler = null;
                }
            }
        } catch (e) {
            queryHandler = null;
        }

        if (!queryHandler) {
            const shiftRand = BigInt(randomInt(0, MAX_SHIFT + 1));
            const bitRand = BigInt(randomInt(0, MAX_BIT_NUMBER + 1));
            queryHandler = HighloadQueryId.fromShiftAndBitNumber(shiftRand, bitRand);
        }

        for (const [symbol, jettonWalletBase64] of Object.entries(jettons)) {
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

            actions.push({
                type: "sendMsg",
                mode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
                outMsg: internal({
                    to: Address.parse(jettonWalletBase64),
                    value: toNano(0.05),
                    body: jettonTransferPayload,
                }),
            });
        }

        const subwalletId = 0x10ad;
        const internalMessageValue = toNano(0.01);
        const createdAt = Math.floor(Date.now() / 1000) - 60;

        await wallet.sendBatch(
            walletKeyPair.secretKey,
            actions,
            subwalletId,
            queryHandler,
            timeout,
            internalMessageValue,
            SendMode.PAY_GAS_SEPARATELY,
            createdAt
        );

        const next = queryHandler.getNext();
        const payloadToSave = JSON.stringify({
            shift: next.getShift().toString(),
            bitNumber: next.getBitNumber().toString(),
        });

        await this.redis.setKey(hlqRedisKey, payloadToSave, redisTTL);
    }

}
