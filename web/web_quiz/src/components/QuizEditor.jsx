import { useState, useEffect } from "react";
import { cn } from "../../../utils/utils.js"
import "../../../utils/util_str.js";
import { showInputModal } from "../utils/ShowInputModal.jsx";
import { showConfirmModal } from "../utils/ShowConfirmModal.jsx";
import RichTextEditor from "../utils/RichTextEditor.jsx";
import { styles as tw } from "./styles_e.js";
import { PenIcon, ArrowIcon } from "./icons_e.js";
import { useNatsFetch } from "../../../net_service/useNatsFetch.js";
import { useAlert } from "../utils/alert/useAlert.js";
import { AlertBanner } from "../utils/alert/AlertBanner.jsx";

/**
 * QuestionUploadForm
 * -------------------
 * 选择题录入表单：
 *  - 1 个题干输入框
 *  - 8 个选项输入框，每个选项后有一个"正确答案"复选框
 *  - 提交按钮：整理数据后调用 submitQuestionToServer()
 *  - 清空按钮：重置所有输入
 */

const MIN_OPTION_COUNT = 8;
const MAX_OPTION_COUNT = 20;

// 生成初始选项数组：[{ text: "", isCorrect: false }, ...]
const createEmptyOptions = (oc = MIN_OPTION_COUNT) => Array.from({ length: oc }, () => ({ text: "", isCorrect: false }));

const INITIAL_SET_OPT_COUNT_BY = { MANUAL: false, FETCH: false };

