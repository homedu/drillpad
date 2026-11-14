import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 可隐藏 / 可拖拽调宽 / 树形结构的左侧导航栏
 *
 * 依赖：react、tailwindcss（无其它第三方库）
 *
 * 树数据结构：
 *   { id: string, label: string, children?: Node[] }
 *   没有 children（或为空数组）的节点即叶节点，点击会触发 onSelect(node)
 *
 * Props:
 *   data                 树数据 Node[]
 *   title                顶部标题（可选）
 *   selectedId           当前选中的叶节点 id（受控；不传则组件内部管理）
 *   onSelect(node)       点击叶节点回调
 *   defaultExpandedIds   默认展开的分支节点 id 数组
 *   open / onOpenChange  受控显示/隐藏（不传则组件内部管理）
 *   defaultOpen          非受控时的初始显示状态，默认 true
 *   defaultWidth         初始宽度(px)，默认 260
 *   minWidth / maxWidth  拖拽宽度范围，默认 180 / 480
 */
export default function Sidebar({
    data = [],
    title = "导航",
    selectedId: selectedIdProp,
    onSelect,
    defaultExpandedIds = [],
    open: openProp,
    onOpenChange,
    defaultOpen = true,
    defaultWidth = 260,
    minWidth = 180,
    maxWidth = 480,
    disablePanel = false,
    //
    user = "",
    slotBtn_NewQuiz = null,
    slotBtn_DelQuiz = null,
}) {
    /* ---------- 显示 / 隐藏 ---------- */
    const [openState, setOpenState] = useState(defaultOpen);
    const open = openProp ?? openState;
    const setOpen = useCallback(
        (v) => {
            if (openProp === undefined) setOpenState(v);
            onOpenChange?.(v);
        },
        [openProp, onOpenChange]
    );

    // 快捷键 Ctrl/Cmd + B 切换（不需要可删除）
    useEffect(() => {
        const onKey = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
                e.preventDefault();
                setOpen(!open);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, setOpen]);

    /* ---------- 拖拽调宽 ---------- */
    const [width, setWidth] = useState(defaultWidth);
    const [dragging, setDragging] = useState(false);
    const dragRef = useRef({ startX: 0, startWidth: 0 });

    const clamp = (w) => Math.min(maxWidth, Math.max(minWidth, w));

    const onPointerDown = (e) => {
        e.currentTarget.setPointerCapture(e.pointerId); // 鼠标移出手柄也能继续拖
        dragRef.current = { startX: e.clientX, startWidth: width };
        setDragging(true);
    };
    const onPointerMove = (e) => {
        if (!dragging) return;
        setWidth(clamp(dragRef.current.startWidth + e.clientX - dragRef.current.startX));
    };
    const onPointerUp = () => setDragging(false);

    // 拖拽时全局禁止选中文字、固定光标
    useEffect(() => {
        if (!dragging) return;
        const { userSelect, cursor } = document.body.style;
        document.body.style.userSelect = "none";
        document.body.style.cursor = "col-resize";
        return () => {
            document.body.style.userSelect = userSelect;
            document.body.style.cursor = cursor;
        };
    }, [dragging]);

    /* ---------- 树：展开 / 选中 ---------- */
    const [expanded, setExpanded] = useState(() => new Set(defaultExpandedIds));
    const toggle = useCallback((id) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }, []);

    const [innerSelected, setInnerSelected] = useState(null);
    const selectedId = selectedIdProp ?? innerSelected;
    const handleSelect = useCallback(
        (node) => {
            setInnerSelected(node.id);
            onSelect?.(node);
        },
        [onSelect]
    );

    return (
        // 外层占位：宽度随 open/width 变化，内容区 flex-1 会自动让位
        <div
            className={`relative h-full shrink-0 ${dragging ? "" : "transition-[width] duration-200 ease-out"}`}
            style={{ width: open ? width : 0 }}
        >
            <aside
                aria-label={title}
                aria-hidden={!open}
                className={`h-full overflow-hidden bg-slate-100 text-slate-700 ${open ? "" : "invisible"
                    } ${dragging ? "" : "transition-[visibility] duration-200"}`}
            >
                {/* 内层固定为当前宽度，动画过程中文字不会反复换行 */}
                <div
                    className="flex h-full flex-col border-r border-slate-200"
                    style={{ width }}
                >
                    <div className="flex h-12 shrink-0 items-center justify-between px-3">
                        <div className="flex items-center gap-2.5 py-1.5 min-w-0">
                            {/* 左侧首字母圆形微章 */}
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-800 text-xs font-semibold text-white uppercase">
                                {user?.trim()?.charAt(0) || "U"}
                            </div>
                            {/* 右侧用户名 */}
                            <span className="font-mono text-xs font-semibold text-zinc-700 tracking-wider uppercase truncate">
                                {user}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            title="隐藏导航栏 (Ctrl+B)"
                            aria-label="隐藏导航栏"
                            className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900 
                                       focus-visible:outline focus-visible:outline-blue-500 
                                       cursor-pointer disabled:cursor-not-allowed"
                        >
                            <PanelIcon />
                        </button>
                    </div>
                    <div className="flex h-12 shrink-0 items-center justify-between px-3">
                        <span className="truncate text-sm font-semibold text-slate-900">
                            {title}
                        </span>
                        <div className="ml-auto" >
                            <span>{slotBtn_NewQuiz}</span>
                            <span>{slotBtn_DelQuiz}</span>
                        </div>
                    </div>
                    <nav className="flex-1 overflow-y-auto px-2 pb-4">
                        <ul role="tree" className="space-y-px">
                            {data.map((node) => (
                                <TreeNode
                                    key={node.id}
                                    node={node}
                                    depth={0}
                                    expanded={expanded}
                                    toggle={toggle}
                                    selectedId={selectedId}
                                    onSelect={handleSelect}
                                />
                            ))}
                        </ul>
                    </nav>
                </div>
            </aside>

            {/* 拖拽手柄：双击恢复默认宽度 */}
            {open && (
                <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="调整导航栏宽度"
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    onDoubleClick={() => setWidth(defaultWidth)}
                    className={`absolute inset-y-0 -right-1 z-20 w-2 cursor-col-resize touch-none after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:transition-colors hover:after:bg-blue-500 ${dragging ? "after:bg-blue-500" : ""
                        }`}
                />
            )}

            {/* 隐藏后，在左上角显示一个展开按钮 */}
            {!open && (
                <button
                    type="button"
                    disabled={disablePanel}
                    onClick={() => setOpen(true)}
                    title="展开导航栏 (Ctrl+B)"
                    aria-label="展开导航栏"
                    className="absolute left-2 top-2 z-20 rounded border border-slate-200 bg-white p-1.5 cursor-pointer disabled:cursor-not-allowed
                             text-slate-500 shadow-sm hover:text-slate-900 focus-visible:outline focus-visible:outline-blue-500"
                >
                    <PanelIcon />
                </button>
            )}
        </div>
    );
}

