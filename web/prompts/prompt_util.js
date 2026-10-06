import { prompt } from "./prompt.js";

const promptPathMap = new Map([
    ['AZ-900@MCSA', prompt.az_900.mcsa]
    // ...
]);

function createPromptMap(p, question) {
    return new Map([
        ['AZ-900@MCSA', `${p.quiz_name}
                         ${question}
                         ${p.question_profile}
                         ${p.correct_answer}
                         ${p.answer_explanation}
                         ${p.incorrect_options_explanation}
                         ${p.tested_topic}
                         ${p.other_notes}`],
        //  ...
    ])
}

export const getPrompt = (quiz, type, question) => {
    const p_id = `${quiz}@${type}`
    const path = promptPathMap.get(p_id);
    const mPrompt = createPromptMap(path, question);
    return mPrompt.get(p_id);
}