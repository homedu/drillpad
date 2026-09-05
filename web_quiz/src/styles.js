export const style_App = {
    padding: "30px",
    fontFamily: "system-ui, sans-serif",
    maxWidth: "700px",
    margin: "auto",
}

export const style_FetchBtn = (loading) => ({
    padding: "12px 24px",
    background: "#0070f3",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: loading ? "not-allowed" : "pointer",
    opacity: loading ? 0.6 : 1,
    fontSize: "16px",
});

export const style_ErrorBox = {
    color: "#dc3545",
    background: "#f8d7da",
    padding: "12px",
    borderRadius: "6px",
    marginTop: "15px",
};
