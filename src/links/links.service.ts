import { BadRequestException, ForbiddenException, Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ChatIdMap } from '../constants/config';
import { PrismaService } from '../prisma/prisma.service';
import { Bot } from 'grammy';

@Injectable()
export class LinksService {
    constructor(
        @Inject('TELEGRAM_BOT') private readonly bot: Bot,
        private readonly prisma: PrismaService,
    ) { }

    private async checkEligibility(chat: string, wallet: string): Promise<boolean> {
        // пример: return this.memberships.checkEligibility(dto.wallet, dto.chat);
        return true;
    }

    async requestLink(tgId: bigint, chat: string) {
        const user = await this.prisma.user.findUnique({ where: { tgId } });

        if (!user) throw new NotFoundException("User not found");
        if (!user.wallet) throw new BadRequestException("Wallet not linked");

        const ok = await this.checkEligibility(chat, user.wallet);
        if (!ok) throw new ForbiddenException('Not eligible for this chat');

        const chatId = ChatIdMap[chat];
        if (!chatId) throw new InternalServerErrorException('Chat is not configured');


        const res = await this.bot.api.createChatInviteLink(chatId, {
            name: `Request link ${chat} for ${String(user.wallet).slice(0, 6)}…`,
            member_limit: 1,
            creates_join_request: true,
        });

        return { invite_link: res.invite_link };
    }
}
