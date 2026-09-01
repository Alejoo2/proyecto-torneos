import { cva, type VariantProps } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-gray-900 text-white hover:bg-gray-800 active:bg-black",
        secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200 active:bg-gray-300",
        outline: "border border-gray-300 bg-transparent text-gray-900 hover:bg-gray-100 active:bg-gray-200",
        ghost: "bg-transparent text-gray-700 hover:bg-gray-100 active:bg-gray-200",
        destructive: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
      },
      size: {
        sm: "h-9 px-4 text-sm min-h-[44px]",
        md: "h-11 px-6 text-base min-h-[44px]",
        lg: "h-14 px-8 text-lg min-h-[56px]",
        icon: "h-11 w-11 min-h-[44px] min-w-[44px]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;