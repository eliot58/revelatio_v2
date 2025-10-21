import { DynamicModule } from '@nestjs/common';
import { TonService } from './ton.service';
import { ConfigType } from '@nestjs/config';
import { TonApiClient } from '@ton-api/client';
import appConfig from '../config/app.config';

export class TonModule {
    static forRootAsync(): DynamicModule {
        return {
            module: TonModule,
            providers: [
                {
                    provide: "TONAPI_CLIENT",
                    useFactory: (cfg: ConfigType<typeof appConfig>) => {
                        return new TonApiClient({ apiKey: cfg.tonapi_key, baseUrl: cfg.tonapi_url });
                    },
                },
                {
                    provide: "TESTNET_TONAPI_CLIENT",
                    useFactory: (cfg: ConfigType<typeof appConfig>) => {
                        return new TonApiClient({ apiKey: cfg.tonapi_key, baseUrl: cfg.testnet_tonapi_url });
                    },
                },
                TonService
            ],
            exports: ["TONAPI_CLIENT", "TESTNET_TONAPI_CLIENT", TonService],
        };
    }
}
