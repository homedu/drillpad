import { useState, useEffect } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { buildTree } from "../../utils/utils.js";
import { useNatsFetch } from "../../net_service/useNatsFetch.js";
import Sidebar from "./components/Sidebar";
import QuizPage from './components/QuizPage';

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
    const { connError, list_quiz } = useNatsFetch();

    const [sidebarOpen, setSidebarOpen] = useState(undefined);
    const [sidebarDisable, setSidebarDisable] = useState(false);

    const user = location.state?.username ?? "";
    const isValidUser = () => { return user.trim().length > 0 }

    const [quizList, setQuizList] = useState([]);
    const [quizTree, setQuizTree] = useState([]);
    const [quiz, setQuiz] = useState(null);

    useEffect(() => {
        (
            async () => {
                if (isValidUser()) {
                    setQuizList(await list_quiz(user));
                }
            }
        )()
    }, [user]);

    useEffect(() => {
        setQuizTree(buildTree(quizList))
    }, [quizList])

    return (
        // 关键布局：父容器 flex + 固定高度，右侧内容 flex-1 + min-w-0
        <div className="flex h-screen w-screen overflow-hidden">

            {connError && (<p className="text-red-600 bg-red-100 p-3 rounded-md mt-3.75"> ⚠️ NATS 连接异常，功能不可用：{connError.message} </p>)}
            {!isValidUser() && (<p className="text-red-600 bg-red-100 p-3 rounded-md mt-3.75"> ⚠️ 无效用户 </p>)}

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
                <QuizPage
                    user={user}
                    selectedQuiz={quiz?.id}
                    onFetchQuiz={() => { setSidebarOpen(false); setSidebarDisable(true) }}
                    onSubmitQuiz={() => { setSidebarOpen(undefined); setSidebarDisable(false) }}
                />
            </main>
        </div>
    );
}
