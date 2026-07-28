"use client";

import { CategoryOrderProvider } from "@/components/CategoryOrderProvider";

export function MainClientProviders({ children }: { children: React.ReactNode }) {
  return <CategoryOrderProvider>{children}</CategoryOrderProvider>;
}
