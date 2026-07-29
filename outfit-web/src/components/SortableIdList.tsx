"use client";

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

export type DragHandleProps = {
  listeners: ReturnType<typeof useSortable>["listeners"];
  attributes: ReturnType<typeof useSortable>["attributes"];
  isDragging: boolean;
};

type SortableIdListProps = {
  ids: string[];
  onReorder: (activeId: string, overId: string) => void;
  children: (id: string, drag: DragHandleProps) => ReactNode;
};

export function SortableIdList({ ids, onReorder, children }: SortableIdListProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 380, tolerance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 380, tolerance: 8 },
    })
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    onReorder(String(active.id), String(over.id));
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
        <div className="space-y-2">
          {ids.map((id) => (
            <SortableRow key={id} id={id}>
              {(drag) => children(id, drag)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeId ? (
          <div className="rounded-xl border border-zinc-300 bg-white/95 px-4 py-4 text-center text-sm font-medium text-zinc-700 shadow-lg">
            Reordering…
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function SortableRow({
  id,
  children,
}: {
  id: string;
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

/** Compact long-press grip. */
export function DragHandleHint({
  listeners,
  attributes,
  isDragging,
}: DragHandleProps) {
  return (
    <button
      type="button"
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-zinc-400 ${
        isDragging ? "text-zinc-900" : "hover:text-zinc-600"
      }`}
      aria-label="Hold and drag to reorder"
      {...attributes}
      {...listeners}
    >
      <svg viewBox="0 0 10 16" width="8" height="12" fill="currentColor" aria-hidden>
        <circle cx="2.5" cy="2.5" r="1.25" />
        <circle cx="7.5" cy="2.5" r="1.25" />
        <circle cx="2.5" cy="8" r="1.25" />
        <circle cx="7.5" cy="8" r="1.25" />
        <circle cx="2.5" cy="13.5" r="1.25" />
        <circle cx="7.5" cy="13.5" r="1.25" />
      </svg>
    </button>
  );
}
