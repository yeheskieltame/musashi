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
  // In the new aesthetic, everything is dark glassmorphism
  const base = glow
    ? "glass-dark-glow"
    : strong
      ? "glass-strong"
      : "glass";

  const hoverClass = hover
    ? "transition-all duration-300 hover:-translate-y-1 hover:border-amber-500/30 hover:shadow-[0_0_20px_rgba(217,119,6,0.15)] card-shine cursor-pointer"
    : "";

  return (
    <div className={`${base} rounded-2xl ${hoverClass} ${className}`}>
      {children}
    </div>
  );
}
