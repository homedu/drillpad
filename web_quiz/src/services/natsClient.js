import { wsconnect } from "@nats-io/nats-core";
import { IP_NATS_REPLY } from "./addr";

const NATS_SERVER = `ws://${IP_NATS_REPLY}`; // 修改 nats 服务器地址

/* ============================================================
 * 错误分类
 * 所有异常都继承自 NatsClientError，调用方可以：
 *   - catch (NatsClientError) 兜底
 *   - 也可以用 instanceof 判断具体子类做针对性处理
 *   - err.cause 里保留了 nats 库抛出的原始错误，便于排查
 * ============================================================ */

export class NatsClientError extends Error {
    constructor(message, options = {}) {
        super(message, options);
        this.name = this.constructor.name;
    }
}

/** 建立连接失败（服务器不可达、握手失败、connect 超时等） */
export class NatsConnectError extends NatsClientError { }

/** 当前没有可用连接（尚未连接成功 / 连接已被关闭 / 正在重连中） */
export class NatsNotConnectedError extends NatsClientError { }

/** request 在 opts.timeout 内没有收到回复 */
export class NatsRequestTimeoutError extends NatsClientError { }

/** subject 没有任何一方在监听（NoResponders） */
export class NatsNoRespondersError extends NatsClientError { }

/** subject 非法，或其它 nats 协议层面的请求错误 */
export class NatsRequestFailedError extends NatsClientError { }

/** 收到了回复，但内容不是合法 JSON。rawMessage 保留原始字符串方便排查 */
export class NatsResponseParseError extends NatsClientError {
    constructor(message, rawMessage, options) {
        super(message, options);
        this.rawMessage = rawMessage;
    }
}

/** 关闭连接过程中出现的异常 */
export class NatsCloseError extends NatsClientError { }

/* ============================================================
 * 连接管理
 * ============================================================ */

let ncPromise = null; // 建连过程中的 promise（用于并发调用去重）
let nc = null; // 建连成功后的连接对象
let statusMonitorStarted = false;

/** 监听连接状态变化（断线 / 重连 / 错误），仅用于日志，不影响业务流程 */
function monitorStatus(connection) {
    if (statusMonitorStarted) return;
    statusMonitorStarted = true;

    (async () => {
        for await (const s of connection.status()) {
            switch (s.type) {
                case "disconnect":
                    console.warn("[NATS] 连接断开:", s.data);
                    break;
                case "reconnecting":
                    console.warn("[NATS] 正在尝试重连...");
                    break;
                case "reconnect":
                    console.log("[NATS] 重连成功:", s.data);
                    break;
                case "update":
                    console.log("[NATS] 集群拓扑更新:", s.data);
                    break;
                case "error":
                    console.error("[NATS] 状态流报告错误:", s.data);
                    break;
                default:
                    break;
            }
        }
    })().catch((err) => {
        // status() 迭代器本身异常终止，说明连接已经彻底不可用
        console.error("[NATS] 状态监听异常终止:", err?.message ?? err);
    });
}

/**
 * 获取（或建立）NATS 连接。
 * 并发调用会复用同一个建连 promise；建连失败会清空缓存以便下次重试，
 * 不会像原实现那样把失败的 promise 一直缓存住。
 */
export function getNatsConnection() {
    if (!ncPromise) {
        ncPromise = wsconnect({
            servers: NATS_SERVER,
            timeout: 10000,
            reconnect: true,
            maxReconnectAttempts: -1, // 无限重连，交由上层业务决定是否放弃
            error_cb: (err) => { console.error("[NATS] 异步错误通知:", err?.message ?? err); },
        }).then((connection) => {
            nc = connection;
            monitorStatus(connection);
            return connection;
        }).catch((err) => {
            // 关键修复：建连失败要重置缓存，否则调用方永远拿到同一个失败的 promise
            ncPromise = null;
            nc = null;
            throw new NatsConnectError(
                `无法连接到 NATS 服务器(${NATS_SERVER}): ${err?.message ?? err}`,
                { cause: err }
            );
        });
    }
    return ncPromise;
}

function isConnected() {
    return !!nc && !nc.isClosed();
}

/* ============================================================
 * 请求封装
 * ============================================================ */

