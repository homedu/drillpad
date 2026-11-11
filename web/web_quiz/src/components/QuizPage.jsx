import { useState, useRef, useEffect } from "react";
import QuizViewer from "./components/QuizViewer.jsx";
import { styles as tw } from "./styles.js";
import { useNatsFetch } from "../../../net_service/useNatsFetch.js";
import { QuizFetchError } from "../../../net_service/QDPErr.js";
import { cn } from "../../../utils/utils.js";
import "../../../utils/util_str.js";

export default function QuizPage({ user, selectedQuiz, onFetchQuiz, onSubmitQuiz }) {
    const { status, loading,
        fetch_quiz,
        count_qa,
        fetch_group_content,
        list_group
    } = useNatsFetch();

    const [fileContent, setFileContent] = useState("");
    const [mapGroupContent, setMapGroupContent] = useState(null);
    const [info, setInfo] = useState("");
    const [error, setError] = useState("");
    const [quizKey, setQuizKey] = useState(0); // 用于彻底销毁并重新初始化 QuizViewer

    const [questionCount, setQuestionCount] = useState(0);
    const [correctCount, setCorrectCount] = useState(0);
    const [incorrectCount, setIncorrectCount] = useState(0);

    const [disabledMap, setDisabledMap] = useState({
        submitBtn: false       // 提交按钮
    });

    const isQuizReady = !!selectedQuiz && selectedQuiz?.trim() !== "";
    const canFetch = !loading && isQuizReady;

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
            setError("无效用户名、或题库名称");
            return;
        }

        setError("");
        try {
            const groups = await list_group(user, selectedQuiz);
            const groups_content = await fetch_group_content(user, selectedQuiz, groups[0], ...groups.slice(1));
            const m = arrToMap(groups_content, groups[0]);
            setMapGroupContent(m);

            const text = await fetch_quiz(
                user,
                selectedQuiz,
                100,
            );

            setFileContent(text);
            setQuizKey((prev) => prev + 1); // 重新读取文件时也刷新组件

            // 开始作答，不可再更改用户输入
            setDisabledMap(prev => ({
                ...prev,
                submitBtn: !!text,
            }))

            setInfo(!text ? ` No questions need to do for <${selectedQuiz}> now` : "")

            if (!!text) onFetchQuiz();

        } catch (err) {
            // useNatsFetch 内部已经把 NATS / 文件拉取的各种异常
            // 翻译成了可读的中文提示（并区分了 stage: request / fetch），直接展示即可
            const message = err instanceof QuizFetchError ? err.message : `未知错误: ${err?.message ?? err}`;
            setError(message);
            // 注意：这里不清空 fileContent —— 请求失败时不应该把用户上一次
            // 已经在做的题目清掉，只提示错误、保留原有内容
        }
    };

    // 彻底清空并重新初始化作答
    const handleResetQuiz = () => { setQuizKey((prev) => prev + 1); };

    const handleOnSubmit = async () => {

        // 开始作答后，不可再更改用户输入; 提交后，解锁输入框
        setDisabledMap(prev => ({ ...prev, submitBtn: false }))

        // 提交后刷新统计数据
        await showQACount();

        // 通知外部，答题已经提交
        onSubmitQuiz();
    };

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
    }, [selectedQuiz]);

    return (
        <div className={tw.app}>

            <div className="flex items-center">
                {
                    questionCount > 0 &&
                    <label className={cn(tw.label, "flex items-center gap-3")}>
                        <span className="font-bold text-olive-900">{selectedQuiz}</span>
                        <span className="font-semibold text-gray-500">共 {questionCount} 习题</span>
                        <span className="font-semibold text-blue-500">已练习 {+correctCount + +incorrectCount}</span>
                        <span className="font-semibold text-green-600">掌握 {correctCount}</span>
                        <span className="font-semibold text-red-600">待巩固 {+questionCount - +correctCount}</span>
                    </label>
                }
                {
                    isQuizReady &&
                    <div className="my-2 flex items-center gap-2 ml-auto">
                        <button
                            onClick={fetchQuiz}
                            disabled={!canFetch || disabledMap.submitBtn}
                            className={cn(
                                tw.input,
                                tw.fetchBtn(canFetch && !disabledMap.submitBtn),
                                "w-30"
                            )}
                        >
                            {loading ? `⏳ 读取中... ${status}` : "📁 开始练习"}
                        </button>
                    </div>
                }
            </div>

            {info && !error && <p className={tw.infoBox}> 💬 {info}</p>}
            {error && !info && <p className={tw.errBox}> ❌ {error}</p>}

            {/* 通过递增 key 彻底重置 DOM 和 State */}
            {isQuizReady && fileContent && (
                <QuizViewer
                    key={quizKey}
                    user={user}
                    quiz={selectedQuiz}
                    quizFileContent={fileContent}
                    mGroupContent={mapGroupContent}
                    onSubmit={handleOnSubmit}
                    onReset={handleResetQuiz}
                />
            )}
        </div>
    );
}
