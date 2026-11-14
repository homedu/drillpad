import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";

/**
 * RichTextEditor —— 可直接替换 <textarea> 的富文本编辑器（即插即用）
 *
 *   <RichTextEditor
 *       className={tw.textarea}
 *       value={question}                                  // HTML 字符串
 *       onChange={(e) => setQuestion(e.target.value)}     // e.target.value = HTML，e.target.text = 纯文本
 *       onBlur={(e) => setQuestion(e.target.value.trim())}
 *       placeholder="输入题目内容"
 *       rows={3}
 *   />
 *
 * 事件对象：e.target.value（HTML）、e.target.text（纯文本）、e.target.html（同 value）。
 * 内容为空时 value 和 text 都是 ""。
 *
 * 特性
 *  - 加粗 / 斜体 / 下划线 / 删除线 / 清除格式（Ctrl/Cmd + B / I / U）
 *  - 支持「只取消选中的那一部分」格式，也支持光标处开启格式后继续输入
 *  - 右下角拖动改变高度；内容超出时才出现竖直滚动条
 *  - 复制、剪切、粘贴一律纯文本
 *  - 不依赖任何第三方库，不使用 execCommand / queryCommandState 等已废弃 API
 * 刻意不支持：撤销 / 重做（浏览器原生撤销栈会被手动 DOM 修改破坏，因此禁用）、列表、拖放内容进编辑框
 *
 * className 作用在编辑区本身（和 textarea 一致），所以边框、内边距、圆角等沿用你原来的样式。
 * 注意：className 里如果有 resize-none，需要去掉，否则无法拖动高度。
 * 需要 React 16.8+。
 */

// ===================== 文本格式：基于 Selection / Range =====================
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
    const so = range.startOffset;
    let ec = range.endContainer;
    const eo = range.endOffset;

    if (ec.nodeType === 3 && eo > 0 && eo < ec.length) ec.splitText(eo);
    if (sc.nodeType === 3 && so > 0 && so < sc.length) {
        const right = sc.splitText(so);
        if (sc === ec) ec = right;
        sc = right;
        range.setStart(sc, 0);
    } else if (sc.nodeType === 3) {
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

function restoreSelection(sel, nodes) {
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const r = document.createRange();
    r.setStart(first, 0);
    r.setEnd(last, last.length);
    sel.removeAllRanges();
    sel.addRange(r);
}

// 切换格式：选区内全部已有该格式 → 取消；否则 → 全部加上
function toggleFormat(root, fmt) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return false;
    const range = sel.getRangeAt(0).cloneRange();
    if (!root.contains(range.commonAncestorContainer)) return false;

    if (range.collapsed) {
        toggleAtCaret(root, range, fmt, sel);
        return true;
    }
    splitBoundaries(range);
    const nodes = textNodesIn(range, root);
    if (!nodes.length) return false;

    const allOn = nodes.every((n) => closestFormat(n, fmt, root));
    nodes.forEach((n) => {
        if (allOn) unformat(n, fmt, root);
        else if (!closestFormat(n, fmt, root)) wrap(n, fmt);
    });
    restoreSelection(sel, nodes);
    return true;
}

// 清除选区内的全部格式
function clearFormat(root) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return false;
    const range = sel.getRangeAt(0).cloneRange();
    if (!root.contains(range.commonAncestorContainer) || range.collapsed) return false;

    splitBoundaries(range);
    const nodes = textNodesIn(range, root);
    if (!nodes.length) return false;
    nodes.forEach((n) =>
        FORMAT_KEYS.forEach((fmt) => {
            while (closestFormat(n, fmt, root)) unformat(n, fmt, root);
        })
    );
    restoreSelection(sel, nodes);
    return true;
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
    if (!sel || !sel.rangeCount) return false;
    const range = sel.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) return false;
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
    if (!last) return false;
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
    return true;
}

