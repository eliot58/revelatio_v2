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
        grc: "kQCFHr3K6FIWpXH-s72iufQZQoY6Ftj26nexg6ZHDZRMLUqI",
        not: "kQAs8R4toFC-kBTJCGxqDwp_eEo2LSjaxApy-jAkSGy06d5F",
        dogs: "kQCaHKzpXlBjep7tODPeWvuUSRgVWcJi7LdZ4UG9AO4l25mz",
        usdt: "kQD5ghgsUK4xTABFxPQiv-zc3A8IuGPY7x7BYU5f9wHuf584",
        px: "kQCIepbrPCESP6vdaSUwIUVsj0w_7JG0bgtiOB5aVHCafTd7"
    }
}));