import { Option } from "./components/OptionFill.jsx";

export const MCSA = {
    label: "单选",

    // 从 TSV 的非空答案列得到 correctAnswer（字符串）
    parseAnswer: (answers, id) => {
        if (answers.length > 1) {
            throw Error(`question - ${id} is MCSA, but has multiple answers`);
        }
        return answers[0] ?? "";
    },

    // 作答状态：选中的 option 对象，或 undefined
    hasAnswered: (q, answer) => !!answer,

    isCorrect: (q, answer) => !!q.correctAnswer && !!answer && answer.text.trim() === q.correctAnswer.trim(),

    formatCorrect: (q) => q.correctAnswer,

    Input: ({ q, answer, onChangeToSetAnswer, submitted }) => {
        return q.options.map((opt) => (
            <Option
                key={opt.label}
                inputType="radio"
                questionId={q.id}
                opt={opt}
                checked={answer?.label === opt.label}
                isCorrect={!!q.correctAnswer && opt.text.trim() === q.correctAnswer.trim()}
                submitted={submitted}
                onChange={() => onChangeToSetAnswer(opt)}
            />
        ));
    },
};