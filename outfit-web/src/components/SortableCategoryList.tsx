"use client";

import { useCategoryOrder } from "@/components/CategoryOrderProvider";
import { DragHandleHint, DragHandleProps, SortableIdList } from "@/components/SortableIdList";
import { ClothingCategory } from "@/lib/types";
import { ReactNode } from "react";

type SortableCategoryListProps = {
  ids: ClothingCategory[];
  children: (category: ClothingCategory, dragHandleProps: DragHandleProps) => ReactNode;
};

export function SortableCategoryList({ ids, children }: SortableCategoryListProps) {
  const { moveCategory } = useCategoryOrder();

  return (
    <SortableIdList
      ids={ids}
      onReorder={(activeId, overId) =>
        moveCategory(activeId as ClothingCategory, overId as ClothingCategory)
      }
    >
      {(id, drag) => children(id as ClothingCategory, drag)}
    </SortableIdList>
  );
}

export function CategoryDragHint(props: DragHandleProps) {
  return <DragHandleHint {...props} />;
}
