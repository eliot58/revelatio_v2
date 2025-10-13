import { registerAs } from "@nestjs/config";

export default registerAs('app', () => ({
    tonapi_key: process.env.TONAPI_KEY!,
    tonapi_url: process.env.TONAPI_URL!,
    getgems_auth: process.env.GETGEMS_AUTH!,
    bot_token: process.env.BOT_TOKEN!,
    public_url: process.env.PUBLIC_URL!,
    tg_webhook_path: process.env.TG_WEBHOOK_PATH!,
    tg_webhook_secret: process.env.TG_WEBHOOK_SECRET!,
    chat_id_grouche_dao: process.env.CHAT_ID_GROUCHE_DAO!,
    chat_id_grouche_whales: process.env.CHAT_ID_GROUCHE_WHALES!,
    chat_id_notwise_holders: process.env.CHAT_ID_NOTWISE_HOLDERS!,
    chat_id_notwise: process.env.CHAT_ID_NOTWISE!,
    chat_id_map: {
        "grouche_whales": process.env.CHAT_ID_GROUCHE_WHALES!,
        "grouche_dao": process.env.CHAT_ID_GROUCHE_DAO!,
        "notwise_holders": process.env.CHAT_ID_NOTWISE_HOLDERS!,
    }
}));