import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id, className = "", ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-[12px] font-medium text-im8-muted uppercase tracking-[0.06em] mb-1.5">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full px-3.5 py-2.5 rounded-xl border bg-white
            text-[14px] text-im8-ink placeholder:text-im8-muted/60
            transition-colors duration-150
            focus:outline-none focus:ring-2 focus:ring-im8-red/25 focus:border-im8-red/50
            disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-im8-offwhite
            ${error ? "border-red-400 focus:ring-red-400/25 focus:border-red-400" : "border-im8-stone/70"}
            ${className}
          `}
          {...props}
        />
        {error && <p className="mt-1.5 text-[12px] text-red-600">{error}</p>}
        {hint && !error && <p className="mt-1.5 text-[12px] text-im8-muted">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input, type InputProps };