/**
 * 发送 JSON 请求并解析 JSON 响应。
 * 出现异常时，会按类型 throw 对应的 Nats*Error 子类，调用方可以精确捕获：
 *
 *   try {
 *     const data = await reqNATS("foo.bar", { a: 1 });
 *   } catch (err) {
 *     if (err instanceof NatsRequestTimeoutError) { ... 超时重试 ... }
 *     else if (err instanceof NatsNoRespondersError) { ... 服务未启动提示 ... }
 *     else if (err instanceof NatsResponseParseError) { ... 记录 err.rawMessage ... }
 *     else if (err instanceof NatsNotConnectedError) { ... 提示网络异常 ... }
 *     else { ... 兜底 ... }
 *   }
 */
export async function reqNATS(subject, payload, opts = { timeout: 10000 }) {
    if (!subject || typeof subject !== "string") {
        throw new NatsRequestFailedError(`非法的 subject: ${String(subject)}`);
    }

    // 建连本身失败时，NatsConnectError 直接透传给调用方
    const connection = await getNatsConnection();

    if (!isConnected()) {
        throw new NatsNotConnectedError(
            "NATS 连接当前不可用（可能正在重连或已关闭），请稍后重试"
        );
    }

    let body;
    try {
        body = typeof payload === 'string' ? payload : JSON.stringify(payload);
    } catch (err) {
        throw new NatsRequestFailedError(
            `请求 payload 序列化失败: ${err.message}`,
            { cause: err }
        );
    }

    let rawMsg;
    try {
        const reply = await connection.request(subject, body, opts);
        rawMsg = reply.string();
    } catch (err) {
        // nats.js 抛出的错误一般带 code / name，具体取值随版本略有差异，
        // 这里同时兼容两种命名方式
        const code = err?.code ?? err?.name;

        switch (code) {
            case "TIMEOUT":
            case "TimeoutError":
                throw new NatsRequestTimeoutError(
                    `请求超时(subject=${subject}, timeout=${opts.timeout}ms)`,
                    { cause: err }
                );

            case "NO_RESPONDERS":
            case "NoRespondersError":
                throw new NatsNoRespondersError(
                    `subject=${subject} 当前没有任何服务在监听`,
                    { cause: err }
                );

            case "CONNECTION_CLOSED":
            case "ConnectionClosedError":
            case "CLOSED_CONNECTION":
                // 连接已经彻底关闭，重置缓存，让下次调用重新建连
                ncPromise = null;
                nc = null;
                throw new NatsNotConnectedError(
                    `请求时发现连接已关闭(subject=${subject})`,
                    { cause: err }
                );

            case "BAD_SUBJECT":
                throw new NatsRequestFailedError(
                    `非法的 subject: ${subject}`,
                    { cause: err }
                );

            default:
                throw new NatsRequestFailedError(
                    `请求失败(subject=${subject}): ${err?.message ?? err}`,
                    { cause: err }
                );
        }
    }

    console.log("NATS RawMsg:", rawMsg);

    if (rawMsg === undefined || rawMsg === null || rawMsg === "") {
        return null;
    }

    // 关键修复：原代码用不存在的 JSON.tryParse 导致永远返回 null，
    // 这里改为 try/catch，并把原始报文带在错误对象上方便排查
    try {
        return JSON.parse(rawMsg);
    } catch (err) {
        throw new NatsResponseParseError(
            `响应内容不是合法 JSON(subject=${subject}): ${err.message}`,
            rawMsg,
            { cause: err }
        );
    }
}

/* ============================================================
 * 关闭连接
 * ============================================================ */

export async function closeNats() {
    if (!ncPromise) return;

    let connection;
    try {
        connection = await ncPromise;
    } catch {
        // 连接本身就没建立成功，直接清理状态即可，无需再抛异常
        ncPromise = null;
        nc = null;
        statusMonitorStarted = false;
        return;
    }

    // 异步监听“是否正常关闭”，仅用于日志，不阻塞关闭流程
    connection
        .closed()
        .then((err) => {
            if (err) {
                console.error("[NATS] 连接异常关闭:", err);
            } else {
                console.log("[NATS] 连接正常关闭");
            }
        })
        .catch((err) => {
            console.error("[NATS] 监听关闭状态时出错:", err?.message ?? err);
        });

    try {
        await connection.close();
    } catch (err) {
        throw new NatsCloseError(`关闭 NATS 连接时出错: ${err.message}`, {
            cause: err,
        });
    } finally {
        ncPromise = null;
        nc = null;
        statusMonitorStarted = false;
    }
}