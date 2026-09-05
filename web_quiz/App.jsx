import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import QuizViewer from "./components/QuizViewer.jsx";
import { style_App, style_ErrorBox, style_FetchBtn } from "./styles.js";

function App() {
    const [fileContent, setFileContent] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [quizKey, setQuizKey] = useState(0); // 用于彻底销毁并重新初始化 QuizViewer

    const CADDY_URL = "http://192.168.1.159:8080/qmiao/quiz_gen/AZ-900.tsv";

    const fetchCaddyFile = async () => {
        setLoading(true);
        setError("");
        try {
            const timestamp = Date.now();
            const response = await fetch(CADDY_URL + `?v=${timestamp}`, { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP 错误: ${response.status}`);
            const text = await response.text();
            setFileContent(text);
            setQuizKey((prev) => prev + 1); // 重新读取文件时也刷新组件
        } catch (err) {
            setError(err.message || "请求失败，请检查 Caddy 跨域设置");
        } finally {
            setLoading(false);
        }
    };

    // 彻底清空并重新初始化作答
    const handleResetQuiz = () => {
        setQuizKey((prev) => prev + 1);
    };

    return (
        <div style={style_App}>
            <h2>🚀 QUIZ for today</h2>
            <button onClick={fetchCaddyFile} disabled={loading} style={style_FetchBtn(loading)}>
                {loading ? "⏳ 读取中..." : "📁 获取文件"}
            </button>
            {error && <p style={style_ErrorBox}>❌ {error}</p>}

            {/* 通过递增 key 彻底重置 DOM 和 State */}
            {fileContent && (
                <QuizViewer
                    key={quizKey}
                    fileContent={fileContent}
                    onReset={handleResetQuiz}
                />
            )}
        </div>
    );
}

const root = createRoot(document.getElementById("root"));
root.render(<React.StrictMode><App /></React.StrictMode>);
