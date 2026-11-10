import { useState } from "react";
import Sidebar from "./components/Sidebar";
import QuizPage from './components/QuizPage';

// 树数据：有 children 的是分支（点击折叠/展开），没有的是叶节点（点击触发 onSelect）
const treeData = [
    {
        id: "guide",
        label: "入门指南",
        children: [
            { id: "guide/install", label: "安装" },
            { id: "guide/quickstart", label: "快速开始" },
        ],
    },
    {
        id: "components",
        label: "组件",
        children: [
            { id: "components/button", label: "Button 按钮" },
            {
                id: "components/form",
                label: "表单",
                children: [
                    { id: "components/form/input", label: "Input 输入框" },
                    { id: "components/form/select", label: "Select 选择器" },
                ],
            },
        ],
    },
    {
        id: "changelog",
        label: "更新日志"
    }, // 顶层叶节点也可以
];

export default function App() {
    const [current, setCurrent] = useState(null);
    return (
        // 关键布局：父容器 flex + 固定高度，右侧内容 flex-1 + min-w-0
        <div className="flex h-screen w-screen overflow-hidden">
            <Sidebar
                title="文档"
                data={treeData}
                defaultExpandedIds={["components"]}
                selectedId={current?.id}
                onSelect={(node) => setCurrent(node)} // 在这里接路由，如 navigate(node.path)
            />
            <main className="min-w-0 flex-1 overflow-auto pt-6 pr-6">
                <QuizPage />
            </main>
        </div>
    );
}
