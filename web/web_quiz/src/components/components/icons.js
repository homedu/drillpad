export const AiHelpIcon = () => (
    <svg xmlns="http://w3.org" viewBox="0 0 256 256" width="256" height="256">
        <title>咨询AI Consult AI</title>
        <desc>极简风格的AI咨询、对话图标</desc>
        <path d="M48 178c0 10 8 18 18 18h110l38 32v-32c10 0 18-8 18-18V66c0-10-8-18-18-18H66c-10 0-18 8-18 18z" fill="#EAF0F8" />
        <path d="M40 170c0 10 8 18 18 18h110l38 32v-32c10 0 18-8 18-18V58c0-10-8-18-18-18H58c-10 0-18 8-18 18z" fill="#FFFFFF" stroke="#172B4D" strokeWidth="6" strokeLinejoin="round" />
        <text x="65" y="145" fontFamily="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" fontWeight="900" fontSize="70" fill="#2F80ED">AI</text>
        <circle cx="155" cy="100" r="4" fill="#B7C4D8" />
        <circle cx="170" cy="100" r="4" fill="#B7C4D8" />
        <circle cx="185" cy="100" r="4" fill="#B7C4D8" />
        <path d="M148 123h32" stroke="#B7C4D8" strokeWidth="5" strokeLinecap="round" />
        <g transform="translate(140, 45) rotate(25 30 30)">
            <path d="M30 0l8 22 22 8-22 8-8 22-8-22-22-8 22-8z" fill="#F2B84B" stroke="#172B4D" strokeWidth="5" strokeLinejoin="round" />
            <circle cx="48" cy="12" r="3" fill="#8FC3FF" />
        </g>
        <path d="M25 210v8M21 214h8" stroke="#F2B84B" strokeWidth="4" strokeLinecap="round" />
    </svg>
);

export const NoteIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
        <title>笔记 Note</title>
        <desc>极简风格的笔记本与笔图标</desc>
        <rect x="43" y="35" width="156" height="188" rx="18" fill="#EAF0F8" />
        <rect x="35" y="27" width="156" height="188" rx="18" fill="#FFFFFF" stroke="#172B4D" strokeWidth="6" />
        <path d="M35 68h156" fill="none" stroke="#172B4D" strokeWidth="6" />
        <circle cx="59" cy="48" r="5" fill="#2F80ED" />
        <circle cx="89" cy="48" r="5" fill="#2F80ED" />
        <circle cx="119" cy="48" r="5" fill="#2F80ED" />
        <circle cx="149" cy="48" r="5" fill="#2F80ED" />
        <circle cx="58" cy="96" r="4" fill="#2F80ED" />
        <path d="M73 96h82" stroke="#B7C4D8" strokeWidth="6" strokeLinecap="round" />
        <circle cx="58" cy="124" r="4" fill="#2F80ED" />
        <path d="M73 124h68" stroke="#B7C4D8" strokeWidth="6" strokeLinecap="round" />
        <circle cx="58" cy="152" r="4" fill="#2F80ED" />
        <path d="M73 152h78" stroke="#B7C4D8" strokeWidth="6" strokeLinecap="round" />
        <path d="M55 181c18-15 31-15 42-2 9 10 19 10 29 0" fill="none" stroke="#F2B84B" strokeWidth="5" strokeLinecap="round" />
        <g transform="translate(18, -25) rotate(35 145 130)">
            <rect x="145" y="78" width="24" height="105" rx="10" fill="#2F80ED" stroke="#172B4D" strokeWidth="5" />
            <path d="M145 91h24" stroke="#8FC3FF" strokeWidth="5" strokeLinecap="round" />
            <path d="M145 178l12 20 12-20z" fill="#FFFFFF" stroke="#172B4D" strokeWidth="5" strokeLinejoin="round" />
            <path d="M157 198l-3 8 6-8" fill="#172B4D" />
            <path d="M145 78h24l-5-15h-14z" fill="#172B4D" />
            <path d="M169 83h8" stroke="#172B4D" strokeWidth="5" strokeLinecap="round" />
        </g>
        <path d="M207 48v12M201 54h12" stroke="#F2B84B" strokeWidth="5" strokeLinecap="round" />
        <path d="M215 190v9M210.5 194.5h9" stroke="#F2B84B" strokeWidth="4" strokeLinecap="round" />
    </svg>
);

