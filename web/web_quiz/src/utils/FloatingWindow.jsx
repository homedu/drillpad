/**
 * FloatingWindow.jsx —— 置顶、非模态、可拖动、可缩放的文本浮窗
 *
 * 依赖：仅 react / react-dom（React 18+）。无外部 CSS，全部使用内联样式，拷贝即用。
 *
 * 用法：
 *   import { showFloatingWindow } from "./FloatingWindow";
 *
 *   const win = showFloatingWindow("要显示的文本", { title: "提示" });
 *   win.update("新的文本");   // 可选：更新内容
 *   win.close();              // 可选：代码关闭（用户只能点右上角 × 关闭）
 *
 * 可选参数 options：
 *   title   标题栏文字（默认 ""）
 *   width   初始宽度（默认 420）
 *   height  初始高度（默认 300）
 *   onClose 窗口关闭后的回调
 *   fontSize 初始字号 "small" | "medium"(默认) | "large"；窗口底部工具栏可随时切换
 *   format  "auto"(默认，自动识别) | "html" | "text"
 *           auto：字符串中含有有效 HTML 标签则按 HTML 渲染，否则按纯文本显示
 *
 * HTML 内容在 Shadow DOM 中渲染：其中的 <style> 不会影响页面，页面样式也不会
 * 影响它；并且会先做一次轻量安全过滤（移除 script/iframe/事件属性/javascript: 链接等）。
 *
 * 也可以直接把 FloatingWindow 当普通组件使用（默认导出）。
 */
