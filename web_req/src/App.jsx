import React, { useState, useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { style_App, style_ReqBtn, style_ReqStatus } from "./styles";
import LogViewer from "./components/LogViewer";
import { useNats } from "./hooks/useNats";

function App() {
    const { status, loading, logs, sendRequest } = useNats();
    const [count, setCount] = useState(5);
    return (
        <div style={style_App}>
            <h2>NATS Request 测试 (React JS)</h2>
            <div style={style_ReqStatus}>{status}</div>
            <input
                type="number"
                value={count}
                // 当用户修改输入时，更新状态（转为数字类型）
                onChange={(e) => setCount(Number(e.target.value))}
                style={{ marginRight: '10px', padding: '5px' }} // 简单样式，可自行调整
                disabled={loading}
            />
            <button onClick={() => sendRequest(
                count,
                ["5b49629a-6811-41e7-8795-e222df05ae8c", "98a35889-0006-4dcd-993a-19d9dbcac979"],
                ["c881a4eb-f1cd-4838-b025-1c662b329135"]
            )} disabled={loading} style={style_ReqBtn(loading)}>
                Request
            </button>
            <LogViewer logs={logs}></LogViewer>
        </div>
    );
}

const root = createRoot(document.getElementById("root"));
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
