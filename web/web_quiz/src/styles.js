import { cn } from "../../utils/utils.js"

export const styles = {

    app: "p-[24px] font-[family-name:system-ui,-apple-system,sans-serif] max-w-[800px] m-auto",

    errBox: "text-red-600 bg-red-100 p-3 rounded-md mt-[15px]",

    infoBox: "text-[#222222] bg-[#d3fcda] p-3 rounded-md mt-[15px]",

    title: "text-[20px] font-semibold mb-[16px]",

    input: cn(
        "box-border h-10 align-middle text-sm mr-[5px] p-[5px] py-0",
        "inline-flex items-center justify-center",
        "leading-[normal]",
    ),

    fetchBtn: (canFetch) => cn(
        "px-3 py-3 bg-[#0070f3] text-white border-none rounded-md cursor-pointer opacity-100",
        !canFetch && "cursor-not-allowed opacity-60",
    )
};
