import React, { useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import QuizViewer from "./components/QuizViewer.jsx";
import { styles as tw } from "./styles.js";
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

            setFileContent(text);
            setQuizKey((prev) => prev + 1); // 重新读取文件时也刷新组件

            // 开始作答，不可再更改用户输入
            setDisabledMap(prev => ({
                ...prev,
                usernameInput: true,
                quizSelect: !!text,
                countInput: !!text,
                submitBtn: !!text,
            }))

            setInfo(!text ? ` No quiz items for <${selectedQuiz}> need to do now` : "")

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
        // 开始作答后，不可再更改用户输入
        setDisabledMap(prev => ({
            ...prev,
            // usernameInput: false,
            quizSelect: false,
            countInput: false,
            submitBtn: false,
        }))
    };

    const refInputUser = useRef(null);
    const refSelectQuiz = useRef(null);

    return (
        <div className={tw.app}>
            <h2>🚀 QUIZ for today</h2>

            {connError && (<p className={tw.errBox}> ⚠️ NATS 连接异常，部分功能可能不可用：{connError.message} </p>)}

            <input
                ref={refInputUser}
                value={user}
                onChange={(e) => { setUser(e.target.value) }}
                onKeyDown={async (e) => {
                    if (e.key === 'Enter' || e.key === 'Tab') {
                        setQuizList(await list_quiz(e.target.value));
                        if (!hasQuizList) {
                            setSelectedQuiz(""); // 如果没有题库，清空上一次的选择
                            setFileContent(""); // 如果没有题库，清空上一次的作答内容
                            setInfo("");
                        }
                        e.target.blur();
                        if (refSelectQuiz.current) {
                            refSelectQuiz.current.focus();
                        }
                    }
                }}
                placeholder="输入用户名后回车"
                className={`${tw.input} w-45`}
                disabled={connError || loading || disabledMap.usernameInput}
            />

            <select
                key={user}
                ref={refSelectQuiz}
                value={selectedQuiz}
                onChange={(e) => setSelectedQuiz(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        if (typeof e.currentTarget.showPicker === 'function') {
                            e.currentTarget.showPicker();
                        }
                    }
                }}
                disabled={connError || loading || disabledMap.quizSelect}
                className={`${tw.input} w-50 rounded-sm`}
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
                className={`${tw.input} w-15`}
                disabled={connError || loading || !hasQuizList || !selectedQuiz || disabledMap.countInput}
            />

            <button
                onClick={fetchQuiz}
                disabled={connError || !canFetch || disabledMap.submitBtn}
                className={`${tw.input} ${tw.fetchBtn(canFetch && !disabledMap.submitBtn)} w-30`}
            >
                {loading ? `⏳ 读取中... ${status}` : "📁 获取练习"}
            </button>

            {info && !error && <p className={tw.infoBox}> 💬 {info}</p>}
            {error && !info && <p className={tw.errBox}> ❌ {error}</p>}

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
