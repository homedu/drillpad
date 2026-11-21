import { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Editor, Toolbar } from "@wangeditor-next/editor-for-react";
// wangeditor 必须引入样式，否则工具栏和编辑区都是乱的
import "@wangeditor-next/editor/dist/css/style.css";

/**
 * 命令式调用的居中富文本输入弹窗（编辑器为 wangeditor-next）
 * 与 showWangEditorModal.jsx（Jodit 版）API 完全一致，换一行 import 就能对比。
 *
 *   const result = await showWangEditorModal({ title: "编辑备注" });
 *   if (result !== null) {
 *     result.html   // wangeditor 输出的富文本 HTML
 *     result.text   // 纯文本
 *   }
 *   // 只有点「提交」或「取消」才会关闭（点窗口外、按 Esc 都不会关闭）
 *   // 点「取消」返回 null；Ctrl/Cmd + Enter 等同于提交
 *
 * 可选参数：title, placeholder, defaultValue(初始 HTML), submitText, cancelText,
 *           width(默认 560), height(默认 420),
 *           toolbarConfig / editorConfig(透传给 wangeditor，与默认配置合并)
 *
 * 窗口：居中显示、遮罩置于最顶层；标题栏可拖动；8 个方向可缩放；
 *       拖动 / 缩放被限制在浏览器可视区域内；浏览器窗口变化时自动收回；
 *       弹出期间锁定页面滚动。
 * 依赖：React 18+、@wangeditor-next/editor、@wangeditor-next/editor-for-react
 *   npm i @wangeditor-next/editor @wangeditor-next/editor-for-react
 */
