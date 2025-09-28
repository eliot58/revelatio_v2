import { HttpService } from '@nestjs/axios';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { Bot, InlineKeyboard } from 'grammy';
import { firstValueFrom } from 'rxjs';

type GetgemsEventItem = {
    address: string;
    time: string;
    typeData: {
        type: 'sold' | 'putUpForAuction';
        price?: string;
        oldOwner?: string;
        newOwner?: string;
    };
};

@Injectable()
export class NotificationsService {
    private readonly getgemsAuth: string;

    constructor(
        @Inject('TELEGRAM_BOT') private readonly bot: Bot,
        private readonly http: HttpService,
        private readonly config: ConfigService,

    ) {
        this.getgemsAuth = this.config.get<string>('GETGEMS_AUTH')!;
    }

    private shortAddr(addr?: string, head = 2, tail = 4): string {
        if (!addr) return '';
        if (addr.length <= head + tail) return addr;
        return `${addr.slice(0, head)}...${addr.slice(-tail)}`;
    }

    private marketappUserUrl(addr: string): string {
        return `https://getgems.io/user/${addr}`;
    }
    private getgemsCollectionUrl(collection: string): string {
        return `https://getgems.io/collection/${collection}`;
    }
    private getgemsNftUrl(nftAddr: string): string {
        return `https://getgems.io/nft/${nftAddr}`;
    }

    private formatTraitsLines(attributes: any): string {
        if (!Array.isArray(attributes)) return '';
        const lines: string[] = [];
        for (const a of attributes) {
            if (!a || typeof a !== 'object') continue;
            const label = a.traitType ?? a.trait_type ?? a.trait ?? 'Trait';
            const value = a.value;
            if (!label || value === undefined || value === null || value === '') continue;
            lines.push(`🎨 ${String(label).trim()} - ${String(value).trim()}`);
        }
        return lines.join('\n');
    }

    private headers() {
        const headers: Record<string, string> = { accept: 'application/json' };
        if (this.getgemsAuth) headers['Authorization'] = this.getgemsAuth;
        return headers;
    }

    private async fetchNftDetails(nftAddr: string) {
        const url = `https://api.getgems.io/public-api/v1/nft/${nftAddr}`;
        const { data } = await firstValueFrom(
            this.http.get(url, { headers: this.headers() }),
        );
        const resp = (data?.response ?? {}) as any;
        return {
            image: resp.image as string | undefined,
            attributes: resp.attributes as any[] | undefined,
            sale: resp.sale as { minBid?: string } | undefined,
            name: resp.name as string | undefined,
        };
    }

    private async fetchEvents(collectionId: string, nowMs: number, types: string[]): Promise<GetgemsEventItem[]> {
        const base = `https://api.getgems.io/public-api/v1/collection/history/${collectionId}`;

        const params = {
            minTime: String(nowMs),
            limit: "100",
            types: types,
        };

        const { data } = await firstValueFrom(
            this.http.get(base, { params, headers: this.headers() }),
        );

        const items = (data?.response?.items ?? []) as GetgemsEventItem[];
        if (items.length > 0) {
            const first = items[0];
            const ts = Date.parse(first.time);
            if (!Number.isNaN(ts)) {
                nowMs = ts + 1;
            }
        }

        return items;
    }

    // ----------------- SENDER -----------------
    private async sendNotification(item: GetgemsEventItem, chatIds: number[]) {
        const nft = await this.fetchNftDetails(item.address);

        const kb = new InlineKeyboard().url(
            'Open on Getgems',
            this.getgemsNftUrl(item.address),
        );

        const name = nft.name ?? this.shortAddr(item.address);
        const t = item.typeData.type;

        let caption = '';
        if (t === 'putUpForAuction') {
            const minBidTon =
                (Number(nft.sale?.minBid ?? '0') || 0) / 1e9;

            caption =
                `🏷️ <b>${name}</b> — <b>Auction</b> ✅️\n` +
                `Min bid: <b>${minBidTon.toLocaleString(undefined, { maximumFractionDigits: 2 })} 💎</b>\n` +
                (this.formatTraitsLines(nft.attributes) || '');
        } else {
            const priceTon = Number(item.typeData.price ?? '0');
            const seller = item.typeData.oldOwner ?? '';
            const buyer = item.typeData.newOwner ?? '';

            caption =
                `🟢 <b>${name}</b> — <b>Sold</b> ✅️\n` +
                `Price: <b>${priceTon.toLocaleString(undefined, { maximumFractionDigits: 2 })} 💎</b>\n` +
                `<a href="${this.marketappUserUrl(seller)}">${this.shortAddr(seller)}</a> ▶️ ` +
                `<a href="${this.marketappUserUrl(buyer)}">${this.shortAddr(buyer)}</a>\n\n` +
                (this.formatTraitsLines(nft.attributes) || '');
        }

        for (const chatId of chatIds) {
            await this.bot.api.sendPhoto(chatId, nft.image ?? this.getgemsNftUrl(item.address), {
                caption,
                parse_mode: 'HTML',
                reply_markup: kb,
            });
        }
    }

    @Interval(60000)
    handleNotWise() {

    }

    @Interval(60000)
    handleNotWiseOwlings() {

    }

    @Interval(60000)
    handleGrouchePears() {

    }

    @Interval(60000)
    handleGroucheJetton() {

    }

    @Interval(60000)
    handleNotWiseRoyalityViolation() {

    }
}
