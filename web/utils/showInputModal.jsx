import { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";

/**
 * 命令式调用的居中富文本输入弹窗
 * 不依赖 Tailwind / 第三方库，也不使用 document.execCommand 等已废弃 API。
 *
 *   const result = await showInputModal({ title: "编辑备注" });
 *   if (result !== null) {
 *     result.html   // 富文本 HTML（只含 b / i / u / s 标签和 br / div）
 *     result.text   // 纯文本
 *   }
 *   // 只有点「提交」或「取消」才会关闭（点窗口外、按 Esc 都不会关闭）
 *   // 点「取消」返回 null；Ctrl/Cmd + Enter 等同于提交
 *
 * 可选参数：title, placeholder, defaultValue(初始 HTML), submitText, cancelText,
 *           width(默认 560), height(默认 420)
 *
 * 功能：加粗 / 斜体 / 下划线 / 删除线 / 清除格式（快捷键 Ctrl/Cmd + B / I / U）
 *       复制、剪切、粘贴一律纯文本；标题栏可拖动；8 个方向可缩放
 * 刻意不支持：撤销 / 重做（Ctrl+Z 已禁用）、列表、拖放内容进编辑框
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

// <editing-helpers>
// ===================== 文本格式：基于 Selection / Range 的实现 =====================
const ZW = "\u200b"; // 零宽空格：用于「光标处开启格式后继续输入」
const ZW_RE = /\u200b/g;

const FORMATS = {
    bold: { tag: "b", match: ["B", "STRONG"] },
    italic: { tag: "i", match: ["I", "EM"] },
    underline: { tag: "u", match: ["U"] },
    strike: { tag: "s", match: ["S", "STRIKE", "DEL"] },
};
const FORMAT_KEYS = Object.keys(FORMATS);

// 从 node 向上找（不超过 root）带有指定格式的元素
function closestFormat(node, fmt, root) {
    const { match } = FORMATS[fmt];
    let n = node;
    while (n && n !== root) {
        if (n.nodeType === 1 && match.includes(n.tagName)) return n;
        n = n.parentNode;
    }
    return null;
}

// 选区内所有「有实际文字」的文本节点（不修改 DOM）
function textNodesIn(range, root) {
    const out = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
        if (range.intersectsNode(n) && n.nodeValue.replace(ZW_RE, "")) out.push(n);
    }
    return out;
}

// 把选区的起止点切到文本节点边界上，使选区恰好由完整的文本节点组成
function splitBoundaries(range) {
    let sc = range.startContainer;
    let so = range.startOffset;
    let ec = range.endContainer;
    const eo = range.endOffset;

    if (ec.nodeType === 3 && eo > 0 && eo < ec.length) ec.splitText(eo);
    if (sc.nodeType === 3 && so > 0 && so < sc.length) {
        const right = sc.splitText(so);
        if (sc === ec) ec = right;
        sc = right;
        so = 0;
    }
    if (sc.nodeType === 3) {
        if (so >= sc.length) range.setStartAfter(sc);
        else range.setStart(sc, so);
    }
    if (ec.nodeType === 3) {
        if (eo === 0) range.setEndBefore(ec);
        else range.setEnd(ec, ec.length);
    }
    return range;
}

// 给文本节点包上格式标签，并与相邻的同类标签合并
function wrap(node, fmt) {
    let el = document.createElement(FORMATS[fmt].tag);
    node.before(el);
    el.appendChild(node);
    const prev = el.previousSibling;
    if (prev && prev.nodeType === 1 && prev.tagName === el.tagName) {
        prev.append(...el.childNodes);
        el.remove();
        el = prev;
    }
    const next = el.nextSibling;
    if (next && next.nodeType === 1 && next.tagName === el.tagName) {
        el.append(...next.childNodes);
        next.remove();
    }
}

// 去掉片段里因拆分产生的空元素
function pruneEmpty(frag) {
    [...frag.querySelectorAll("*")].reverse().forEach((e) => {
        if (!e.textContent && !e.querySelector("br,img")) e.remove();
    });
}

// 只把这个文本节点从格式标签中「拆」出来，标签内其余部分保持原格式
function unformat(node, fmt, root) {
    const el = closestFormat(node, fmt, root);
    if (!el) return;

    const afterRange = document.createRange();
    afterRange.setStartAfter(node);
    afterRange.setEnd(el, el.childNodes.length);
    const afterFrag = afterRange.extractContents();
    pruneEmpty(afterFrag);
    if (afterFrag.textContent) {
        const c = el.cloneNode(false);
        c.appendChild(afterFrag);
        el.after(c);
    }

    const beforeRange = document.createRange();
    beforeRange.setStart(el, 0);
    beforeRange.setEndBefore(node);
    const beforeFrag = beforeRange.extractContents();
    pruneEmpty(beforeFrag);
    if (beforeFrag.textContent) {
        const c = el.cloneNode(false);
        c.appendChild(beforeFrag);
        el.before(c);
    }

    while (el.firstChild) el.before(el.firstChild);
    el.remove();
}

function placeCaret(sel, node, offset) {
    const r = document.createRange();
    r.setStart(node, offset);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
}

// 光标（无选中文字）时切换格式：用零宽空格占位，之后输入的文字就带上 / 不带该格式
function toggleAtCaret(root, range, fmt, sel) {
    const zw = document.createTextNode(ZW);
    const el = closestFormat(range.startContainer, fmt, root);

    if (!el) {
        const w = document.createElement(FORMATS[fmt].tag);
        w.appendChild(zw);
        range.insertNode(w);
    } else {
        // 光标所在位置还有哪些「在 el 内部」的其它格式，需要在新位置保留
        const others = FORMAT_KEYS.filter((k) => {
            if (k === fmt) return false;
            const o = closestFormat(range.startContainer, k, root);
            return o && el.contains(o);
        });

        const afterRange = document.createRange();
        afterRange.setStart(range.startContainer, range.startOffset);
        afterRange.setEnd(el, el.childNodes.length);
        const frag = afterRange.extractContents();

        let node = zw;
        others.forEach((k) => {
            const w = document.createElement(FORMATS[k].tag);
            w.appendChild(node);
            node = w;
        });
        el.after(node);
        if (frag.textContent) {
            const c = el.cloneNode(false);
            c.appendChild(frag);
            node.after(c);
        }
        if (!el.textContent) el.remove();
    }
    placeCaret(sel, zw, 1);
}

// 切换格式：选区内全部已有该格式 → 取消；否则 → 全部加上
function toggleFormat(root, fmt) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0).cloneRange();
    if (!root.contains(range.commonAncestorContainer)) return;

    if (range.collapsed) {
        toggleAtCaret(root, range, fmt, sel);
        return;
    }
    splitBoundaries(range);
    const nodes = textNodesIn(range, root);
    if (!nodes.length) return;

    const allOn = nodes.every((n) => closestFormat(n, fmt, root));
    nodes.forEach((n) => {
        if (allOn) unformat(n, fmt, root);
        else if (!closestFormat(n, fmt, root)) wrap(n, fmt);
    });
    restoreSelection(sel, nodes);
}

// 清除选区内的全部格式
function clearFormat(root) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0).cloneRange();
    if (!root.contains(range.commonAncestorContainer) || range.collapsed) return;

    splitBoundaries(range);
    const nodes = textNodesIn(range, root);
    if (!nodes.length) return;
    nodes.forEach((n) =>
        FORMAT_KEYS.forEach((fmt) => {
            while (closestFormat(n, fmt, root)) unformat(n, fmt, root);
        })
    );
    restoreSelection(sel, nodes);
}

function restoreSelection(sel, nodes) {
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const r = document.createRange();
    r.setStart(first, 0);
    r.setEnd(last, last.length);
    sel.removeAllRanges();
    sel.addRange(r);
}

// 工具栏按钮是否处于「已应用」状态
function isActive(root, fmt) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return false;
    const range = sel.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) return false;
    if (range.collapsed) return !!closestFormat(range.startContainer, fmt, root);
    const nodes = textNodesIn(range, root);
    return nodes.length > 0 && nodes.every((n) => closestFormat(n, fmt, root));
}

// 在当前选区位置插入纯文本（换行转为 <br>）
function insertPlainText(root, text) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) return;
    range.deleteContents();

    const frag = document.createDocumentFragment();
    text
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .forEach((line, i) => {
            if (i) frag.appendChild(document.createElement("br"));
            if (line) frag.appendChild(document.createTextNode(line));
        });
    const last = frag.lastChild;
    if (!last) return;
    range.insertNode(frag);
    // 末尾是换行时，补一个 <br> 才能让光标显示在新的一行
    if (last.nodeName === "BR" && !last.nextSibling) {
        last.after(document.createElement("br"));
    }
    const r = document.createRange();
    r.setStartAfter(last);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
}

// 提交时清理：去掉零宽空格和空的格式标签
function cleanHtml(el) {
    const c = el.cloneNode(true);
    const walker = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
    const ts = [];
    let n;
    while ((n = walker.nextNode())) ts.push(n);
    ts.forEach((t) => (t.nodeValue = t.nodeValue.replace(ZW_RE, "")));
    [...c.querySelectorAll("b,strong,i,em,u,s,strike,del")]
        .reverse()
        .forEach((e) => {
            if (!e.textContent && !e.querySelector("br,img")) e.remove();
        });
    c.normalize();
    return c.innerHTML;
}
// </editing-helpers>

// ===================== 弹窗 UI =====================
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
    { fmt: "bold", label: <b>B</b>, title: "加粗 (Ctrl+B)" },
    { fmt: "italic", label: <i>I</i>, title: "斜体 (Ctrl+I)" },
    { fmt: "underline", label: <u>U</u>, title: "下划线 (Ctrl+U)" },
    { fmt: "strike", label: <s>S</s>, title: "删除线" },
    "|",
    { fmt: "clear", label: "Tx", title: "清除选中文字的格式" },
];
const HANDLES = ["n", "s", "e", "w", "nw", "ne", "sw", "se"];
const INPUT_TO_FORMAT = {
    formatBold: "bold",
    formatItalic: "italic",
    formatUnderline: "underline",
    formatStrikeThrough: "strike",
};

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

    const refreshActive = () => {
        const el = editorRef.current;
        if (!el) return;
        const next = {};
        FORMAT_KEYS.forEach((k) => (next[k] = isActive(el, k)));
        setActive(next);
    };

    const applyFormat = (fmt) => {
        const el = editorRef.current;
        el.focus();
        if (fmt === "clear") clearFormat(el);
        else toggleFormat(el, fmt);
        refreshActive();
    };

    // 初始内容 + 聚焦到末尾 + 拦截浏览器自带的撤销 / 拖放 / 格式输入
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

        const onBeforeInput = (e) => {
            const t = e.inputType || "";
            if (INPUT_TO_FORMAT[t]) {
                e.preventDefault();
                applyFormat(INPUT_TO_FORMAT[t]);
            } else if (
                t === "historyUndo" ||
                t === "historyRedo" ||
                t === "insertFromDrop" ||
                t.startsWith("format")
            ) {
                e.preventDefault();
            }
        };
        el.addEventListener("beforeinput", onBeforeInput);
        return () => el.removeEventListener("beforeinput", onBeforeInput);
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

    // 选区变化时刷新工具栏按钮状态
    useEffect(() => {
        document.addEventListener("selectionchange", refreshActive);
        return () => document.removeEventListener("selectionchange", refreshActive);
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const submit = () => {
        const el = editorRef.current;
        const text = el.innerText.replace(ZW_RE, "").trim();
        onSubmit({ html: text ? cleanHtml(el) : "", text });
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
                                        key={t.fmt}
                                        type="button"
                                        title={t.title}
                                        className={"sim-tool" + (active[t.fmt] ? " on" : "")}
                                        onMouseDown={(e) => e.preventDefault()} // 不抢走编辑框焦点/选区
                                        onClick={() => applyFormat(t.fmt)}
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
                                e.preventDefault();
                                insertPlainText(editorRef.current, e.clipboardData.getData("text/plain"));
                            }}
                            onCopy={(e) => {
                                e.preventDefault();
                                e.clipboardData.setData(
                                    "text/plain",
                                    window.getSelection().toString().replace(ZW_RE, "")
                                );
                            }}
                            onCut={(e) => {
                                e.preventDefault();
                                const sel = window.getSelection();
                                e.clipboardData.setData("text/plain", sel.toString().replace(ZW_RE, ""));
                                sel.deleteFromDocument();
                            }}
                            onDrop={(e) => e.preventDefault()}
                            onKeyDown={(e) => {
                                const mod = e.ctrlKey || e.metaKey;
                                if (mod && e.key === "Enter") {
                                    e.preventDefault();
                                    submit();
                                } else if (mod && !e.shiftKey && !e.altKey) {
                                    const k = e.key.toLowerCase();
                                    const fmt = { b: "bold", i: "italic", u: "underline" }[k];
                                    if (fmt) {
                                        e.preventDefault();
                                        applyFormat(fmt);
                                    } else if (k === "z" || k === "y") {
                                        e.preventDefault(); // 撤销 / 重做已禁用
                                    }
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
