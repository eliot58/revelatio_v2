import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { TonApiClient } from '@ton-api/client';
import { Inject } from '@nestjs/common';
import appConfig from '../config/app.config';
import { ConfigType } from '@nestjs/config';
import { Address } from '@ton/core';
import { ContractAdapter } from '@ton-api/ton-adapter';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { SendMode, WalletContractV5R1, beginCell, internal, toNano } from '@ton/ton';

@Processor('telegram')
export class TelegramConsumer extends WorkerHost {
  constructor(
    @Inject(appConfig.KEY) private readonly appCfg: ConfigType<typeof appConfig>,
    @Inject("TESTNET_TONAPI_CLIENT") private readonly tonClient: TonApiClient
  ) {
    super()
  }

  async process(job: Job<{ destination: string; coins: "not" | "px" | "dogs" | "usdt" | "grc"; jettonWallet: string }>) {
    const { destination, coins, jettonWallet } = job.data;

    const adapter = new ContractAdapter(this.tonClient);

    const keyPair = await mnemonicToPrivateKey(this.appCfg.seed_phrase);

    const wallet = WalletContractV5R1.create({ publicKey: keyPair.publicKey, walletId: { networkGlobalId: -3 } });
    const contract = adapter.open(wallet);

    const amount = 10000n * (coins === 'usdt' ? 1_000_000n : 1_000_000_000n);

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
          to: Address.parse(jettonWallet),
          value: toNano(0.05),
          body: jettonTransferPayload
        })
      ]
    });
  }

}