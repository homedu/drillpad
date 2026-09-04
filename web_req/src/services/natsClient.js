import { wsconnect } from "@nats-io/nats-core";

const NATS_SERVER = "ws://192.168.1.159:9222"; // change nats server address

let ncPromise = null;

export function getNatsConnection() {
    if (!ncPromise) { ncPromise = wsconnect({ servers: NATS_SERVER }); }
    return ncPromise;
}

export async function requestJson(subject, payload, opts = { timeout: 10000 }) {
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