import { styles as tw } from "../../styles.js";

// 单个选项：单选(radio)与多选(checkbox)共用
export function Option({
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
            <input
                type={inputType}
                name={`question-${questionId}`}
                value={opt.label}
                checked={!!checked}
                disabled={submitted}
                onChange={onChange}
                className="me-2.5"
            />
            <strong className="me-2">{opt.label}.</strong>
            <span>{opt.text}</span>
        </label>
    );
}

export function Fill({
    questionId,
    opt,
    filled,
    isCorrect,        // 该选项是否为正确选项（用于提交后高亮）
    submitted,
    onChange,
    onFocus,
}) {
    return (
        <label className={tw.fill({ submitted, isOptionSelected: filled, isThisOptionCorrect: isCorrect })}>
            <strong className="me-2">{opt.label}.</strong>
            <input
                type="text"
                name={`question-${questionId}-${opt.label}`}
                disabled={submitted}
                className="m-0 w-1/2 h-full min-h-0 box-border px-1 py-0 leading-normal"
                onChange={(e) => onChange({ "label": opt.label, "text": e.target.value })}
                onFocus={(e) => onFocus(e.target.name)}
            />
        </label>
    );
}