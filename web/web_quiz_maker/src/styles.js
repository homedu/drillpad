import { cn } from "./utils/cn";

export const styles = {

    container: "max-w-[800px] my-0 mx-auto p-[24px] font-[family-name:system-ui,-apple-system,sans-serif]",

    input: cn(
        "box-border h-10 align-middle text-sm mr-[5px] p-[5px] py-0",
        "inline-flex items-center justify-center",
        "leading-[normal]",
    ),

    errBox: "text-[#dc3545] bg-[#f8d7da] p-[12px] rounded-[6px] mt-[15px]",

    infoBox: "text-[#222222] bg-[#d3fcda] p-[12px] rounded-[6px] mt-[15px]",

    title: "text-[20px] font-semibold mb-[16px]",

    label: "text-[15px] font-medium mt-[16px] mb-[8px] text-[#374151]",

    textarea: cn(
        "w-full box-border py-[8px] px-[10px] text-[14px]",
        "border border-solid border-[#d1d5db] rounded-[6px]",
        "resize-y font-[family-name:inherit]",
    ),

    optionsList: "flex flex-col gap-[8px]",

    optionRow: "flex items-center gap-[8px]",

    optionIndex: "w-[20px] text-[14px] font-semibold text-[#6b7280] text-center",

    optionInput: cn(
        "flex-1 box-border py-[6px] px-[10px] text-[14px]",
        "border border-solid border-[#d1d5db] rounded-[6px]",
    ),

    checkLabel: (disabled) => cn(
        "flex items-center text-[13px] whitespace-nowrap text-[#374151]",
        disabled && "text-[#9ca3af] cursor-not-allowed"
    ),

    message: "mt-[12px] text-[13px] text-[#15803d]",

    buttonRow: "flex gap-[12px] mt-[20px]",

    button: "py-[8px] px-[20px] text-[14px] rounded-[6px] border-none cursor-pointer",

    primaryButton: "bg-[#2563eb] text-white",

    secondaryButton: "bg-[#e5e7eb] text-[#111827]",
};
