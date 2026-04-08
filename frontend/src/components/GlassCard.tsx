"use client";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  dark?: boolean;
  strong?: boolean;
}

export function GlassCard({
  children,
  className = "",
  hover = false,
  dark = false,
  strong = false,
}: GlassCardProps) {
  const base = dark
    ? strong
      ? "glass-dark-strong"
      : "glass-dark"
    : strong
      ? "glass-strong"
      : "glass";

  const hoverClass = hover
    ? "transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-200/60"
    : "";

  return (
    <div className={`${base} rounded-2xl ${hoverClass} ${className}`}>
      {children}
    </div>
  );
}
