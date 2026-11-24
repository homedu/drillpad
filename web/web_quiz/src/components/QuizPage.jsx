import { useState, useRef, useEffect } from "react";
import { useAlert } from "../utils/alert/useAlert.js";
import { AlertBanner } from "../utils/alert/AlertBanner.jsx";
import QuizViewer from "./components/QuizViewer.jsx";
import { RadioGroup } from "../utils/RadioGroup.jsx";
import { styles as tw } from "./styles.js";
import { useNatsFetch } from "../../../service_net/useNatsFetch.js";
import { QuizFetchError } from "../../../service_net/QDPErr.js";
import { cn } from "../../../utils/utils.js";
import "../../../utils/util_str.js";

export default function QuizPage({ user, selectedQuiz, onQuestionsReady, onSubmitQuiz, onNoQuestions }) {
    const { alertState, showAlert, hideAlert } = useAlert(3000);
    const { status, loading,
        fetch_quiz,
        count_qa,
        fetch_group_content,
        list_group
    } = useNatsFetch();

    const [fileContent, setFileContent] = useState("");
    const [mapGroupContent, setMapGroupContent] = useState(null);
    const [filter, setFilter] = useState({ evalMode: "", rating: 0 })
    const [quizKey, setQuizKey] = useState(0); // 用于彻底销毁并重新初始化 QuizViewer

    const [questionCount, setQuestionCount] = useState(0);
    const [correctCount, setCorrectCount] = useState(0);
    const [incorrectCount, setIncorrectCount] = useState(0);

    const [answering, setAnswering] = useState(false)
    const isQuizReady = !!selectedQuiz && selectedQuiz?.trim() !== "" && questionCount > 0;
    const canFetch = !loading && !alertState.visible && isQuizReady;

    // [ { key1: value1 }, { key2: value2 }, ... ] => Map( key1: value1, key2: value2 )
    // and exclude empty-value object to be map element
    const arrToMap = (arr, keyForNotArr = "NEED-A-KEY-FOR-NONE-ARRAY") => {
        if (!Array.isArray(arr)) {
            return new Map([[keyForNotArr, arr]])
        }
        return new Map(arr
            .filter(obj => Object.values(obj).every(val => val !== undefined && val !== null && val !== ""))
            .map(obj => Object.entries(obj).flat()));
    };

    const fetchQuiz = async () => {
        if (!canFetch) {
            showAlert("无效题库名")
            return;
        }
        try {
            const groups = await list_group(user, selectedQuiz);
            const groups_content = await fetch_group_content(user, selectedQuiz, groups[0], ...groups.slice(1));
            const m = arrToMap(groups_content, groups[0]);
            setMapGroupContent(m);

            const text = await fetch_quiz(user, selectedQuiz, 1000);
            setFileContent(text);
            setQuizKey((prev) => prev + 1); // 重新读取文件时也刷新组件

            // 开始作答，锁定
            setAnswering(!!text)

        } catch (err) {
            // useNatsFetch 内部已经把 NATS / 文件拉取的各种异常
            // 翻译成了可读的中文提示（并区分了 stage: request / fetch），直接展示即可
            const message = err instanceof QuizFetchError ? err.message : `未知错误: ${err?.message ?? err}`;
            showAlert(message);
            // 注意：这里不清空 fileContent —— 请求失败时不应该把用户上一次
            // 已经在做的题目清掉，只提示错误、保留原有内容
        }
    };

    const handleQuestionsReady = () => {
        onQuestionsReady?.();
    }

    const handleSubmit = async () => {
        setAnswering(false)
        onSubmitQuiz?.();
        await showQACount();
    };

    const handleNoQuestions = () => {
        if (!alertState.visible) {
            setAnswering(false)
            onNoQuestions?.()
            showAlert(`No Question for <${selectedQuiz.part(-1)}> on ${filter.evalMode}`, "success")
        }
    }

    // 彻底清空并重新初始化作答
    const handleResetQuiz = () => { setQuizKey((prev) => prev + 1); };

    const showQACount = async () => {
        const qaCount = selectedQuiz ? await count_qa(user, selectedQuiz) : { question_count: 0, correct_count: 0, incorrect_count: 0 };
        setQuestionCount(qaCount.question_count);
        setCorrectCount(qaCount.correct_count);
        setIncorrectCount(qaCount.incorrect_count);
        // console.log(`showQACount: ${qaCount}`);
    }

    // 更换不同的QUIZ，刷新不同的用户数据
    useEffect(() => {
        (async () => { await showQACount(); })();
        setFileContent(""); // 清空题目
    }, [selectedQuiz]);

    return (
        <div className={tw.app}>

            <AlertBanner alert={alertState} onClose={hideAlert} className={cn(alertState.visible ? "mb-4" : "")} />

            <div className="flex items-center">
                <div>
                    <span className="block uppercase font-bold text-xl text-olive-900 mb-1">{selectedQuiz?.part(-1) ?? "侧边栏选择题库进行题目练习"}</span>
                    {selectedQuiz?.part(-1) && (<label className={cn(tw.label, "flex items-center gap-5")}>
                        <span className="font-semibold text-sm text-gray-500">共 {questionCount} 习题</span>
                        <span className="font-semibold text-sm text-blue-500">已练习 {+correctCount + +incorrectCount}</span>
                        <span className="font-semibold text-sm text-green-600">掌握 {correctCount}</span>
                        <span className="font-semibold text-sm text-red-600">待巩固 {+questionCount - +correctCount}</span>
                    </label>)}
                </div>
                {isQuizReady && (
                    <div className="my-2 flex items-center gap-3 ml-auto">
                        <RadioGroup
                            name="evalMode"
                            value={filter.evalMode}
                            disabled={!canFetch || answering}
                            onChange={(val) => setFilter({ ...filter, evalMode: val })}
                            options={[
                                { label: '全部', value: '' },
                                { label: '主观题', value: 'SUB' },
                                { label: '客观题', value: 'OBJ' },
                            ]}
                        />
                        <button
                            onClick={fetchQuiz}
                            disabled={!canFetch || answering}
                            className={cn(
                                tw.input,
                                tw.fetchBtn(canFetch && !answering),
                                "w-30"
                            )}
                        >
                            {loading ? `⏳ 读取中...` : "📁 开始练习"}
                        </button>
                    </div>)
                }
            </div>

            {/* 通过递增 key 彻底重置 DOM 和 State */}
            {isQuizReady && fileContent && (
                <QuizViewer
                    key={quizKey}
                    user={user}
                    quiz={selectedQuiz}
                    quizFileContent={fileContent}
                    mGroupContent={mapGroupContent}
                    filter={filter}
                    onSubmit={handleSubmit}
                    onReset={handleResetQuiz}
                    onNoQuestions={handleNoQuestions}
                    onQuestionsReady={handleQuestionsReady}
                />
            )}
        </div>
    );
}
