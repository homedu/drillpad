import { style_Log, style_Entry, style_RepContent } from "./styles"

export default function LogViewer({ logs }) {
    return (
        <div style={style_Log}>
            {logs.map((log) => (
                <div key={log.id} style={{ style_Entry }}  >
                    <span style={{ color: "#999", marginRight: "8px" }} >{log.time}</span>
                    <span style={{ color: log.ok ? "#16a34a" : "#dc2626" }} >{log.text}</span>
                    {log.detail !== undefined && (
                        <pre style={style_RepContent}>
                            {typeof log.detail === "string" ? log.detail : JSON.stringify(log.detail, null, 2)}
                        </pre>
                    )}
                </div>
            ))}
        </div>
    )
}