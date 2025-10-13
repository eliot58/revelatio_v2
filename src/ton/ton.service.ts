import { Inject, Injectable, Logger } from '@nestjs/common';
import { sha256 } from '@ton/crypto';
import { CheckProofRequestDto } from '../auth/dto/check-proof-dto';
import { Address, Cell, contractAddress, loadStateInit } from '@ton/ton';
import { tryParsePublicKey } from '../wrappers/wallets-data';
import { sign } from 'tweetnacl';
import { TonApiClient } from '@ton-api/client';
import { ConfigType } from '@nestjs/config';
import authConfig from '../config/auth.config';

@Injectable()
export class TonService {
    private readonly logger = new Logger(TonService.name);

    constructor(
        @Inject("TONAPI_CLIENT") private readonly tonClient: TonApiClient,
        @Inject(authConfig.KEY) private readonly authCfg: ConfigType<typeof authConfig>,
    ) { }

    public async getWalletPublicKey(address: string) {
        const res = await this.tonClient.accounts.getAccountPublicKey(Address.parse(address))

        return Buffer.from(
            res.publicKey,
            'hex',
        );
    }

    public async checkProof(
        payload: CheckProofRequestDto
    ): Promise<boolean> {
        try {
            const stateInit = loadStateInit(
                Cell.fromBase64(payload.proof.state_init).beginParse(),
            );

            const publicKey =
                tryParsePublicKey(stateInit) ??
                (await this.getWalletPublicKey(payload.address));
            if (!publicKey) {
                return false;
            }

            const wantedPublicKey = Buffer.from(payload.public_key, 'hex');
            if (!publicKey.equals(wantedPublicKey)) {
                return false;
            }

            const wantedAddress = Address.parse(payload.address);
            const address = contractAddress(wantedAddress.workChain, stateInit);
            if (!address.equals(wantedAddress)) {
                return false;
            }

            if (!this.authCfg.allowedDomains.includes(payload.proof.domain.value)) {
                return false;
            }

            const now = Math.floor(Date.now() / 1000);
            if (now - this.authCfg.validAuthTimeSec > payload.proof.timestamp) {
                return false;
            }

            const message = {
                workchain: address.workChain,
                address: address.hash,
                domain: {
                    lengthBytes: payload.proof.domain.lengthBytes,
                    value: payload.proof.domain.value,
                },
                signature: Buffer.from(payload.proof.signature, 'base64'),
                payload: payload.proof.payload,
                stateInit: payload.proof.state_init,
                timestamp: payload.proof.timestamp,
            };

            const wc = Buffer.alloc(4);
            wc.writeUInt32BE(message.workchain, 0);

            const ts = Buffer.alloc(8);
            ts.writeBigUInt64LE(BigInt(message.timestamp), 0);

            const dl = Buffer.alloc(4);
            dl.writeUInt32LE(message.domain.lengthBytes, 0);

            const msg = Buffer.concat([
                Buffer.from(this.authCfg.tonProofPrefix),
                wc,
                message.address,
                dl,
                Buffer.from(message.domain.value),
                ts,
                Buffer.from(message.payload),
            ]);

            const msgHash = Buffer.from(await sha256(msg));

            const fullMsg = Buffer.concat([
                Buffer.from([0xff, 0xff]),
                Buffer.from(this.authCfg.tonConnectPrefix),
                msgHash,
            ]);

            const result = Buffer.from(await sha256(fullMsg));

            return sign.detached.verify(result, message.signature, publicKey);
        } catch (e) {
            return false;
        }
    }
}
