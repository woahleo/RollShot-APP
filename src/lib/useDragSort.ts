"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";

type Drag = {
  key: string;
  startX: number;
  startY: number;
  touch: boolean;
  active: boolean;
  timer?: ReturnType<typeof setTimeout>;
};

/**
 * Drag to reorder a list of tiles, with a mouse or a finger. On a phone, press and hold a tile for a
 * moment, then drag it; a quick swipe still scrolls the page. The order changes live under the finger
 * and is handed to onChange when the tile is let go. With a keyboard, focus a tile and use the arrow keys.
 *
 * Spread itemProps(key) on each tile. Buttons and inputs inside a tile keep working as usual, and a link
 * inside a tile can be dragged by too: it only opens on a tap or click that didn't drag.
 */
export function useDragSort(keys: string[], onChange: (next: string[]) => void) {
  const group = useId();
  const [live, setLive] = useState<string[] | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const drag = useRef<Drag | null>(null);
  const liveRef = useRef<string[] | null>(null);
  const justDragged = useRef(false);
  // The tile last swapped with. Until React redraws, the pointer can still be over it, and swapping
  // again would undo the move.
  const lastTarget = useRef<string | null>(null);
  const keysRef = useRef(keys);
  const changeRef = useRef(onChange);
  useEffect(() => {
    keysRef.current = keys;
    changeRef.current = onChange;
  });

  const order = live ?? keys;

  const moveTo = useCallback((x: number, y: number) => {
    const d = drag.current;
    if (!d?.active) return;
    const over = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-sort-key]");
    const target = over?.dataset.sortGroup === group ? over.dataset.sortKey! : null;
    if (!target || target === d.key) { lastTarget.current = null; return; }
    if (target === lastTarget.current) return;
    const list = liveRef.current ?? keysRef.current;
    const from = list.indexOf(d.key);
    const to = list.indexOf(target);
    if (from < 0 || to < 0) return;
    const next = [...list];
    next.splice(from, 1);
    next.splice(to, 0, d.key);
    liveRef.current = next;
    lastTarget.current = target;
    setLive(next);
  }, [group]);

  const start = useCallback(() => {
    const d = drag.current;
    if (!d) return;
    d.active = true;
    setDragging(d.key);
    if (d.touch) navigator.vibrate?.(10);
  }, []);

  const finish = useCallback(() => {
    const d = drag.current;
    if (!d) return;
    clearTimeout(d.timer);
    drag.current = null;
    lastTarget.current = null;
    const next = liveRef.current;
    liveRef.current = null;
    setDragging(null);
    setLive(null);
    if (d.active) {
      // The click that ends a drag shouldn't also open a link inside the tile.
      justDragged.current = true;
      setTimeout(() => { justDragged.current = false; }, 0);
    }
    if (d.active && next && next.join("\n") !== keysRef.current.join("\n")) changeRef.current(next);
  }, []);

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const far = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
      if (!d.active) {
        if (d.touch) {
          // Moving before the hold finishes means they're scrolling, not dragging.
          if (far > 8) { clearTimeout(d.timer); drag.current = null; }
          return;
        }
        if (far > 4) start();
        else return;
      }
      if (d.touch) return; // a finger drag follows touchmove below
      moveTo(e.clientX, e.clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      const d = drag.current;
      if (!d?.active) return;
      e.preventDefault(); // hold the page still while a tile is being dragged
      const t = e.touches[0];
      if (t) moveTo(t.clientX, t.clientY);
    };
    const onPointerUp = finish;
    const onPointerCancel = () => {
      // A finger drag can cancel pointer events while touch events carry on; touchend finishes it.
      if (drag.current && !(drag.current.touch && drag.current.active)) finish();
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", finish);
    window.addEventListener("touchcancel", finish);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", finish);
      window.removeEventListener("touchcancel", finish);
    };
  }, [moveTo, start, finish]);

  const itemProps = (key: string) => ({
    "data-sort-key": key,
    "data-sort-group": group,
    "data-dragging": dragging === key ? "" : undefined,
    tabIndex: 0,
    "aria-roledescription": "sortable item",
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0 || (e.target as HTMLElement).closest("button, input, select, textarea, label")) return;
      const touch = e.pointerType !== "mouse";
      if (!touch) e.preventDefault(); // no text selection or image ghost while dragging with a mouse
      drag.current = { key, startX: e.clientX, startY: e.clientY, touch, active: false };
      if (touch) drag.current.timer = setTimeout(start, 220);
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.target !== e.currentTarget) return;
      const step = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : 0;
      if (!step) return;
      e.preventDefault();
      const list = keysRef.current;
      const i = list.indexOf(key);
      const j = i + step;
      if (i < 0 || j < 0 || j >= list.length) return;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      changeRef.current(next);
      const el = e.currentTarget;
      requestAnimationFrame(() => el.focus());
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (justDragged.current) { e.preventDefault(); e.stopPropagation(); }
    },
    onDragStart: (e: React.DragEvent) => e.preventDefault(), // no browser drag of a link or image
    onContextMenu: (e: React.MouseEvent) => {
      if (drag.current) e.preventDefault(); // a long press drags instead of opening the image menu
    },
  });

  return { order, itemProps, dragging };
}
