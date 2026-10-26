import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { styles as tw } from "./styles.js";
import { cn } from "../../../utils/utils.js";
import "../../../utils/util_str.js";
import { useNatsFetch } from "../../../net_service/useNatsFetch.js";
import { AnswerRecordError, QuestionRateError, QuestionRateFetchError } from "../../../net_service/QDPErr.js";
import { AiHelpIcon, NoteIcon, BookmarkIcon, RatingIcon } from "./icons.js";
import { getPrompt } from "../../../prompts/prompt_util.js";
import { questionTypes } from "./questionTypes/index.js";
import { showFloatingWindow } from "../../../utils/FloatingWindow";
import { showRatingModal } from "../../../utils/ShowRatingModal";

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
    const { record_answer, rate_question, fetch_rate_question } = useNatsFetch();
    const [aiPrompt, setAiPrompt] = useState("");
    const [questionMod, setQuestionMod] = useState({}); // 填空题交互时候花样翻新
    const [bookmarked, setBookmarked] = useState([]);
    const curIdxRef = useRef(-1);
    const curIdxCandRef = useRef([]);
    const togglingBookmarkIndexRef = useRef(-1);

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

                if (qType === 'MCSA' && answers.length > 1) {
                    throw Error(`Question - ${id} is Multiple Choice Single Answer, but got Multiple Answers from Quiz Bank`);
                }

                const ansMap = new Map([
                    ['MCSA', answers[0]],   // multiple choice, single answer
                    ['MS', answers],        // multiple select, array answer
                    ['FILL', answers]       // fill, array answer
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
    const setAnswer = useCallback((questionId, value) => {
        // console.log("setAnswer value:", value);
        if (submitted) return;
        setUserAnswers((prev) => ({ ...prev, [questionId]: value }));
    }, [submitted]);

    // 3. 计算得分
    const score = useMemo(() => {
        // console.log("userAnswers:", userAnswers);
        if (!submitted) return 0;
        return questions.reduce((acc, q) => (judge(q, userAnswers[q.id]) === "correct" ? acc + 1 : acc), 0);
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
            console.log(result);

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

    const handleNote = (qid, type, event) => {
        console.log("question id:", qid, "; question type", type);
    };

    const handleBookmark = (qid, type, index, event) => {
        togglingBookmarkIndexRef.current = index;
        setBookmarked(prev => (prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]).sort((a, b) => a - b));
    };

    const handleCardClick = (index, event) => {
        // bookmarked 稳定之后，再调用此函数计算curIdxRef
        const prevBookmarked = bookmarked;
        let pMarked = prevBookmarked.findIndex(item => item === index);
        if (pMarked != -1) {
            curIdxRef.current = pMarked
            console.log("curIdxRef", curIdxRef.current);
        } else {
            pMarked = prevBookmarked.findIndex(item => item > index);
            if (pMarked === -1) {
                pMarked = prevBookmarked.length
            }
            if (prevBookmarked.length >= 2) {
                const p = pMarked - 1 < 0 ? prevBookmarked.length - 1 : pMarked - 1;
                pMarked %= prevBookmarked.length
                curIdxCandRef.current = [p, pMarked];
                console.log("curIdxCandRef", curIdxCandRef.current);
            }
        }
    }

    const handleRating = async (qid, type, index, event) => {
        let defaultRating = 0;
        try {
            const result = await fetch_rate_question(user, quiz, qid);
            console.log(result)
            defaultRating = result?.rating ?? 0;
        } catch (err) {
            const message = err instanceof QuestionRateFetchError ? err.message : `未知错误: ${err?.message ?? err}`;
            console.error(message);
            return;
        }

        const rating = (await showRatingModal({ title: `题目(${index + 1})重要度`, defaultValue: defaultRating })) ?? 0;
        if (rating === 0) return
        try {
            const result = await rate_question(user, quiz, qid, rating);
            console.log(result);
        } catch (err) {
            const message = err instanceof QuestionRateError ? err.message : `未知错误: ${err?.message ?? err}`;
            console.error(message);
        }
    };

    if (!questions.length) {
        return (<p className="mt-5 text-zinc-500"> ⚠️ 未解析到有效题目内容，请检查文件格式。</p>);
    }

    const bookmarkJump = () => {
        const activeBookmarks = document.querySelectorAll('div[data-bookmark="true"]');
        const n = activeBookmarks.length;
        if (n === 0) return;
        const targetElement = activeBookmarks[curIdxRef.current];
        targetElement.scrollIntoView({ behavior: 'auto', block: 'nearest' });
        targetElement.focus({ preventScroll: true });
        console.log(`跳转到第 ${curIdxRef.current + 1} 个激活的书签`);
    }

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.ctrlKey && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
                event.preventDefault(); // 避免浏览器/页面的默认滚动行为
                const n = bookmarked.length
                if (n === 0) return;
                if (event.key === 'ArrowDown') {
                    if (curIdxCandRef.current.length) {
                        curIdxRef.current = curIdxCandRef.current[0]
                        curIdxCandRef.current = []
                    }
                    curIdxRef.current = (curIdxRef.current + 1) % n
                } else if (event.key === 'ArrowUp') {
                    if (curIdxCandRef.current.length) {
                        curIdxRef.current = curIdxCandRef.current[1]
                        curIdxCandRef.current = []
                    }
                    curIdxRef.current = curIdxRef.current <= 0 ? n - 1 : curIdxRef.current - 1
                }
                if (curIdxRef.current >= n) {
                    curIdxRef.current = n - 1
                }
                // console.log("bookmarked@", curIdxRef.current, bookmarked[curIdxRef.current]);
                bookmarkJump();
            }
        };

        // bookmarked 此时已稳定更新
        handleCardClick(togglingBookmarkIndexRef.current);

        window.addEventListener('keydown', handleKeyDown);
        return () => { window.removeEventListener('keydown', handleKeyDown); }; // 🟢 返回一个清理函数（Cleanup）

    }, [bookmarked]);

    return (
        <div className="mt-6 scroll-smooth">
            {questions.map((q, index) => {
                const handler = questionTypes[q.type];
                const answered = userAnswers[q.id];
                const status = submitted ? judge(q, answered) : null;
                const isBookmarked = bookmarked.includes(index);

                return (
                    <div key={q.id}
                        className={cn(tw.card, "relative transform-3d focus:outline-none focus:ring-1 focus:ring-blue-400")}
                        tabIndex={-1}
                        data-bookmark={isBookmarked}
                        onClick={(e) => handleCardClick(index, e)}>

                        {/* 左侧题号：绝对定位到卡片左边框外面，靠上 */}
                        <div className={cn(tw.cardNum)} onDoubleClick={(e) => handleDoubleClick(q.id, q.group, e)}>
                            <span className="inline-block transform -translate-y-1.25">
                                {index + 1}
                            </span>
                        </div>

                        {/* 右侧功能键：绝对定位到卡片右边框外面，从上往下排 */}
                        <div className={tw.cardButtonGrp}>
                            <button type="button" className={tw.cardButton} onClick={(e) => { e.stopPropagation(); handleBookmark(q.id, q.type, index, e) }}>
                                <BookmarkIcon index={index} bookmarked={bookmarked} />
                            </button>
                            {submitted && (
                                <div>
                                    <button type="button" className={tw.cardButton} onClick={(e) => handleRating(q.id, q.type, index, e)}>
                                        <RatingIcon />
                                    </button>
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
                        </div>

                        {/* 题组 */}
                        <div>
                            <h3 className={cn(tw.question, "whitespace-pre-line")}>
                                {q.group.trim() && (
                                    <span className="me-2" > {q.group} </span>
                                )}
                                {q.groupContent.trim() && (
                                    <span
                                        className="me-3 text-sm text-zinc-500 cursor-pointer"
                                        onClick={(e) => { showFloatingWindow(q.groupContent, { title: q.group }) }} >...
                                    </span>
                                )}
                                {/* 提示label 单选/多选/填空 */}
                                {handler && (
                                    <span className="text-sm text-zinc-500">{handler.label}</span>
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
                                {/* 优先显示装饰过的问题 */}
                                {
                                    questionMod?.[index] ?
                                        (<div dangerouslySetInnerHTML={{ __html: `${questionMod[index]}`.trim() }} />) :
                                        (<div> {q.question} </div>)
                                }
                            </h3>
                        </div>

                        {/* 作答区域：完全交给题型组件 */}
                        <div className={tw.optionsContainer}>
                            {
                                handler ?
                                    (<handler.Input
                                        q={q}
                                        answer={answered}
                                        submitted={submitted}
                                        onChangeToSetAnswer={(a) => setAnswer(q.id, a)}
                                        // 'onFocus' is only for Fill-Type
                                        onFocus={(n) => {
                                            const qMod = q.question.replaceNth("____", n, "___🖊___")
                                            setQuestionMod(prev => ({ ...prev, [index]: qMod }))
                                        }}
                                    />) :
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