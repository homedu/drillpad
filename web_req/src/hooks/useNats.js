import { useState, useEffect, useRef, useCallback } from "react";
import { getNatsConnection, requestJson, closeNats } from "../services/natsClient";

export function useNats() {
    const [status, setStatus] = useState("连接中...");
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState([]);

    const seqRef = useRef(0);

    const addLog = useCallback((ok, text, detail) => {
        const newEntry = {
            id: Date.now() + Math.random(),
            ok,
            time: new Date().toLocaleTimeString(),
            text,
            detail,
        };
        setLogs((prev) => [newEntry, ...prev]);
    }, []);

    useEffect(() => {
        let cancelled = false;

        async function initNats() {
            try {
                const nc = await getNatsConnection();
                if (cancelled) return;

                setStatus("已连接 NATS");
                setLoading(false);

                (async () => {
                    for await (const statusEvent of nc.status()) {
                        if (cancelled) break;
                        setStatus(`连接状态: ${statusEvent.type}`);
                        if (statusEvent.type === "disconnect" || statusEvent.type === "error") { setLoading(true); }
                        if (statusEvent.type === "reconnect") { setLoading(false); }
                    }
                })();
            } catch (err) {
                if (!cancelled) {
                    setStatus("连接失败");
                    addLog(false, "初始连接失败", String(err));
                }
            }
        }

        initNats();

        return () => {
            cancelled = true;
            // 注意:连接是单例,组件卸载不一定要关闭,见下方说明
            // closeNats();
        };
    }, [addLog]);

    const sendRequest = useCallback(async (count, ids_inc, ids_exc) => {
        seqRef.current += 1;
        const currentSeq = seqRef.current;
        const payload = {
            orderId: currentSeq,
            count,
            include: ids_inc,
            exclude: ids_exc,
        };

        setLoading(true);
        try {
            const result = await requestJson("fetch-quiz", payload, { timeout: 10000 }); // change topic here
            addLog(true, `请求 #${currentSeq} 成功`, result);
        } catch (err) {
            if (err.code === "TIMEOUT") {
                addLog(false, `请求 #${currentSeq} 超时`);
            } else {
                addLog(false, `请求 #${currentSeq} 失败`, String(err));
            }
        } finally {
            setLoading(false);
        }
    }, [addLog]);

    return { status, loading, logs, sendRequest };
}

if (import.meta.hot) {
    import.meta.hot.accept();
    import.meta.hot.dispose(() => {
        console.log('Cleaning up useNats...');
    });
}
