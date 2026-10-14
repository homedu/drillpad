import { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";

/**
 * 命令式调用的居中输入弹窗（不依赖 Tailwind，纯内联样式）
 *
 * 在任意事件 / 函数里直接调用，不需要提前在组件树里摆放标签：
 *
 *   const value = await showInputModal({ title: "修改名称", label: "新名称" });
 *   if (value !== null) {
 *     // 用户点了提交 / 按了 Enter，value 是输入的字符串
 *   }
 *   // 点取消 / 按 Esc / 点遮罩 → 返回 null
 *
 * 可选参数：title, label, placeholder, defaultValue, submitText, cancelText
 * 需要 React 18+（使用 react-dom/client）。
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
                onSubmit={(v) => close(v)}
                onCancel={() => close(null)}
            />
        );
    });
}

const S = {
    // fixed + flex 居中 → 始终位于浏览器视口正中央
    backdrop: {
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 2147483647,
        background: "rgba(20, 24, 31, 0.5)",
    },
    dialog: {
        width: "100%",
        maxWidth: 400,
        boxSizing: "border-box",
        padding: 24,
        background: "#ffffff",
        color: "#1c2330",
        border: "1px solid #cbd5e1",
        borderRadius: 10,
        boxShadow: "0 20px 50px rgba(0, 0, 0, 0.35)",
        fontFamily:
            "system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif",
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
        color: "#0f172a",
        background: "#ffffff",
        border: "1px solid #c5ccd6",
        borderRadius: 6,
        outline: "none",
    },
    actions: {
        display: "flex",
        justifyContent: "flex-end",
        gap: 10,
        marginTop: 22,
    },
    btn: {
        padding: "8px 16px",
        fontSize: 14,
        borderRadius: 6,
        cursor: "pointer",
    },
};

function ModalView({
    title = "输入内容",
    label = "内容",
    placeholder = "请输入…",
    defaultValue = "",
    submitText = "提交",
    cancelText = "取消",
    onSubmit,
    onCancel,
}) {
    const [value, setValue] = useState(defaultValue);
    const [focused, setFocused] = useState(false);
    const [hover, setHover] = useState(null); // "cancel" | "submit" | null
    const inputRef = useRef(null);

    useEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, []);

    // Esc 取消 + 锁定页面滚动
    useEffect(() => {
        const onKey = (e) => e.key === "Escape" && onCancel();
        document.addEventListener("keydown", onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prev;
        };
    }, [onCancel]);

    const submit = () => onSubmit(value);

    return (
        <div style={S.backdrop} onMouseDown={onCancel}>
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                style={S.dialog}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <h2 style={S.title}>{title}</h2>

                <label style={S.label}>
                    {label}
                    <input
                        ref={inputRef}
                        type="text"
                        value={value}
                        placeholder={placeholder}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && submit()}
                        onFocus={() => setFocused(true)}
                        onBlur={() => setFocused(false)}
                        style={{
                            ...S.input,
                            borderColor: focused ? "#2b5fd9" : "#c5ccd6",
                            boxShadow: focused ? "0 0 0 3px rgba(43, 95, 217, 0.25)" : "none",
                        }}
                    />
                </label>

                <div style={S.actions}>
                    <button
                        type="button"
                        onClick={onCancel}
                        onMouseEnter={() => setHover("cancel")}
                        onMouseLeave={() => setHover(null)}
                        style={{
                            ...S.btn,
                            color: "#1c2330",
                            background: hover === "cancel" ? "#e2e8f0" : "#eef1f5",
                            border: "1px solid #cbd5e1",
                        }}
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        onMouseEnter={() => setHover("submit")}
                        onMouseLeave={() => setHover(null)}
                        style={{
                            ...S.btn,
                            color: "#ffffff",
                            background: hover === "submit" ? "#1e4fc0" : "#2b5fd9",
                            border: "1px solid #2b5fd9",
                        }}
                    >
                        {submitText}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ---------- 使用示例 ----------
export default function Demo() {
    const [result, setResult] = useState("");

    const handleClick = async () => {
        const v = await showInputModal({ title: "修改名称", label: "新名称" });
        if (v !== null) setResult(v);
    };

    return (
        <div style={{ padding: 40 }}>
            <button onClick={handleClick}>打开窗口</button>
            <p style={{ marginTop: 16 }}>提交的内容：{result || "（无）"}</p>
        </div>
    );
}