export const BookmarkIcon = ({ index, bookmarked }) => {
    const markedColor = bookmarked.includes(index) ? "#2F80ED" : "#FFFFFF"
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
            <title>书签 Bookmark</title>
            <desc>极简风格的蓝色书签图标，带有星标、层叠效果与装饰性闪光</desc>
            <path d="M91 39h110a15 15 0 0 1 15 15v157l-70-43-70 43V54a15 15 0 0 1 15-15z" fill="#EAF0F8" />
            <path d="M67 27h110a15 15 0 0 1 15 15v177l-70-45-70 45V42a15 15 0 0 1 15-15z" fill="#FFFFFF" stroke="#172B4D" strokeWidth="6" strokeLinejoin="round" />
            <path d="M67 42a15 15 0 0 1 15-15h80a15 15 0 0 1 15 15v139l-55-35-55 35z" fill={markedColor} />
            <path d="M67 42a15 15 0 0 1 15-15h80a15 15 0 0 1 15 15v139l-55-35-55 35z" fill="none" stroke="#172B4D" strokeWidth="6" strokeLinejoin="round" />
            <path d="M122 65l8 16 18 3-13 13 3 18-16-9-16 9 3-18-13-13 18-3z" fill="#FFFFFF" stroke="#172B4D" strokeWidth="4" strokeLinejoin="round" />
            <path d="M122 71l6 12 13 2-10 10 2 13-11-6-11 6 2-13-10-10 13-2z" fill="#FFFFFF" />
            <path d="M205 42v12M199 48h12" fill="none" stroke="#F2B84B" strokeWidth="5" strokeLinecap="round" />
            <path d="M45 190v10M40 195h10" fill="none" stroke="#F2B84B" strokeWidth="4" strokeLinecap="round" />
            <circle cx="201" cy="76" r="3" fill="#2F80ED" />
            <circle cx="49" cy="166" r="3" fill="#2F80ED" />
        </svg>
    )
};

export const RatingIcon = ({ value = 0 }) => {
    const rating = Math.min(5, Math.max(0, Math.round(value)));
    const isActive = rating > 0;
    const scale = rating <= 1 ? 1 : 1 + (rating - 1) * 0.1;   // 可调：0.12
    const fontSize = rating === 0 ? 0 : 45;                   // 可调：数字字号

    // 星星包围盒（含 translate(0 38) 与描边余量）
    const VB = { x: 50, y: 47, w: 156, h: 156 };              // 可调：收紧 viewBox 放大星星

    // 以星星中心缩放
    const cx = 128;
    const cy = 99 + 38; // 

    const priorityColors = {
        2: '#1E6FF9', // 蓝 —— 与黄互补，对比强
        3: '#0EAF6E', // 绿 —— 冷暖对比，清晰
        4: '#7A3FF2', // 紫 —— 色相远，醒目
        5: '#EE2F2F', // 红 —— 最重、最警示，且与黄对比强
    };

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
            width={VB.w * scale}
            height={VB.h * scale}
        >
            <title>星级评分 Rating</title>
            <desc>星评分图标，当前评分 {rating}</desc>
            <g transform={`translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})`}>
                <g transform="translate(0 38)">
                    <path
                        d="M128 29 L145 65 L185 71 L156 99 L163 139 L128 120 L93 139 L100 99 L71 71 L111 65 Z"
                        fill={isActive ? '#F2B84B' : '#C1C7D0'}
                        stroke="#172B4D"
                        strokeWidth="1"
                        strokeLinejoin="round"
                    />
                    {(isActive && rating != 1) && (
                        <text
                            x={128}
                            y={92 + fontSize * 0.35}
                            textAnchor="middle"
                            fontSize={fontSize}
                            fill={priorityColors[rating]}
                            fontFamily="'Avenir Next', 'Futura', 'Century Gothic', 'Helvetica Neue', sans-serif"
                            fontStyle="italic"
                            style={{ userSelect: 'none' }}
                        >
                            {rating}
                        </text>
                    )}
                </g>
            </g>
        </svg>
    );
};
