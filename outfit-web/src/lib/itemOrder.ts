import { ClothingCategory, ClothingItem } from "@/lib/types";

export const ITEM_ORDER_STORAGE_KEY = "wardrobe_item_order_v1";

export type ItemOrderMap = Partial<Record<ClothingCategory, string[]>>;

export function loadItemOrder(): ItemOrderMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(ITEM_ORDER_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as ItemOrderMap;
  } catch {
    return {};
  }
}

export function saveItemOrder(order: ItemOrderMap) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ITEM_ORDER_STORAGE_KEY, JSON.stringify(order));
}

/** Apply saved ID order; unknown (new) items appear first by newest created_at. */
export function sortItemsByOrder(
  items: ClothingItem[],
  orderedIds: string[] | undefined
): ClothingItem[] {
  if (items.length <= 1) return items;

  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered: ClothingItem[] = [];
  const seen = new Set<string>();

  for (const id of orderedIds ?? []) {
    const item = byId.get(id);
    if (item) {
      ordered.push(item);
      seen.add(id);
    }
  }

  const newcomers = items
    .filter((item) => !seen.has(item.id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return [...newcomers, ...ordered];
}

export function moveIdInList(ids: string[], activeId: string, overId: string): string[] {
  const oldIndex = ids.indexOf(activeId);
  const newIndex = ids.indexOf(overId);
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return ids;
  const next = [...ids];
  const [removed] = next.splice(oldIndex, 1);
  next.splice(newIndex, 0, removed);
  return next;
}
