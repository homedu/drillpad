import { getPromptObject } from "./prompt.js";

const makePrompt = (p, question) => {
    return `${p.quiz_name}
            ${question}
            ${p?.question_profile ?? ""}
            ${p?.correct_answer ?? ""}
            ${p?.answer_explanation ?? ""}
            ${p?.incorrect_options_explanation ?? ""}
            ${p?.tested_topic ?? ""}
            ${p?.other_notes ?? ""}`
}

export const getPrompt = (quiz, type, question) => {
    return makePrompt(getPromptObject(quiz, type), question);
}