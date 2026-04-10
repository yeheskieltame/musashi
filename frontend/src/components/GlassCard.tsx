"use client";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  dark?: boolean;
  strong?: boolean;
  glow?: boolean;
}

export function GlassCard({
  children,
  className = "",
  hover = false,
  dark = false,
  strong = false,
  glow = false,
}: GlassCardProps) {
  const base = dark
    ? glow
      ? "glass-dark-glow"
      : strong
        ? "glass-dark-strong"
        : "glass-dark"
    : strong
      ? "glass-strong shadow-lg shadow-blue-100/50"
      : "glass";

  const hoverClass = hover
    ? dark
      ? "transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/20 hover:shadow-lg hover:shadow-blue-500/10 card-shine"
      : "transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-200/60"
    : "";

  return (
    <div className={`${base} rounded-2xl ${hoverClass} ${className}`}>
      {children}
    </div>
  );
}
