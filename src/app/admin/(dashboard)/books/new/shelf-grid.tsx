"use client";

import { useState, useEffect, useTransition, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Trash2,
  GripVertical,
  Library,
  Tag,
  DoorOpen,
  Armchair,
  Monitor,
  Lamp,
  Clock,
  Star,
  Heart,
  Flower2,
  TreePine,
  Sun,
  Moon,
  Coffee,
  Baby,
  Glasses,
  Music,
  Palette,
  Pencil,
} from "lucide-react";
import {
  getShelves,
  createShelf,
  updateShelf,
  deleteShelf,
} from "@/app/actions/shelves";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";

type Shelf = {
  id: string;
  name: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  color: string;
  type: "shelf" | "label";
  book_count: number;
  font_size: number;
  font_bold: boolean;
};

const FONT_SIZES = [0, 8, 10, 12, 14, 16, 18, 20, 24];

const GRID_COLS = 20;
const GRID_ROWS = 20;
const CELL_SIZE = 60;

const COLORS = [
  "#3b82f6", "#2563eb", "#1d4ed8",
  "#ef4444", "#dc2626", "#b91c1c",
  "#22c55e", "#16a34a", "#15803d",
  "#f59e0b", "#d97706", "#b45309",
  "#8b5cf6", "#7c3aed", "#6d28d9",
  "#ec4899", "#db2777", "#be185d",
  "#06b6d4", "#0891b2", "#0e7490",
  "#f97316", "#ea580c", "#c2410c",
  "#64748b", "#475569", "#334155",
  "#78716c", "#57534e", "#44403c",
];

const LABEL_ICONS: { name: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { name: "none", icon: Tag },
  { name: "door", icon: DoorOpen },
  { name: "armchair", icon: Armchair },
  { name: "monitor", icon: Monitor },
  { name: "lamp", icon: Lamp },
  { name: "clock", icon: Clock },
  { name: "star", icon: Star },
  { name: "heart", icon: Heart },
  { name: "flower", icon: Flower2 },
  { name: "tree", icon: TreePine },
  { name: "sun", icon: Sun },
  { name: "moon", icon: Moon },
  { name: "coffee", icon: Coffee },
  { name: "baby", icon: Baby },
  { name: "glasses", icon: Glasses },
  { name: "music", icon: Music },
  { name: "palette", icon: Palette },
];

function getIconComponent(iconName: string) {
  const found = LABEL_ICONS.find((i) => i.name === iconName);
  return found ? found.icon : Tag;
}

function parseLabelName(name: string): { icon: string; text: string } {
  if (name.startsWith("icon:")) {
    const parts = name.split(":");
    return { icon: parts[1] || "none", text: parts.slice(2).join(":") || "" };
  }
  return { icon: "none", text: name };
}

function encodeLabelName(icon: string, text: string): string {
  if (icon === "none") return text;
  return `icon:${icon}:${text}`;
}

