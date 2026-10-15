import { IP_CADDY } from "./addr";

const CADDY_URL = `http://${IP_CADDY}/[PATH]`;
const DEFAULT_TIMEOUT = 10000;

/* ============================================================
 * 错误分类
 * 所有异常都继承自 FetchFileError，调用方可以：
 *   - catch (FetchFileError) 兜底
 *   - 也可以用 instanceof 判断具体子类做针对性处理
 *   - err.cause 里保留了 fetch 抛出的原始错误，便于排查
 * ============================================================ */

export class FetchFileError extends Error {
    constructor(message, options = {}) {
        super(message, options);
        this.name = this.constructor.name;
    }
}

/** path 参数本身不合法（空值、非字符串等），根本没有发起请求 */
export class FetchFileInvalidPathError extends FetchFileError { }

/** 请求在 opts.timeout 内没有完成（网络太慢 / 服务器无响应） */
export class FetchFileTimeoutError extends FetchFileError { }

/** 网络层错误：DNS 解析失败、连接被拒绝、CORS 拦截等，fetch 本身 reject */
export class FetchFileNetworkError extends FetchFileError { }

/** 服务端返回 404，单独拎出来因为这是最常见、最需要区分处理的情况 */
export class FetchFileNotFoundError extends FetchFileError {
    constructor(message, status, options) {
        super(message, options);
        this.status = status;
    }
}

/** 服务端返回了其它非 2xx 状态码 */
export class FetchFileHttpError extends FetchFileError {
    constructor(message, status, options) {
        super(message, options);
        this.status = status;
    }
}

/** HTTP 状态是 2xx，但读取响应体（.text()）时出错 */
export class FetchFileReadError extends FetchFileError { }

/* ============================================================
 * 主函数
 * ============================================================ */

/**
 * 从 Caddy 服务拉取文件内容（文本）。
 *
 * @param {string} path - 相对路径，会替换掉 CADDY_URL 里的 [PATH]
 * @param {object} [opts]
 * @param {number} [opts.timeout=10000] - 超时时间(ms)
 * @param {AbortSignal} [opts.signal] - 外部传入的 AbortSignal，可用于主动取消；会和内部的超时 signal 一起生效
 * @throws {FetchFileInvalidPathError} path 非法
 * @throws {FetchFileTimeoutError} 请求超时
 * @throws {FetchFileNetworkError} 网络层错误（DNS/连接被拒/CORS 等）
 * @throws {FetchFileNotFoundError} 404
 * @throws {FetchFileHttpError} 其它非 2xx 状态码
 * @throws {FetchFileReadError} 响应体读取失败
 *
 * 用法示例：
 *   try {
 *     const content = await fetchFile("configs/a.json");
 *   } catch (err) {
 *     if (err instanceof FetchFileNotFoundError) { ... 文件不存在 ... }
 *     else if (err instanceof FetchFileTimeoutError) { ... 超时重试 ... }
 *     else if (err instanceof FetchFileNetworkError) { ... 提示网络异常 ... }
 *     else if (err instanceof FetchFileHttpError) { console.error(err.status) }
 *     else { ... 兜底 ... }
 *   }
 */
export async function fetchFile(path, opts = {}) {
    const { timeout = DEFAULT_TIMEOUT, signal: externalSignal } = opts;

    if (!path || typeof path !== "string") {
        throw new FetchFileInvalidPathError(`非法的 path: ${String(path)}`);
    }

    const timestamp = Date.now();
    const url = CADDY_URL.replace("[PATH]", path) + `?v=${timestamp}`;

    // 用 AbortController 实现超时控制；同时兼容外部传入的 signal
    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), timeout);

    // 如果外部 signal 被中止，也同步中止请求
    const onExternalAbort = () => timeoutController.abort();
    if (externalSignal) {
        if (externalSignal.aborted) timeoutController.abort();
        else externalSignal.addEventListener("abort", onExternalAbort);
    }

    let response;
    try {
        response = await fetch(url, {
            cache: "no-store",
            signal: timeoutController.signal,
        });
    } catch (err) {
        if (err.name === "AbortError") {
            throw new FetchFileTimeoutError(
                `请求超时(path=${path}, timeout=${timeout}ms)`,
                { cause: err }
            );
        }
        // fetch 只会在网络层面失败时 reject（DNS 失败、连接被拒、CORS 拦截等）
        throw new FetchFileNetworkError(
            `网络请求失败(path=${path}): ${err.message}`,
            { cause: err }
        );
    } finally {
        clearTimeout(timer);
        if (externalSignal) {
            externalSignal.removeEventListener("abort", onExternalAbort);
        }
    }

    if (!response.ok) {
        if (response.status === 404) {
            throw new FetchFileNotFoundError(
                `文件不存在(path=${path}, status=404)`,
                404
            );
        }
        throw new FetchFileHttpError(
            `HTTP 错误(path=${path}, status=${response.status})`,
            response.status
        );
    }

    try {
        return await response.text();
    } catch (err) {
        throw new FetchFileReadError(
            `响应体读取失败(path=${path}): ${err.message}`,
            { cause: err }
        );
    }
}