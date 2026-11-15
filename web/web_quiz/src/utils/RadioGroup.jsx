export function RadioGroup({ name, options, value, onChange, disabled = false }) {
    return (
        <div className={`inline-flex flex-wrap gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/70 transition-opacity ${disabled ? 'opacity-50 pointer-events-none select-none' : ''}`}>
            {options.map((opt) => (
                <label
                    key={opt.value}
                    className={`select-none ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                >
                    <input
                        type="radio"
                        name={name}
                        value={opt.value}
                        checked={value === opt.value}
                        disabled={disabled}
                        onChange={() => !disabled && onChange?.(opt.value)}
                        className="peer sr-only"
                    />
                    <span
                        className="block px-3.5 py-1.5 text-sm font-medium rounded-lg text-slate-600 transition-all duration-200
                       hover:text-slate-900
                       peer-checked:bg-white peer-checked:text-indigo-600 peer-checked:shadow-sm"
                    >
                        {opt.label}
                    </span>
                </label>
            ))}
        </div>
    );
}
