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
        const filled = normalize(answer.map((o) => o.text));
        const correct = normalize(q.correctAnswer);
        return filled.every((f, i) => f === correct[i]);
    },

    formatCorrect: (q) => q.correctAnswer.join("；"),

    Input: ({ q, answer, onChangeToSetAnswer, onFocus, submitted }) => {
        const current = Array.isArray(answer) ? answer : [];
        const correctTexts = Array.isArray(q.correctAnswer) ? normalize(q.correctAnswer) : [];

        // 已填则覆盖，未填则加入
        const fillAnswer = (f) => {
            const exists = current.some((a) => a.label === f.label);
            onChangeToSetAnswer(exists ? current.map((a) => a.label === f.label ? f : a) : [...current, f]);
        };

        const [allFillTxt, setAllFillTxt] = useState({})

        return q.options.map((opt, idx) => {
            return (
                <Fill
                    key={opt.label} // A, B, C...
                    questionId={q.id}
                    opt={opt}
                    filled={allFillTxt?.[idx]?.trim()}
                    isCorrect={allFillTxt?.[idx] === correctTexts[idx]}
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