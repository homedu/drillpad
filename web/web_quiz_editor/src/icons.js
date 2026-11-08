
export const PenIcon = () => (
    <svg xmlns="http://w3.org" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
    </svg>
);

export const ArrowIcon = ({ direction, className = 'w-5 h-5' }) => {
    const svgProps = {
        xmlns: 'http://w3.org',
        fill: 'none',
        viewBox: '0 0 24 24',
        strokeWidth: '2',
        stroke: 'currentColor',
        className: className,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
    };
    switch (direction) {
        case 'L': // 左箭头
            return (<svg {...svgProps}> <path d="M15.75 19.5 8.25 12l7.5-7.5" /> </svg>);
        case 'R': // 右箭头
            return (<svg {...svgProps}> <path d="M8.25 4.5l7.5 7.5-7.5 7.5" /> </svg>);
        case 'U': // 上箭头
            return (<svg {...svgProps}> <path d="M4.5 15.75L12 8.25l7.5 7.5" /> </svg>);
        case 'D': // 下箭头
            return (<svg {...svgProps}> <path d="M19.5 8.25l-7.5 7.5-7.5-7.5" /> </svg>);
        default:
            return null;
    }
};