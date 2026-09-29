export const styles = {
    card: "bg-white border border-solid border-[#e1e4e8] rounded-[8px] p-[20px] mb-[16px] shadow-[0_1px_3px_rgba(0,0,0,0.05)]",

    question: "mt-0 text-[16px] text-[#24292e] leading-[1.5]",

    optionsContainer: "flex flex-col gap-[8px]",

    option: ({ submitted, isOptionSelected, isThisOptionCorrect }) => {
        // 先确定，再赋值。不要先赋值，再局部覆盖！ 
        let stateClasses;
        if (submitted && isThisOptionCorrect) {
            stateClasses = "border-[#28a745] bg-[#dcffe4]";
        } else if (submitted && isOptionSelected) {
            stateClasses = "border-[#dc3545] bg-[#f8d7da]";
        } else if (isOptionSelected) {
            stateClasses = "border-[#0070f3] bg-[#e6f0ff]";
        } else {
            stateClasses = "border-[#d1d5da] bg-[#f6f8fa]";
        }

        return [
            "py-[10px] px-[14px]",
            "rounded-[6px]",
            "border border-solid",
            "flex items-center",
            "transition-all duration-200 ease-[ease]",
            submitted ? "cursor-default" : "cursor-pointer",
            stateClasses,
        ].join(" ");
    },

    submitBtn: "py-[10px] px-[24px] bg-[#28a745] text-white border-none rounded-[6px] text-[15px] font-bold cursor-pointer",

    resetBtn: "py-[10px] px-[24px] bg-[#0070f3] text-white border-none rounded-[6px] text-[15px] font-bold cursor-pointer",

    errBox: "text-[#dc3545] bg-[#f8d7da] p-[12px] rounded-[6px] mt-[15px]",
};