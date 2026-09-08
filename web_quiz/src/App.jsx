import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import QuizViewer from "./components/QuizViewer.jsx";
import { style_App, style_ErrorBox, style_FetchBtn, style_Input } from "./styles.js";
import { useNatsFetch, QuizFetchError } from "./hooks/useNatsFetch.js";
import "./utils/str.js";

function App() {
    const [fileContent, setFileContent] = useState("");
    const [error, setError] = useState("");
    const [quizKey, setQuizKey] = useState(0); // 用于彻底销毁并重新初始化 QuizViewer
    const { status, loading, connError, fetch_quiz } = useNatsFetch();
    const [user, setUser] = useState("");
    const [quiz, setQuiz] = useState("");
    const [count, setCount] = useState(5);

    const isCountValid = count !== "" && Number.isInteger(count) && count > 0;
    const canFetch = !loading && user.trim() !== "" && quiz.trim() !== "" && isCountValid;

    const handleCountChange = (e) => {
        const value = e.target.value;
        if (value === "") {
            setCount(""); // 允许输入框暂时清空，而不是被 Number('') 强行变成 0
            return;
        }
        const n = Number(value);
        if (!Number.isNaN(n)) setCount(n);
    };

    const fetchQuiz = async () => {
        if (!canFetch) {
            setError("请先填写用户名、题库名称，并确保数量为正整数");
            return;
        }

        setError("");
        try {
            // 关键修复：原代码这里没有 try/catch，fetch_quiz 抛出的异常
            // 会变成未处理的 Promise rejection，用户完全看不到任何错误提示
            const text = await fetch_quiz(
                user,
                quiz,
                count,
                ["5b49629a-6811-41e7-8795-e222df05ae8c", "98a35889-0006-4dcd-993a-19d9dbcac979"],
                ["c881a4eb-f1cd-4838-b025-1c662b329135"]
            );
            setFileContent(text);
            setQuizKey((prev) => prev + 1); // 重新读取文件时也刷新组件
        } catch (err) {
            // useNatsFetch 内部已经把 NATS / 文件拉取的各种异常
            // 翻译成了可读的中文提示（并区分了 stage: request / fetch），直接展示即可
            const message = err instanceof QuizFetchError ? err.message : `未知错误: ${err?.message ?? err}`;
            setError(message);
            // 注意：这里不清空 fileContent —— 请求失败时不应该把用户上一次
            // 已经在做的题目清掉，只提示错误、保留原有内容
        }
    };

    // 彻底清空并重新初始化作答
    const handleResetQuiz = () => { setQuizKey((prev) => prev + 1); };

    return (
        <div style={style_App}>
            <h2>🚀 QUIZ for today</h2>

            {connError && (<p style={style_ErrorBox}> ⚠️ NATS 连接异常，部分功能可能不可用：{connError.message} </p>)}

            <input
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="用户名"
                style={{ ...style_Input, width: '150px' }}
                disabled={loading}
            />
            <input
                value={quiz}
                onChange={(e) => setQuiz(e.target.value)}
                placeholder="题库"
                style={{ ...style_Input, width: '150px' }}
                disabled={loading}
            />
            <input
                type="number"
                min="1"
                value={count}
                onChange={handleCountChange}
                style={{ ...style_Input, width: '50px' }}
                disabled={loading}
            />
            <button
                onClick={fetchQuiz}
                disabled={loading || !canFetch}
                style={{ ...style_Input, ...style_FetchBtn(loading), width: '120px' }}
            >
                {loading ? `⏳ 读取中... ${status}` : "📁 获取练习"}
            </button>

            {error && <p style={style_ErrorBox}>❌ {error}</p>}

            {/* 通过递增 key 彻底重置 DOM 和 State */}
            {fileContent && (
                <QuizViewer
                    key={quizKey}
                    user={user}
                    quiz={quiz}
                    fileContent={fileContent}
                    onReset={handleResetQuiz}
                />
            )}
        </div>
    );
}

const root = createRoot(document.getElementById("root"));
root.render(<React.StrictMode><App /></React.StrictMode>);
