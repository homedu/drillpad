import { useState, useEffect } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { buildTree } from "../../utils/utils.js";
import { useAlert } from "./utils/alert/useAlert.js";
import { AlertBanner } from "./utils/alert/AlertBanner.jsx";
import { showSimpleInputModal } from "./utils/ShowSimpleInputModal.jsx";
import { useNatsFetch } from "../../net_service/useNatsFetch.js";
import Sidebar from "./components/Sidebar";
import QuizPage from './components/QuizPage';
import QuizEditor from "./components/QuizEditor";

// SIDEBAR 树数据：有 children 的是分支（点击折叠/展开），没有的是叶节点（点击触发 onSelect）
// const treeData = [
//     {
//         id: "guide",
//         label: "入门指南",
//         children: [
//             { id: "guide/install", label: "安装" },
//             { id: "guide/quickstart", label: "快速开始" },
//         ],
//     },
//     {
//         id: "components",
//         label: "组件",
//         children: [
//             { id: "components/button", label: "Button 按钮" },
//             {
//                 id: "components/form",
//                 label: "表单",
//                 children: [
//                     { id: "components/form/input", label: "Input 输入框" },
//                     { id: "components/form/select", label: "Select 选择器" },
//                 ],
//             },
//         ],
//     },
//     {
//         id: "changelog",
//         label: "更新日志"
//     }, // 顶层叶节点也可以
// ];

export default function App() {
    const location = useLocation();
    const navigate = useNavigate();
    const { alertState, showAlert, hideAlert } = useAlert(3000);
    const { connError, list_quiz, new_quiz, count_qa } = useNatsFetch();
    const [sidebarOpen, setSidebarOpen] = useState(undefined);
    const [sidebarDisable, setSidebarDisable] = useState(false);
    const [user, setUser] = useState(location.state?.username ?? "");
    const [mode, setMode] = useState("QUIZ");

    // 挂载后立即用 replace: true 覆盖当前历史记录，清空 state
    useEffect(() => {
        if (location.state) {
            navigate(location.pathname + location.search, { replace: true, state: null });
        }
    }, [location, navigate]);

    useEffect(() => {
        if (connError) showAlert(`⚠️ NATS 连接异常，功能不可用：${connError.message}`)
    }, [connError])

    const [quizList, setQuizList] = useState([]);
    const [quizTree, setQuizTree] = useState([]);
    const [quiz, setQuiz] = useState(null);

    useEffect(() => {
        if (!user) {
            showAlert('⚠️ 无效用户, 跳转至登录页...')
            navigate('/'); // 刷新后，user 会变成 undefined，可在此做兜底处理
        }
        if (user.part(-1) === "editor") {
            setMode("EDITOR");
            setUser(user.replace(/\/editor$/, ""));
            return;
        }
        (async () => { setQuizList(await list_quiz(user)); })()
    }, [user]);

    useEffect(() => {
        setQuizTree(buildTree(quizList))
    }, [quizList])

    function SlotNewQuiz() {
        return (<button
            type="button"
            title="新建题库"
            className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900 
                                       focus-visible:outline focus-visible:outline-blue-500 
                                       cursor-pointer disabled:cursor-not-allowed"
            onClick={async () => {
                let qz = await showSimpleInputModal({ title: "新建题库名", label: "" });
                if (!qz) return
                console.log(qz)
                qz = qz.replace(/[\s-]+/g, '-');
                await new_quiz(user, qz)
                setQuizList(await list_quiz(user))
            }}
        >
            <NewQuizIcon />
        </button>)
    }

    function SlotDelQuiz({ quiz = "" }) {
        return (<button
            type="button"
            title="删除题库"
            disabled={!quiz || quiz.length === 0}
            className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900 
                                       focus-visible:outline focus-visible:outline-blue-500 
                                       cursor-pointer disabled:cursor-not-allowed"
            onClick={async () => {
                if (quiz == null || quiz?.length === 0) return
                const c = await count_qa(user, quiz, "question_count")
                if (c > 0) {
                    showAlert('非空题库不可删除', 'warning')
                    return
                }

                // TODO: delete QUIZ

                // qz = qz.replace(/[\s-]+/g, '-');
                // await new_quiz(user, qz)
                // setQuizList(await list_quiz(user))
            }}
        >
            <DelQuizIcon />
        </button>)
    }

    return (
        <>
            <AlertBanner alert={alertState} onClose={hideAlert} />

            {/* 关键布局：父容器 flex + 固定高度，右侧内容 flex-1 + min-w-0 */}
            <div className="flex h-screen w-screen overflow-hidden">
                <Sidebar
                    title="题库"
                    data={quizTree}
                    defaultExpandedIds={["components"]}
                    open={sidebarOpen}
                    selectedId={quiz?.id}
                    onSelect={(node) => setQuiz(node)} // 在这里接路由，如 navigate(node.path)
                    disablePanel={sidebarDisable}
                    user={user}
                    slotBtn_NewQuiz={mode === "EDITOR" ? <SlotNewQuiz /> : null}
                    slotBtn_DelQuiz={mode === "EDITOR" ? <SlotDelQuiz quiz={quiz?.id} /> : null}
                />
                <main className="min-w-0 flex-1 overflow-auto pt-6 pr-6">
                    {
                        mode === "QUIZ" ?
                            (<QuizPage
                                user={user}
                                selectedQuiz={quiz?.id}
                                onFetchQuiz={() => { setSidebarOpen(false); setSidebarDisable(true) }}
                                onSubmitQuiz={() => { setSidebarOpen(undefined); setSidebarDisable(false) }}
                            />) :
                            (< QuizEditor
                                user={user}
                                selectedQuiz={quiz?.id}
                            />)
                    }
                </main>
            </div>
        </>
    );
}

function NewQuizIcon() {
    return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
            <path d="M11 3.5H5.5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V9" />
            <path d="M15.5 2.5a1.414 1.414 0 0 1 2 2L10.5 11.5 8 12l.5-2.5 7-7Z" />
        </svg>
    );
}

function DelQuizIcon() {
    return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
            <path d="M3.5 5.5h13" />
            <path d="M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5" />
            <path d="M5 5.5l.8 10a1.5 1.5 0 0 0 1.5 1.5h5.4a1.5 1.5 0 0 0 1.5-1.5l.8-10" />
            <path d="M8.5 9v4.5M11.5 9v4.5" />
        </svg>
    );
}