import React, {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react";
import { createRoot } from "react-dom/client";

const MIN_W = 180;
const MIN_H = 130;
const HEADER_H = 36;
const FOOTER_H = 36;

// 字号档位：px 用于纯文本；zoom 用于 HTML（可连同内联 px 字号一起整体缩放）
const FONT_LEVELS = [
    { key: "small", label: "S", px: 14, zoom: 14 / 18 },
    { key: "medium", label: "M", px: 18, zoom: 1 },
    { key: "large", label: "L", px: 22, zoom: 22 / 18 },
];
const mFontSize = new Map([["S", 10], ["M", 12], ["L", 14]]);
const EDGE = 6;
const CORNER = 14;

// 各窗口共用的层级计数器，点击窗口时将其提到所有浮窗之上
let zCounter = 2147483000;

const RESIZE_HANDLES = [
    { dir: "n", cursor: "ns-resize", style: { top: 0, left: CORNER, right: CORNER, height: EDGE } },
    { dir: "s", cursor: "ns-resize", style: { bottom: 0, left: CORNER, right: CORNER, height: EDGE } },
    { dir: "w", cursor: "ew-resize", style: { left: 0, top: CORNER, bottom: CORNER, width: EDGE } },
    { dir: "e", cursor: "ew-resize", style: { right: 0, top: CORNER, bottom: CORNER, width: EDGE } },
    { dir: "nw", cursor: "nwse-resize", style: { top: 0, left: 0, width: CORNER, height: CORNER } },
    { dir: "ne", cursor: "nesw-resize", style: { top: 0, right: 0, width: CORNER, height: CORNER } },
    { dir: "sw", cursor: "nesw-resize", style: { bottom: 0, left: 0, width: CORNER, height: CORNER } },
    { dir: "se", cursor: "nwse-resize", style: { bottom: 0, right: 0, width: CORNER, height: CORNER } },
];

/* ---------- HTML 检测 / 过滤 ---------- */

const DANGEROUS_TAGS = "script,iframe,frame,frameset,object,embed,link,meta,base,applet";
const URL_ATTRS = ["href", "src", "xlink:href", "action", "formaction", "poster", "data"];

function parseHtml(str) {
    return new DOMParser().parseFromString(str, "text/html");
}

/** 判断字符串是否含有真正的 HTML 标签（"a < b"、"<foo>" 之类不算） */
function looksLikeHtml(str) {
    if (typeof str !== "string" || str.indexOf("<") === -1) return false;
    const doc = parseHtml(str);
    const real = (el) => !(el instanceof HTMLUnknownElement);
    return (
        Array.from(doc.body.querySelectorAll("*")).some(real) ||
        Array.from(doc.head.children).some(real)
    );
}

/** 轻量过滤：去掉可执行内容。返回可直接注入的 HTML 字符串 */
function sanitizeHtml(str) {
    const doc = parseHtml(str);
    doc.querySelectorAll(DANGEROUS_TAGS).forEach((el) => el.remove());
    doc.querySelectorAll("*").forEach((el) => {
        Array.from(el.attributes).forEach((attr) => {
            const name = attr.name.toLowerCase();
            const val = attr.value.replace(/[\s\u0000-\u001f]/g, "").toLowerCase();
            if (name.startsWith("on") || name === "srcdoc") {
                el.removeAttribute(attr.name);
            } else if (URL_ATTRS.includes(name) && /^(javascript|vbscript|data:text\/html)/.test(val)) {
                el.removeAttribute(attr.name);
            }
        });
        if (el.tagName === "A") {
            el.setAttribute("target", "_blank");
            el.setAttribute("rel", "noopener noreferrer");
        }
    });
    const styles = Array.from(doc.head.querySelectorAll("style"))
        .map((el) => el.outerHTML)
        .join("");
    return styles + doc.body.innerHTML;
}

/** 在 Shadow DOM 中渲染 HTML，样式与页面互不影响 */
function ShadowHtml({ html, zoom = 1 }) {
    const ref = useRef(null);
    useLayoutEffect(() => {
        const host = ref.current;
        const sr = host.shadowRoot || host.attachShadow({ mode: "open" });
        sr.innerHTML =
            "<style>:host{display:block;overflow-wrap:anywhere}" +
            "img,video,canvas,svg{max-width:100%;height:auto}" +
            "table{max-width:100%}pre{white-space:pre-wrap}</style>" +
            html;
    }, [html]);
    return <div ref={ref} style={{ zoom }} />;
}

export function FloatingWindow({
    text = "",
    format = "auto",
    fontSize = "medium",
    title = "",
    width = 420,
    height = 300,
    onClose,
    onFocus,
}) {
    // 初始居中
    const [rect, setRect] = useState(() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const w = Math.min(width, vw);
        const h = Math.min(height, vh);
        return { x: Math.round((vw - w) / 2), y: Math.round((vh - h) / 2), w, h };
    });

    const op = useRef(null); // 当前拖动/缩放操作的状态
    const [level, setLevel] = useState(
        FONT_LEVELS.some((l) => l.key === fontSize) ? fontSize : "medium"
    );
    const fontLevel = FONT_LEVELS.find((l) => l.key === level);

    // 内容类型判断（text 不变时不重复解析）
    const [isHtml, htmlContent] = React.useMemo(() => {
        const str = text == null ? "" : String(text);
        const html = format === "html" || (format === "auto" && looksLikeHtml(str));
        return [html, html ? sanitizeHtml(str) : null];
    }, [text, format]);

    // 浏览器窗口变小时，保证浮窗标题栏仍在可视区域内
    useEffect(() => {
        const onResize = () =>
            setRect((r) => ({
                ...r,
                x: Math.min(Math.max(r.x, 60 - r.w), window.innerWidth - 60),
                y: Math.min(Math.max(r.y, 0), window.innerHeight - HEADER_H),
            }));
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    const begin = useCallback(
        (e, type, dir) => {
            if (e.button !== undefined && e.button !== 0) return;
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            op.current = { type, dir, px: e.clientX, py: e.clientY, start: rect };
            onFocus && onFocus();
        },
        [rect, onFocus]
    );

    const move = useCallback((e) => {
        const o = op.current;
        if (!o) return;
        const dx = e.clientX - o.px;
        const dy = e.clientY - o.py;
        const s = o.start;

        if (o.type === "drag") {
            const x = Math.min(Math.max(s.x + dx, 60 - s.w), window.innerWidth - 60);
            const y = Math.min(Math.max(s.y + dy, 0), window.innerHeight - HEADER_H);
            setRect({ ...s, x, y });
            return;
        }

        let { x, y, w, h } = s;
        if (o.dir.includes("e")) w = Math.max(MIN_W, s.w + dx);
        if (o.dir.includes("s")) h = Math.max(MIN_H, s.h + dy);
        if (o.dir.includes("w")) {
            w = Math.max(MIN_W, s.w - dx);
            x = s.x + (s.w - w);
        }
        if (o.dir.includes("n")) {
            h = Math.max(MIN_H, s.h - dy);
            y = s.y + (s.h - h);
        }
        setRect({ x, y, w, h });
    }, []);

    const end = useCallback((e) => {
        if (op.current && e.currentTarget.hasPointerCapture?.(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
        op.current = null;
    }, []);

    return (
        <div
            onPointerDown={() => onFocus && onFocus()}
            role="dialog"
            aria-modal="false"
            aria-label={title || "浮动窗口"}
            style={{
                position: "fixed",
                left: rect.x,
                top: rect.y,
                width: rect.w,
                height: rect.h,
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                background: "#ffffff",
                color: "#1f2328",
                border: "1px solid #c9ced6",
                borderRadius: 8,
                boxShadow: "0 10px 30px rgba(0,0,0,.25)",
                font: "14px/1.6 system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
                pointerEvents: "auto", // 容器本身不拦截事件，只有窗口自己响应
                overflow: "hidden",
            }}
        >
            {/* 标题栏：拖动手柄 */}
            <div
                onPointerDown={(e) => begin(e, "drag")}
                onPointerMove={move}
                onPointerUp={end}
                onPointerCancel={end}
                style={{
                    flex: "0 0 auto",
                    height: HEADER_H,
                    boxSizing: "border-box",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0 6px 0 12px",
                    background: "#f3f5f8",
                    borderBottom: "1px solid #dde1e7",
                    cursor: "move",
                    userSelect: "none",
                    touchAction: "none",
                }}
            >
                <span
                    style={{
                        fontWeight: 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {title}
                </span>
                <button
                    type="button"
                    aria-label="关闭"
                    title="关闭"
                    onPointerDown={(e) => e.stopPropagation()} // 点关闭按钮不触发拖动
                    onClick={() => onClose && onClose()}
                    style={{
                        flex: "0 0 auto",
                        width: 26,
                        height: 26,
                        padding: 0,
                        border: "none",
                        borderRadius: 4,
                        background: "transparent",
                        color: "#57606a",
                        fontSize: 18,
                        lineHeight: "26px",
                        cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#e5484d";
                        e.currentTarget.style.color = "#fff";
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "#57606a";
                    }}
                >
                    ×
                </button>
            </div>

            {/* 内容区：内容超出才出现滚动条，放大到能容纳时自动消失 */}
            <div
                style={{
                    flex: "1 1 auto",
                    minHeight: 0,
                    overflow: "auto",
                    padding: "10px 14px",
                    ...(isHtml
                        ? {}
                        : {
                            fontSize: fontLevel.px,
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            overflowWrap: "anywhere",
                        }),
                }}
            >
                {isHtml ? <ShadowHtml html={htmlContent} zoom={fontLevel.zoom} /> : text}
            </div>

            {/* 底部工具栏：字号切换（小 / 中 / 大） */}
            <div
                style={{
                    flex: "0 0 auto",
                    height: FOOTER_H,
                    boxSizing: "border-box",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 4,
                    padding: "0 18px 0 12px", // 右侧留白，避免与右下角缩放手柄重叠
                    background: "#f3f5f8",
                    borderTop: "1px solid #dde1e7",
                    userSelect: "none",
                }}
            >
                {FONT_LEVELS.map((l) => {
                    const active = l.key === level;
                    return (
                        <button
                            key={l.key}
                            type="button"
                            title={l.label + "字体"}
                            aria-pressed={active}
                            onClick={() => setLevel(l.key)}
                            style={{
                                minWidth: 28,
                                height: 24,
                                padding: "0 8px",
                                border: "1px solid " + (active ? "#2f6fed" : "#c9ced6"),
                                borderRadius: 4,
                                background: active ? "#2f6fed" : "#fff",
                                color: active ? "#fff" : "#1f2328",
                                fontSize: mFontSize.get(l.label),
                                lineHeight: "22px",
                                cursor: "pointer",
                            }}
                        >
                            {l.label}
                        </button>
                    );
                })}
            </div>

            {/* 缩放手柄（四边 + 四角） */}
            {RESIZE_HANDLES.map((h) => (
                <div
                    key={h.dir}
                    onPointerDown={(e) => begin(e, "resize", h.dir)}
                    onPointerMove={move}
                    onPointerUp={end}
                    onPointerCancel={end}
                    style={{
                        position: "absolute",
                        cursor: h.cursor,
                        touchAction: "none",
                        ...h.style,
                    }}
                />
            ))}
        </div>
    );
}

/**
 * 函数式调用：显示一个浮窗。
 * @param {string} text 要显示的文本
 * @param {{title?:string,width?:number,height?:number,format?:"auto"|"html"|"text",fontSize?:"small"|"medium"|"large",onClose?:Function}} [options]
 * @returns {{close:()=>void, update:(text:string)=>void}}
 */
export function showFloatingWindow(text, options = {}) {
    if (typeof document === "undefined") {
        return { close() { }, update() { } };
    }

    // 0×0 的固定定位容器：自身不占空间、不拦截下层页面的任何事件
    const host = document.createElement("div");
    host.style.cssText =
        "position:fixed;left:0;top:0;width:0;height:0;overflow:visible;";
    host.style.zIndex = String(++zCounter);
    document.body.appendChild(host);

    const root = createRoot(host);
    let closed = false;
    let currentText = text;

    const bringToFront = () => {
        if (closed) return;
        if (Number(host.style.zIndex) !== zCounter) {
            host.style.zIndex = String(++zCounter);
        }
    };

    const close = () => {
        if (closed) return;
        closed = true;
        // 异步卸载，避免在 React 事件处理过程中同步卸载自身
        setTimeout(() => {
            root.unmount();
            host.remove();
            options.onClose && options.onClose();
        }, 0);
    };

    const render = () =>
        root.render(
            <FloatingWindow
                text={currentText}
                format={options.format}
                fontSize={options.fontSize}
                title={options.title}
                width={options.width}
                height={options.height}
                onClose={close}
                onFocus={bringToFront}
            />
        );

    render();

    return {
        close,
        update(next) {
            if (closed) return;
            currentText = next;
            render();
        },
    };
}

export default FloatingWindow;
