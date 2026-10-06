import { cn } from "../../../utils/utils.js"

export const styles = {

    card: "bg-white border border-solid border-[#e1e4e8] rounded-[8px] p-[20px] mb-[16px] shadow-[0_1px_3px_rgba(0,0,0,0.05)]",

    question: "mt-0 text-[16px] text-[#24292e] leading-[1.5]",

    optionsContainer: "flex flex-col gap-[8px]",

    option: ({ submitted, isOptionSelected, isThisOptionCorrect }) => cn(
        "py-[10px] px-[14px] rounded-[6px]",
        "border border-solid",
        "flex items-center",
        "transition-all duration-200 ease-[ease]",
        "border-[#d1d5da] bg-[#f6f8fa]",
        submitted ? "cursor-default" : "cursor-pointer",
        !submitted && isOptionSelected && "border-[#0070f3] bg-[#e6f0ff]",
        submitted && isThisOptionCorrect && "border-[#28a745] bg-[#dcffe4]",
        submitted && isOptionSelected && !isThisOptionCorrect && "border-[#dc3545] bg-[#f8d7da]",
    ),

    submitBtn: "py-[10px] px-[24px] bg-[#28a745] text-white border-none rounded-[6px] text-[15px] font-bold cursor-pointer",

    resetBtn: "py-[10px] px-[24px] bg-[#0070f3] text-white border-none rounded-[6px] text-[15px] font-bold cursor-pointer",

    cardButton: cn(
        "inline-flex h-9 w-10 items-center justify-center gap-1.5 rounded-lg cursor-pointer",
        "border-none bg-white text-sm font-medium text-gray-700 mb-4",
        "shadow-sm transition",
        "hover:border-gray-500 hover:bg-gray-50",
        "active:scale-95",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
    ),

    errBox: "text-[#dc3545] bg-[#f8d7da] p-[12px] rounded-[6px] mt-[15px]",
};