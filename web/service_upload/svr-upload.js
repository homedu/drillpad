import { randomUUID } from "crypto";
import path from "path";
import fs from "fs/promises";
import { IP_SERVER_UPLOAD, IP_QDP_WEB } from "../config.js";
import "../utils/util_str.js"
import { joinUrl } from "../utils/utils.js";

const UPLOAD_DIR = "./uploads";
await fs.mkdir(UPLOAD_DIR, { recursive: true });

// 允许的前端来源，生产环境请改成具体域名
const ALLOWED_ORIGINS = new Set([
    joinUrl(IP_QDP_WEB),
    "http://localhost",
    "http://localhost:80",
    "http://localhost:3000",
    "http://192.168.1.159:80"
]);

// 统一的 CORS 头生成
function corsHeaders(req) {
    const origin = req.headers.get("origin") ?? "";
    const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "null";
    return {
        "Access-Control-Allow-Origin": allowOrigin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        // wangEditor 默认会带这些头，如果你用了自定义 token 也要列上
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
        Vary: "Origin",
    };
}

// 包装响应，统一追加 CORS 头
function withCors(req, res) {
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(corsHeaders(req))) {
        headers.set(k, v);
    }
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

const handleUpload = {
    // 预检请求
    OPTIONS: (req) => new Response(null, { status: 204, headers: corsHeaders(req) }),
    POST: async (req) => {
        try {
            const formData = await req.formData();
            let file = null;
            for (const [, value] of formData.entries()) {
                if (value instanceof File) {
                    file = value;
                    break;
                }
            }
            if (!file) {
                return withCors(
                    req,
                    Response.json({ errno: 1, message: "No file uploaded" }, { status: 400 })
                );
            }
            const ext = path.extname(file.name) || "";
            const uniqueName = `${randomUUID()}${ext}`;
            const savePath = path.join(UPLOAD_DIR, uniqueName);
            await Bun.write(savePath, file);
            const url = joinUrl(IP_SERVER_UPLOAD, UPLOAD_DIR, uniqueName);
            return withCors(
                req,
                Response.json({
                    errno: 0,
                    data: { url, alt: `${uniqueName}`, href: "" }, // data: [***]
                })
            );
        } catch (err) {
            return withCors(
                req,
                Response.json({ errno: 1, message: err.message }, { status: 500 })
            );
        }
    }
}

const handleFetch = {
    OPTIONS: (req) => new Response(null, { status: 204, headers: corsHeaders(req) }),
    GET: async (req) => {
        const filePath = path.join(UPLOAD_DIR, req.params.filename);
        const file = Bun.file(filePath);
        if (!(await file.exists())) {
            return withCors(req, new Response("Not Found", { status: 404 }));
        }
        return withCors(req, new Response(file));
    }
}

const server = Bun.serve({
    port: IP_SERVER_UPLOAD.part(-1, ":"),
    routes: {
        "/api/upload/image": handleUpload,
        "/api/upload/video": handleUpload,
        "/uploads/:filename": handleFetch,
    },

    // 兜底：未匹配路由也统一带 CORS，并处理全局 OPTIONS
    fetch(req) {
        if (req.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: corsHeaders(req) });
        }
        return withCors(req, new Response("Not Found", { status: 404 }));
    },
});

console.log(`Upload Server Running at ${IP_SERVER_UPLOAD}`);