/* ---------- 递归树节点 ---------- */
function TreeNode({ node, depth, expanded, toggle, selectedId, onSelect }) {
    const isBranch = Array.isArray(node.children) && node.children.length > 0;
    const isOpen = isBranch && expanded.has(node.id);
    const isSelected = !isBranch && selectedId === node.id;

    return (
        <li role="none">
            <button
                type="button"
                role="treeitem"
                aria-expanded={isBranch ? isOpen : undefined}
                aria-selected={isBranch ? undefined : isSelected}
                onClick={() => (isBranch ? toggle(node.id) : onSelect(node))}
                style={{ paddingLeft: 8 + depth * 16 }} // 每层缩进 16px
                className={`flex w-full items-center gap-1 rounded py-1.5 pr-2 text-left text-sm cursor-pointer focus-visible:outline focus-visible:outline-blue-500 
                    ${isSelected
                        ? "bg-blue-100 font-medium text-blue-800"
                        : isBranch
                            ? "font-medium text-slate-800 hover:bg-slate-200/70"
                            : "hover:bg-slate-200/70"
                    }`}
            >
                {isBranch ? (
                    <ChevronIcon
                        className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-150 ${isOpen ? "rotate-90" : ""
                            }`}
                    />
                ) : (
                    <span className="h-4 w-4 shrink-0" /> // 叶节点占位，保持文字对齐
                )}
                <span className="truncate">{node.label}</span>
            </button>

            {isOpen && (
                <ul role="group">
                    {node.children.map((child) => (
                        <TreeNode
                            key={child.id}
                            node={child}
                            depth={depth + 1}
                            expanded={expanded}
                            toggle={toggle}
                            selectedId={selectedId}
                            onSelect={onSelect}
                        />
                    ))}
                </ul>
            )}
        </li>
    );
}

/* ---------- 内联图标（避免引入图标库） ---------- */
function ChevronIcon({ className }) {
    return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
            <path d="M7 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function PanelIcon() {
    return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5" aria-hidden="true">
            <rect x="2.5" y="3.5" width="15" height="13" rx="2" />
            <path d="M8 3.5v13" />
        </svg>
    );
}
