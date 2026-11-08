import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";

/**
 * 命令式确认对话框（纯 CSS 版，不依赖 Tailwind）
 *
 * const ok = await showConfirmModal({ title: "TITLE", text: "Exit ?" });
 * // ok === true  -> 点击了确认
 * // ok === false -> 点击了取消
 *
 * 点击遮罩层不会关闭；只能通过「确认 / 取消」两个按钮关闭。
 */

const STYLE_ID = "confirm-modal-style";

// 样式随组件一起注入，只注入一次，无需额外的 CSS 文件
const CSS = `
.cm-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.5);
}
.cm-dialog {
  box-sizing: border-box;
  width: 100%;
  max-width: 384px;
  padding: 24px;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.15);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
}
.cm-title {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: #111827;
}
.cm-text {
  margin: 8px 0 0;
  font-size: 14px;
  line-height: 1.5;
  color: #4b5563;
}
.cm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}
.cm-btn {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s;
}
.cm-btn:focus-visible {
  outline: 2px solid #60a5fa;
  outline-offset: 2px;
}
.cm-btn-cancel {
  border: 1px solid #d1d5db;
  background: #fff;
  color: #374151;
}
.cm-btn-cancel:hover {
  background: #f3f4f6;
}
.cm-btn-confirm {
  border: 1px solid transparent;
  background: #2563eb;
  color: #fff;
}
.cm-btn-confirm:hover {
  background: #1d4ed8;
}
`;

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

function ConfirmModal({ title, text, confirmText, cancelText, onResult }) {
    const cancelRef = useRef(null);
    const dialogRef = useRef(null);

    // 默认聚焦“取消”，避免误触确认；并把 Tab 焦点限制在对话框内
    useEffect(() => {
        cancelRef.current?.focus();

        const onKeyDown = (e) => {
            if (e.key !== "Tab") return;
            const nodes = dialogRef.current?.querySelectorAll("button");
            if (!nodes?.length) return;
            const first = nodes[0];
            const last = nodes[nodes.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, []);

    return (
        // 遮罩层：不绑定任何 onClick，因此点击外部不会关闭
        <div className="cm-overlay">
            <div
                ref={dialogRef}
                className="cm-dialog"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-modal-title"
                aria-describedby="confirm-modal-text"
            >
                <h2 id="confirm-modal-title" className="cm-title">
                    {title}
                </h2>
                <p id="confirm-modal-text" className="cm-text">
                    {text}
                </p>

                <div className="cm-actions">
                    <button
                        ref={cancelRef}
                        type="button"
                        className="cm-btn cm-btn-cancel"
                        onClick={() => onResult(false)}
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        className="cm-btn cm-btn-confirm"
                        onClick={() => onResult(true)}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}

export function showConfirmModal({
    title = "提示",
    text = "",
    confirmText = "确认",
    cancelText = "取消",
} = {}) {
    return new Promise((resolve) => {
        ensureStyle();
        const container = document.createElement("div");
        document.body.appendChild(container);
        const root = createRoot(container);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden"; // 弹出期间禁止背景滚动
        const close = (result) => {
            root.unmount();
            container.remove();
            document.body.style.overflow = prevOverflow;
            resolve(result);
        };
        root.render(
            <ConfirmModal
                title={title}
                text={text}
                confirmText={confirmText}
                cancelText={cancelText}
                onResult={close}
            />
        );
    });
}

export default showConfirmModal;
