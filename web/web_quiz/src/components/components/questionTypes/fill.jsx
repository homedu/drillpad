import { Fill } from "./components/OptionFill.jsx";
import { useState } from "react";

const normalize = (arr) => arr.map((a) => a.trim());

export const FILL = {
    label: "填空",

    parseAnswer: (answers) => answers,

    hasAnswered: (q, answer) => Array.isArray(answer) && answer.length > 0,

    isCorrect: (q, answer) => {
        if (!Array.isArray(q.correctAnswer) || !Array.isArray(answer)) {
            return false;
        }
        if (answer.length === 0 || q.correctAnswer.length !== answer.length) {
            return false;
        }
        const filled = normalize(answer.sort((a, b) => a.label.localeCompare(b.label)).map((o) => o.text));
        const correct = normalize(q.correctAnswer);
        // console.log("answer", answer);
        // console.log("filled", filled);
        // console.log("correct", correct);
        return filled.every((f, i) => f === correct[i]);
    },

    formatCorrect: (q) => q.correctAnswer.join("；"),

    Input: ({ q, answer, onChangeToSetAnswer, onFocus, submitted }) => {
        const current = Array.isArray(answer) ? answer : [];
        const correctTexts = Array.isArray(q.correctAnswer) ? normalize(q.correctAnswer) : [];

        // 已填则覆盖，未填则加入
        const fillAnswer = (f) => {
            const exists = current.some((a) => a.label === f.label);
            onChangeToSetAnswer(exists ? current.map((a) => a.label === f.label ? f : a) : [...current, f]); // attach current filled answer to whole quiz answer
        };

        const [allFillTxt, setAllFillTxt] = useState({}) // current question's filled answers

        return q.options.map((opt, idx) => {
            return (
                <Fill
                    key={opt.label} // A, B, C...
                    questionId={q.id}
                    opt={opt}
                    filled={allFillTxt?.[idx]?.trim()} // just for setting style of input box
                    isCorrect={allFillTxt?.[idx] === correctTexts[idx]} // just for setting style of input box
                    isSubEval={q.evalMode === "SUB"} // just for setting style of input box
                    submitted={submitted}
                    onChange={(oneFillRst) => {
                        fillAnswer(oneFillRst)
                        setAllFillTxt(prev => ({ ...prev, [idx]: oneFillRst.text }))
                    }}
                    onFocus={(target_name) => {
                        onFocus(idx)
                    }}
                />
            )
        });
    },
};