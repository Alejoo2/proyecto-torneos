import { cva, type VariantProps } from "class-variance-authority";

export const oauthButtonVariants = cva<{
  provider: {
    google: string;
    discord: string;
  };
  isLoading: {
    true: string;
    false: string;
  };
}>(
  "flex w-full items-center justify-center gap-3 rounded-lg px-4 py-3 font-semibold text-white shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      provider: {
        google: "bg-[#4285F4] hover:bg-[#357AE8] focus:ring-[#4285F4]",
        discord: "bg-[#5865F2] hover:bg-[#4752C4] focus:ring-[#5865F2]",
      },
      isLoading: {
        true: "cursor-wait opacity-75",
        false: "",
      },
    },
    defaultVariants: {
      provider: "google",
      isLoading: false,
    },
  }
);

export type OAuthButtonProps = VariantProps<typeof oauthButtonVariants>;