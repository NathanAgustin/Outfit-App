"use client";

import { CategoryOrderProvider } from "@/components/CategoryOrderProvider";
import { ItemOrderProvider } from "@/components/ItemOrderProvider";

export function MainClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <CategoryOrderProvider>
      <ItemOrderProvider>{children}</ItemOrderProvider>
    </CategoryOrderProvider>
  );
}
