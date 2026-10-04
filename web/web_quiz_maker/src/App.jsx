import React, { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { cn } from "../../utils/utils.js"
import "../../utils/util_str.js";
import { styles as tw } from "./styles.js";
import { useNatsFetch, QuizListError } from "../../net_service/useNatsFetch.js";

/**
 * QuestionUploadForm
 * -------------------
 * 选择题录入表单：
 *  - 1 个题干输入框
 *  - 8 个选项输入框，每个选项后有一个"正确答案"复选框
 *  - 提交按钮：整理数据后调用 submitQuestionToServer()（占位函数，需自行接入后端）
 *  - 清空按钮：重置所有输入
 */

const OPTION_COUNT = 8;

// 生成初始选项数组：[{ text: "", isCorrect: false }, ...]
const createEmptyOptions = () => Array.from({ length: OPTION_COUNT }, () => ({ text: "", isCorrect: false }));

function App() {

    const [info, setInfo] = useState("");
    const [error, setError] = useState("");
    const { loading, connError, list_quiz, count_qa, search_question, make_quiz } = useNatsFetch();

    const [user, setUser] = useState("");
    const [quizList, setQuizList] = useState([]);
    const [selectedQuiz, setSelectedQuiz] = useState('');
    const [questionCount, setQuestionCount] = useState(0);
    const [qid, setQid] = useState("");

    const [question, setQuestion] = useState("");
    const [options, setOptions] = useState(createEmptyOptions());
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState(null); // { type: "success" | "error", text: string }

    const hasQuizList = quizList?.length > 0;

    const handleOptionTextChange = (index, value) => {
        setOptions((prev) =>
            prev.map((opt, i) =>
                i !== index ? opt : {
                    ...opt,
                    text: value,
                    isCorrect: value.trim() ? opt.isCorrect : false,// 内容被清空时，自动取消该选项的"正确答案"勾选
                }
            )
        );
    };

    const handleOptionCheck = (index) => {
        setOptions((prev) =>
            prev.map((opt, i) => {
                if (i !== index) return opt;
                // 内容为空时不允许勾选
                if (!opt.text.trim()) return opt;
                return { ...opt, isCorrect: !opt.isCorrect };
            })
        );
    };

    const resetForm = () => {
        setQuestion("");
        setOptions(createEmptyOptions());
        setMessage(null);
        setError("");
        setInfo("");
    };

    const validate = () => {
        if (!question.trim()) return "请输入题目内容";

        const emptyOption = options.every((opt) => !opt.text.trim());
        if (emptyOption) return "请填写合理数量的选项内容";

        const correctCount = options.filter((opt) => opt.isCorrect).length;
        if (correctCount === 0) return "请至少勾选一个正确答案";

        return null;
    };

    const handleSubmit = async () => {
        const error = validate();
        if (error) {
            setMessage({ type: "error", text: error });
            return;
        }

        const opts = options.filter((opt) => opt.text.trim()).map((opt) => opt.text);
        const answers = options.filter((opt) => opt.isCorrect).map((opt) => opt.text);
        const type = answers.length > 1 ? "MS" : "MCSA";

        setSubmitting(true);
        setMessage(null);
        try {
            await make_quiz(user, selectedQuiz, type, question, opts, answers);
            setMessage({ type: "success", text: "提交成功！" });
            resetForm();
            setQuestionCount(await count_qa(user, selectedQuiz, "question_count"));
        } catch (err) {
            setMessage({ type: "error", text: "提交失败，请重试" });
        } finally {
            setSubmitting(false);
        }
    };

    const handleQuestionSearch = async () => {
        if (!user || !selectedQuiz || !qid.trim().isValidGuid()) {
            setError("请输入有效的'用户名', '题库'和 'Question ID'");
            setInfo("");
            return;
        }
        try {
            const result = await search_question(user, selectedQuiz, qid.trim());
            if (result.status === "success") {
                const [qId, qText, ...qOptions] = result.question.split("\t");
                setQuestion(qText);
                setOptions(createEmptyOptions().map((opt, index) => ({
                    text: qOptions[index] || "",
                    isCorrect: qOptions[index] ? qOptions[index] === qOptions[8] : false, // 第9列开始是正确答案
                })));
                setInfo("题目搜索成功");
                setError("");
            } else if (result.status === "failure") {
                resetForm();                
                setError("搜索题目失败");
            }
        } catch (err) {
            setError("搜索题目失败");
        }
    };

    const refInputUser = useRef(null);
    const refSelectQuiz = useRef(null);

    useEffect(() => {
        (async () => user && selectedQuiz && setQuestionCount(await count_qa(user, selectedQuiz, "question_count")))();
    }, [user, selectedQuiz]);

    return (
        <div className={tw.container}>

            {connError && (<p className={tw.errBox}> ⚠️ NATS 连接异常，部分功能可能不可用：{connError.message} </p>)}

            <h2 className={tw.title}>选择题录入</h2>

            <div className="flex items-center">

                <input
                    ref={refInputUser}
                    value={user}
                    onChange={(e) => { setUser(e.target.value) }}
                    onKeyDown={async (e) => {
                        if (e.key === 'Enter' || e.key === 'Tab') {
                            setQuizList(await list_quiz(e.target.value));
                            if (!hasQuizList) {
                                setSelectedQuiz(""); // 如果没有题库，清空上一次的选择
                                setInfo("");
                            }
                            e.target.blur();
                            if (refSelectQuiz.current) {
                                refSelectQuiz.current.focus();
                            }
                        }
                    }}
                    placeholder="用户名"
                    className={cn(tw.input, "w-45")}
                    disabled={connError || loading}
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
                    disabled={connError || loading}
                    className={cn(tw.input, "w-50", "rounded-sm")}
                >
                    {hasQuizList && (
                        <>
                            <option value="" disabled hidden>选择题目</option>
                            {quizList.map((item, index) => (<option key={index} value={item}>{item}</option>))}
                        </>
                    )}
                </select>

                {questionCount > 0 && <label className={cn(tw.label, "ml-auto")}> 已录入 {questionCount} 道题目 </label>}

            </div>

            <div className="flex items-center justify-end gap-2 mt-3">
                <input
                    type="text"
                    value={qid}
                    onChange={(e) => setQid(e.target.value)}
                    placeholder="Question ID"
                    className="w-80 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />

                <button
                    onClick={handleQuestionSearch}
                    disabled={!user || !selectedQuiz || !qid.trim().isValidGuid()}
                    className={cn(tw.button, tw.primaryButton, (!user || !selectedQuiz || !qid.trim().isValidGuid()) && "opacity-50 cursor-not-allowed")}
                >
                    搜索
                </button>
            </div>

            {info && !error && <p className={tw.infoBox}> 💬 {info}</p>}
            {error && !info && <p className={tw.errBox}> ❌ {error}</p>}

            {/*  */}

            <label className={cn(tw.label, "block")}>题目</label>
            <textarea
                className={tw.textarea}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="请输入题目内容"
                rows={3}
            />

            <label className={cn(tw.label, "block")}>选项（勾选表示该项为正确答案）</label>
            <div className={tw.optionsList}>
                {options.map((opt, index) => (
                    <div key={index} className={tw.optionRow}>
                        <span className={tw.optionIndex}>{String.fromCharCode(65 + index)}</span>
                        <input
                            className={tw.optionInput}
                            type="text"
                            value={opt.text}
                            onChange={(e) => handleOptionTextChange(index, e.target.value)}
                            placeholder={`选项 ${index + 1} 内容`}
                        />
                        <label className={tw.checkLabel(!opt.text.trim())} title={opt.text.trim() ? "" : "请先填写选项内容"}>
                            <input
                                type="checkbox"
                                checked={opt.isCorrect}
                                disabled={!opt.text.trim()}
                                onChange={() => handleOptionCheck(index)}
                            />
                            <span style={{ marginLeft: 4 }}>正确</span>
                        </label>
                    </div>
                ))}
            </div>

            {
                message && (
                    <div className={cn(tw.message, message.type === "error" && "text-[#B91C1C]")}>
                        {message.text}
                    </div>
                )
            }

            <div className={tw.buttonRow}>
                <button className={cn(tw.button, tw.primaryButton)} onClick={handleSubmit} disabled={submitting}>
                    {submitting ? "提交中..." : "提交"}
                </button>
                <button className={cn(tw.button, tw.secondaryButton)} onClick={resetForm} disabled={submitting}>
                    清空
                </button>
            </div>
        </div>
    );
}

const root = createRoot(document.getElementById("root"));
root.render(<React.StrictMode><App /></React.StrictMode>);