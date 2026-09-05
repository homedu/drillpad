import { useState, useEffect, useCallback } from "react";
import { getNatsConnection, reqJSON, closeNats } from "../services/natsClient";
import { fetchFile } from "../services/fetchClient";

export function useNatsFetch() {
    const [status, setStatus] = useState("连接中...");
    const [loading, setLoading] = useState(true);

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
                }
            }
        }

        initNats();

        return () => {
            cancelled = true;
            // 注意:连接是单例,组件卸载不一定要关闭,见下方说明
            // closeNats();
        };
    }, []);

    const fetch_quiz = useCallback(async (count, ids_inc, ids_exc) => {
        const payload = {
            count,
            include: ids_inc,
            exclude: ids_exc,
        };
        setLoading(true);
        try {
            const result = await reqJSON("fetch-quiz", payload, { timeout: 10000 }); // change topic here
            // console.log(result.path);
            return await fetchFile(result.path);
        } catch (err) {
            if (err.code === "TIMEOUT") {
                return "REQ TIME OUT"
            } else {
                return "REQ ERROR"
            }
        } finally {
            setLoading(false);
        }
    }, []);

    return { status, loading, fetch_quiz };
}

if (import.meta.hot) {
    import.meta.hot.accept();
    import.meta.hot.dispose(() => {
        console.log('Cleaning up useNatsFetch...');
    });
}
