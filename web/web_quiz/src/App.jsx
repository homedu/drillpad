import { useState, useEffect } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { buildTree } from "../../utils/utils.js";
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

    const { connError, list_quiz } = useNatsFetch();

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
                />
                <main className="min-w-0 flex-1 overflow-auto pt-6 pr-6">
                    {false && (<QuizPage
                        user={user}
                        selectedQuiz={quiz?.id}
                        onFetchQuiz={() => { setSidebarOpen(false); setSidebarDisable(true) }}
                        onSubmitQuiz={() => { setSidebarOpen(undefined); setSidebarDisable(false) }}
                    />)}
                    <QuizEditor
                        user={user}
                        selectedQuiz={quiz?.id}
                    />
                </main>
            </div>
        </>
    );
}
