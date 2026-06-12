import { ButtonHTMLAttributes } from "react";
import { theme } from "@/styles/theme";

type AppButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
};

export default function AppButton({
  variant = "primary",
  className = "",
  children,
  ...props
}: AppButtonProps) {
  return (
    <button
      className={`${theme.button.base} ${theme.button[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}