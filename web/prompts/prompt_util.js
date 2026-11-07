import { getPromptObject } from "./prompt.js";

// 顺序组织
const makePrompt = (p) => {
    const lines = [
        p.quiz_name,              // 是个什么测试？
        p?.question_type,         // 题型是什么，单选/多选/填空
        p?.question,              // 完整题目内容
        p?.question_profile,      // 如何解析这个题目？哪里是问题，哪里是选项等
        p?.question_eval,         // 是主观题吗？是的话先给结论
        p?.question_ref,          // 该题有需要参考的文字吗？比如阅读理解的文章
        p?.correct_answer,        // 正确答案是什么？
        p?.answer_explanation,    // 为什么这个是正确答案？
        p?.incorrect_explanation, // 错误答案或选项，为什么错了？
        p?.tested_topic,          // 考察的知识点
        p?.other_notes            // 其他备注
    ];
    // filter(Boolean) 会自动过滤掉 undefined, null 和空字符串，避免生成无意义的空行
    return lines.filter(Boolean).join('\n');
}

export const getPrompt = (quiz, type, question, question_ref, isEval) => {
    const po = getPromptObject(quiz, type, question, question_ref, isEval)
    return makePrompt(po);
}