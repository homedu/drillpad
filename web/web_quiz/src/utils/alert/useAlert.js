import { useState, useEffect, useCallback } from "react";

export function useAlert(defaultDuration = 3000) {
    const [alertState, setAlertState] = useState({
        text: "",
        type: "error", // 支持 'error' | 'success' | 'warning'
        id: 0,
        visible: false,
        duration: defaultDuration,
    });

    // 触发提示：showAlert("错误信息") 或 showAlert("保存成功", "success", 2000)
    const showAlert = useCallback(
        (text, type = "error", duration = defaultDuration) => {
            setAlertState({
                text,
                type,
                id: Date.now(),
                visible: true,
                duration,
            });
        },
        [defaultDuration]
    );

    // 手动关闭提示
    const hideAlert = useCallback(() => {
        setAlertState((prev) => ({ ...prev, visible: false }));
    }, []);

    useEffect(() => {
        if (!alertState.visible) return;

        // 1. 到点触发淡出动画
        const fadeTimer = setTimeout(() => {
            setAlertState((prev) => ({ ...prev, visible: false }));
        }, alertState.duration);

        // 2. 预留 300ms 给 CSS 过渡动画，之后彻底清空数据
        const clearTimer = setTimeout(() => {
            setAlertState((prev) => ({ ...prev, text: "", id: 0 }));
        }, alertState.duration + 300);

        return () => {
            clearTimeout(fadeTimer);
            clearTimeout(clearTimer);
        };
    }, [alertState.id, alertState.visible, alertState.duration]);

    return { alertState, showAlert, hideAlert };
}
