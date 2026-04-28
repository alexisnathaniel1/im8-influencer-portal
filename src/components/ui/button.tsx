import { forwardRef, type ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

// V4.01 spec: Burgundy fill + pill shape on light backgrounds
// secondary: white fill on dark/burgundy backgrounds
const variantClasses: Record<ButtonVariant, string> = {
  primary:   "bg-im8-burgundy text-white hover:bg-im8-dark focus-visible:ring-im8-burgundy",
  secondary: "bg-white text-im8-burgundy hover:bg-im8-sand border border-im8-stone/60 focus-visible:ring-im8-stone",
  outline:   "border border-im8-burgundy/40 bg-transparent text-im8-burgundy hover:bg-im8-sand focus-visible:ring-im8-stone",
  ghost:     "bg-transparent text-im8-maroon hover:bg-im8-offwhite focus-visible:ring-im8-stone",
  danger:    "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600",
};

// V4.01 spec: pill radius (9999px), Aeonik Bold, 11px, UPPERCASE, 0.1em tracking
const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-4 py-1.5 text-[11px]",
  md: "px-5 py-2.5 text-[11px]",
  lg: "px-7 py-3 text-[12px]",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading = false, disabled, className = "", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center gap-2
          rounded-full font-bold uppercase tracking-[0.1em]
          transition-colors duration-150 ease-in-out
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
          disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer
          ${variantClasses[variant]} ${sizeClasses[size]} ${className}
        `}
        {...props}
      >
        {loading && (
          <svg className="animate-spin -ml-1 h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button, type ButtonProps, type ButtonVariant, type ButtonSize };
