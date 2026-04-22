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
      className={`bg-white rounded-xl shadow-sm border border-im8-stone/20 ${paddingClasses[padding]} ${className}`}
      {...props}
    >
      {title && <h3 className="text-lg font-semibold text-im8-burgundy mb-4">{title}</h3>}
      {children}
    </div>
  );
}

export { Card, type CardProps };
