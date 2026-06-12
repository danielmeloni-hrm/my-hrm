import { HTMLAttributes } from "react";
import { theme } from "@/styles/theme";

type AppCardProps = HTMLAttributes<HTMLDivElement> & {
  padded?: boolean;
};

export default function AppCard({
  padded = true,
  className = "",
  children,
  ...props
}: AppCardProps) {
  return (
    <div
      className={`${padded ? theme.card.padded : theme.card.base} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}