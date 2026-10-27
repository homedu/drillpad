import { Option } from "./components/OptionFill.jsx";

const normalize = (arr) => arr.map((a) => a.trim());

export const MS = {
    label: "多选",

    // correctAnswer 为字符串数组
    parseAnswer: (answers) => answers,

    // 作答状态：选中的 option 对象数组
    hasAnswered: (q, answer) => Array.isArray(answer) && answer.length > 0,

    // 必须与正确答案集合完全一致
    isCorrect: (q, answer) => {
        if (!Array.isArray(q.correctAnswer) || !Array.isArray(answer) || answer.length === 0) {
            return false;
        }
        const picked = new Set(normalize(answer.map((o) => o.text)));
        const correct = new Set(normalize(q.correctAnswer));
        return picked.size === correct.size && [...picked].every((t) => correct.has(t));
    },

    formatCorrect: (q) => q.correctAnswer.join("；"),

    Input: ({ q, answer, onChangeToSetAnswer, onFocus, submitted }) => {
        const current = Array.isArray(answer) ? answer : [];
        const correctTexts = Array.isArray(q.correctAnswer) ? normalize(q.correctAnswer) : [];

        // 已选则取消，未选则加入
        const toggle = (opt) => {
            const exists = current.some((o) => o.label === opt.label);
            onChangeToSetAnswer(exists ? current.filter((o) => o.label !== opt.label) : [...current, opt]);
        };

        return q.options.map((opt, idx) => (
            <Option
                key={opt.label}
                inputType="checkbox"
                questionId={q.id}
                opt={opt}
                checked={current.some((o) => o.label === opt.label)}
                isCorrect={correctTexts.includes(opt.text.trim())}
                submitted={submitted}
                onChange={() => toggle(opt)}
                onFocus={(target_name) => { onFocus(idx) }}
            />
        ));
    },
};