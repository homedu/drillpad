export const style_Card = {
    background: "#ffffff",
    border: "1px solid #e1e4e8",
    borderRadius: "8px",
    padding: "20px",
    marginBottom: "16px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
};

export const style_Question = {
    marginTop: 0,
    fontSize: "16px",
    color: "#24292e",
    lineHeight: "1.5",
};

export const style_OptionsContainer = {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
};

export function style_Option({ submitted, isOptionSelected, isThisOptionCorrect }) {
    const style = {
        padding: "10px 14px",
        borderRadius: "6px",
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: "#d1d5da", // 不用 border 简写
        cursor: submitted ? "default" : "pointer",
        display: "flex",
        alignItems: "center",
        transition: "all 0.2s ease",
        background: "#f6f8fa",
    };

    if (isOptionSelected) {
        style.borderColor = "#0070f3";
        style.background = "#e6f0ff";
    }

    if (submitted) {
        if (isThisOptionCorrect) {
            style.borderColor = "#28a745";
            style.background = "#dcffe4";
        } else if (isOptionSelected && !isThisOptionCorrect) {
            style.borderColor = "#dc3545";
            style.background = "#f8d7da";
        }
    }

    return style;
}

export const style_SubmitBtn = {
    padding: "10px 24px",
    background: "#28a745",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "15px",
    fontWeight: "bold",
    cursor: "pointer",
};

export const style_ResetBtn = {
    padding: "10px 24px",
    background: "#0070f3",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "15px",
    fontWeight: "bold",
    cursor: "pointer",
};

export const style_ErrorBox = {
    color: "#dc3545",
    background: "#f8d7da",
    padding: "12px",
    borderRadius: "6px",
    marginTop: "15px",
};