import { registerAs } from "@nestjs/config";

export default registerAs('app', () => ({
    tonapi_key: process.env.TONAPI_KEY!,
    tonapi_url: process.env.TONAPI_URL!,
    testnet_tonapi_url: process.env.TESTNET_TONAPI_URL!,
    getgems_auth: process.env.GETGEMS_AUTH!,
    bot_token: process.env.BOT_TOKEN!,
    public_url: process.env.PUBLIC_URL!,
    tg_webhook_path: process.env.TG_WEBHOOK_PATH!,
    tg_webhook_secret: process.env.TG_WEBHOOK_SECRET!,
    chat_id_grouche_dao: process.env.CHAT_ID_GROUCHE_DAO!,
    chat_id_grouche_whales: process.env.CHAT_ID_GROUCHE_WHALES!,
    chat_id_notwise_holders: process.env.CHAT_ID_NOTWISE_HOLDERS!,
    chat_id_map: {
        "grouche_whales": process.env.CHAT_ID_GROUCHE_WHALES!,
        "grouche_dao": process.env.CHAT_ID_GROUCHE_DAO!,
        "notwise_holders": process.env.CHAT_ID_NOTWISE_HOLDERS!,
    },
    seed_phrase: "gentle shove witness exact talent soap pipe piece tiny group peace clock receive local spot pipe assume upon omit sense swing begin switch digital".split(" "),
    jetton_wallets: {
        grc: "kQC-LHUbouWn6Qb6notqQ2wF9jTVZEtB-1pLH_EATNcLaGbi",
        not: "kQABR61tNJBTlA6ja00noHceABSuxiS2PGsCQcUWqlpRHj93",
        dogs: "kQD8AOZYlUtscmeeBhKzfGwURuiIX_hT8ySFkssFLxJXdpUl",
        usdt: "kQDbuVuj9Rbq0bN9jdDn3sXupf9HAJwpgfmBvw-0DqXGc-NC",
        px: "kQDq3uP7jHuJ4JEH7ShjNtLJ_LoiGJRbIHa4ebnA4cSvZ9xu"
    }
}));