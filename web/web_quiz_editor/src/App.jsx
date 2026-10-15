import React, { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { cn } from "../../utils/utils.js"
import "../../utils/util_str.js";
import { showInputModal } from "../../utils/showInputModal.jsx";
import { styles as tw } from "./styles.js";
import { PenIcon } from "./icons.js";
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
    const { loading, connError, list_quiz, count_qa, search_question, delete_question, make_quiz_v2 } = useNatsFetch();

    const [user, setUser] = useState("");
    const [quizList, setQuizList] = useState([]);
    const [selectedQuiz, setSelectedQuiz] = useState('');
    const [selectedQuestionType, setSelectedQuestionType] = useState(''); // "MCSA" 或 "MS"
    const [questionCount, setQuestionCount] = useState(0);
    const [qid, setQid] = useState("");
    const [group, setGroup] = useState("");
    const [idxGrp, setIdxGrp] = useState("");
    const [groupRef, setGroupRef] = useState(null);
    const [question, setQuestion] = useState("");
    const [options, setOptions] = useState(createEmptyOptions());
    const [skillStr, setSkillStr] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const [disabledMap, setDisabledMap] = useState({
        userInput: false,  // 用户名输入框
        quizSelect: false, // 题目下拉框
    });

    const hasQuizList = quizList?.length > 0;

    const handleOptionTextChange = (index, text) => {
        const isEmpty = !text.trim();
        setOptions((prev) =>
            prev.map((opt, i) => {
                if (i === index) {
                    // 当前项：文本为空时同步取消"正确"
                    return { ...opt, text, isCorrect: isEmpty ? false : opt.isCorrect };
                }
                if (isEmpty && i > index) {
                    // 当前项被清空：后面的选项全部清空
                    return { ...opt, text: "", isCorrect: false };
                }
                return opt;
            })
        );
    };

    const handleOptionCheck = (index) => {
        setOptions((prev) =>
            prev.map((opt, i) => {
                // radio 模式下，当前选项无法被取消勾选；下面逻辑无法执行
                if (selectedQuestionType === 'MCSA') {
                    return i === index ? { ...opt, isCorrect: !opt.isCorrect } : { ...opt, isCorrect: false };
                }
                return i === index ? { ...opt, isCorrect: !opt.isCorrect } : opt;
            })
        );
    };

    const resetForm = () => {
        setQid("");
        setGroup("");
        setIdxGrp("");
        setQuestion("");
        setOptions(createEmptyOptions());
        setSkillStr("");
        setInfo("");
        setError("");
    };

    const validate = () => {
        if (!user.trim()) return "请输入用户名";
        if (!selectedQuiz.trim()) return "请选择题库";
        if (!selectedQuestionType) return "请选择题型";
        if (!question.trim()) return "请输入题目内容";

        const count = options.filter((opt) => opt.text.trim()).length;
        if (count < 2) return "请至少填写两个选项";
        if (count > OPTION_COUNT) return `最多只能填写 ${OPTION_COUNT} 个选项`;

        const correctCount = options.filter((opt) => opt.isCorrect).length;
        if (correctCount === 0) return "请至少勾选一个正确答案";

        const hasGap = options.some((opt, i) => opt.text.trim() && options.slice(0, i).some((o) => !o.text.trim()));
        if (hasGap) return "选项必须从上到下依次填写";

        return null;
    };

    const handleSubmit = async () => {
        const err = validate();
        if (err) {
            setError(err)
            return;
        }

        const opts = options.filter((opt) => opt.text.trim()).map((opt) => opt.text);
        const answers = options.filter((opt) => opt.isCorrect).map((opt) => opt.text);
        const type = answers.length > 1 ? "MS" : "MCSA";
        const skills = skillStr.trim().replace(/^;+|;+$/g, '').split(";").filter(s => s.trim()).map(s => s.trim());

        setSubmitting(true);
        try {
            const id = await make_quiz_v2(user, selectedQuiz, qid, type, group, question, opts, answers, skills);
            resetForm();
            setQuestionCount(await count_qa(user, selectedQuiz, "question_count"));
            setQid(id);
            await question_search(user, selectedQuiz, id);
            setInfo("提交成功!")
        } catch (err) {
            setError("提交失败!");
        } finally {
            setSubmitting(false);
        }
    };

    const question_search = async (user, quiz, qid) => {
        try {
            const result = await search_question(user, quiz, qid.trim());
            if (result.status === "success") {

                const fields = result.question_line.split("\t");

                const qType = fields[1];
                const qGroup = fields[2];
                const qGroupIdx = +fields[3];

                const qText = fields[+fields[4]].fromLiteral();
                const qOptions = fields.slice(+fields[5], +fields[6] - 1).filter(o => o.trim()); // "- 1" is skip "A:" 
                const qAnswers = fields.slice(+fields[6], +fields[7] - 1).filter(a => a.trim()); // "- 1" is skip "S:"
                const qSkills = fields.slice(+fields[7]);

                const ref_id = fields[8];
                const prev_id = fields[9];
                const next_id = fields[10];
                const prompt_id = fields[11];

                // console.log("Q:", qText);
                // console.log("O:", qOptions);
                // console.log("A:", qAnswers);
                // console.log("S:", qSkills);

                setSelectedQuestionType(qType);
                setGroup(qGroup);
                setIdxGrp(qGroupIdx);
                setQuestion(qText);
                setOptions(createEmptyOptions().map((opt, index) => ({
                    text: qOptions[index] || "",
                    isCorrect: qOptions[index] ? qAnswers.includes(qOptions[index]) : false,
                })));
                setSkillStr(qSkills.join("; "))

                setInfo("题目搜索成功");
                setError("");
            } else if (result.status === "failure") {
                resetForm();
                setError("搜索题目失败");
            }
        } catch (err) {
            resetForm();
            setError("搜索题目失败");
        }
    }

    const question_delete = async (user, quiz, qid) => {
        try {
            const result = await delete_question(user, quiz, qid.trim());
            if (result.status === "success") {
                resetForm();
                setQuestionCount(await count_qa(user, quiz, "question_count"));
                setInfo("题目删除成功");
                setError("");
            } else if (result.status === "failure") {
                resetForm();
                setError("删除题目失败");
            }
        } catch (err) {
            resetForm();
            setError("删除题目失败");
        }
    };

    // 根据用户名找出来QUIZ列表后，用户名便不可更改了
    useEffect(() => {
        if (hasQuizList) {
            setDisabledMap(prev => ({
                ...prev,
                userInput: true,
            }))
        }
    }, [hasQuizList]);

    // 更换不同的QUIZ，刷新不同的用户数据
    useEffect(() => {
        (async () => setQuestionCount(await count_qa(user, selectedQuiz, "question_count")))();
    }, [selectedQuiz]);

    useEffect(() => {
        if (selectedQuestionType === 'MCSA') {
            setOptions((prev) => {
                const correctCount = prev.filter((o) => o.isCorrect).length;
                if (correctCount <= 1) return prev;

                // 只保留第一个正确答案
                let found = false;
                return prev.map((o) => {
                    if (o.isCorrect && !found) {
                        found = true;
                        return o;
                    }
                    return { ...o, isCorrect: false };
                });
            });
        }
    }, [selectedQuestionType]);

    const refInputUser = useRef(null);
    const refSelectQuiz = useRef(null);

    return (
        <div className={tw.container}>

            {connError && (<p className={tw.errBox}> ⚠️ NATS 连接异常，部分功能可能不可用：{connError.message} </p>)}
            {info && !error && <p className={cn(tw.infoBox)}> 💬 {info}</p>}
            {error && <p className={cn(tw.errBox)}> ❌ {error}</p>}

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
                    disabled={connError || loading || disabledMap.userInput}
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
                    className={cn(tw.input, "w-50 rounded-sm")}
                >
                    {hasQuizList && (
                        <>
                            <option value="" disabled hidden>考题类别</option>
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
                    className={cn(tw.input, "w-80")}
                />

                <button
                    onClick={async () => { await question_search(user, selectedQuiz, qid) }}
                    disabled={!user || !selectedQuiz || !qid.trim().isValidGuid()}
                    className={cn(tw.button, tw.primaryButton, (!user || !selectedQuiz || !qid.trim().isValidGuid()) && "opacity-50 cursor-not-allowed")}
                >
                    搜索
                </button>

                <button
                    onClick={async () => { await question_delete(user, selectedQuiz, qid) }}
                    disabled={!user || !selectedQuiz || !qid.trim().isValidGuid()}
                    className={cn(tw.button, tw.primaryButton, "bg-red-500", (!user || !selectedQuiz || !qid.trim().isValidGuid()) && "opacity-50 cursor-not-allowed")}
                >
                    删除
                </button>
            </div>

            {/*  */}

            <div className="flex items-center gap-6 mt-6">
                <div className="flex items-center gap-3">
                    <label className={cn(tw.label, "font-bold")}>题型</label>
                    <select
                        value={selectedQuestionType}
                        onChange={(e) => setSelectedQuestionType(e.target.value)}
                        disabled={connError || loading}
                        className={cn(tw.input, "w-45 rounded-sm")}
                    >
                        <>
                            <option value="" disabled hidden>题型</option>
                            <option value="MCSA">单选题</option>
                            <option value="MS">多选题</option>
                        </>
                    </select>
                </div>
                <div className="flex flex-1 min-w-0 items-center">
                    <label className={cn(tw.label, "shrink-0 font-bold mr-3 mt-0 mb-0")}>技能知识点</label>
                    <input
                        type="text"
                        value={skillStr}
                        className={cn(tw.input, "w-full")}
                        onChange={(e) => setSkillStr(e.target.value)}
                        placeholder="分号(;)分隔多个技能知识点输入"
                    />
                </div>
            </div>

            <div className="shrink-0 flex items-center gap-3 mt-5">
                <label className={cn(tw.label, "font-bold")}>类组</label>
                <input
                    type="text"
                    value={group}
                    className={cn(tw.input)}
                    onChange={(e) => setGroup(e.target.value)}
                    placeholder="题目组类"
                />
                {/* {!!idxGrp && <label className={cn(tw.label)}> 组内序号: {idxGrp}</label>} */}
                <button onClick={async () => {
                    const r = await showInputModal({
                        title: `${group} 引用内容`,
                        defaultValue: groupRef?.html || "",
                    });
                    if (r !== null) setGroupRef(r);
                    console.log(r);
                }}
                    disabled={!group.trim()}
                    className={cn(tw.button, tw.primaryButton, "bg-blue-500 w-11", (!group) && "opacity-50 cursor-not-allowed")}
                >
                    <PenIcon />
                </button>

                {/* test: show group ref content */}
                <div
                    className="border border-[#ccc] p-3 min-h-10"
                    dangerouslySetInnerHTML={{ __html: groupRef?.html || "" }}
                />

            </div>

            <label className={cn(tw.label, "block font-bold mt-6")}>题目</label>
            <textarea
                className={tw.textarea}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="输入题目内容"
                rows={3}
            />

            <label className={cn(tw.label, "block font-bold")}>选项（勾选表示该项为正确答案）</label>

            <div className={tw.optionsList}>
                {options.map((opt, index) => {
                    // 前面所有选项都已填写，当前行才可编辑
                    const canEdit = options.slice(0, index).every((o) => o.text.trim());

                    return (
                        <div key={index} className={tw.optionRow}>
                            <span className={tw.optionIndex}>{String.fromCharCode(65 + index)}</span>
                            <input
                                className={tw.optionInput}
                                type="text"
                                value={opt.text}
                                disabled={!canEdit}
                                onChange={(e) => handleOptionTextChange(index, e.target.value)}
                                placeholder={canEdit ? `选项 ${index + 1} 内容` : `先填写选项 ${String.fromCharCode(64 + index)}`}
                            />
                            <label className={tw.checkLabel(!opt.text.trim())} title={opt.text.trim() ? "" : "先填写选项内容"}>
                                <input
                                    type={selectedQuestionType === 'MCSA' ? 'radio' : 'checkbox'}
                                    name="correct-option"
                                    checked={opt.isCorrect}
                                    disabled={!opt.text.trim()}
                                    onChange={() => handleOptionCheck(index)}
                                />
                                <span style={{ marginLeft: 4 }}>正确</span>
                            </label>
                        </div>
                    );
                })}
            </div>

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