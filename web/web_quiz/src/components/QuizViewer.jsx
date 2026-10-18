import { useMemo, useState, useCallback } from "react";
import { styles as tw } from "./styles.js";
import { cn } from "../../../utils/utils.js";
import { useNatsFetch, AnswerRecordError } from "../../../net_service/useNatsFetch.js";
import { AiHelpIcon, NoteIcon } from "./icons.js";
import { getPrompt } from "../../../prompts/prompt_util.js";
import { questionTypes } from "./questionTypes/index.js";
import { showFloatingWindow } from "../../../utils/FloatingWindow";

// 判定一道题的作答状态: "blank" | "correct" | "incorrect"
// 题型未注册时按未作答处理
const judge = (q, answer) => {
    const handler = questionTypes[q.type];
    if (!handler || !handler.hasAnswered(q, answer)) return "blank";
    return handler.isCorrect(q, answer) ? "correct" : "incorrect";
};

// 选择题渲染与交互组件
export default function QuizViewer({ user, quiz, quizFileContent, mGroupContent, onSubmit, onReset }) {
    // userAnswers: { [questionId]: 由各题型自己定义形状的作答状态 }
    const [userAnswers, setUserAnswers] = useState({});
    const [submitted, setSubmitted] = useState(false);
    const { record_answer } = useNatsFetch();
    const [aiPrompt, setAiPrompt] = useState("");

    // 1. 解析 TSV 格式数据
    const questions = useMemo(() => {
        if (!quizFileContent) return [];
        return quizFileContent
            .trim()
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .map((line) => {
                const fields = line.split("\t").map((f) => f.trim());
                const [id, qType, qGroup, qIdxGrp, iQuestion, iOption, iAnswer, iSkill, ref_id, prev_id, next_id, prompt_id] = fields;

                const question = fields[+iQuestion].fromLiteral();
                const options = fields.slice(+iOption, +iAnswer - 1).filter(o => o.trim());
                const answers = fields.slice(+iAnswer, +iSkill - 1).filter(a => a.trim());
                const skills = fields.slice(+iSkill).filter(s => s.trim());
                const opts = options.map((opt, index) => ({
                    label: String.fromCharCode(65 + index), // A, B, C...
                    text: opt
                }));

                if (qType === "MCSA" && answers.length > 1) {
                    throw Error(`question - ${id} is MCSA, but has multiple answers`);
                }

                const ansMap = new Map([
                    ["MCSA", answers[0]],   // multiple choice, single answer
                    ["MS", answers],        // multiple select
                    ["FILL", answers]       // fill
                ]);

                return {
                    id,
                    question,
                    type: qType,
                    group: qGroup,
                    groupContent: mGroupContent.get(qGroup) ?? "",
                    options: opts,
                    correctAnswer: ansMap.get(qType),
                    humanReadableQuestion: `((${question})) [[${opts.map((o) => `${o.label}. ${o.text}`).join(";; ")}]]`,
                };
            })
            .filter(Boolean);
    }, [quizFileContent]);

    // 2. 统一的作答入口：各题型组件通过 onChange(newAnswer) 调用
    const setAnswer = useCallback(
        (questionId, value) => {
            if (submitted) return;
            setUserAnswers((prev) => ({ ...prev, [questionId]: value }));
        },
        [submitted]
    );

    // 3. 计算得分
    const score = useMemo(() => {
        if (!submitted) return 0;
        return questions.reduce(
            (acc, q) => (judge(q, userAnswers[q.id]) === "correct" ? acc + 1 : acc),
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
            const status = judge(q, userAnswers[q.id]);
            if (status === "correct") correct.push(q.id);
            else if (status === "incorrect") incorrect.push(q.id);
            else blank.push(q.id);
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

    // 5. 双击触发的处理函数
    const handleDoubleClick = (key, group, event) => {
        console.log("question id:", key);
        console.log("question group:", group);
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
                const handler = questionTypes[q.type];
                const selected = userAnswers[q.id];
                const status = submitted ? judge(q, selected) : null;

                return (
                    <div key={q.id} className={cn(tw.card, "relative")}>

                        {/* 左侧题号：绝对定位到卡片左边框外面，靠上 */}
                        <div className={tw.cardNum} onDoubleClick={(e) => handleDoubleClick(q.id, q.group, e)}>
                            <span className="inline-block transform -translate-y-1.25">
                                {index + 1}
                            </span>
                        </div>

                        {/* 右侧功能键：绝对定位到卡片右边框外面，从上往下排 */}
                        {submitted && (
                            <div className={tw.cardButtonGrp}>
                                <button type="button" className={tw.cardButton} onClick={(e) => handleNote(q.id, q.type, e)}>
                                    <NoteIcon />
                                </button>
                                <form action="https://www.google.com/search" method="get" target="_blank" className={cn(tw.cardButton, "inline")} onSubmit={(e) => handleAI(q.id, q.type, e)}>
                                    <input type="hidden" name="q" value={aiPrompt} />
                                    <input type="hidden" name="udm" value="50" />
                                    <input type="hidden" name="btnK" value="Google Search" />
                                    <input type="hidden" name="hl" value="zh-CN" />
                                    <button type="submit" className={tw.cardButton}> <AiHelpIcon /> </button>
                                </form>
                            </div>
                        )}

                        {/* 题组 */}
                        <div>
                            <h3 className={cn(tw.question, "whitespace-pre-line")}>
                                {q.group}
                                {q.groupContent.trim() && (
                                    <span
                                        className="ms-2 text-sm text-zinc-500 cursor-pointer"
                                        onClick={(e) => { showFloatingWindow(q.groupContent, { title: q.group }) }} >...
                                    </span>
                                )}
                            </h3>
                        </div>

                        {/* 题组内容 */}
                        {/* {q.groupContent.trim() && (
                            <div
                                className="border border-[#ccc] p-3 min-h-10"
                                dangerouslySetInnerHTML={{ __html: q.groupContent }}
                            />
                        )} */}

                        {/* 题干 */}
                        <div>
                            <h3 className={cn(tw.question, "whitespace-pre-line")}>
                                {q.question}
                                {/* 多选提示label */}
                                {handler && q.type !== "MCSA" && (
                                    <span className="ms-2 text-sm text-zinc-500">（{handler.label}）</span>
                                )}
                            </h3>
                        </div>

                        {/* 作答区域：完全交给题型组件 */}
                        <div className={tw.optionsContainer}>
                            {
                                handler ?
                                    (<handler.Input q={q} answer={selected} submitted={submitted} onChange={(next) => setAnswer(q.id, next)} />) :
                                    (<p className="text-sm text-zinc-500">⚠️ 不支持的题型：{q.type}</p>)
                            }
                        </div>

                        {/* 对错提示 */}
                        {submitted && handler && q.correctAnswer && (
                            <div className="mt-3 text-sm">
                                {status === "correct" && (<span className="text-green-500 font-bold"> ✅ 正确 </span>)}
                                {status === "incorrect" && (<span className="text-red-500"> ❌ 错误 (正确答案：{handler.formatCorrect(q)})  </span>)}
                                {status === "blank" && (<span className="text-zinc-500"> ⚠️ 未作答 (正确答案：{handler.formatCorrect(q)})  </span>)}
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