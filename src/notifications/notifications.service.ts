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

        await this.bot.api.sendMessage(-1003007629863, message, {
            parse_mode: 'HTML',
            link_preview_options: {
                is_disabled: true
            }
        });
    }

    @Interval(180000)
    async handleJettonPool() {
        const poolAddrStr = 'EQAdn2BoPvqOZ6ptXBXpoZ8pXhJMR0KQMxZuEcK-6J_oO5Vs';
        const address = Address.parse(poolAddrStr);

        const cache = await this.redis.getKey(`lastLt:${poolAddrStr}`);
        let lastLt: bigint | undefined = undefined;
        if (cache) lastLt = BigInt(cache);

        const res = await this.tonClient.blockchain.getBlockchainAccountTransactions(address, { limit: 50, after_lt: lastLt });

        if (res.transactions.length === 0) return;
        
        const firstLt = res.transactions[0].lt.toString()

        if (!cache) {
            await this.redis.setKey(`lastLt:${poolAddrStr}`, firstLt);
            return;
        }

        for (const tx of res.transactions.reverse()) {
            if (!tx.success) continue;

            if (tx.inMsg?.decodedOpName !== 'stonfi_swap') continue;

            if (!Array.isArray(tx.outMsgs) || tx.outMsgs.length === 0) continue;

            const lastOut = tx.outMsgs[tx.outMsgs.length - 1];

            if (lastOut?.decodedOpName !== 'stonfi_payment_request') continue;

            const amount0OutStr = lastOut.decodedBody["params"]["value"]["amount0_out"];
            if (amount0OutStr === '0') continue;

            const txHash = tx.hash;
            const tonIn = Number(tx.inMsg.decodedBody["jetton_amount"]);
            const grcOut = Number(amount0OutStr);
            const price = tonIn / grcOut;

            const tonStr = (tonIn / 1e9).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            });
            const grcStr = (grcOut / 1e9).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            });
            const priceStr = Number(price).toLocaleString(undefined, {
                minimumFractionDigits: 6,
                maximumFractionDigits: 6,
            });

            await this.sendSwapNotification(tonStr, grcStr, priceStr, txHash);
        }

        await this.redis.setKey(`lastLt:${poolAddrStr}`, firstLt);
    }

}
