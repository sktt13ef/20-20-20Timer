import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon: ReactNode;
  active?: boolean;
  showText?: boolean;
};

export function IconButton({ label, icon, active = false, showText = false, className = "", ...props }: IconButtonProps) {
  return (
    <button
      className={`icon-button ${active ? "is-active" : ""} ${showText ? "has-text" : ""} ${className}`}
      title={label}
      aria-label={label}
      aria-pressed={active}
      {...props}
    >
      {icon}
      {showText ? <span>{label}</span> : null}
    </button>
  );
}
