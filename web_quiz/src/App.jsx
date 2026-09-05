import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import QuizViewer from "./components/QuizViewer.jsx";
import { style_App, style_ErrorBox, style_FetchBtn } from "./styles.js";
import { useNatsFetch } from "./hooks/useNatsFetch.js";
import "./utils/str.js"

function App() {
    const [fileContent, setFileContent] = useState("");
    const [error, setError] = useState("");
    const [quizKey, setQuizKey] = useState(0); // 用于彻底销毁并重新初始化 QuizViewer
    const { status, loading, fetch_quiz } = useNatsFetch();
    const [count, setCount] = useState(5);

    const fetchQuiz = async () => {
        setError("");
        try {
            const text = await fetch_quiz(
                count,
                ["5b49629a-6811-41e7-8795-e222df05ae8c", "98a35889-0006-4dcd-993a-19d9dbcac979"],
                ["c881a4eb-f1cd-4838-b025-1c662b329135"]
            )
            setFileContent(text);
            setQuizKey((prev) => prev + 1); // 重新读取文件时也刷新组件
        } catch (err) {
            setError(err.message || "请求失败，请检查 Nats 或 Caddy 设置");
        } finally {
        }
    };

    // 彻底清空并重新初始化作答
    const handleResetQuiz = () => {
        setQuizKey((prev) => prev + 1);
    };

    return (
        <div style={style_App}>
            <h2>🚀 QUIZ for today</h2>
            <input
                type="number"
                value={count}
                // 当用户修改输入时，更新状态（转为数字类型）
                onChange={(e) => setCount(Number(e.target.value))}
                style={{ marginRight: '10px', padding: '5px' }} // 简单样式，可自行调整
                disabled={loading}
            />
            <button onClick={fetchQuiz} disabled={loading} style={style_FetchBtn(loading)}>
                {loading ? `⏳ 读取中... ${status}` : "📁 获取文件"}
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
