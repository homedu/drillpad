import { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";

/**
 * 命令式调用的居中评分弹窗（不依赖 Tailwind / 第三方库）
 *
 *   const rating = await showRatingModal({ title: "给本次服务打分" });
 *   if (rating !== null) {
 *     // rating 是 1 ~ max 的整数
 *   }
 *   // 点「取消」返回 null；点窗口外、按 Esc 不会关闭
 *
 * 可选参数：
 *   title        标题（默认「请评分」）
 *   max          星星总数（默认 5）
 *   defaultValue 初始分数（默认 0，即未选择；未选择时「提交」不可点）
 *   labels       每个分数对应的文字，如 ["很差","较差","一般","满意","非常满意"]
 *   submitText / cancelText
 *
 * 操作：鼠标点星星；键盘 ←/→ 或 ↑/↓ 调整，数字键直接选，Enter 提交。
 */
export function showRatingModal(options = {}) {
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
            <RatingView
                {...options}
                onSubmit={(v) => close(v)}
                onCancel={() => close(null)}
            />
        );
    });
}

const DEFAULT_LABELS = ["不重要", "较不重要", "一般", "重要", "很重要"];

const CSS = `
.srm-backdrop {
  position: fixed; top: 0; right: 0; bottom: 0; left: 0;
  display: flex; align-items: center; justify-content: center; padding: 16px;
  z-index: 2147483647; background: rgba(20, 24, 31, 0.5);
}
.srm-dialog, .srm-dialog * { box-sizing: border-box; }
.srm-dialog {
  width: 100%; max-width: 360px; padding: 24px;
  background: #fff; color: #1c2330;
  border: 1px solid #cbd5e1; border-radius: 12px;
  box-shadow: 0 20px 50px rgba(0,0,0,.35);
  font-family: system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  text-align: center;
}
.srm-title { margin: 0 0 20px; font-size: 18px; font-weight: 600; }
.srm-stars {
  display: flex; flex-wrap: wrap; justify-content: center; gap: 6px;
  outline: none; border-radius: 8px; padding: 4px;
}
.srm-stars:focus-visible { box-shadow: 0 0 0 3px rgba(43,95,217,.35); }
.srm-star {
  width: 44px; height: 44px; padding: 4px; border: none; background: none;
  cursor: pointer; line-height: 0;
}
.srm-star svg { width: 100%; height: 100%; transition: transform .1s; }
.srm-star:hover svg { transform: scale(1.12); }
.srm-text { height: 22px; margin: 12px 0 0; font-size: 15px; color: #475569; }
.srm-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px; }
.srm-btn { padding: 8px 16px; font-size: 14px; border-radius: 6px; cursor: pointer; }
.srm-btn.cancel { color: #1c2330; background: #eef1f5; border: 1px solid #cbd5e1; }
.srm-btn.cancel:hover { background: #e2e8f0; }
.srm-btn.submit { color: #fff; background: #2b5fd9; border: 1px solid #2b5fd9; }
.srm-btn.submit:hover { background: #1e4fc0; }
.srm-btn.submit:disabled { opacity: .45; cursor: not-allowed; background: #2b5fd9; }
`;

function Star({ filled }) {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
                d="M12 2.5l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.52l-5.88 3.09 1.12-6.55L2.48 9.42l6.58-.96L12 2.5z"
                fill={filled ? "#f5b301" : "#e2e8f0"}
                stroke={filled ? "#d99a00" : "#cbd5e1"}
                strokeWidth="1"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function RatingView({
    title = "请评分",
    max = 5,
    defaultValue = 0,
    labels,
    submitText = "提交",
    cancelText = "取消",
    onSubmit,
    onCancel,
}) {
    const [value, setValue] = useState(Math.min(Math.max(defaultValue, 0), max));
    const [hover, setHover] = useState(0);
    const groupRef = useRef(null);

    const textList = labels || (max === 5 ? DEFAULT_LABELS : null);
    const shown = hover || value;
    const caption = shown
        ? textList?.[shown - 1] || `${shown} / ${max}`
        : "请选择评分";

    useEffect(() => {
        groupRef.current?.focus();
    }, []);

    // 锁定页面滚动，并补上滚动条宽度，避免背景页面水平跳动
    useEffect(() => {
        const body = document.body;
        const prevOverflow = body.style.overflow;
        const prevPadding = body.style.paddingRight;
        const sbw = window.innerWidth - document.documentElement.clientWidth;
        if (sbw > 0) {
            const cur = parseFloat(window.getComputedStyle(body).paddingRight) || 0;
            body.style.paddingRight = cur + sbw + "px";
        }
        body.style.overflow = "hidden";
        return () => {
            body.style.overflow = prevOverflow;
            body.style.paddingRight = prevPadding;
        };
    }, []);

    const submit = () => value > 0 && onSubmit(value);

    const onKeyDown = (e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowUp") {
            e.preventDefault();
            setValue((v) => Math.min(v + 1, max));
        } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
            e.preventDefault();
            setValue((v) => Math.max(v - 1, 1));
        } else if (e.key === "Home") {
            e.preventDefault();
            setValue(1);
        } else if (e.key === "End") {
            e.preventDefault();
            setValue(max);
        } else if (/^[1-9]$/.test(e.key) && Number(e.key) <= max) {
            setValue(Number(e.key));
        } else if (e.key === "Enter") {
            e.preventDefault();
            submit();
        }
    };

    return (
        <div className="srm-backdrop">
            <style>{CSS}</style>
            <div className="srm-dialog" role="dialog" aria-modal="true" aria-label={title}>
                <h2 className="srm-title">{title}</h2>

                <div
                    ref={groupRef}
                    className="srm-stars"
                    role="radiogroup"
                    aria-label={title}
                    tabIndex={0}
                    onKeyDown={onKeyDown}
                    onMouseLeave={() => setHover(0)}
                >
                    {Array.from({ length: max }, (_, i) => {
                        const n = i + 1;
                        return (
                            <button
                                key={n}
                                type="button"
                                tabIndex={-1}
                                role="radio"
                                aria-checked={value === n}
                                aria-label={`${n} 星`}
                                className="srm-star"
                                onMouseEnter={() => setHover(n)}
                                onClick={() => setValue(n)}
                            >
                                <Star filled={n <= shown} />
                            </button>
                        );
                    })}
                </div>

                <p className="srm-text">{caption}</p>

                <div className="srm-footer">
                    <button type="button" className="srm-btn cancel" onClick={onCancel}>
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        className="srm-btn submit"
                        disabled={value === 0}
                        onClick={submit}
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
    const [rating, setRating] = useState(null);

    const handleClick = async () => {
        const r = await showRatingModal({ title: "给本次服务打分", defaultValue: rating || 0 });
        if (r !== null) setRating(r);
    };

    return (
        <div style={{ padding: 40 }}>
            <button onClick={handleClick}>去评分</button>
            <p style={{ marginTop: 16 }}>你的评分：{rating ?? "（未评分）"}</p>
        </div>
    );
}
