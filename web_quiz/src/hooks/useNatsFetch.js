import { useState, useEffect, useCallback } from "react";
import { T_QUIZ_LIST, T_QUIZ_FETCH, T_ANS_REC } from "./topic";
import {
    getNatsConnection,
    reqNATS,
    closeNats,
    NatsConnectError,
    NatsNotConnectedError,
    NatsRequestTimeoutError,
    NatsNoRespondersError,
    NatsRequestFailedError,
    NatsResponseParseError,
} from "../services/natsClient";
import {
    fetchFile,
    FetchFileInvalidPathError,
    FetchFileTimeoutError,
    FetchFileNetworkError,
    FetchFileNotFoundError,
    FetchFileHttpError,
    FetchFileReadError,
} from "../services/fetchClient";

/**
 * fetch_quiz 统一抛出的错误类型。
 * - stage: "request" 表示 NATS 请求路径失败，"fetch" 表示文件拉取失败
 * - cause: 保留 natsClient / fetchClient 抛出的原始分类错误，
 *          组件里仍然可以 `err.cause instanceof NatsRequestTimeoutError` 做精确判断
 */
export class QuizFetchError extends Error {
    constructor(message, stage, options = {}) {
        super(message, options);
        this.name = "QuizFetchError";
        this.stage = stage;
    }
}

export class QuizListError extends Error {
    constructor(message, stage, options = {}) {
        super(message, options);
        this.name = "QuizListError";
        this.stage = stage;
    }
}

export class AnswerRecordError extends Error {
    constructor(message, stage, options = {}) {
        super(message, options);
        this.name = "AnswerRecordError";
        this.stage = stage;
    }
}

// 把两个 client 抛出的分类错误翻译成人可读的中文提示，用于 message / UI 展示
function describeError(err) {
    if (err instanceof NatsConnectError) return "无法连接 NATS 服务器";
    if (err instanceof NatsNotConnectedError) return "NATS 连接不可用，请稍后重试";
    if (err instanceof NatsRequestTimeoutError) return "请求超时";
    if (err instanceof NatsNoRespondersError) return "没有服务在处理该请求";
    if (err instanceof NatsResponseParseError) return "响应内容格式错误";
    if (err instanceof NatsRequestFailedError) return "请求失败";
    if (err instanceof FetchFileInvalidPathError) return "文件路径非法";
    if (err instanceof FetchFileTimeoutError) return "文件拉取超时";
    if (err instanceof FetchFileNetworkError) return "文件拉取网络错误";
    if (err instanceof FetchFileNotFoundError) return "文件不存在";
    if (err instanceof FetchFileHttpError) return `文件拉取失败(HTTP ${err.status})`;
    if (err instanceof FetchFileReadError) return "文件内容读取失败";
    return err?.message ?? String(err);
}

export function useNatsFetch() {
    const [status, setStatus] = useState("连接中...");
    const [loading, setLoading] = useState(true);
    // 连接层面的错误（建连失败 / 状态监听中断），供 UI 展示用，
    // 与 fetch_quiz 抛出的 QuizFetchError 是两回事，互不覆盖
    const [connError, setConnError] = useState(null);

    useEffect(() => {
        let cancelled = false;

        async function initNats() {
            try {
                const nc = await getNatsConnection();
                if (cancelled) return;
                setStatus("已连接 NATS");
                setConnError(null);
                setLoading(false);

                (async () => {
                    try {
                        for await (const statusEvent of nc.status()) {
                            if (cancelled) break;
                            setStatus(`连接状态: ${statusEvent.type}`);
                            if (statusEvent.type === "disconnect" || statusEvent.type === "error") {
                                setLoading(true);
                            }
                            if (statusEvent.type === "reconnect") {
                                setLoading(false);
                                setConnError(null);
                            }
                        }
                    } catch (err) {
                        // status() 迭代器异常终止，说明连接已经彻底不可用了，
                        // 原代码这里没有 catch，会变成未处理的 rejection
                        if (!cancelled) {
                            setStatus("连接监听中断");
                            setConnError(err);
                            setLoading(true);
                        }
                    }
                })();
            } catch (err) {
                // getNatsConnection 失败时会抛 NatsConnectError
                if (!cancelled) {
                    setStatus("连接失败");
                    setConnError(err);
                    setLoading(false);
                }
            }
        }

        initNats();

        return () => {
            cancelled = true;
            // 注意：连接是单例，组件卸载不代表要关闭连接 —— 别的组件可能还在用。
            // 只有在确定整个应用退出 / 彻底离开该功能模块时才调用 closeNats()。
            // closeNats();
        };
    }, []);

    const fetch_quiz = useCallback(async (user, quiz, count) => {
        const payload = {
            user,
            quiz,
            count,
        };

        let path = "";

        // 1) 通过 NATS 请求获取文件路径
        setLoading(true);
        try {
            const result = await reqNATS(T_QUIZ_FETCH, payload, { timeout: 10000 });
            if (result === null || !result.path) {
                // 请求成功但响应内容不符合预期，也算作一种"响应格式错误"
                throw new NatsResponseParseError(
                    "响应中缺少 path 字段",
                    JSON.stringify(result)
                );
            }
            path = result.path;
        } catch (err) {
            throw new QuizFetchError(
                `获取题目路径失败: ${describeError(err)}`,
                "request",
                { cause: err }
            );
        } finally {
            setLoading(false);
        }

        // 2) 用拿到的 path 去 Caddy 拉取实际文件内容
        setLoading(true);
        try {
            return await fetchFile(path);
        } catch (err) {
            throw new QuizFetchError(
                `拉取题目文件失败: ${describeError(err)}`,
                "fetch",
                { cause: err }
            );
        } finally {
            setLoading(false);
        }
    }, []);

    const record_answer = useCallback(async (user, quiz, ids_correct, ids_incorrect, ids_blank) => {
        const payload = {
            user,
            quiz,
            correct: ids_correct,
            incorrect: ids_incorrect,
            blank: ids_blank,
        };

        setLoading(true);
        try {
            const result = await reqNATS(T_ANS_REC, payload, { timeout: 10000 });
            if (result === null || !result.status) {
                // 请求成功但响应内容不符合预期，也算作一种"响应格式错误"
                throw new NatsResponseParseError(
                    "响应中缺少 status 字段",
                    JSON.stringify(result)
                );
            }
        } catch (err) {
            throw new AnswerRecordError(
                `记录答题结果失败: ${describeError(err)}`,
                "request",
                { cause: err }
            );
        } finally {
            setLoading(false);
        }
    }, []);

    const list_quiz = useCallback(async (user) => {
        const payload = user;
        setLoading(true);
        try {
            const result = await reqNATS(T_QUIZ_LIST, payload, { timeout: 10000 });
            if (!Array.isArray(result)) {
                throw new NatsResponseParseError(
                    "返回非数组,格式错误",
                    JSON.stringify(result)
                );
            };
            return result
        } catch (err) {
            throw new QuizListError(
                `获取题目列表失败: ${describeError(err)}`,
                "request",
                { cause: err }
            );
        } finally {
            setLoading(false);
        }
    });

    return { status, loading, connError, fetch_quiz, record_answer, list_quiz };
}

if (import.meta.hot) {
    import.meta.hot.accept();
    import.meta.hot.dispose(() => {
        console.log("Cleaning up useNatsFetch...");
    });
}