// 输出时清理：去掉零宽空格和空的格式标签
function cleanHtml(el) {
    const c = el.cloneNode(true);
    const walker = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
    const ts = [];
    let n;
    while ((n = walker.nextNode())) ts.push(n);
    ts.forEach((t) => (t.nodeValue = t.nodeValue.replace(ZW_RE, "")));
    [...c.querySelectorAll("b,strong,i,em,u,s,strike,del")].reverse().forEach((e) => {
        if (!e.textContent && !e.querySelector("br,img")) e.remove();
    });
    c.normalize();
    return c.innerHTML;
}

// 没有任何文字、换行、图片时视为空
function isEmpty(el) {
    return !el.textContent.replace(ZW_RE, "") && !el.querySelector("br,img");
}

function readValue(el) {
    if (!el || isEmpty(el)) return { html: "", text: "" };
    return { html: cleanHtml(el), text: el.innerText.replace(ZW_RE, "") };
}

// ===================== 样式（只注入一次） =====================
const STYLE_ID = "rte-style";
const CSS = `
.rte-root { width: 100%; box-sizing: border-box; }
.rte-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 2px; margin-bottom: 4px; }
.rte-tool {
  min-width: 26px; height: 26px; padding: 0 6px;
  border: 1px solid transparent; border-radius: 4px;
  background: transparent; color: inherit; font: inherit; font-size: 13px; line-height: 1; cursor: pointer;
}
.rte-tool:hover:not(:disabled) { background: rgba(100,116,139,.18); }
.rte-tool.rte-on { background: rgba(43,95,217,.16); border-color: rgba(43,95,217,.45); }
.rte-tool:disabled { opacity: .45; cursor: not-allowed; }
.rte-sep { width: 1px; height: 16px; margin: 0 3px; background: rgba(100,116,139,.45); }

/* 以下默认外观用 :where 降为 0 优先级，你传入的 className 一定能覆盖 */
:where(.rte-editor) {
  width: 100%; padding: 8px 10px;
  border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; color: inherit;
  font: inherit;
}
.rte-editor {
  display: block; box-sizing: border-box;
  overflow-y: auto;            /* 内容超出时才出现竖直滚动条，未超出自动隐藏 */
  overflow-x: hidden;
  resize: vertical;            /* 右下角拖动改变高度 */
  outline: none;
  white-space: pre-wrap; word-break: break-word;
  line-height: 1.5;
}
.rte-editor:focus { border-color: #2b5fd9; box-shadow: 0 0 0 3px rgba(43,95,217,.2); }
.rte-editor:empty:before { content: attr(data-placeholder); color: #94a3b8; pointer-events: none; }
.rte-editor[contenteditable="false"] { opacity: .6; cursor: not-allowed; resize: none; }
`;

if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
    const s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = CSS;
    document.head.appendChild(s);
}

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const TOOLS = [
    { fmt: "bold", label: <b>B</b>, title: "加粗 (Ctrl+B)" },
    { fmt: "italic", label: <i>I</i>, title: "斜体 (Ctrl+I)" },
    { fmt: "underline", label: <u>U</u>, title: "下划线 (Ctrl+U)" },
    { fmt: "strike", label: <s>S</s>, title: "删除线" },
    "|",
    { fmt: "clear", label: "Tx", title: "清除选中文字的格式" },
];

const INPUT_TO_FORMAT = {
    formatBold: "bold",
    formatItalic: "italic",
    formatUnderline: "underline",
    formatStrikeThrough: "strike",
};

