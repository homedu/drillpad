export const style_App =
{
    padding: "30px",
    fontFamily: "system-ui, sans-serif",
    maxWidth: "700px",
    margin: "auto",
}

export const style_ReqStatus = {
    margin: "12px 0",
    fontSize: "13px",
    color: "#666",
}

export const style_ReqBtn = (loading) => ({
    padding: "12px 24px",
    background: "#0070f3",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: loading ? "not-allowed" : "pointer",
    opacity: loading ? 0.6 : 1,
    fontSize: "16px",
})