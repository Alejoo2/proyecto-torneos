import { cn } from "torneos/lib/utils";
import { type ButtonHTMLAttributes } from "react";
import { buttonVariants, type ButtonVariantProps } from "./button.variants";

// Usamos el patrón de interfaz local para satisfacer a ESLint estricto
interface ButtonComponentProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonVariantProps {
  isLoading?: boolean;
}

export function Button({ 
  className, 
  variant, 
  size, 
  isLoading = false, 
  disabled, 
  children, 
  ...props 
}: ButtonComponentProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      // Usamos ?? para satisfacer a ESLint, igual que en tu OAuthButton
      disabled={disabled ?? isLoading}
      {...props}
    >
      {isLoading ? (
        // Un mini-spinner SVG inline (no es CSS inline, es SVG válido)
        <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
      ) : (
        children
      )}
    </button>
  );
}