// ===================== 组件 =====================
export default function RichTextEditor({
    value = "",
    onChange,
    onBlur,
    onFocus,
    placeholder = "",
    rows = 3,
    className = "",
    style,
    name,
    disabled = false,
    toolbar = true,
}) {
    const ref = useRef(null);
    const [active, setActive] = useState({});

    // 始终拿到最新的回调，避免原生事件监听里用到过期闭包
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    // 构造「类 textarea」事件：保留原事件的方法（preventDefault 等），覆盖 target
    const emit = useCallback(
        (handler, base, type) => {
            if (!handler) return;
            const { html, text } = readValue(ref.current);
            const e = Object.create(base || { type });
            Object.defineProperty(e, "target", {
                value: { name, value: html, html, text },
                enumerable: true,
                configurable: true,
            });
            Object.defineProperty(e, "currentTarget", {
                value: ref.current,
                enumerable: true,
                configurable: true,
            });
            handler(e);
        },
        [name]
    );

    // 外部 value 变化时同步；与当前内容一致则跳过，避免光标跳动
    useIsoLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const next = value || "";
        if (readValue(el).html !== next) el.innerHTML = next;
    }, [value]);

    const refreshActive = useCallback(() => {
        const el = ref.current;
        if (!el) return;
        const next = {};
        FORMAT_KEYS.forEach((k) => (next[k] = isActive(el, k)));
        setActive((prev) => (FORMAT_KEYS.every((k) => prev[k] === next[k]) ? prev : next));
    }, []);

    useEffect(() => {
        document.addEventListener("selectionchange", refreshActive);
        return () => document.removeEventListener("selectionchange", refreshActive);
    }, [refreshActive]);

    const applyFormat = useCallback(
        (fmt) => {
            const el = ref.current;
            if (!el || el.getAttribute("contenteditable") === "false") return;
            el.focus();
            const changed = fmt === "clear" ? clearFormat(el) : toggleFormat(el, fmt);
            if (changed) emit(onChangeRef.current, null, "change");
            refreshActive();
        },
        [emit, refreshActive]
    );

    // 拦截浏览器自带的撤销 / 拖放 / 格式输入（它们会和手动 DOM 修改冲突）
    useEffect(() => {
        const el = ref.current;
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
    }, [applyFormat]);

    const handleKeyDown = (e) => {
        const mod = e.ctrlKey || e.metaKey;
        if (!mod || e.shiftKey || e.altKey) return;
        const k = e.key.toLowerCase();
        const fmt = { b: "bold", i: "italic", u: "underline" }[k];
        if (fmt) {
            e.preventDefault();
            applyFormat(fmt);
        } else if (k === "z" || k === "y") {
            e.preventDefault(); // 撤销 / 重做已禁用
        }
    };

    const handleInput = (e) => {
        // 清空后浏览器会残留 <br>，去掉以便显示占位符
        if (e.currentTarget.innerHTML === "<br>") e.currentTarget.innerHTML = "";
        emit(onChange, e, "change");
    };

    const handlePaste = (e) => {
        e.preventDefault();
        if (insertPlainText(ref.current, e.clipboardData.getData("text/plain"))) {
            emit(onChange, e, "change");
        }
    };

    const handleCopy = (e) => {
        e.preventDefault();
        e.clipboardData.setData("text/plain", window.getSelection().toString().replace(ZW_RE, ""));
    };

    const handleCut = (e) => {
        e.preventDefault();
        const sel = window.getSelection();
        e.clipboardData.setData("text/plain", sel.toString().replace(ZW_RE, ""));
        sel.deleteFromDocument();
        if (ref.current.innerHTML === "<br>") ref.current.innerHTML = "";
        emit(onChange, e, "change");
    };

    return (
        <div className="rte-root">
            {toolbar && (
                <div className="rte-toolbar">
                    {TOOLS.map((t, i) =>
                        t === "|" ? (
                            <span key={i} className="rte-sep" />
                        ) : (
                            <button
                                key={t.fmt}
                                type="button"
                                title={t.title}
                                disabled={disabled}
                                className={"rte-tool" + (active[t.fmt] ? " rte-on" : "")}
                                onMouseDown={(e) => e.preventDefault()} // 不抢走编辑区的焦点和选区
                                onClick={() => applyFormat(t.fmt)}
                            >
                                {t.label}
                            </button>
                        )
                    )}
                </div>
            )}
            <div
                ref={ref}
                role="textbox"
                aria-multiline="true"
                aria-disabled={disabled || undefined}
                className={`rte-editor ${className}`}
                style={{ height: `calc(${rows * 1.5}em + 18px)`, ...style }}
                contentEditable={!disabled}
                suppressContentEditableWarning
                data-placeholder={placeholder}
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                onCopy={handleCopy}
                onCut={handleCut}
                onDrop={(e) => e.preventDefault()}
                onFocus={onFocus}
                onBlur={(e) => emit(onBlur, e, "blur")}
            />
        </div>
    );
}
