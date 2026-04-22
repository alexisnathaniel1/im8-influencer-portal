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
          <label htmlFor={inputId} className="block text-sm font-medium text-im8-burgundy mb-1.5">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full px-3 py-2 rounded-lg border bg-white text-im8-burgundy placeholder:text-im8-burgundy/40 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-im8-red/30 focus:border-im8-red disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-im8-offwhite ${error ? "border-red-500 focus:ring-red-500/30 focus:border-red-500" : "border-im8-stone"} ${className}`}
          {...props}
        />
        {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
        {hint && !error && <p className="mt-1.5 text-sm text-im8-burgundy/60">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input, type InputProps };
