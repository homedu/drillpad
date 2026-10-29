import { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";

/**
 * 命令式调用的居中富文本输入弹窗（不依赖 Tailwind / 任何第三方库）
 *
 *   const result = await showInputModal({ title: "编辑备注" });
 *   if (result !== null) {
 *     result.html   // 富文本 HTML 字符串
 *     result.text   // 纯文本
 *   }
 *   // 只有点「提交」或「取消」才会关闭；点窗口外、按 Esc 都不会关闭
 *   // 点「取消」返回 null；Ctrl/Cmd + Enter 等同于提交
 *
 * 可选参数：
 *   title, placeholder, defaultValue(初始 HTML), submitText, cancelText,
 *   width(默认 560), height(默认 420)
 *
 * 功能：标题栏拖动移动；8 个方向都可拖拽缩放；缩放时按钮始终在右下角；
 *       编辑框与窗口左/右/上(标题栏)/下(按钮栏)的间距相等（16px）。
 * 需要 React 18+。
 */
export function showInputModal(options = {}) {
    return new Promise((resolve) => {
        const container = document.createElement("div");
        document.body.appendChild(container);
        const root = createRoot(container);

        const close = (result) => {
            root.unmount();
            container.remove();
            resolve(result);
        };

        root.render(
            <ModalView
                {...options}
                onSubmit={(r) => close(r)}
                onCancel={() => close(null)}
            />
        );
    });
}

const MIN_W = 340;
const MIN_H = 260;
const GAP = 16; // 编辑框到窗口各边的统一间距

const clamp = (v, a, b) => Math.min(Math.max(v, a), Math.max(a, b));

const CSS = `
.sim-dialog, .sim-dialog * { box-sizing: border-box; }
.sim-dialog {
  position: fixed; display: flex; flex-direction: column;
  background: #fff; color: #1c2330;
  border: 1px solid #cbd5e1; border-radius: 10px;
  box-shadow: 0 20px 50px rgba(0,0,0,.35);
  font-family: system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 14px;
}
.sim-header {
  flex: none; height: 44px; padding: 0 ${GAP}px;
  display: flex; align-items: center;
  font-size: 16px; font-weight: 600;
  border-bottom: 1px solid #e2e8f0;
  border-radius: 10px 10px 0 0;
  cursor: move; user-select: none; touch-action: none;
}
.sim-body { flex: 1; min-height: 0; padding: ${GAP}px ${GAP}px 0; display: flex; }
.sim-box {
  flex: 1; min-width: 0; min-height: 0;
  display: flex; flex-direction: column;
  border: 1px solid #c5ccd6; border-radius: 6px; background: #fff;
}
.sim-box:focus-within { border-color: #2b5fd9; box-shadow: 0 0 0 3px rgba(43,95,217,.25); }
.sim-toolbar {
  flex: none; display: flex; flex-wrap: wrap; gap: 2px; padding: 4px;
  border-bottom: 1px solid #e2e8f0; background: #f8fafc; border-radius: 6px 6px 0 0;
}
.sim-tool {
  min-width: 28px; height: 28px; padding: 0 6px;
  border: 1px solid transparent; border-radius: 4px;
  background: transparent; color: #1c2330; font-size: 14px; cursor: pointer;
}
.sim-tool:hover { background: #e2e8f0; }
.sim-tool.on { background: #dbe6fb; border-color: #9db8ee; }
.sim-sep { width: 1px; margin: 4px 3px; background: #cbd5e1; }
.sim-editor {
  flex: 1; min-height: 0; overflow: auto; padding: 10px 12px;
  outline: none; line-height: 1.55; font-size: 15px; word-break: break-word;
}
.sim-editor:empty:before { content: attr(data-placeholder); color: #94a3b8; pointer-events: none; }
.sim-editor ul, .sim-editor ol { margin: 4px 0; padding-left: 24px; }
.sim-editor ul { list-style: disc; }
.sim-editor ol { list-style: decimal; }
.sim-footer {
  flex: none; display: flex; justify-content: flex-end; gap: 10px;
  padding: ${GAP}px;
}
.sim-btn { padding: 8px 16px; font-size: 14px; border-radius: 6px; cursor: pointer; }
.sim-btn.cancel { color: #1c2330; background: #eef1f5; border: 1px solid #cbd5e1; }
.sim-btn.cancel:hover { background: #e2e8f0; }
.sim-btn.submit { color: #fff; background: #2b5fd9; border: 1px solid #2b5fd9; }
.sim-btn.submit:hover { background: #1e4fc0; }
.sim-h { position: absolute; touch-action: none; }
.sim-h.n  { top: 0;    left: 14px;  right: 14px;  height: 6px; cursor: ns-resize; }
.sim-h.s  { bottom: 0; left: 14px;  right: 14px;  height: 6px; cursor: ns-resize; }
.sim-h.e  { right: 0;  top: 14px;   bottom: 14px; width: 6px;  cursor: ew-resize; }
.sim-h.w  { left: 0;   top: 14px;   bottom: 14px; width: 6px;  cursor: ew-resize; }
.sim-h.nw { top: 0;    left: 0;     width: 14px; height: 14px; cursor: nwse-resize; }
.sim-h.se { bottom: 0; right: 0;    width: 14px; height: 14px; cursor: nwse-resize;
  background: linear-gradient(135deg, transparent 55%, #94a3b8 55%, #94a3b8 62%, transparent 62%,
    transparent 74%, #94a3b8 74%, #94a3b8 81%, transparent 81%); }
.sim-h.ne { top: 0;    right: 0;    width: 14px; height: 14px; cursor: nesw-resize; }
.sim-h.sw { bottom: 0; left: 0;     width: 14px; height: 14px; cursor: nesw-resize; }
`;

const TOOLS = [
    { cmd: "bold", label: <b>B</b>, title: "加粗" },
    { cmd: "italic", label: <i>I</i>, title: "斜体" },
    { cmd: "underline", label: <u>U</u>, title: "下划线" },
    { cmd: "strikeThrough", label: <s>S</s>, title: "删除线" },
    "|",
    { cmd: "insertUnorderedList", label: "•", title: "无序列表" },
    { cmd: "insertOrderedList", label: "1.", title: "有序列表" },
    "|",
    { cmd: "undo", label: "↶", title: "撤销" },
    { cmd: "redo", label: "↷", title: "重做" },
    { cmd: "removeFormat", label: "Tx", title: "清除格式" },
];
const STATEFUL = ["bold", "italic", "underline", "strikeThrough", "insertUnorderedList", "insertOrderedList"];
const HANDLES = ["n", "s", "e", "w", "nw", "ne", "sw", "se"];

function ModalView({
    title = "输入内容",
    placeholder = "请输入…",
    defaultValue = "",
    submitText = "提交",
    cancelText = "取消",
    width = 560,
    height = 420,
    onSubmit,
    onCancel,
}) {
    const editorRef = useRef(null);
    const [active, setActive] = useState({});
    const [rect, setRect] = useState(() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const w = Math.min(width, vw - 32);
        const h = Math.min(height, vh - 32);
        return { x: (vw - w) / 2, y: (vh - h) / 2, w, h };
    });

    // 初始内容 + 聚焦到末尾
    useEffect(() => {
        const el = editorRef.current;
        if (defaultValue) el.innerHTML = defaultValue;
        el.focus();
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 锁定页面滚动
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);

    // 浏览器窗口变化时，保证弹窗不超出视口
    useEffect(() => {
        const onResize = () =>
            setRect((r) => {
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                const w = Math.min(r.w, vw);
                const h = Math.min(r.h, vh);
                return { w, h, x: clamp(r.x, 0, vw - w), y: clamp(r.y, 0, vh - h) };
            });
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    // 工具栏按钮的选中状态
    useEffect(() => {
        const onSel = () => {
            const el = editorRef.current;
            const sel = window.getSelection();
            if (!el || !sel.rangeCount || !el.contains(sel.anchorNode)) return;
            const next = {};
            STATEFUL.forEach((c) => (next[c] = document.queryCommandState(c)));
            setActive(next);
        };
        document.addEventListener("selectionchange", onSel);
        return () => document.removeEventListener("selectionchange", onSel);
    }, []);

    // 拖动 / 缩放
    const begin = (e, mode) => {
        if (e.button !== undefined && e.button !== 0) return;
        e.preventDefault();
        const sx = e.clientX;
        const sy = e.clientY;
        const r = { ...rect };

        const move = (ev) => {
            const dx = ev.clientX - sx;
            const dy = ev.clientY - sy;
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            let { x, y, w, h } = r;
            if (mode === "move") {
                x = clamp(r.x + dx, 0, vw - r.w);
                y = clamp(r.y + dy, 0, vh - r.h);
            } else {
                if (mode.includes("e")) w = clamp(r.w + dx, MIN_W, vw - r.x);
                if (mode.includes("w")) {
                    x = clamp(r.x + dx, 0, r.x + r.w - MIN_W);
                    w = r.x + r.w - x;
                }
                if (mode.includes("s")) h = clamp(r.h + dy, MIN_H, vh - r.y);
                if (mode.includes("n")) {
                    y = clamp(r.y + dy, 0, r.y + r.h - MIN_H);
                    h = r.y + r.h - y;
                }
            }
            setRect({ x, y, w, h });
        };
        const up = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
            window.removeEventListener("pointercancel", up);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
        window.addEventListener("pointercancel", up);
    };

    const exec = (cmd) => {
        editorRef.current.focus();
        document.execCommand(cmd, false, null);
        const next = {};
        STATEFUL.forEach((c) => (next[c] = document.queryCommandState(c)));
        setActive(next);
    };

    const submit = () => {
        const el = editorRef.current;
        const text = el.innerText.replace(/\u200b/g, "").trim();
        const hasMedia = !!el.querySelector("img,table,hr");
        onSubmit({ html: text || hasMedia ? el.innerHTML : "", text });
    };

    return (
        // 遮罩：只挡住下层页面，点击不会关闭窗口
        <div
            style={{
                position: "fixed",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                zIndex: 2147483647,
                background: "rgba(20, 24, 31, 0.5)",
            }}
        >
            <style>{CSS}</style>
            <div
                className="sim-dialog"
                role="dialog"
                aria-modal="true"
                aria-label={title}
                style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
            >
                <div className="sim-header" onPointerDown={(e) => begin(e, "move")}>
                    {title}
                </div>

                <div className="sim-body">
                    <div className="sim-box">
                        <div className="sim-toolbar">
                            {TOOLS.map((t, i) =>
                                t === "|" ? (
                                    <span key={i} className="sim-sep" />
                                ) : (
                                    <button
                                        key={t.cmd}
                                        type="button"
                                        title={t.title}
                                        className={"sim-tool" + (active[t.cmd] ? " on" : "")}
                                        onMouseDown={(e) => e.preventDefault()} // 不抢走编辑框焦点/选区
                                        onClick={() => exec(t.cmd)}
                                    >
                                        {t.label}
                                    </button>
                                )
                            )}
                        </div>
                        <div
                            ref={editorRef}
                            className="sim-editor"
                            contentEditable
                            suppressContentEditableWarning
                            data-placeholder={placeholder}
                            onInput={(e) => {
                                // 清空后浏览器会残留 <br>，去掉以便显示占位符
                                if (e.currentTarget.innerHTML === "<br>") e.currentTarget.innerHTML = "";
                            }}
                            onPaste={(e) => {
                                // 粘贴只保留纯文本，避免带入外部样式
                                e.preventDefault();
                                const t = e.clipboardData.getData("text/plain");
                                document.execCommand("insertText", false, t);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                                    e.preventDefault();
                                    submit();
                                }
                            }}
                        />
                    </div>
                </div>

                <div className="sim-footer">
                    <button type="button" className="sim-btn cancel" onClick={onCancel}>
                        {cancelText}
                    </button>
                    <button type="button" className="sim-btn submit" onClick={submit}>
                        {submitText}
                    </button>
                </div>

                {HANDLES.map((h) => (
                    <div key={h} className={"sim-h " + h} onPointerDown={(e) => begin(e, h)} />
                ))}
            </div>
        </div>
    );
}

// ---------- 使用示例 ----------
export default function Demo() {
    const [result, setResult] = useState(null);

    const handleClick = async () => {
        const r = await showInputModal({
            title: "编辑备注",
            defaultValue: result?.html || "",
        });
        if (r !== null) setResult(r);
    };

    return (
        <div style={{ padding: 40 }}>
            <button onClick={handleClick}>打开窗口</button>
            <p style={{ marginTop: 16 }}>提交的内容：</p>
            {/* 注意：展示来自不可信来源的 HTML 前请先做净化（如 DOMPurify） */}
            <div
                style={{ border: "1px solid #ccc", padding: 12, minHeight: 40 }}
                dangerouslySetInnerHTML={{ __html: result?.html || "（无）" }}
            />
        </div>
    );
}
