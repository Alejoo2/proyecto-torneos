import { cva, type VariantProps } from "class-variance-authority";

// W6 re-skin Cypher: botón neutro de superficie elevada (matriz 4.3).
// La identidad de marca la porta el icono (detalle gráfico, 4.2), no el fondo:
// los colores planos de proveedor no están en la matriz legal.
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
  "flex w-full items-center justify-center gap-3 rounded-xl px-4 min-h-[44px] font-semibold text-cypher-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cypher-2/60 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      provider: {
        google: "bg-cypher-5-1-1 hover:bg-cypher-4/10 active:bg-cypher-4/15",
        discord: "bg-cypher-5-1-1 hover:bg-cypher-4/10 active:bg-cypher-4/15",
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