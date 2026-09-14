import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import QuizViewer from "./components/QuizViewer.jsx";
import { style_App, style_ErrorBox, style_InfoBox, style_FetchBtn, style_Input } from "./styles.js";
import { useNatsFetch, QuizFetchError, QuizListError } from "./hooks/useNatsFetch.js";
import "./utils/str.js";

function App() {
    const [fileContent, setFileContent] = useState("");
    const [info, setInfo] = useState("");
    const [error, setError] = useState("");
    const [quizKey, setQuizKey] = useState(0); // 用于彻底销毁并重新初始化 QuizViewer
    const { status, loading, connError, fetch_quiz, list_quiz } = useNatsFetch();

    const [user, setUser] = useState("");
    const [quizList, setQuizList] = useState([]);
    const [selectedQuiz, setSelectedQuiz] = useState('');
    const [count, setCount] = useState(10);

    const [disabledMap, setDisabledMap] = useState({
        usernameInput: false,  // 用户名输入框
        quizSelect: false,     // 题目下拉框
        countInput: false,     // 题目数量输入框
        submitBtn: false       // 提交按钮
    });

    const isCountValid = count !== "" && Number.isInteger(count) && count > 0;
    const hasQuizList = quizList?.length > 0;
    const canFetch = !loading && user.trim() !== "" && hasQuizList && selectedQuiz.trim() !== "" && isCountValid;

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
                selectedQuiz,
                count,
            );

            if (!text) {
                setInfo(` No quiz items for <${selectedQuiz}> need to do now`)
                return
            }

            setFileContent(text);
            setQuizKey((prev) => prev + 1); // 重新读取文件时也刷新组件

            // 开始作答，不可再更改用户输入
            setDisabledMap(prev => ({
                ...prev,
                usernameInput: true,
                quizSelect: true,
                countInput: true,
                submitBtn: true,
            }))

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
    const handleOnSubmit = () => {
        // 开始作答，不可再更改用户输入
        setDisabledMap(prev => ({
            ...prev,
            // usernameInput: false,
            quizSelect: false,
            countInput: false,
            submitBtn: false,
        }))
    };

    return (
        <div style={style_App}>
            <h2>🚀 QUIZ for today</h2>

            {connError && (<p style={style_ErrorBox}> ⚠️ NATS 连接异常，部分功能可能不可用：{connError.message} </p>)}

            <input
                value={user}
                onChange={(e) => { setUser(e.target.value) }}
                // onBlur={async (e) => { setQuizList(await list_quiz(e.target.value)); }}

                onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                        setQuizList(await list_quiz(e.target.value));
                        if (!hasQuizList) {
                            setSelectedQuiz(""); // 如果没有题库，清空上一次的选择
                            setFileContent(""); // 如果没有题库，清空上一次的作答内容
                        }
                        e.target.blur();
                    }
                }}
                placeholder="输入用户名选择题目"
                style={{ ...style_Input, width: '180px' }}
                disabled={loading || disabledMap.usernameInput}
            />

            <select
                key={user}
                value={selectedQuiz}
                onChange={(e) => setSelectedQuiz(e.target.value)}
                disabled={loading || !hasQuizList || disabledMap.quizSelect}
                style={{ ...style_Input, width: '200px', borderRadius: '4px' }}
            >
                {hasQuizList && (
                    <>
                        <option value="" disabled hidden>选择题目</option>
                        {quizList.map((item, index) => (<option key={index} value={item}>{item}</option>))}
                    </>
                )}
            </select>

            <input
                type="number"
                min="1"
                value={count}
                onChange={handleCountChange}
                style={{ ...style_Input, width: '60px' }}
                disabled={loading || !hasQuizList || !selectedQuiz || disabledMap.countInput}
            />

            <button
                onClick={fetchQuiz}
                disabled={!canFetch || disabledMap.submitBtn}
                style={{ ...style_Input, ...style_FetchBtn(canFetch && !disabledMap.submitBtn), width: '120px' }}
            >
                {loading ? `⏳ 读取中... ${status}` : "📁 获取练习"}
            </button>

            {info && !error && <p style={style_InfoBox}> 💬 {info}</p>}
            {error && !info && <p style={style_ErrorBox}> ❌ {error}</p>}

            {/* 通过递增 key 彻底重置 DOM 和 State */}
            {hasQuizList && selectedQuiz && fileContent && (
                <QuizViewer
                    key={quizKey}
                    user={user}
                    quiz={selectedQuiz}
                    fileContent={fileContent}
                    onReset={handleResetQuiz}
                    onSubmit={handleOnSubmit}
                />
            )}
        </div>
    );
}

const root = createRoot(document.getElementById("root"));
root.render(<React.StrictMode><App /></React.StrictMode>);
