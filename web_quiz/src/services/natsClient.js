import { wsconnect } from "@nats-io/nats-core";
import { IP_NATS_REPLY } from "./addr";

const NATS_SERVER = `ws://${IP_NATS_REPLY}`; // change nats server address

let ncPromise = null;

export function getNatsConnection() {
    if (!ncPromise) { ncPromise = wsconnect({ servers: NATS_SERVER }); }
    return ncPromise;
}

export async function reqJSON(subject, payload, opts = { timeout: 10000 }) {
    const nc = await getNatsConnection();
    const msg = await nc.request(subject, JSON.stringify(payload), opts);
    console.log(msg.string());
    return JSON.parse(msg.string());
}

export async function closeNats() {
    if (ncPromise) {
        const nc = await ncPromise;
        await nc.close().catch(() => { });
        ncPromise = null;
    }
}