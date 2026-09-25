import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { styles } from "./styles.js";

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
const createEmptyOptions = () =>
    Array.from({ length: OPTION_COUNT }, () => ({ text: "", isCorrect: false }));

// ============ 占位的后端通信函数，请自行替换为真实请求 ============
async function submitQuestionToServer(payload) {
    // 示例：
    // const res = await fetch("/api/questions", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify(payload),
    // });
    // if (!res.ok) throw new Error("提交失败");
    // return res.json();

    console.log("提交到题库的数据：", payload);
    return new Promise((resolve) => setTimeout(resolve, 500));
}
// ================================================================

export default function App() {
    const [question, setQuestion] = useState("");
    const [options, setOptions] = useState(createEmptyOptions());
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState(null); // { type: "success" | "error", text: string }

    const handleOptionTextChange = (index, value) => {
        setOptions((prev) =>
            prev.map((opt, i) => (i === index ? { ...opt, text: value } : opt))
        );
    };

    const handleOptionCheck = (index) => {
        setOptions((prev) =>
            prev.map((opt, i) =>
                i === index ? { ...opt, isCorrect: !opt.isCorrect } : opt
            )
        );
    };

    const resetForm = () => {
        setQuestion("");
        setOptions(createEmptyOptions());
        setMessage(null);
    };

    const validate = () => {
        if (!question.trim()) {
            return "请输入题目内容";
        }
        const emptyOption = options.some((opt) => !opt.text.trim());
        if (emptyOption) {
            return "请填写全部 8 个选项内容";
        }
        const correctCount = options.filter((opt) => opt.isCorrect).length;
        if (correctCount === 0) {
            return "请至少勾选一个正确答案";
        }
        return null;
    };

    const handleSubmit = async () => {
        const error = validate();
        if (error) {
            setMessage({ type: "error", text: error });
            return;
        }

        const payload = {
            question: question.trim(),
            options: options.map((opt, i) => ({
                index: i,
                text: opt.text.trim(),
                isCorrect: opt.isCorrect,
            })),
        };

        setSubmitting(true);
        setMessage(null);
        try {
            await submitQuestionToServer(payload);
            setMessage({ type: "success", text: "提交成功！" });
            resetForm();
        } catch (err) {
            setMessage({ type: "error", text: "提交失败，请重试" });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={styles.container}>
            <h2 style={styles.title}>选择题录入</h2>

            <label style={styles.label}>题目</label>
            <textarea
                style={styles.textarea}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="请输入题目内容"
                rows={3}
            />

            <label style={styles.label}>选项（勾选表示该项为正确答案）</label>
            <div style={styles.optionsList}>
                {options.map((opt, index) => (
                    <div key={index} style={styles.optionRow}>
                        <span style={styles.optionIndex}>{String.fromCharCode(65 + index)}</span>
                        <input
                            style={styles.optionInput}
                            type="text"
                            value={opt.text}
                            onChange={(e) => handleOptionTextChange(index, e.target.value)}
                            placeholder={`选项 ${index + 1} 内容`}
                        />
                        <label style={styles.checkLabel}>
                            <input
                                type="checkbox"
                                checked={opt.isCorrect}
                                onChange={() => handleOptionCheck(index)}
                            />
                            <span style={{ marginLeft: 4 }}>正确</span>
                        </label>
                    </div>
                ))}
            </div>

            {message && (
                <div
                    style={{
                        ...styles.message,
                        color: message.type === "error" ? "#b91c1c" : "#15803d",
                    }}
                >
                    {message.text}
                </div>
            )}

            <div style={styles.buttonRow}>
                <button
                    style={{ ...styles.button, ...styles.primaryButton }}
                    onClick={handleSubmit}
                    disabled={submitting}
                >
                    {submitting ? "提交中..." : "提交"}
                </button>
                <button
                    style={{ ...styles.button, ...styles.secondaryButton }}
                    onClick={resetForm}
                    disabled={submitting}
                >
                    清空
                </button>
            </div>
        </div>
    );
}

const root = createRoot(document.getElementById("root"));
root.render(<React.StrictMode><App /></React.StrictMode>);