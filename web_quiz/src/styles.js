export const styles = {

    app: "p-[30px] font-[system-ui,sans-serif] max-w-[700px] m-auto",

    errBox: "text-red-600 bg-red-100 p-3 rounded-md mt-[15px]",

    infoBox: "text-[#222222] bg-[#d3fcda] p-3 rounded-md mt-[15px]",

    input: [
        "box-border h-10 align-middle text-sm mr-[5px] p-[5px] py-0",
        "inline-flex items-center justify-center",
        "leading-[normal]",
    ].join(" "),

    fetchBtn: (canFetch) =>
        [
            "px-3 py-3 bg-[#0070f3] text-white border-none rounded-md",
            canFetch ? "cursor-pointer opacity-100" : "cursor-not-allowed opacity-60",
        ].join(" "),
};