export default function QuizEditor({ user, selectedQuiz }) {
    const { alertState, showAlert, hideAlert } = useAlert(6000);
    const { loading, connError,
        count_qa,
        fetch_question,
        delete_question,
        fetch_prevnext_qid,
        make_quiz,
        save_group_content,
        fetch_group_content
    } = useNatsFetch();

    const isQuizReady = !!selectedQuiz && selectedQuiz?.trim() !== "";

    const [selectedQuestionType, setSelectedQuestionType] = useState('MCSA'); // 'MCSA', 'MS', 'FILL'
    const [QType, setQType] = useState({ MCSA: true, MS: false, FILL: false, OPT: true });
    const [questionCount, setQuestionCount] = useState(0);
    const [qid, setQid] = useState("");
    const [qnum, setQnum] = useState(0);
    const [group, setGroup] = useState("");
    const [idxGrp, setIdxGrp] = useState("");
    const [groupRef, setGroupRef] = useState("");
    const [question, setQuestion] = useState("");
    const [questionFieldType, setQuestionFieldType] = useState("TXT"); // "TXT" or "BIN"
    const [evalMode, setEvalMode] = useState("OBJ"); // "SUB", "OBJ"
    const [optCount, setOptCount] = useState(MIN_OPTION_COUNT);
    const [OptCountBy, setOptCountBy] = useState(INITIAL_SET_OPT_COUNT_BY);
    const [options, setOptions] = useState(createEmptyOptions());
    const [fillCount, setFillCount] = useState(0);
    const [skillStr, setSkillStr] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [keepQuestion, setKeepQuestion] = useState(false); // 提交后保留题目内容
    const [keepOptions, setKeepOptions] = useState(false); // 提交后保留选项内容

    const SetOptCountBy = (by) => {
        if (by in INITIAL_SET_OPT_COUNT_BY) {
            setOptCountBy({
                ...INITIAL_SET_OPT_COUNT_BY,
                [by]: true,
            })
        } else {
            console.warn(`SetOptCountBy: invalid value '${by}'`);
        }
    }

    const handleOptionTextChange = (index, text, toTrim = false) => {
        const isEmpty = !text.trim();
        setOptions((prev) =>
            prev.map((opt, i) => {
                if (i === index) {
                    // 当前项：文本为空时同步取消"正确"
                    return { ...opt, text: toTrim ? text.trim() : text, isCorrect: isEmpty ? false : opt.isCorrect };
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
                if (QType.MCSA) {
                    return i === index ? { ...opt, isCorrect: !opt.isCorrect } : { ...opt, isCorrect: false };
                }
                return i === index ? { ...opt, isCorrect: !opt.isCorrect } : opt;
            })
        );
    };

    const resetForm = () => {
        setQid("");
        setQnum(0);
        setGroup("");
        setIdxGrp("");
        setQuestion("");
        setOptions(createEmptyOptions());
        setSkillStr("");
    };

    const validate = () => {
        if (!selectedQuestionType) return "请选择题型";
        if (!question.trim()) return "输入题目内容";

        const count = options.filter((opt) => opt.text.trim()).length;
        if (QType.OPT && count < 2) return "至少填写两个选项";
        if (QType.FILL && count < 1) return "至少填写一个空格的答案";

        // 填空题都为正确答案
        const correctCount = QType.FILL ? count : options.filter((opt) => opt.isCorrect).length;
        if (correctCount === 0) return "至少勾选一个正确答案";

        const hasGap = options.some((opt, i) => opt.text.trim() && options.slice(0, i).some((o) => !o.text.trim()));
        if (hasGap) return "选项必须从上到下依次填写";

        return null;
    };

    const handleSubmit = async () => {
        const err = validate();
        if (err) {
            showAlert(err)
            return;
        }

        const opts = options.filter((opt) => opt.text.trim()).map((opt) => opt.text);
        const answers = options.filter((opt) => QType.FILL ? opt.text.trim() : opt.isCorrect).map((opt) => opt.text);
        const type = selectedQuestionType;
        const skills = skillStr.trim().replace(/^;+|;+$/g, '').split(";").filter(s => s.trim()).map(s => s.trim());

        setSubmitting(true);
        try {
            const id = await make_quiz(user, selectedQuiz, qid, type, group, question, opts, answers, skills, questionFieldType, evalMode);
            resetForm();
            setQuestionCount(await count_qa(user, selectedQuiz, "question_count")); // update new question count
            setQid("");
            await question_fetch(user, selectedQuiz, id, { question: !keepQuestion, option: !keepOptions }); // 提交后的刷新，某些字段需要清空，方便继续录入下一题
            showAlert(`提交成功! 题目ID: ${id}`, "success")
        } catch (err) {
            showAlert("提交失败!");
        } finally {
            setSubmitting(false);
        }
    };

    const qid_prevnext_fetch = async (user, quiz, qid, pn) => {
        const r = await fetch_prevnext_qid(user, quiz, qid);
        if (r.success === true && r.status === "found") {
            if (["P", "p", "U", "u"].some(p => p === pn)) {
                setQid(r.prev.id)
                setQnum(r.prev.line)
            }
            if (["N", "n", "D", "d"].some(n => n === pn)) {
                setQid(r.next.id)
                setQnum(r.next.line)
            }
        }
    }

    const question_fetch = async (user, quiz, qid, clearMap) => {
        try {
            const result = await fetch_question(user, quiz, qid.trim());
            if (result.status === "success") {

                const fields = result.question_line.split("\t");

                const qType = fields[1];
                const qGroup = fields[2];
                const qGroupIdx = +fields[3];

                const qText = fields[+fields[4]].fromLiteral();
                const qOptions = fields.slice(+fields[5], +fields[6] - 1).filter(o => o.trim()); // "- 1" is skip "A:" 
                const qAnswers = fields.slice(+fields[6], +fields[7] - 1).filter(a => a.trim()); // "- 1" is skip "S:"
                const qSkills = fields.slice(+fields[7]);
                const qFieldType = fields[8]; // "TXT" or "BIN"

                const ref_id = fields[9];
                const prev_id = fields[10];
                const next_id = fields[11];
                const prompt_id = fields[12];
                const eval_mode = fields[14]; // "SUB" or "OBJ"

                // console.log("Q:", qText);
                // console.log("O:", qOptions);
                // console.log("A:", qAnswers);
                // console.log("S:", qSkills);

                setSelectedQuestionType(qType);
                setGroup(qGroup);
                setIdxGrp(qGroupIdx);
                setSkillStr(qSkills.join("; "))
                setQuestion(clearMap?.question ? "" : qText);
                setQuestionFieldType(qFieldType || "TXT");
                setEvalMode(eval_mode || "OBJ");
                SetOptCountBy("FETCH");
                const oc = qOptions.length < MIN_OPTION_COUNT ? MIN_OPTION_COUNT : qOptions.length;
                setOptCount(oc);
                setOptions(createEmptyOptions(oc).map((opt, index) => ({
                    text: clearMap?.option ? "" : (qOptions[index] || ""),
                    isCorrect: clearMap?.option ? false : (qOptions[index] ? qAnswers.includes(qOptions[index]) : false),
                })));
                showAlert("搜索成功", "success");
            } else if (result.status === "failure") {
                resetForm();
                showAlert("搜索失败");
            }
        } catch (err) {
            resetForm();
            showAlert("搜索失败");
        }
    }

    const question_delete = async (user, quiz, qid) => {
        try {
            const result = await delete_question(user, quiz, qid.trim());
            if (result.status === "success") {
                resetForm();
                setQuestionCount(await count_qa(user, quiz, "question_count"));
                showAlert("删除成功", "success");
            } else if (result.status === "failure") {
                resetForm();
                showAlert("删除失败");
            }
        } catch (err) {
            resetForm();
            showAlert("删除失败");
        }
    };

    // 更换不同的QUIZ，清空页面，刷新不同题库题数
    useEffect(() => {
        (async () => {
            setQuestionCount(await count_qa(user, selectedQuiz, "question_count"))
            resetForm()
        })();
    }, [selectedQuiz]);

    useEffect(() => {
        setQType({
            MCSA: selectedQuestionType === 'MCSA',
            MS: selectedQuestionType === 'MS',
            FILL: selectedQuestionType === 'FILL',
            OPT: selectedQuestionType === 'MCSA' || selectedQuestionType === 'MS'
        })
    }, [selectedQuestionType]);

    useEffect(() => {
        // 变为单选题，只保留第一个正确答案
        if (QType.MCSA) {
            setOptions((prev) => {
                const correctCount = prev.filter((o) => o.isCorrect).length;
                if (correctCount <= 1) return prev;
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
        if (QType.OPT) {
            setEvalMode("OBJ"); // 选择题只能是客观题
        }
    }, [QType]);

    useEffect(() => {
        if (QType.FILL) {
            const matches = question.match(/_{4,}/g);
            const n = matches ? matches.length : 0;
            setFillCount(n);
        } else {
            setFillCount(0);
        }
    }, [question]);

    useEffect(() => {
        if (qid.isValidGuid()) {
            (async () => {
                const r = await fetch_prevnext_qid(user, selectedQuiz, qid);
                if (r.success === true && r.status === "found") {
                    setQnum(r.target.line)
                    await question_fetch(user, selectedQuiz, qid)
                }
            })()
        }
    }, [qid])

    useEffect(() => {
        if (OptCountBy.MANUAL) {
            const newOptions = createEmptyOptions(optCount);
            newOptions.map((opt, index) => {
                if (index < options.length) {
                    newOptions[index] = options[index];
                }
            });
            setOptions(newOptions);
        }
    }, [optCount, OptCountBy])

    return (
        <div className={tw.container}>

            <AlertBanner alert={alertState} onClose={hideAlert} className={cn(alertState.visible ? "mb-4" : "")} />

            <div className="flex items-center">
                <span className="block uppercase font-bold text-xl text-olive-900 mb-1">{isQuizReady ? selectedQuiz.part(-1) : "选择题库进行题目录入编辑，或新建题库录入"}</span>
            </div>

            {isQuizReady && (<div>

                <div className="flex items-center gap-2 mt-5">

                    <label className={cn(tw.label, "font-bold")}>序号 {qnum}/{questionCount}</label>

                    <div className="flex items-center gap-2 ml-auto">
                        <label className={cn(tw.label, "font-bold", "mr-1.5")}>搜索</label>
                        <input
                            type="text"
                            value={qid}
                            disabled={!selectedQuiz?.trim()}
                            onChange={(e) => setQid(e.target.value)}
                            placeholder="Question ID"
                            className={cn(tw.input, "w-80 disabled:opacity-50 disabled:cursor-not-allowed")}
                        />
                        {["U", "D"].map((e, i) => {
                            return (
                                <button
                                    key={i}
                                    onClick={async () => { await qid_prevnext_fetch(user, selectedQuiz, qid, e) }}
                                    disabled={!selectedQuiz?.trim() || !qid.isValidGuid()}
                                    className="cursor-pointer disabled:cursor-not-allowed"
                                >
                                    <ArrowIcon direction={e} className="w-5 h-5 text-gray-600 hover:text-black" />
                                </button>
                            )
                        })}
                        <button
                            onClick={
                                async () => {
                                    if (await showConfirmModal({ title: "Deleting Question ?", text: `${qid}` })) {
                                        await question_delete(user, selectedQuiz, qid)
                                    }
                                }
                            }
                            disabled={!selectedQuiz?.trim() || !qid.trim().isValidGuid()}
                            className={cn(tw.button, tw.primaryButton, "bg-red-500", "ml-4 disabled:opacity-50 disabled:cursor-not-allowed")}
                        >
                            删除
                        </button>
                    </div>
                </div>

                {/*  */}

                <div className="flex items-center gap-6 mt-6">
                    <div className="flex items-center gap-3">
                        <label className={cn(tw.label, "font-bold")}>题型</label>
                        <select
                            value={selectedQuestionType}
                            onChange={(e) => setSelectedQuestionType(e.target.value)}
                            disabled={connError || loading || !selectedQuiz?.trim()}
                            className={cn(tw.input, "w-45 rounded-sm disabled:opacity-50 disabled:cursor-not-allowed")}
                        >
                            <>
                                <option value='' disabled hidden>题型</option>
                                <option value='MCSA'>单选题</option>
                                <option value='MS'>多选题</option>
                                <option value='FILL'>填空题</option>
                            </>
                        </select>
                    </div>
                    <div className="flex flex-1 min-w-0 items-center">
                        <label className={cn(tw.label, "shrink-0 font-bold mr-3 mt-0 mb-0")}>技能知识点</label>
                        <input
                            type="text"
                            value={skillStr}
                            disabled={!selectedQuiz?.trim()}
                            className={cn(tw.input, "w-full disabled:opacity-50 disabled:cursor-not-allowed")}
                            onChange={(e) => setSkillStr(e.target.value)}
                            placeholder="分号(;)分隔多个技能知识点"
                        />
                    </div>
                </div>

                <div className="shrink-0 flex items-center gap-3 mt-5">
                    <label className={cn(tw.label, "font-bold")}>类组</label>
                    <input
                        type="text"
                        value={group}
                        className={cn(tw.input, "disabled:opacity-50 disabled:cursor-not-allowed")}
                        disabled={!selectedQuiz?.trim()}
                        onChange={(e) => setGroup(e.target.value.replace(/[\s-]+/g, '-'))}
                        onBlur={(e) => setGroup(e.target.value.replace(/^-+|-+$/g, ''))}
                        placeholder="题目组类"
                    />
                    {/* {!!idxGrp && <label className={cn(tw.label)}> 组内序号: {idxGrp}</label>} */}
                    <button onClick={async () => {
                        const content = await fetch_group_content(user, selectedQuiz, group)
                        setGroupRef(content);
                        const result = await showInputModal({
                            title: group,
                            defaultValue: content,
                        });
                        if (result !== null) {
                            setGroupRef(result.html);
                            await save_group_content(user, selectedQuiz, group, result.html);
                        }
                    }}
                        disabled={!selectedQuiz?.trim() || !group.trim()}
                        className={cn(tw.button, tw.primaryButton, "bg-blue-500 w-11 disabled:opacity-50 disabled:cursor-not-allowed")}
                    >
                        <PenIcon />
                    </button>

                    {/* test: show group ref content */}
                    {/* <div
                    className="border border-[#ccc] p-3 min-h-10"
                    dangerouslySetInnerHTML={{ __html: groupRef }}
                /> */}

                </div>

                <div className="flex items-center mt-4">
                    <label className={cn(tw.label, "block font-bold")}>题目</label>
                    <label className={cn(tw.label, "block font-bold ml-auto")}>
                        <span className="me-1">提交后保留内容</span>
                        <input
                            type='checkbox'
                            name="keep-question"
                            checked={keepQuestion}
                            onChange={(e) => setKeepQuestion(e.target.checked)}
                        />
                    </label>
                </div>

                <RichTextEditor
                    className={tw.textarea}
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onBlur={(e) => setQuestion(e.target.value.trim())}
                    placeholder="输入题目内容"
                    rows={3}
                />

                <div className="flex items-center gap-2 mt-5">
                    <label className={cn(tw.label, "block font-bold", QType.OPT && "hidden")}>
                        <span className={cn("me-2")}>主观题 ?</span>
                        <input
                            type='checkbox'
                            name="subjective-answer"
                            disabled={QType.OPT} // 选择题只能是客观题
                            checked={QType.FILL && evalMode === "SUB"}
                            onChange={(e) => setEvalMode(e.target.checked ? "SUB" : "OBJ")}
                        />
                    </label>
                    <div className="ml-auto">
                        <label className={cn(tw.label, "font-bold me-1")}>答案数量</label>
                        <input
                            type="number"
                            min={MIN_OPTION_COUNT}
                            max={MAX_OPTION_COUNT}
                            value={optCount}
                            onChange={(e) => {
                                SetOptCountBy("MANUAL");
                                const value = e.target.value;
                                if (value === "") {
                                    setOptCount(MIN_OPTION_COUNT); // 允许输入框暂时清空，而不是被 Number('') 强行变成 0
                                    return;
                                }
                                const n = Number(value);
                                if (!Number.isNaN(n) && n >= MIN_OPTION_COUNT && n <= MAX_OPTION_COUNT) {
                                    setOptCount(n);
                                }
                            }}
                            className={cn(tw.input, "w-12 text-center")}
                        />
                    </div>
                </div>

                <div className="flex items-center mt-2 mb-2">
                    <label className={cn(tw.label, "block font-bold")}>
                        {QType.FILL ? "答案（该项内容即为对应空位的答案）" : "选项（勾选表示该项为正确答案）"}
                    </label>
                    <label className={cn(tw.label, "block font-bold ml-auto")}>
                        <span className="me-1">提交后保留内容</span>
                        <input
                            type='checkbox'
                            name="keep-options"
                            checked={keepOptions}
                            onChange={(e) => setKeepOptions(e.target.checked)}
                        />
                    </label>
                </div>

                <div className={tw.optionsList}>
                    {options.map((opt, index) => {
                        // 选择题：前面所有选项都已填写，当前行才可编辑；填空题：根据下划线判断 （ [].every() is true ）
                        const canEdit = QType.OPT ? options.slice(0, index).every((o) => o.text.trim()) : index < fillCount;
                        return (
                            <div key={index} className={tw.optionRow}>
                                <span className={tw.optionIndex}>{String.fromCharCode(65 + index)}</span>
                                <input
                                    className={tw.optionInput}
                                    type="text"
                                    value={opt.text}
                                    disabled={!canEdit}
                                    onChange={(e) => handleOptionTextChange(index, e.target.value)}
                                    onBlur={(e) => handleOptionTextChange(index, e.target.value, true)}
                                    placeholder={canEdit ?
                                        (QType.OPT ? `选项 ${index + 1} 内容` : `第 ${index + 1} 空格处答案内容`) :
                                        (QType.OPT ? `先填写选项 ${String.fromCharCode(64 + index)}` : "匹配题目中的待填空'____'")}
                                />
                                <label className={tw.checkLabel(!opt.text.trim())} title={opt.text.trim() ? "" : "先填写选项内容"}>
                                    <input
                                        type={QType.MCSA ? 'radio' : 'checkbox'}
                                        name="correct-option"
                                        checked={QType.FILL ? true : opt.isCorrect}
                                        disabled={!opt.text.trim()}
                                        onChange={() => handleOptionCheck(index)}
                                    />
                                    <span className="ml-1">正确</span>
                                </label>
                            </div>
                        );
                    })}
                </div>

                <div className="flex items-center mt-1">
                    <div className={cn(tw.buttonRow, "ml-auto")}>
                        <button className={cn(tw.button, tw.primaryButton)} onClick={handleSubmit} disabled={submitting}>
                            {submitting ? "提交中..." : "提交"}
                        </button>
                        <button className={cn(tw.button, tw.secondaryButton)} onClick={resetForm} disabled={submitting}>
                            清空
                        </button>
                    </div>
                </div>

            </div>)}

        </div>
    );
}