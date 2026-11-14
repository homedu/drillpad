const STYLE_MAP = {
    error: "text-red-600 bg-red-100",
    success: "text-emerald-700 bg-emerald-100",
    warning: "text-amber-700 bg-amber-100",
};

export function AlertBanner({ alert, onClose, className = "" }) {
    // 彻底清空后直接返回 null，不占任何空间
    if (!alert?.text) return null;

    const colorStyle = STYLE_MAP[alert.type] || STYLE_MAP.error;

    return (
        // 外层用 Grid 控制高度和外边距的平滑收起（从 1fr 过渡到 0fr）
        <div
            className={`grid transition-all duration-300 ease-in-out ${alert.visible
                ? "grid-rows-[1fr] opacity-100 mt-3.75"
                : "grid-rows-[0fr] opacity-0 mt-0 pointer-events-none"
                } ${className}`}
        >
            {/* 必须加 overflow-hidden，高度收起时内容才不会溢出 */}
            <div className="overflow-hidden">
                <div
                    role="alert"
                    className={`flex items-center justify-between p-3 rounded-md ${colorStyle}`}
                >
                    <span>{alert.text}</span>
                    {onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="ml-4 opacity-70 hover:opacity-100 font-bold leading-none cursor-pointer"
                            aria-label="关闭提示"
                        >
                            ×
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
