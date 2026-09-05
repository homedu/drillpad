import { IP_CADDY } from "./addr";

const CADDY_URL = `http://${IP_CADDY}/[PATH]`;

export async function fetchFile(path) {
    const timestamp = Date.now();
    const url = CADDY_URL.replace("[PATH]", path) + `?v=${timestamp}`;
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP 错误: ${response.status}`);
    return await response.text();
}
