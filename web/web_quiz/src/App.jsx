import { useState, useEffect } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { buildTree } from "../../utils/utils.js";
import { showSimpleInputModal } from "../../utils/ShowSimpleInputModal.jsx";
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
    const { connError, list_quiz, new_quiz } = useNatsFetch();
    const [mode, setMode] = useState("EDITOR");
    const [sidebarOpen, setSidebarOpen] = useState(undefined);
    const [sidebarDisable, setSidebarDisable] = useState(false);
    const [user] = useState(() => location.state?.username ?? "");
    const [isValidUser] = useState(() => { return user?.trim().length > 0 });

    // 挂载后立即用 replace: true 覆盖当前历史记录，清空 state
    useEffect(() => {
        if (location.state) {
            navigate(location.pathname + location.search, { replace: true, state: null });
        }
    }, [location, navigate]);

    // 刷新后，user 会变成 undefined，可在此做兜底处理
    if (!isValidUser) {
        navigate('/');
    }

    const [quizList, setQuizList] = useState([]);
    const [quizTree, setQuizTree] = useState([]);
    const [quiz, setQuiz] = useState(null);

    useEffect(() => {
        (
            async () => {
                if (isValidUser) {
                    setQuizList(await list_quiz(user));
                }
            }
        )()
    }, [user]);

    useEffect(() => {
        setQuizTree(buildTree(quizList))
    }, [quizList])

    function SlotNewQuiz() {
        return (<button
            type="button"
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

    const alertMsg = connError
        ? `⚠️ NATS 连接异常，功能不可用：${connError.message}`
        : !isValidUser
            ? '⚠️ 无效用户'
            : null;

    return (
        <>
            {alertMsg && (<p className="text-red-600 bg-red-100 p-3 rounded-md mt-3.75">{alertMsg}</p>)}

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
                    slotBtn_NewQuiz={mode === "EDITOR" ? <SlotNewQuiz /> : null}
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
            <path d="M11.5 2.5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7l-4.5-4.5Z" />
            <path d="M11.5 2.5V7H16" />
            <path d="M10 10.5v4M8 12.5h4" />
        </svg>
    );
}
