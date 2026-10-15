import { styles as tw } from "../styles.js";

// 单个选项：单选(radio)与多选(checkbox)共用
export default function Option({
    inputType,        // "radio" | "checkbox"
    questionId,
    opt,
    checked,
    isCorrect,        // 该选项是否为正确选项（用于提交后高亮）
    submitted,
    onChange,
}) {
    return (
        <label className={tw.option({ submitted, isOptionSelected: checked, isThisOptionCorrect: isCorrect })}>
            <input type={inputType} name={`question-${questionId}`} value={opt.label} checked={!!checked} disabled={submitted} onChange={onChange} className="me-2.5" />
            <strong className="me-2">{opt.label}.</strong>
            <span>{opt.text}</span>
        </label>
    );
}