import { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { createPortal } from 'react-dom';

/** 上下文菜单：受控组件，由父组件传入坐标 */
export function ContextMenu({ x, y, items, onClose }) {
    const ref = useRef(null);
    const [pos, setPos] = useState({ left: x, top: y });

    // 渲染后测量尺寸，防止超出视口
    useLayoutEffect(() => {
        const { offsetWidth: w, offsetHeight: h } = ref.current;
        setPos({
            left: Math.min(x, window.innerWidth - w - 8),
            top: Math.min(y, window.innerHeight - h - 8),
        });
    }, [x, y]);

    // 点击空白、Esc、滚动、缩放时关闭
    useEffect(() => {
        const onDown = (e) => !ref.current?.contains(e.target) && onClose();
        const onKey = (e) => e.key === 'Escape' && onClose();
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        window.addEventListener('scroll', onClose, true);
        window.addEventListener('resize', onClose);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
            window.removeEventListener('scroll', onClose, true);
            window.removeEventListener('resize', onClose);
        };
    }, [onClose]);

    return createPortal(
        <div
            ref={ref}
            role="menu"
            style={{ left: pos.left, top: pos.top }}
            className="fixed z-50 w-40 rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg"
        >
            {items.map((item, i) =>
                item.divider ? (
                    <div key={i} className="my-1 border-t border-gray-100" />
                ) : (
                    <button
                        key={i}
                        role="menuitem"
                        onClick={() => {
                            item.onClick();
                            onClose();
                        }}
                        className={`block w-full px-4 py-2 text-left ${item.danger
                            ? 'text-red-600 hover:bg-red-50'
                            : 'text-gray-700 hover:bg-gray-100'
                            }`}
                    >
                        {item.label}
                    </button>
                )
            )}
        </div>,
        document.body
    );
}

/** 使用示例：在已有按钮的 onClick 中显示菜单 */
// function App() {
//     const [menu, setMenu] = useState(null); // { x, y } | null
//     const handleClick = (e) => {
//         // 再次点击按钮时：mousedown 已先关闭菜单，这里避免立刻重新打开
//         if (menu) return setMenu(null);
//         const r = e.currentTarget.getBoundingClientRect();
//         setMenu({ x: r.left, y: r.bottom + 4 });
//     };
//     const items = [
//         {
//             label: '复制链接',
//             onClick: async () => {
//                 await navigator.clipboard.writeText(location.href);
//                 alert('链接已复制');
//             },
//         },
//         { divider: true },
//         {
//             label: '删除',
//             danger: true,
//             onClick: () => confirm('确定要删除吗？') && console.log('已删除'),
//         },
//     ];
//     return (
//         <div className="p-10">
//             {/* 已有控件 */}
//             <button
//                 onClick={handleClick}
//                 className="rounded-md bg-blue-600 px-3 py-1.5 text-white"
//             >
//                 更多
//             </button>
//             {menu && (
//                 <ContextMenu
//                     x={menu.x}
//                     y={menu.y}
//                     items={items}
//                     onClose={() => setMenu(null)}
//                 />
//             )}
//         </div>
//     );
// }