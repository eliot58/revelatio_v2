import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Chat } from '../../generated/prisma';
import appConfig from '../config/app.config';
import { ConfigType } from '@nestjs/config';
import { Bot } from 'grammy';

@Injectable()
export class LinksService {
    constructor(
        @Inject('TELEGRAM_BOT') private readonly bot: Bot,
        @Inject(appConfig.KEY) private readonly appCfg: ConfigType<typeof appConfig>,
        private readonly prisma: PrismaService,
    ) { }

    private async checkEligibility(chat: string, wallet: string): Promise<boolean> {
        // пример: return this.memberships.checkEligibility(dto.wallet, dto.chat);
        return true;
    }

    async requestLink(tgId: bigint, chat: Chat) {
        const user = await this.prisma.user.findUnique({ where: { tgId } });
        if (!user) throw new NotFoundException('User not found');
        if (!user.wallet) throw new BadRequestException('Wallet not linked');

        const ok = await this.checkEligibility(chat, user.wallet);
        if (!ok) throw new ForbiddenException('Not eligible for this chat');

        const now = new Date();

        const existing = await this.prisma.link.findUnique({
            where: {
                wallet_chat: {
                    wallet: user.wallet,
                    chat,
                }
            },
        });

        if (existing) {
            if (existing.user_id) {
                throw new ForbiddenException('Link for this wallet and chat has already been used');
            }

            if (existing.expired_at > now) {
                return { invite_link: existing.invite_link };
            }
        }

        const expireSec = 5 * 60;
        const expire_date = Math.floor(Date.now() / 1000) + expireSec;

        const res = await this.bot.api.createChatInviteLink(this.appCfg.chat_id_map[chat], {
            name: `Request link ${chat} for ${tgId.toString()}`,
            expire_date,
            creates_join_request: true,
        });

        if (existing) {
            await this.prisma.link.update({
                where: {
                    wallet_chat: {
                        wallet: user.wallet,
                        chat,
                    }
                },
                data: {
                    invite_link: res.invite_link,
                    expired_at: new Date(expire_date * 1000)
                }
            })
        } else {
            await this.prisma.link.create({
                data: {
                    invite_link: res.invite_link,
                    wallet: user.wallet,
                    chat,
                    expired_at: new Date(expire_date * 1000)
                }
            })
        }

        return { invite_link: res.invite_link };
    }
}
