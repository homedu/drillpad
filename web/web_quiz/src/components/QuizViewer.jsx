import { useMemo, useState, useCallback } from "react";
import { styles as tw } from "./styles.js";
import { cn } from "../../../utils/utils.js";
import { useNatsFetch, AnswerRecordError } from "../../../net_service/useNatsFetch.js";
import { AiHelpIcon, NoteIcon } from "./icons.js";
import { getPrompt } from "../../../prompts/prompt_util.js";

// ---------- 题型通用工具函数 ----------

// 是否已作答：单选是对象，多选是非空数组
const hasAnswered = (q, userChoice) => q.type === "MS" ? Array.isArray(userChoice) && userChoice.length > 0 : !!userChoice;

// 判断作答是否正确：单选比较文本；多选要求"选中集合"与"正确答案集合"完全一致
const isAnswerCorrect = (q, userChoice) => {
    if (!q.correctAnswer || !hasAnswered(q, userChoice)) return false;

    if (q.type === "MCSA") {
        return userChoice.text.trim() === q.correctAnswer.trim();
    }
    if (q.type === "MS") {
        const picked = new Set(userChoice.map((o) => o.text.trim()));
        const correct = new Set(q.correctAnswer.map((a) => a.trim()));
        return picked.size === correct.size && [...picked].every((t) => correct.has(t));
    }
    return false;
};

// 用于界面展示的正确答案文本
const formatCorrectAnswer = (q) => Array.isArray(q.correctAnswer) ? q.correctAnswer.join(";") : q.correctAnswer;

