import { HttpService } from '@nestjs/axios';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { Bot, InlineKeyboard } from 'grammy';
import { firstValueFrom } from 'rxjs';
import appConfig from '../config/app.config';
import { RedisService } from '../redis/redis.service';
import { Address } from '@ton/ton';
import { TonApiClient } from '@ton-api/client';

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
    private handlers = [
        this.handleNotWise.bind(this),
        this.handleNotWiseOwlings.bind(this),
        this.handleGrouchePears.bind(this),
        this.handleNotWiseRoyalityViolation.bind(this),
    ];

    private currentHandler = 0;

    constructor(
        private readonly http: HttpService,
        private readonly redis: RedisService,
        @Inject('TELEGRAM_BOT') private readonly bot: Bot,
        @Inject("TONAPI_CLIENT") private readonly tonClient: TonApiClient,
        @Inject(appConfig.KEY) private readonly appCfg: ConfigType<typeof appConfig>,
    ) { }

    private shortAddr(addr?: string, head = 2, tail = 4): string {
        if (!addr) return '';
        if (addr.length <= head + tail) return addr;
        return `${addr.slice(0, head)}...${addr.slice(-tail)}`;
    }

    private marketappUserUrl(addr: string): string {
        return `https://getgems.io/user/${addr}`;
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
        headers['Authorization'] = this.appCfg.getgems_auth;
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

    private async fetchEvents(collectionId: string, types: string): Promise<GetgemsEventItem[]> {
        let nowMs: number;

        const cache = await this.redis.getKey(`nowMs:${collectionId}`)
        if (!cache) {
            nowMs = new Date().getTime();
        } else {
            nowMs = Number(cache)
        }

        const url = `https://api.getgems.io/public-api/v1/collection/history/${collectionId}?minTime=${nowMs}&limit=100${types}`;

        const { data } = await firstValueFrom(
            this.http.get(url, { headers: this.headers() }),
        );

        const items = (data?.response?.items ?? []) as GetgemsEventItem[];
        if (items.length > 0) {
            const first = items[0];
            const ts = Date.parse(first.time);
            nowMs = ts + 1;
        }

        await this.redis.setKey(`nowMs:${collectionId}`, nowMs.toString())

        return items;
    }

    // ----------------- SENDER -----------------
    private async sendNotification(item: GetgemsEventItem, chatIds: string[]) {
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
                reply_markup: kb
            });
        }
    }

    @Interval(60000)
    async handleSequential() {
        const handler = this.handlers[this.currentHandler];
        try {
            await handler();
        } catch (err) {
            console.error('Error in notification handler:', err);
        }

        this.currentHandler = (this.currentHandler + 1) % this.handlers.length;
    }

    // ----------------- HANDLERS -----------------
    private async handleNotWise() {
        const events = await this.fetchEvents("EQA5HalN4asamSjufbmXF_Wr3jyapCEYcYN0igfBDe5Nmbm7", "&types=sold&types=putUpForAuction")

        for (const event of events) {
            await this.sendNotification(event, ["-1002234423310", "-1001338790838"])
        }
    }

    private async handleNotWiseOwlings() {
        const events = await this.fetchEvents("EQAPpJOA7BJPDJw9d7Oy7roElafFzsIkjaPoKPe9nmNBKaOZ", "&types=sold&types=putUpForAuction")

        for (const event of events) {
            await this.sendNotification(event, ["-1002234423310", "-1001338790838"])
        }
    }

    private async handleGrouchePears() {
        const events = await this.fetchEvents("EQCdpND6kJ8O7KFfHfIiqY75MBuFkpX2jdBrRDnlFGpp97QQ", "&types=sold&types=putUpForAuction")

        for (const event of events) {
            await this.sendNotification(event, ["-1003007629863"])
        }
    }

    private async handleNotWiseRoyalityViolation() {
        console.log('Running handleNotWiseRoyalityViolation...');
    }

    private async sendSwapNotification(
        tonIn: string,
        grcOut: string,
        price: string,
        txHash: string,
    ): Promise<void> {
        const txLink = `https://tonviewer.com/transaction/${txHash}`;

        const message =
            `🟢 GRC <a href="${txLink}">Purchase</a> (STON.fi)\n` +
            `<b>${tonIn} 💎</b> → <b>${grcOut} 🍐</b>\n` +
            `Price: <b>${price} 💎</b>`;

        await this.bot.api.sendMessage(-1002936541860, message, {
            parse_mode: 'HTML',
            link_preview_options: {
                is_disabled: true
            }
        });
    }

    @Interval(5000)
    async handleJettonPool() {
        const poolAddrStr = 'EQAdn2BoPvqOZ6ptXBXpoZ8pXhJMR0KQMxZuEcK-6J_oO5Vs';
        const tokenAddr = 'EQAu7qxfVgMg0tpnosBpARYOG--W1EUuX_5H_vOQtTVuHnrn';
        const redisKey = `lastHash:${poolAddrStr}`;

        const lastHash = await this.redis.getKey(redisKey);

        const url = `https://api.geckoterminal.com/api/v2/networks/ton/pools/${poolAddrStr}/trades?trade_volume_in_usd_greater_than=1&token=${tokenAddr}`;
        const { data } = await firstValueFrom(
            this.http.get(url, { headers: { accept: 'application/json' } }),
        );

        let trades: any[] = data["data"];

        if (!trades || trades.length === 0) return;

        if (lastHash) {
            const index = trades.findIndex(t => t.attributes.tx_hash === lastHash);
            if (index !== -1) trades = trades.slice(index + 1);
        }

        for (const trade of trades.reverse()) {
            const attrs = trade.attributes;

            if (attrs.kind !== 'buy') continue;

            const fromAmount = Number(attrs.from_token_amount);
            const toAmount = Number(attrs.to_token_amount);
            const price = fromAmount / toAmount;

            const fromStr = fromAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const toStr = toAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const priceStr = price.toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 6 });

            await this.sendSwapNotification(fromStr, toStr, priceStr, attrs.tx_hash);
        }

        const lastTrade = trades[trades.length - 1];
        if (lastTrade) {
            await this.redis.setKey(redisKey, lastTrade.attributes.tx_hash);
        }
    }


}
