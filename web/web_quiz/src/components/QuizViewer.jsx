import { useMemo, useState, useCallback } from "react";
import { styles as tw } from "./styles.js";
import { useNatsFetch, AnswerRecordError } from "../../../net_service/useNatsFetch.js";

// 选择题渲染与交互组件
export default function QuizViewer({ user, quiz, fileContent, onSubmit, onReset }) {
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
                // 索引含义：0: GUID; 1: 题干; 2-9: A-H选项内容; 10-17: 答案内容; 18: ref_id; 19: prompt_id; 20: note_id; 21: quiz_type
                const [id, question, optA, optB, optC, optD, optE, optF, optG, optH, ans1, _ans2, _ans3, _ans4, _ans5, _ans6, _ans7, _ans8, ref_id, prompt_id, note_id, quiz_type] = fields;
                if (quiz_type === "MCSA" && ans1) {
                    return {
                        id,
                        question,
                        options: [
                            { label: "A", text: optA },
                            { label: "B", text: optB },
                            { label: "C", text: optC },
                            { label: "D", text: optD },
                            { label: "E", text: optE },
                            { label: "F", text: optF },
                            { label: "G", text: optG },
                            { label: "H", text: optH },
                        ].filter((opt) => opt.text),
                        correctAnswer: ans1
                    };
                }
                return null;
            })
            .filter(Boolean);
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

    // 4. 提交答案
    const handleSubmit = useCallback(async () => {
        // 统计答案, 根据当前 userAnswers 直接计算答案分类
        const correct = [];
        const incorrect = [];
        const blank = [];

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

        // 先让 UI 进入“已提交”状态
        setSubmitted(true);

        try {
            // 等待后台保存完成
            const result = await record_answer(user, quiz, correct, incorrect, blank);
            console.log(JSON.stringify(result));

            // record_answer 成功完成后，再通知父组件进行后续刷新
            await onSubmit();

        } catch (err) {
            const message = err instanceof AnswerRecordError ? err.message : `未知错误: ${err?.message ?? err}`;
            console.error(message);
        }
    }, [questions, userAnswers, user, quiz, record_answer, onSubmit]);

    // 6. 双击触发的处理函数
    const handleDoubleClick = (key, event) => {
        console.log("question id:", key);
    };

    if (!questions.length) {
        return (<p className="mt-5 text-zinc-500"> ⚠️ 未解析到有效题目内容，请检查文件格式。</p>);
    }

    return (
        <div className="mt-6">

            {questions.map((q, index) => {
                const selected = userAnswers[q.id];
                const isCorrect = submitted && selected && q.correctAnswer && selected.text.trim() === q.correctAnswer.trim();
                const isWrong = submitted && selected && q.correctAnswer && selected.text.trim() !== q.correctAnswer.trim();

                return (
                    <div key={q.id} className={tw.card} onDoubleClick={(e) => handleDoubleClick(q.id, e)}>
                        <h3 className={tw.question}> {index + 1}. {q.question} </h3>

                        <div className={tw.optionsContainer}>
                            {q.options.map((opt) => {
                                const isOptionSelected = selected?.label === opt.label;
                                const isThisOptionCorrect = q.correctAnswer && opt.text.trim() === q.correctAnswer.trim();
                                return (
                                    <label key={opt.label} className={tw.option({ submitted, isOptionSelected, isThisOptionCorrect })}>
                                        <input
                                            type="radio"
                                            name={`question-${q.id}`}
                                            value={opt.label}
                                            checked={!!isOptionSelected} // 确保转为纯布尔值
                                            disabled={submitted}
                                            onChange={() => handleSelect(q.id, opt)}
                                            className="me-2.5"
                                        />
                                        <strong className="me-2">{opt.label}.</strong>
                                        <span>{opt.text}</span>
                                    </label>
                                );
                            })}
                        </div>

                        {submitted && q.correctAnswer && (
                            <div className="mt-3 text-sm">
                                {isCorrect && (<span className="text-green-500 font-bold"> ✅ 正确 </span>)}
                                {isWrong && (<span className="text-red-500"> ❌ 错误 (正确答案：{q.correctAnswer})  </span>)}
                                {!selected && (<span className="text-zinc-500"> ⚠️ 未作答 (正确答案：{q.correctAnswer})  </span>)}
                            </div>
                        )}
                    </div>
                );
            })}

            <div className="mt-5 flex items-center gap-4">
                {!submitted
                    ? (<button onClick={handleSubmit} className={tw.submitBtn}> 提交答案 </button>)
                    : (<>
                        {/* <button onClick={onReset} className={tw.resetBtn}> 重新作答 </button> */}
                        <div className="text-lg font-bold text-[#24292e]"> 最终得分：{score} / {questions.length} </div>
                    </>)
                }
            </div>

        </div>
    );
}
