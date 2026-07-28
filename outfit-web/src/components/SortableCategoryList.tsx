"use client";

import { useCategoryOrder } from "@/components/CategoryOrderProvider";
import { ClothingCategory } from "@/lib/types";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ReactNode, useState } from "react";

type SortableCategoryListProps = {
  ids: ClothingCategory[];
  children: (category: ClothingCategory, dragHandleProps: DragHandleProps) => ReactNode;
};

export type DragHandleProps = {
  listeners: ReturnType<typeof useSortable>["listeners"];
  attributes: ReturnType<typeof useSortable>["attributes"];
  isDragging: boolean;
};

export function SortableCategoryList({ ids, children }: SortableCategoryListProps) {
  const { moveCategory } = useCategoryOrder();
  const [activeId, setActiveId] = useState<ClothingCategory | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 380, tolerance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 380, tolerance: 8 },
    })
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as ClothingCategory);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    moveCategory(active.id as ClothingCategory, over.id as ClothingCategory);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {ids.map((id) => (
            <SortableCategoryItem key={id} id={id}>
              {(drag) => children(id, drag)}
            </SortableCategoryItem>
          ))}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeId ? (
          <div className="rounded-2xl border border-zinc-300 bg-white/95 px-4 py-6 text-center text-sm font-medium text-zinc-700 shadow-lg">
            Reordering…
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function SortableCategoryItem({
  id,
  children,
}: {
  id: ClothingCategory;
  children: (drag: DragHandleProps) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 20 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="touch-manipulation">
      {children({ attributes, listeners, isDragging })}
    </div>
  );
}

/** Long-press affordance shown on category headers. */
export function CategoryDragHint({
  listeners,
  attributes,
  isDragging,
}: DragHandleProps) {
  return (
    <button
      type="button"
      className={`rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-wide ${
        isDragging ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500"
      }`}
      aria-label="Hold and drag to reorder"
      {...attributes}
      {...listeners}
    >
      Hold to move
    </button>
  );
}
