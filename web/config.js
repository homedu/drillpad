const IP = typeof QDP_IP === "undefined" ? "localhost" : QDP_IP; // QDP_IP is from [build:html] ./web/web_quiz/package.json
export const IP_CADDY_FETCH_QUIZ = `${IP}:8080` // 8080 is Caddy Static File Service port for fetch generated quiz
export const IP_NATS_REPLY = `${IP}:9222` // 9222 is Nats Reply Services Port, launched from ./script/deploy
export const IP_SERVER_UPLOAD = `${IP}:8088` // 8088 is Bun HTTP Service Port for file(image/video) uploading
export const IP_QDP_WEB = `${IP}:3000` // 3000 is QDP/web Service Port, defined from [dev:server] ./web/web_quiz/package.json

console.log("IP_CADDY_FETCH_QUIZ", IP_CADDY_FETCH_QUIZ);
console.log("IP_NATS_REPLY", IP_NATS_REPLY);
console.log("IP_SERVER_UPLOAD", IP_SERVER_UPLOAD);
console.log("IP_QDP_WEB", IP_QDP_WEB);