import { TonApiClient } from "@ton-api/client";

async function main() {

    const client = new TonApiClient({
        baseUrl: 'https://tonapi.io',
        apiKey: 'AHUUFGKOZ3UZTFIAAAAHDTOUA4GYUTWT24IWXZQUPMXONYKN5MSCQWUQJLN424664CSKMWI',
    });

    const tx = await client.blockchain.getBlockchainTransaction("2e75e6732b30d72f88f22930b685877d55b41a7bffb3b090905b1af878c7e670")

    console.log(tx)

    // if (!tx.success) console.log("saccuess false");

    // if (tx.inMsg?.decodedOpName !== 'stonfi_swap') console.log("invalid op name");

    // if (!Array.isArray(tx.outMsgs) || tx.outMsgs.length === 0) console.log("failed");

    // const lastOut = tx.outMsgs[tx.outMsgs.length - 1];

    // if (lastOut?.decodedOpName !== 'stonfi_payment_request') console.log("failed");

    // console.log(lastOut.decodedBody)

    // const amount0OutStr = lastOut.decodedBody["params"]["value"]["amount0_out"];
    // if (amount0OutStr === '0') console.log("failed");

    // const txHash = tx.hash;
    // const tonIn = Number(tx.inMsg?.decodedBody["jetton_amount"]);
    // const grcOut = Number(amount0OutStr);
    // const price = tonIn / grcOut;

    // console.log(tonIn)

    // console.log(grcOut)

    // if (100000000000 > tonIn) console.log("failed");

    // const tonStr = (tonIn / 1e9).toLocaleString(undefined, {
    //     minimumFractionDigits: 2,
    //     maximumFractionDigits: 2,
    // });
    // const grcStr = (grcOut / 1e9).toLocaleString(undefined, {
    //     minimumFractionDigits: 2,
    //     maximumFractionDigits: 2,
    // });
    // const priceStr = Number(price).toLocaleString(undefined, {
    //     minimumFractionDigits: 6,
    //     maximumFractionDigits: 6,
    // });


    // console.log(tonStr, grcStr, priceStr)
}


main()