function DraggableItem({
  shelf,
  isSelected,
  onClick,
  onShiftClick,
  onResizeStart,
  isResizing,
  draggable = true,
}: {
  shelf: Shelf;
  isSelected: boolean;
  onClick: () => void;
  onShiftClick: () => void;
  onResizeStart: (e: React.PointerEvent) => void;
  isResizing: boolean;
  draggable?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: shelf.id,
    data: shelf,
    disabled: isResizing || !draggable,
  });

  const isLabel = shelf.type === "label";
  const { icon: iconName, text: displayText } = isLabel
    ? parseLabelName(shelf.name)
    : { icon: "none", text: shelf.name };
  const IconComp = getIconComponent(iconName);

  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  function handlePointerDown(e: React.PointerEvent) {
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    if (!e.shiftKey && draggable) {
      listeners?.onPointerDown?.(e);
    }
  }

  function handleClick(e: React.MouseEvent) {
    if (dragStartPos.current) {
      const dx = Math.abs(e.clientX - dragStartPos.current.x);
      const dy = Math.abs(e.clientY - dragStartPos.current.y);
      if (dx > 5 || dy > 5) return;
    }
    if (e.shiftKey) {
      e.stopPropagation();
      onShiftClick();
    } else {
      onClick();
    }
  }

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      className={`absolute rounded-md border-2 flex flex-col items-center justify-center gap-0.5 select-none transition-shadow hover:shadow-lg ${
        draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      } ${isDragging ? "opacity-30" : ""} ${isSelected ? "ring-2 ring-primary ring-offset-2" : ""} ${
        isLabel ? "border-dashed" : ""
      }`}
      style={{
        left: shelf.position_x * CELL_SIZE,
        top: shelf.position_y * CELL_SIZE,
        width: shelf.width * CELL_SIZE - 4,
        height: shelf.height * CELL_SIZE - 4,
        backgroundColor: isLabel ? shelf.color + "10" : shelf.color + "20",
        borderColor: shelf.color,
        margin: 2,
      }}
    >
      {draggable && <GripVertical className="size-3 text-muted-foreground absolute top-0.5 right-0.5 opacity-40" />}
      {isLabel && iconName !== "none" && (
        <IconComp className="size-4" style={{ color: shelf.color }} />
      )}
      <span
        className={`truncate max-w-full px-1 ${shelf.font_size > 0 ? "" : isLabel ? "text-[10px]" : "text-xs"} ${shelf.font_bold ? "font-bold" : isLabel ? "" : "font-semibold"}`}
        style={{
          color: shelf.color,
          ...(shelf.font_size > 0 ? { fontSize: shelf.font_size } : {}),
        }}
      >
        {displayText}
      </span>
      {!isLabel && (
        <span className="text-[10px] text-muted-foreground">
          {shelf.book_count}권
        </span>
      )}
      {isLabel && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onResizeStart(e);
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <svg
            className="w-3 h-3 absolute bottom-0.5 right-0.5 opacity-50"
            viewBox="0 0 12 12"
            style={{ color: shelf.color }}
          >
            <path
              d="M10 2L2 10M10 6L6 10M10 10L10 10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      )}
    </div>
  );
}

function ItemOverlay({ shelf }: { shelf: Shelf }) {
  const isLabel = shelf.type === "label";
  const { icon: iconName, text: displayText } = isLabel
    ? parseLabelName(shelf.name)
    : { icon: "none", text: shelf.name };
  const IconComp = getIconComponent(iconName);

  return (
    <div
      className={`rounded-md border-2 flex flex-col items-center justify-center gap-0.5 select-none shadow-xl ${
        isLabel ? "border-dashed" : ""
      }`}
      style={{
        width: shelf.width * CELL_SIZE - 4,
        height: shelf.height * CELL_SIZE - 4,
        backgroundColor: isLabel ? shelf.color + "30" : shelf.color + "40",
        borderColor: shelf.color,
      }}
    >
      {isLabel && iconName !== "none" && (
        <IconComp className="size-4" style={{ color: shelf.color }} />
      )}
      <span
        className={`truncate max-w-full px-1 ${shelf.font_size > 0 ? "" : isLabel ? "text-[10px]" : "text-xs"} ${shelf.font_bold ? "font-bold" : isLabel ? "" : "font-semibold"}`}
        style={{
          color: shelf.color,
          ...(shelf.font_size > 0 ? { fontSize: shelf.font_size } : {}),
        }}
      >
        {displayText}
      </span>
      {!isLabel && (
        <span className="text-[10px] text-muted-foreground">
          {shelf.book_count}권
        </span>
      )}
    </div>
  );
}

const COL_LABELS = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T"];

