import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * 居中模态窗口：文本输入 + 提交 / 取消（不依赖 Tailwind，纯内联样式）
 *
 * Props:
 *  - open:      是否显示（由外部控制）
 *  - title:     标题
 *  - label:     输入框标签
 *  - placeholder
 *  - defaultValue
 *  - onSubmit(value): 点击提交（或在输入框按 Enter）时调用
 *  - onCancel():      点击取消 / 按 Esc / 点击遮罩时调用
 */
export function InputModal({
    open,
    title = "输入内容",
    label = "内容",
    placeholder = "请输入…",
    defaultValue = "",
    onSubmit,
    onCancel,
}) {
    const [value, setValue] = useState(defaultValue);
    const inputRef = useRef(null);

    // 每次打开时重置输入并聚焦
    useEffect(() => {
        if (open) {
            setValue(defaultValue);
            setTimeout(() => inputRef.current?.focus(), 0);
        }
    }, [open, defaultValue]);

    // Esc 关闭 + 打开时锁定页面滚动
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => e.key === "Escape" && onCancel?.();
        document.addEventListener("keydown", onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prev;
        };
    }, [open, onCancel]);

    if (!open) return null;

    const submit = () => onSubmit?.(value);

    return createPortal(
        <div style={styles.backdrop} onMouseDown={onCancel}>
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                style={styles.dialog}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <h2 style={styles.title}>{title}</h2>
                <label style={styles.label}>
                    {label}
                    <input
                        ref={inputRef}
                        type="text"
                        value={value}
                        placeholder={placeholder}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && submit()}
                        style={styles.input}
                    />
                </label>
                <div style={styles.actions}>
                    <button type="button" onClick={onCancel} style={styles.cancel}>
                        取消
                    </button>
                    <button type="button" onClick={submit} style={styles.submit}>
                        提交
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

const styles = {
    // fixed + flex 居中 → 始终位于浏览器视口正中央
    backdrop: {
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(20, 24, 31, 0.5)",
        zIndex: 1000,
        padding: 16,
    },
    dialog: {
        width: "100%",
        maxWidth: 400,
        background: "#fff",
        color: "#1c2330",
        borderRadius: 10,
        padding: 24,
        boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
        fontFamily: "system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif",
    },
    title: { margin: "0 0 16px", fontSize: 18, fontWeight: 600 },
    label: { display: "block", fontSize: 14, color: "#4a5568" },
    input: {
        display: "block",
        width: "100%",
        boxSizing: "border-box",
        marginTop: 6,
        padding: "9px 11px",
        fontSize: 15,
        border: "1px solid #c5ccd6",
        borderRadius: 6,
        outline: "none",
    },
    actions: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 },
    cancel: {
        padding: "8px 16px",
        fontSize: 14,
        background: "#eef1f5",
        color: "#1c2330",
        border: "none",
        borderRadius: 6,
        cursor: "pointer",
    },
    submit: {
        padding: "8px 16px",
        fontSize: 14,
        background: "#2b5fd9",
        color: "#fff",
        border: "none",
        borderRadius: 6,
        cursor: "pointer",
    },
};

// ---------- 使用示例：外部按钮触发 ----------
export default function Demo() {
    const [open, setOpen] = useState(false);
    const [result, setResult] = useState("");

    return (
        <div style={{ padding: 40 }}>
            <button onClick={() => setOpen(true)}>打开窗口</button>
            <p>提交的内容：{result || "（无）"}</p>

            <InputModal
                open={open}
                title="修改名称"
                label="新名称"
                onSubmit={(v) => {
                    setResult(v);
                    setOpen(false);
                }}
                onCancel={() => setOpen(false)}
            />
        </div>
    );
}
