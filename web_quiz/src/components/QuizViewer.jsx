import { useMemo, useState, useCallback, useEffect } from "react";
import { style_Card, style_Option, style_OptionsContainer, style_Question, style_ResetBtn, style_SubmitBtn } from "./styles.js";
import { useNatsFetch, AnswerRecordError } from "../hooks/useNatsFetch.js";

// 选择题渲染与交互组件
export default function QuizViewer({ user, quiz, fileContent, onReset }) {
    const [userAnswers, setUserAnswers] = useState({});
    const [submitted, setSubmitted] = useState(false);
    const { record_answer } = useNatsFetch();

    // 1. 解析 TSV 格式数据
    const questions = useMemo(() => {
        if (!fileContent) return [];
        return fileContent
            .trim()
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .map((line) => {
                const fields = line.split("\t").map((f) => f.trim());
                // 索引含义：0: GUID; 1: 题干; 2-9: A-H 选项内容, 10-17: 答案内容; 20: REF ID
                const [id, question, optA, optB, optC, optD, optE, optF, optG, optH, ans1, ans2, ans3, ans4, ans5, ans6, ans7, ans8, _1, _2, ref_id] = fields;
                return {
                    id,
                    question,
                    options: [
                        { label: "A", text: optA },
                        { label: "B", text: optB },
                        { label: "C", text: optC },
                        { label: "D", text: optD },
                    ].filter((opt) => opt.text),
                    correctAnswer: ans1 || undefined,
                };
            });
    }, [fileContent]);

    // 2. 选择选项
    const handleSelect = (questionId, optionObj) => {
        if (submitted) return;
        setUserAnswers((prev) => ({
            ...prev,
            [questionId]: optionObj,
        }));
    };

    // 3. 计算得分
    const score = useMemo(() => {
        if (!submitted) return 0;
        return questions.reduce((acc, q) => {
            const userChoice = userAnswers[q.id];
            if (q.correctAnswer && userChoice && userChoice.text.trim() === q.correctAnswer.trim()) {
                return acc + 1;
            }
            return acc;
        }, 0);
    }, [submitted, questions, userAnswers]);

    if (!questions.length) {
        return (
            <p style={{ color: "#666", marginTop: "20px" }}>⚠️ 未解析到有效题目内容，请检查文件格式。</p>
        );
    }

    // 统计答案
    const { ids_correct, ids_incorrect, ids_blank } = useMemo(() => {
        const correct = [];
        const incorrect = [];
        const blank = [];
        if (submitted) {
            questions.forEach((q) => {
                const userChoice = userAnswers[q.id];
                if (!userChoice) {
                    blank.push(q.id);
                } else if (q.correctAnswer && userChoice.text.trim() === q.correctAnswer.trim()) {
                    correct.push(q.id);
                } else {
                    incorrect.push(q.id);
                }
            });
        }
        return { ids_correct: correct, ids_incorrect: incorrect, ids_blank: blank };
    }, [submitted, questions, userAnswers]);

    useEffect(() => {
        if (submitted) {
            // console.log("correct", ids_correct);
            // console.log("wrong", ids_incorrect);
            // console.log("blank", ids_blank);
            // console.log("user", user);
            // console.log("quiz", quiz);

            try {
                record_answer(user, quiz, ids_correct, ids_incorrect, ids_blank).then((result) => {
                    console.log(JSON.stringify(result));
                })
            } catch (err) {
                const message = err instanceof AnswerRecordError ? err.message : `未知错误: ${err?.message ?? err}`
            }
        }
    }, [submitted, ids_correct, ids_incorrect, ids_blank]);

    const handleSubmit = useCallback(() => { setSubmitted(true) }, []);

    return (
        <div style={{ marginTop: "24px" }}>

            {questions.map((q, index) => {
                const selected = userAnswers[q.id];
                const isCorrect = submitted && selected && q.correctAnswer && selected.text.trim() === q.correctAnswer.trim();
                const isWrong = submitted && selected && q.correctAnswer && selected.text.trim() !== q.correctAnswer.trim();

                return (
                    <div key={q.id} style={style_Card}>
                        <h3 style={style_Question}> {index + 1}. {q.question} </h3>

                        <div style={style_OptionsContainer}>
                            {q.options.map((opt) => {
                                const isOptionSelected = selected?.label === opt.label;
                                const isThisOptionCorrect = q.correctAnswer && opt.text.trim() === q.correctAnswer.trim();
                                const optionStyle = style_Option({ submitted, isOptionSelected, isThisOptionCorrect, });
                                return (
                                    <label key={opt.label} style={optionStyle}>
                                        <input
                                            type="radio"
                                            name={`question-${q.id}`}
                                            value={opt.label}
                                            checked={!!isOptionSelected} // 确保转为纯布尔值
                                            disabled={submitted}
                                            onChange={() => handleSelect(q.id, opt)}
                                            style={{ marginRight: "10px" }}
                                        />
                                        <strong style={{ marginRight: "8px" }}>{opt.label}.</strong>
                                        <span>{opt.text}</span>
                                    </label>
                                );
                            })}
                        </div>

                        {submitted && q.correctAnswer && (
                            <div style={{ marginTop: "12px", fontSize: "14px" }}>
                                {isCorrect && (<span style={{ color: "#28a745", fontWeight: "bold" }}> ✓ 正确 </span>)}
                                {isWrong && (<span style={{ color: "#dc3545" }}> ✕ 错误 正确答案：<strong> {q.correctAnswer} </strong> </span>)}
                                {!selected && (<span style={{ color: "#6c757d" }}> 未作答 正确答案：<strong> {q.correctAnswer} </strong> </span>)}
                            </div>
                        )}
                    </div>
                );
            })}

            <div style={{ marginTop: "20px", display: "flex", alignItems: "center", gap: "16px" }}>
                {!submitted
                    ? (<button onClick={handleSubmit} style={style_SubmitBtn}> 提交答案 </button>)
                    : (<>
                        <button onClick={onReset} style={style_ResetBtn}> 重新作答 </button>
                        <div style={{ fontSize: "18px", fontWeight: "bold", color: "#24292e" }}> 最终得分：{score} / {questions.length} </div>
                    </>)
                }
            </div>

        </div>
    );
}