export function showWangEditorModal(options = {}) {
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

// ===================== 初始 HTML 规范化 =====================
// wangeditor 解析 HTML 时，只认「<p> 里的 <img>」（以及 span / a 包着的）。
// 图片被 <div> 或 <figure> 包着时，图片会被整个丢掉（文字还在），
// 所以载入前先把这些容器转成 <p>（或展开），再交给编辑器。
function normalizeHtml(html) {
    if (!html) return "";
    // 引号被转义了两次（如 <img src=\"http://...\">）时先还原，否则 src 会变成 \"http://...\"，图片加载失败
    if (/=\\["']/.test(html)) {
        html = html.replace(/\\(["'])/g, "$1").replace(/\\\//g, "/");
    }
    if (!/<(div|figure|section|article|center)\b/i.test(html)) return html;
    const doc = new DOMParser().parseFromString("<body>" + html + "</body>", "text/html");
    const BLOCK =
        "p,ul,ol,li,table,h1,h2,h3,h4,h5,h6,pre,blockquote,hr,div,figure,section,article,center";
    // 从最内层往外处理
    [...doc.body.querySelectorAll("div,figure,section,article,center")].reverse().forEach((el) => {
        if (el.hasAttribute("data-w-e-type")) return;
        if (el.querySelector(BLOCK)) {
            el.replaceWith(...el.childNodes); // 里面还有块级元素：直接展开
        } else {
            const p = doc.createElement("p");
            const ta = el.style && el.style.textAlign;
            if (ta) p.style.textAlign = ta;
            p.append(...el.childNodes);
            el.replaceWith(p);
        }
    });
    doc.querySelectorAll("figcaption").forEach((el) => {
        const p = doc.createElement("p");
        p.append(...el.childNodes);
        el.replaceWith(p);
    });
    return doc.body.innerHTML;
}

// ===================== 弹窗 UI =====================
const MIN_W = 340;
const MIN_H = 260;
const GAP = 16; // 编辑框到窗口各边的统一间距
const Z_BACKDROP = 2147483646;
const Z_POPUP = 2147483647; // wangeditor 的下拉面板 / 对话框 / 悬浮条，必须压在弹窗之上

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
.sim-toolbar { flex: none; border-radius: 6px 6px 0 0; }
.sim-toolbar .w-e-toolbar { border-radius: 6px 6px 0 0; flex-wrap: wrap; }
/* 编辑区：占剩余高度，内容超出时在编辑区内部滚动 */
.sim-editor { position: relative; flex: 1 1 0; min-height: 0; }
.sim-editor .w-e-text-container { border-radius: 0 0 6px 6px; }
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

/* wangeditor 的下拉面板、对话框、悬浮工具条，要压在弹窗遮罩之上 */
.w-e-modal, .w-e-drop-panel, .w-e-select-list, .w-e-hover-bar, .w-e-bar-item-menus-container {
  z-index: ${Z_POPUP} !important;
}
`;

const HANDLES = ["n", "s", "e", "w", "nw", "ne", "sw", "se"];

function ModalView({
    title = "输入内容",
    placeholder = "请输入…",
    defaultValue = "",
    submitText = "提交",
    cancelText = "取消",
    width = 1024,
    height = 768,
    toolbarConfig: userToolbarConfig,
    editorConfig: userEditorConfig,
    onSubmit,
    onCancel,
}) {
    const [editor, setEditor] = useState(null);
    const editorInstRef = useRef(null);

    // 初始内容只在挂载时传入一次，之后内容由 wangeditor 自己维护
    const [initialHtml] = useState(() => normalizeHtml(defaultValue));

    const [toolbarConfig] = useState(() => ({
        excludeKeys: ["fullScreen"], // 全屏会脱离弹窗，去掉
        ...userToolbarConfig,
    }));
    const [editorConfig] = useState(() => ({
        placeholder,
        ...userEditorConfig,
    }));

    const [rect, setRect] = useState(() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const w = Math.min(width, vw - 32);
        const h = Math.min(height, vh - 32);
        return { x: (vw - w) / 2, y: (vh - h) / 2, w, h };
    });

    // 组件卸载时销毁编辑器，避免内存泄漏
    useEffect(() => {
        return () => {
            const ed = editorInstRef.current;
            if (ed) {
                ed.destroy();
                editorInstRef.current = null;
            }
        };
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
        const ed = editorInstRef.current;
        if (!ed) return;
        const text = ed.getText().replace(/\u200b/g, "").trim();
        // isEmpty()：只有一个空段落时为 true；含图片 / 表格等则为 false
        onSubmit({ html: ed.isEmpty() ? "" : ed.getHtml(), text });
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
                zIndex: Z_BACKDROP,
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
                // 捕获阶段拦截，避免编辑器先把 Ctrl/Cmd+Enter 当成换行
                onKeyDownCapture={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        e.stopPropagation();
                        submit();
                    }
                }}
            >
                <div className="sim-header" onPointerDown={(e) => begin(e, "move")}>
                    {title}
                </div>

                <div className="sim-body">
                    <div className="sim-box">
                        <div className="sim-toolbar">
                            <Toolbar editor={editor} defaultConfig={toolbarConfig} mode="default" />
                        </div>
                        <div className="sim-editor">
                            <Editor
                                defaultConfig={editorConfig}
                                defaultHtml={initialHtml}
                                mode="default"
                                style={{ height: "100%", overflowY: "hidden" }}
                                onCreated={(ed) => {
                                    editorInstRef.current = ed;
                                    setEditor(ed);
                                    ed.focus(true); // 光标放到末尾
                                }}
                            />
                        </div>
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
function Demo() {
    const [result, setResult] = useState(null);

    const handleClick = async () => {
        const r = await showWangEditorModal({
            title: "编辑备注",
            defaultValue: result?.html || "",
            editorConfig: makeUploadConfig("http://localhost:8088"),
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

/**
 * 前端：wangEditor 图片 / 视频上传配置，对应 server.js 的两个接口
 *
 * 用法（配合前面的弹窗）：
 *   import { makeUploadConfig } from "./wangEditorUploadConfig";
 *   const r = await showInputModal({
 *       title: "编辑备注",
 *       defaultValue: html,
 *       editorConfig: makeUploadConfig("http://localhost:8088"),
 *   });
 *
 * 直接用 <Editor> 时：<Editor defaultConfig={{ ...makeUploadConfig(base) }} ... />
 */
export function makeUploadConfig(baseUrl = "http://localhost:8088", options = {}) {
    const { headers = {}, withCredentials = false, onMessage = (msg) => alert(msg) } = options;

    const common = {
        fieldName: "file", // 必须和 server.js 里 multer 的 .single("file") 一致
        headers, // 需要登录时：{ Authorization: "Bearer xxx" }
        withCredentials,
        onFailed(file, res) {
            onMessage((res && res.message) || "上传失败：" + file.name);
        },
        onError(file, err, res) {
            onMessage((res && res.message) || "上传出错：" + (err && err.message ? err.message : err));
        },
    };

    return {
        MENU_CONF: {
            uploadImage: {
                ...common,
                server: baseUrl.replace(/\/$/, "") + "/api/upload/image",
                maxFileSize: 16 * 1024 * 1024, // 和后端限制保持一致
                maxNumberOfFiles: 10,
                allowedFileTypes: ["image/png", "image/jpeg", "image/gif", "image/webp"],
                timeout: 30 * 1000,
            },
            uploadVideo: {
                ...common,
                server: baseUrl.replace(/\/$/, "") + "/api/upload/video",
                maxFileSize: 512 * 1024 * 1024,
                maxNumberOfFiles: 3,
                allowedFileTypes: ["video/mp4", "video/webm", "video/ogg"],
                timeout: 5 * 60 * 1000,
            },
        },
    };
}