export function ShelfGrid() {
  const router = useRouter();
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [isLoading, startTransition] = useTransition();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createType, setCreateType] = useState<"shelf" | "label">("shelf");
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [newIcon, setNewIcon] = useState("none");
  const [newFontSize, setNewFontSize] = useState(0);
  const [newFontBold, setNewFontBold] = useState(false);
  const [createError, setCreateError] = useState("");
  const [isCreating, startCreate] = useTransition();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  const [activeShelf, setActiveShelf] = useState<Shelf | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editShelf, setEditShelf] = useState<Shelf | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(COLORS[0]);
  const [editIcon, setEditIcon] = useState("none");
  const [editFontSize, setEditFontSize] = useState(0);
  const [editFontBold, setEditFontBold] = useState(false);
  const [isSavingEdit, startSaveEdit] = useTransition();

  const [resizingId, setResizingId] = useState<string | null>(null);
  const resizeStart = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 5 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 5 },
  });
  const sensors = useSensors(pointerSensor, touchSensor);

  const loadShelves = useCallback(() => {
    startTransition(async () => {
      const data = await getShelves();
      setShelves(data as unknown as Shelf[]);
    });
  }, []);

  useEffect(() => {
    loadShelves();
  }, [loadShelves]);

  // --- Resize ---
  function handleResizeStart(shelfId: string, e: React.PointerEvent) {
    const shelf = shelves.find((s) => s.id === shelfId);
    if (!shelf) return;
    setResizingId(shelfId);
    resizeStart.current = { x: e.clientX, y: e.clientY, w: shelf.width, h: shelf.height };
  }

  useEffect(() => {
    if (!resizingId) return;

    function handlePointerMove(e: PointerEvent) {
      if (!resizeStart.current || !resizingId) return;
      const dx = Math.round((e.clientX - resizeStart.current.x) / CELL_SIZE);
      const dy = Math.round((e.clientY - resizeStart.current.y) / CELL_SIZE);
      const newW = Math.max(1, resizeStart.current.w + dx);
      const newH = Math.max(1, resizeStart.current.h + dy);

      setShelves((prev) =>
        prev.map((s) => {
          if (s.id !== resizingId) return s;
          const clampedW = Math.min(newW, GRID_COLS - s.position_x);
          const clampedH = Math.min(newH, GRID_ROWS - s.position_y);
          return { ...s, width: clampedW, height: clampedH };
        })
      );
    }

    function handlePointerUp() {
      const shelf = shelves.find((s) => s.id === resizingId);
      if (shelf) {
        const formData = new FormData();
        formData.set("id", shelf.id);
        formData.set("name", shelf.name);
        formData.set("position_x", String(shelf.position_x));
        formData.set("position_y", String(shelf.position_y));
        formData.set("width", String(shelf.width));
        formData.set("height", String(shelf.height));
        formData.set("color", shelf.color);
        formData.set("type", shelf.type);
        formData.set("font_size", String(shelf.font_size || 0));
        formData.set("font_bold", String(shelf.font_bold || false));
        updateShelf(formData);
      }
      setResizingId(null);
      resizeStart.current = null;
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [resizingId, shelves]);

  // --- Multi-select ---
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function handleGridClick(e: React.MouseEvent) {
    if (e.target === gridContainerRef.current) {
      clearSelection();
    }
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Delete" && selectedIds.size > 0 && !createDialogOpen && !deleteConfirmOpen && !editDialogOpen) {
        e.preventDefault();
        setDeleteConfirmOpen(true);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIds.size, createDialogOpen, deleteConfirmOpen, editDialogOpen]);

  function handleBatchDelete() {
    const ids = Array.from(selectedIds);
    setDeleteConfirmOpen(false);
    startTransition(async () => {
      for (const id of ids) {
        await deleteShelf(id);
      }
      clearSelection();
      loadShelves();
    });
  }

  // --- Create ---
  function openCreateDialog(type: "shelf" | "label") {
    setCreateType(type);
    setNewName("");
    setNewColor(COLORS[0]);
    setNewIcon("none");
    setNewFontSize(0);
    setNewFontBold(false);
    setCreateError("");
    setCreateDialogOpen(true);
  }

  function handleCreate() {
    if (!newName.trim()) {
      setCreateError(createType === "shelf" ? "서재 이름을 입력해주세요." : "라벨 텍스트를 입력해주세요.");
      return;
    }
    setCreateError("");
    startCreate(async () => {
      const formData = new FormData();
      const finalName = createType === "label" ? encodeLabelName(newIcon, newName.trim()) : newName.trim();
      formData.set("name", finalName);
      formData.set("color", newColor);
      formData.set("type", createType);

      const occupied = new Set(shelves.map((s) => `${s.position_x},${s.position_y}`));
      let px = 0, py = 0, found = false;
      for (let y = 0; y < GRID_ROWS && !found; y++) {
        for (let x = 0; x < GRID_COLS && !found; x++) {
          if (!occupied.has(`${x},${y}`)) {
            px = x; py = y; found = true;
          }
        }
      }
      formData.set("position_x", String(px));
      formData.set("position_y", String(py));
      formData.set("width", createType === "label" ? "1" : "2");
      formData.set("height", "1");
      formData.set("font_size", String(newFontSize));
      formData.set("font_bold", String(newFontBold));

      const result = await createShelf(formData);
      if (result.success) {
        setCreateDialogOpen(false);
        loadShelves();
      } else {
        setCreateError(result.error || "생성에 실패했습니다.");
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteShelf(id);
      if (result.success) {
        setEditDialogOpen(false);
        setEditShelf(null);
        loadShelves();
      }
    });
  }

  // --- Edit dialog ---
  function openEditDialog(shelf: Shelf) {
    clearSelection();
    const isLabel = shelf.type === "label";
    const { icon, text } = isLabel ? parseLabelName(shelf.name) : { icon: "none", text: shelf.name };
    setEditShelf(shelf);
    setEditName(text);
    setEditColor(shelf.color);
    setEditIcon(icon);
    setEditFontSize(shelf.font_size || 0);
    setEditFontBold(shelf.font_bold || false);
    setEditDialogOpen(true);
  }

  function handleEditSave() {
    if (!editShelf || !editName.trim()) return;
    startSaveEdit(async () => {
      const isLabel = editShelf.type === "label";
      const finalName = isLabel ? encodeLabelName(editIcon, editName.trim()) : editName.trim();
      const formData = new FormData();
      formData.set("id", editShelf.id);
      formData.set("name", finalName);
      formData.set("position_x", String(editShelf.position_x));
      formData.set("position_y", String(editShelf.position_y));
      formData.set("width", String(editShelf.width));
      formData.set("height", String(editShelf.height));
      formData.set("color", editColor);
      formData.set("type", editShelf.type);
      formData.set("font_size", String(editFontSize));
      formData.set("font_bold", String(editFontBold));
      const result = await updateShelf(formData);
      if (result.success) {
        setEditDialogOpen(false);
        setEditShelf(null);
        loadShelves();
      }
    });
  }

  // --- Drag ---
  function handleDragStart(event: DragStartEvent) {
    const shelf = shelves.find((s) => s.id === event.active.id);
    if (shelf) {
      setActiveShelf(shelf);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, delta } = event;
    setActiveShelf(null);
    if (!delta) return;

    const draggedShelf = shelves.find((s) => s.id === active.id);
    if (!draggedShelf) return;

    const dx = Math.round(delta.x / CELL_SIZE);
    const dy = Math.round(delta.y / CELL_SIZE);
    if (dx === 0 && dy === 0) return;

    const idsToMove = selectedIds.has(draggedShelf.id)
      ? selectedIds
      : new Set([draggedShelf.id]);

    const updates: { id: string; newX: number; newY: number }[] = [];
    for (const id of idsToMove) {
      const s = shelves.find((sh) => sh.id === id);
      if (!s) continue;
      const newX = Math.max(0, Math.min(GRID_COLS - s.width, s.position_x + dx));
      const newY = Math.max(0, Math.min(GRID_ROWS - s.height, s.position_y + dy));
      updates.push({ id, newX, newY });
    }

    setShelves((prev) =>
      prev.map((s) => {
        const upd = updates.find((u) => u.id === s.id);
        return upd ? { ...s, position_x: upd.newX, position_y: upd.newY } : s;
      })
    );

    for (const upd of updates) {
      const s = shelves.find((sh) => sh.id === upd.id);
      if (!s) continue;
      const formData = new FormData();
      formData.set("id", s.id);
      formData.set("name", s.name);
      formData.set("position_x", String(upd.newX));
      formData.set("position_y", String(upd.newY));
      formData.set("width", String(s.width));
      formData.set("height", String(s.height));
      formData.set("color", s.color);
      formData.set("type", s.type);
      formData.set("font_size", String(s.font_size || 0));
      formData.set("font_bold", String(s.font_bold || false));
      updateShelf(formData);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">서재 관리</h1>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {selectedIds.size}개 선택
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 text-destructive hover:text-destructive"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className="size-3 mr-1" />
                삭제
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={clearSelection}
              >
                선택 해제
              </Button>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant={editMode ? "default" : "outline"}
            onClick={() => { setEditMode(!editMode); clearSelection(); }}
          >
            <Pencil className="size-4 mr-2" />
            {editMode ? "편집 완료" : "편집"}
          </Button>
          <Button variant="outline" onClick={() => openCreateDialog("label")}>
            <Tag className="size-4 mr-2" />
            라벨 추가
          </Button>
          <Button variant="outline" onClick={() => openCreateDialog("shelf")}>
            <Plus className="size-4 mr-2" />
            서재 추가
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          <Card>
            <CardContent className="p-4 overflow-auto">
              <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <div className="flex" style={{ paddingLeft: 28 }}>
                  {COL_LABELS.map((label) => (
                    <div
                      key={label}
                      className="text-xs font-medium text-muted-foreground text-center"
                      style={{ width: CELL_SIZE }}
                    >
                      {label}
                    </div>
                  ))}
                </div>

                <div className="flex">
                  <div className="flex flex-col" style={{ width: 28 }}>
                    {Array.from({ length: GRID_ROWS }, (_, i) => (
                      <div
                        key={i}
                        className="text-xs font-medium text-muted-foreground flex items-center justify-center"
                        style={{ height: CELL_SIZE }}
                      >
                        {i + 1}
                      </div>
                    ))}
                  </div>

                  <div
                    ref={gridContainerRef}
                    className="relative border border-border rounded"
                    style={{
                      width: GRID_COLS * CELL_SIZE,
                      height: GRID_ROWS * CELL_SIZE,
                    }}
                    onClick={handleGridClick}
                  >
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        backgroundImage:
                          `linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px),
                           linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)`,
                        backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px`,
                      }}
                    />
                    <div className="absolute inset-0 pointer-events-none">
                      {Array.from({ length: GRID_ROWS }, (_, row) =>
                        Array.from({ length: GRID_COLS }, (_, col) => (
                          <div
                            key={`${row}-${col}`}
                            className={(row + col) % 2 === 0 ? "bg-muted/30" : ""}
                            style={{
                              position: "absolute",
                              left: col * CELL_SIZE,
                              top: row * CELL_SIZE,
                              width: CELL_SIZE,
                              height: CELL_SIZE,
                            }}
                          />
                        ))
                      )}
                    </div>

                    {shelves.map((shelf) => (
                      <DraggableItem
                        key={shelf.id}
                        shelf={shelf}
                        isSelected={selectedIds.has(shelf.id)}
                        onShiftClick={() => editMode && toggleSelect(shelf.id)}
                        onClick={() => {
                          if (editMode) {
                            openEditDialog(shelf);
                          } else if (shelf.type === "shelf") {
                            router.push(`/admin/books/shelf/${encodeURIComponent(shelf.name)}`);
                          }
                        }}
                        onResizeStart={(e) => editMode && handleResizeStart(shelf.id, e)}
                        isResizing={editMode && resizingId === shelf.id}
                        draggable={editMode}
                      />
                    ))}

                    {shelves.length === 0 && !isLoading && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center text-muted-foreground space-y-2">
                          <Library className="size-12 mx-auto opacity-30" />
                          <p className="text-sm">서재가 없습니다</p>
                          <p className="text-xs">&quot;서재 추가&quot; 버튼으로 서재를 만들어주세요</p>
                        </div>
                      </div>
                    )}

                    {isLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                        <Loader2 className="size-6 animate-spin" />
                      </div>
                    )}
                  </div>
                </div>

                <DragOverlay>
                  {activeShelf ? (
                    <div className="relative">
                      <ItemOverlay shelf={activeShelf} />
                      {selectedIds.has(activeShelf.id) && selectedIds.size > 1 && (
                        <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                          {selectedIds.size}
                        </div>
                      )}
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </CardContent>
          </Card>
        </div>

      </div>

      {/* Create dialog */}
      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) {
            setNewName("");
            setNewColor(COLORS[0]);
            setNewIcon("none");
            setNewFontSize(0);
            setNewFontBold(false);
            setCreateError("");
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {createType === "shelf" ? "서재 추가" : "라벨 추가"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {createError && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                <AlertCircle className="size-4 shrink-0" />
                {createError}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {createType === "shelf" ? "서재 이름" : "라벨 텍스트"}
              </label>
              <Input
                placeholder={createType === "shelf" ? "예: 어린이 코너" : "예: 출입구"}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
            </div>

            {createType === "label" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">아이콘</label>
                <div className="flex gap-1.5 flex-wrap">
                  {LABEL_ICONS.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.name}
                        type="button"
                        className={`w-8 h-8 rounded-md border flex items-center justify-center transition-all ${
                          newIcon === item.name
                            ? "border-foreground bg-accent scale-110"
                            : "border-border hover:bg-accent/50"
                        }`}
                        onClick={() => setNewIcon(item.name)}
                      >
                        <Icon className="size-4" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">폰트</label>
              <div className="flex items-center gap-2">
                <div className="flex gap-1 flex-wrap flex-1">
                  {FONT_SIZES.map((size) => (
                    <button
                      key={size}
                      type="button"
                      className={`h-7 min-w-[2rem] px-1.5 rounded text-xs border transition-all ${
                        newFontSize === size
                          ? "border-foreground bg-accent font-bold"
                          : "border-border hover:bg-accent/50"
                      }`}
                      onClick={() => setNewFontSize(size)}
                    >
                      {size === 0 ? "자동" : size}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className={`h-7 w-8 rounded border text-sm font-bold transition-all ${
                    newFontBold
                      ? "border-foreground bg-accent"
                      : "border-border hover:bg-accent/50"
                  }`}
                  onClick={() => setNewFontBold(!newFontBold)}
                >
                  B
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">색상</label>
              <div className="flex gap-1.5 flex-wrap">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-7 h-7 rounded-md border-2 transition-all ${
                      newColor === color
                        ? "border-foreground scale-110"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewColor(color)}
                  />
                ))}
              </div>
            </div>
            <Button
              className="w-full"
              onClick={handleCreate}
              disabled={isCreating || !newName.trim()}
            >
              {isCreating ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : createType === "shelf" ? (
                <Plus className="size-4 mr-2" />
              ) : (
                <Tag className="size-4 mr-2" />
              )}
              {createType === "shelf" ? "서재 추가" : "라벨 추가"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setEditShelf(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editShelf?.type === "label" ? "라벨 편집" : "서재 편집"}
            </DialogTitle>
          </DialogHeader>
          {editShelf && (
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {editShelf.type === "label" ? "라벨 텍스트" : "서재 이름"}
                </label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleEditSave()}
                  autoFocus
                />
              </div>

              {editShelf.type === "label" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">아이콘</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {LABEL_ICONS.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.name}
                          type="button"
                          className={`w-8 h-8 rounded-md border flex items-center justify-center transition-all ${
                            editIcon === item.name
                              ? "border-foreground bg-accent scale-110"
                              : "border-border hover:bg-accent/50"
                          }`}
                          onClick={() => setEditIcon(item.name)}
                        >
                          <Icon className="size-4" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">폰트</label>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1 flex-wrap flex-1">
                    {FONT_SIZES.map((size) => (
                      <button
                        key={size}
                        type="button"
                        className={`h-7 min-w-[2rem] px-1.5 rounded text-xs border transition-all ${
                          editFontSize === size
                            ? "border-foreground bg-accent font-bold"
                            : "border-border hover:bg-accent/50"
                        }`}
                        onClick={() => setEditFontSize(size)}
                      >
                        {size === 0 ? "자동" : size}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className={`h-7 w-8 rounded border text-sm font-bold transition-all ${
                      editFontBold
                        ? "border-foreground bg-accent"
                        : "border-border hover:bg-accent/50"
                    }`}
                    onClick={() => setEditFontBold(!editFontBold)}
                  >
                    B
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">색상</label>
                <div className="flex gap-1.5 flex-wrap">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`w-7 h-7 rounded-md border-2 transition-all ${
                        editColor === color
                          ? "border-foreground scale-110"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setEditColor(color)}
                    />
                  ))}
                </div>
              </div>

              {editShelf.type === "shelf" && (
                <Button
                  size="lg"
                  className="w-full h-12 text-base"
                  onClick={() => {
                    setEditDialogOpen(false);
                    setEditShelf(null);
                    router.push(`/admin/books/shelf/${encodeURIComponent(editShelf.name)}`);
                  }}
                >
                  <Library className="size-5 mr-2" />
                  도서 관리
                </Button>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleEditSave}
                  disabled={isSavingEdit || !editName.trim()}
                >
                  {isSavingEdit ? (
                    <Loader2 className="size-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-4 mr-2" />
                  )}
                  저장
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => handleDelete(editShelf.id)}
                  disabled={isLoading}
                >
                  <Trash2 className="size-4 mr-2" />
                  삭제
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Batch delete confirmation dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>선택 항목 삭제</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              선택한 {selectedIds.size}개 항목을 삭제하시겠습니까?
              <br />
              이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirmOpen(false)}
              >
                취소
              </Button>
              <Button
                variant="destructive"
                onClick={handleBatchDelete}
              >
                <Trash2 className="size-4 mr-2" />
                {selectedIds.size}개 삭제
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