// 选择题渲染与交互组件
export default function QuizViewer({ user, quiz, fileContent, onSubmit, onReset }) {
    // userAnswers: { [questionId]: 单选 -> optionObj；多选 -> optionObj[] }
    const [userAnswers, setUserAnswers] = useState({});
    const [submitted, setSubmitted] = useState(false);
    const { record_answer } = useNatsFetch();
    const [aiPrompt, setAiPrompt] = useState("");

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
                const [id, question, // 索引含义：0: GUID; 1: 题干;
                    optA, optB, optC, optD, optE, optF, optG, optH, // 2-9: A-H选项内容;
                    ans1, ans2, ans3, ans4, ans5, ans6, ans7, ans8, // 10-17: 答案内容;
                    ref_id, prompt_id, question_type] = fields; // 18: ref_id; 19: prompt_id; 20: question_type

                const opts = [
                    { label: "A", text: optA },
                    { label: "B", text: optB },
                    { label: "C", text: optC },
                    { label: "D", text: optD },
                    { label: "E", text: optE },
                    { label: "F", text: optF },
                    { label: "G", text: optG },
                    { label: "H", text: optH },
                ].filter((opt) => opt.text);

                const answers = [ans1, ans2, ans3, ans4, ans5, ans6, ans7, ans8].filter((ans) => ans && ans.trim());

                if (question_type === "MCSA" && answers.length > 1) {
                    throw Error(`question - ${id} is MCSA, but has multiple answers`);
                }

                const ansMap = new Map([
                    ["MCSA", ans1],
                    ["MS", answers]
                ]);

                return {
                    id,
                    question,
                    type: question_type,
                    options: opts,
                    correctAnswer: ansMap.get(question_type),
                    humanReadableQuestion: `((${question})) [[${opts.map((o) => `${o.label}. ${o.text}`).join(";; ")}]]`,
                };
            })
            .filter(Boolean);
    }, [fileContent]);

    // 2a. 单选：直接替换
    const handleSelect = (questionId, optionObj) => {
        if (submitted) return;
        setUserAnswers((prev) => ({
            ...prev,
            [questionId]: optionObj,
        }));
    };

    // 2b. 多选：已选则取消，未选则加入
    const handleToggleMulti = (questionId, optionObj) => {
        if (submitted) return;
        setUserAnswers((prev) => {
            const current = Array.isArray(prev[questionId]) ? prev[questionId] : [];
            const exists = current.some((o) => o.label === optionObj.label);
            return {
                ...prev,
                [questionId]: exists
                    ? current.filter((o) => o.label !== optionObj.label)
                    : [...current, optionObj],
            };
        });
    };

    // 3. 计算得分（多选全对才得分）
    const score = useMemo(() => {
        if (!submitted) return 0;
        return questions.reduce(
            (acc, q) => (isAnswerCorrect(q, userAnswers[q.id]) ? acc + 1 : acc),
            0
        );
    }, [submitted, questions, userAnswers]);

    // 4. 提交答案
    const handleSubmit = useCallback(async () => {
        // 统计答案, 根据当前 userAnswers 直接计算答案分类
        const correct = [];
        const incorrect = [];
        const blank = [];

        questions.forEach((q) => {
            const userChoice = userAnswers[q.id];
            if (!hasAnswered(q, userChoice)) {
                blank.push(q.id);
            } else if (isAnswerCorrect(q, userChoice)) {
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

    const handleAI = (key, type, event) => {
        console.log("question id:", key, "; question type", type);
        const question = questions.filter((q) => q.id === key)[0];
        if (question == undefined || question == null) {
            throw Error(`cannot find question - ${key}`);
        }

        const prompt = getPrompt(quiz, type, question.humanReadableQuestion);
        console.log(prompt);
        setAiPrompt(prompt);
    };

    const handleNote = (key, type, event) => {
        console.log("question id:", key, "; question type", type);
    };

    if (!questions.length) {
        return (<p className="mt-5 text-zinc-500"> ⚠️ 未解析到有效题目内容，请检查文件格式。</p>);
    }

    return (
        <div className="mt-6">

            {questions.map((q, index) => {
                const selected = userAnswers[q.id];
                const isMulti = q.type === "MS";
                const answered = hasAnswered(q, selected);
                const isCorrect = submitted && answered && isAnswerCorrect(q, selected);
                const isWrong = submitted && answered && q.correctAnswer && !isAnswerCorrect(q, selected);

                // 多选题预先规范化正确答案，避免每个选项里重复 trim
                const correctTexts = isMulti && Array.isArray(q.correctAnswer)
                    ? q.correctAnswer.map((a) => a.trim())
                    : [];

                return (
                    <div key={q.id} className={cn(tw.card, "relative")}>

                        {/* 左侧题号：绝对定位到卡片左边框外面，靠上 */}
                        <div className={tw.cardNum} onDoubleClick={(e) => handleDoubleClick(q.id, e)}>
                            {index + 1}
                        </div>

                        {/* 右侧功能键：绝对定位到卡片右边框外面，从上往下排 */}
                        {submitted && (
                            <div className={tw.cardButtonGrp}>
                                <button type="button" className={tw.cardButton} onClick={(e) => handleNote(q.id, q.type, e)}>
                                    <NoteIcon />
                                </button>
                                <form
                                    action="https://www.google.com/search"
                                    method="get"
                                    target="_blank"
                                    className={cn(tw.cardButton, "inline")}
                                    onSubmit={(e) => handleAI(q.id, q.type, e)}
                                >
                                    <input type="hidden" name="q" value={aiPrompt} />
                                    <input type="hidden" name="udm" value="50" />
                                    <input type="hidden" name="btnK" value="Google Search" />
                                    <input type="hidden" name="hl" value="zh-CN" />
                                    <button type="submit" className={tw.cardButton}> <AiHelpIcon /> </button>
                                </form>
                            </div>
                        )}

                        {/* 卡片本体：原来的边框、背景、圆角样式放在这里 */}
                        <div>
                            <h3 className={tw.question}>
                                {q.question}
                                {isMulti && <span className="ms-2 text-sm text-zinc-500">（多选）</span>}
                            </h3>
                        </div>

                        <div className={tw.optionsContainer}>
                            {q.options.map((opt) => {

                                const isOptionSelected = isMulti
                                    ? Array.isArray(selected) && selected.some((s) => s.label === opt.label)
                                    : selected?.label === opt.label;

                                const isThisOptionCorrect = q.correctAnswer && (
                                    (q.type === "MCSA" && opt.text.trim() === q.correctAnswer.trim()) ||
                                    (q.type === "MS" && correctTexts.includes(opt.text.trim()))
                                );

                                switch (q.type) {
                                    case "MCSA":
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
                                    case "MS":
                                        return (
                                            <label key={opt.label} className={tw.option({ submitted, isOptionSelected, isThisOptionCorrect })}>
                                                <input
                                                    type="checkbox"
                                                    name={`question-${q.id}`}
                                                    value={opt.label}
                                                    checked={!!isOptionSelected}
                                                    disabled={submitted}
                                                    onChange={() => handleToggleMulti(q.id, opt)}
                                                    className="me-2.5"
                                                />
                                                <strong className="me-2">{opt.label}.</strong>
                                                <span>{opt.text}</span>
                                            </label>
                                        );
                                    default:
                                        return null;
                                }
                            })}
                        </div>

                        {submitted && q.correctAnswer && (
                            <div className="mt-3 text-sm">
                                {isCorrect && (<span className="text-green-500 font-bold"> ✅ 正确 </span>)}
                                {isWrong && (<span className="text-red-500"> ❌ 错误 (正确答案：{formatCorrectAnswer(q)})  </span>)}
                                {!answered && (<span className="text-zinc-500"> ⚠️ 未作答 (正确答案：{formatCorrectAnswer(q)})  </span>)}
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