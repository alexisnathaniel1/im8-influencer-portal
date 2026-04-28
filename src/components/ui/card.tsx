import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  children: ReactNode;
  padding?: "sm" | "md" | "lg";
}

const paddingClasses = { sm: "p-4", md: "p-6", lg: "p-8" };

function Card({ title, children, padding = "md", className = "", ...props }: CardProps) {
  return (
    <div
      className={`bg-white rounded-xl border border-im8-stone/30 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-sm ${paddingClasses[padding]} ${className}`}
      {...props}
    >
      {title && (
        <h3 className="text-[15px] font-semibold text-im8-maroon mb-4" style={{ fontFamily: "var(--font-serif)" }}>
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

export { Card, type CardProps };
