const IP = typeof QDP_IP === "undefined" ? "localhost" : QDP_IP;
export const IP_CADDY = `${IP}:8080` // 8080 is file server port for fetch
export const IP_NATS_REPLY = `${IP}:9222` // 9222 is nats server port