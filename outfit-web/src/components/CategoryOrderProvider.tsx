"use client";

import {
  CATEGORY_ORDER_STORAGE_KEY,
  DEFAULT_CATEGORY_ORDER,
  normalizeCategoryOrder,
} from "@/lib/categoryOrder";
import { ClothingCategory } from "@/lib/types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type CategoryOrderContextValue = {
  order: ClothingCategory[];
  setOrder: (next: ClothingCategory[]) => void;
  moveCategory: (activeId: ClothingCategory, overId: ClothingCategory) => void;
};

const CategoryOrderContext = createContext<CategoryOrderContextValue | null>(null);

export function CategoryOrderProvider({ children }: { children: React.ReactNode }) {
  const [order, setOrderState] = useState<ClothingCategory[]>(DEFAULT_CATEGORY_ORDER);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CATEGORY_ORDER_STORAGE_KEY);
      if (raw) {
        setOrderState(normalizeCategoryOrder(JSON.parse(raw)));
      }
    } catch {
      // ignore bad storage
    }
    setReady(true);
  }, []);

  const setOrder = useCallback((next: ClothingCategory[]) => {
    const normalized = normalizeCategoryOrder(next);
    setOrderState(normalized);
    try {
      window.localStorage.setItem(CATEGORY_ORDER_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // ignore quota errors
    }
  }, []);

  const moveCategory = useCallback(
    (activeId: ClothingCategory, overId: ClothingCategory) => {
      setOrderState((current) => {
        const oldIndex = current.indexOf(activeId);
        const newIndex = current.indexOf(overId);
        if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return current;

        const next = [...current];
        const [moved] = next.splice(oldIndex, 1);
        next.splice(newIndex, 0, moved);

        try {
          window.localStorage.setItem(CATEGORY_ORDER_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    []
  );

  const value = useMemo(
    () => ({ order, setOrder, moveCategory }),
    [order, setOrder, moveCategory]
  );

  // Avoid hydration mismatch flash; still render children with default order.
  if (!ready) {
    return (
      <CategoryOrderContext.Provider value={value}>{children}</CategoryOrderContext.Provider>
    );
  }

  return (
    <CategoryOrderContext.Provider value={value}>{children}</CategoryOrderContext.Provider>
  );
}

export function useCategoryOrder() {
  const context = useContext(CategoryOrderContext);
  if (!context) {
    throw new Error("useCategoryOrder must be used within CategoryOrderProvider");
  }
  return context;
}
