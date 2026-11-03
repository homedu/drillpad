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
    onFocus,
}) {
    return (
        <label className={tw.option({ submitted, isOptionSelected: checked, isThisOptionCorrect: isCorrect })}>
            <input
                type={inputType}
                name={`question-${questionId}`}
                value={opt.label}
                checked={!!checked}
                disabled={submitted}
                className="me-2.5"
                onChange={onChange}
                onFocus={(e) => onFocus(e.target.name)}
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
            <textarea
                name={`question-${questionId}-${opt.label}`}
                disabled={submitted}
                autoComplete="off"
                className="m-0 w-full h-[3rem] min-h-[3rem] box-border px-3 py-3 leading-norma text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                wrap="soft"
                onChange={(e) => onChange({ "label": opt.label, "text": e.target.value })}
                onFocus={(e) => onFocus(e.target.name)}>
            </textarea>
        </label>
    );
}