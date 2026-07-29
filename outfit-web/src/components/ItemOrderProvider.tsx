"use client";

import {
  ItemOrderMap,
  loadItemOrder,
  moveIdInList,
  saveItemOrder,
  sortItemsByOrder,
} from "@/lib/itemOrder";
import { ClothingCategory, ClothingItem } from "@/lib/types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type ItemOrderContextValue = {
  orderedItems: (category: ClothingCategory, items: ClothingItem[]) => ClothingItem[];
  moveItem: (
    category: ClothingCategory,
    items: ClothingItem[],
    activeId: string,
    overId: string
  ) => void;
};

const ItemOrderContext = createContext<ItemOrderContextValue | null>(null);

export function ItemOrderProvider({ children }: { children: React.ReactNode }) {
  const [orderMap, setOrderMap] = useState<ItemOrderMap>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setOrderMap(loadItemOrder());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveItemOrder(orderMap);
  }, [orderMap, ready]);

  const orderedItems = useCallback(
    (category: ClothingCategory, items: ClothingItem[]) => {
      const inCategory = items.filter((item) => item.category === category);
      return sortItemsByOrder(inCategory, orderMap[category]);
    },
    [orderMap]
  );

  const moveItem = useCallback(
    (
      category: ClothingCategory,
      items: ClothingItem[],
      activeId: string,
      overId: string
    ) => {
      const current = sortItemsByOrder(
        items.filter((item) => item.category === category),
        orderMap[category]
      ).map((item) => item.id);

      const nextIds = moveIdInList(current, activeId, overId);
      setOrderMap((prev) => ({ ...prev, [category]: nextIds }));
    },
    [orderMap]
  );

  const value = useMemo(
    () => ({ orderedItems, moveItem }),
    [orderedItems, moveItem]
  );

  return <ItemOrderContext.Provider value={value}>{children}</ItemOrderContext.Provider>;
}

export function useItemOrder() {
  const ctx = useContext(ItemOrderContext);
  if (!ctx) {
    throw new Error("useItemOrder must be used within ItemOrderProvider");
  }
  return ctx;
}
