'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const DRAG_THRESHOLD = 6;
const CLICK_SUPPRESS_MS = 100;

export default function CategoryChipScroller({
  items = [],
  activeKey,
  onSelect,
  ariaLabel = 'Category list',
  isRtl = false,
  scrollLeftLabel = 'Scroll categories left',
  scrollRightLabel = 'Scroll categories right',
}) {
  const scrollRef = useRef(null);
  const chipRefs = useRef(new Map());
  const suppressClickRef = useRef(false);
  const dragStateRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    startScrollLeft: 0,
  });
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const updateScrollState = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    setCanScrollLeft(container.scrollLeft > 1);
    setCanScrollRight(container.scrollLeft < container.scrollWidth - container.clientWidth - 1);
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return undefined;

    updateScrollState();

    const onScroll = () => updateScrollState();
    const onWheel = (event) => {
      if (container.scrollWidth <= container.clientWidth) return;
      const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      if (!delta) return;
      event.preventDefault();
      container.scrollLeft += delta;
      updateScrollState();
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    container.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('resize', updateScrollState);

    return () => {
      container.removeEventListener('scroll', onScroll);
      container.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [items, updateScrollState]);

  useEffect(() => {
    const onMouseMove = (event) => {
      const container = scrollRef.current;
      if (!container || !dragStateRef.current.active) return;

      const walk = event.pageX - dragStateRef.current.startX;
      if (!dragStateRef.current.moved && Math.abs(walk) > DRAG_THRESHOLD) {
        dragStateRef.current.moved = true;
        setIsDragging(true);
      }

      if (!dragStateRef.current.moved) return;

      event.preventDefault();
      container.scrollLeft = dragStateRef.current.startScrollLeft - walk;
      updateScrollState();
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      if (dragStateRef.current.moved) {
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, CLICK_SUPPRESS_MS);
      }

      dragStateRef.current.active = false;
      dragStateRef.current.moved = false;
      setIsDragging(false);
    };

    const onMouseDown = (event) => {
      if (event.button !== 0) return;

      const container = scrollRef.current;
      if (!container) return;

      dragStateRef.current.active = true;
      dragStateRef.current.moved = false;
      dragStateRef.current.startX = event.pageX;
      dragStateRef.current.startScrollLeft = container.scrollLeft;

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    const container = scrollRef.current;
    if (!container) return undefined;

    container.addEventListener('mousedown', onMouseDown);

    return () => {
      container.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [items, updateScrollState]);

  const scrollByViewport = useCallback((direction) => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollBy({
      left: direction * Math.max(180, container.clientWidth * 0.8),
      behavior: 'smooth',
    });
  }, []);

  const handleChipClick = useCallback((key) => {
    if (suppressClickRef.current) return;
    onSelect?.(key);
  }, [onSelect]);

  useEffect(() => {
    const container = scrollRef.current;
    const activeChip = activeKey ? chipRefs.current.get(activeKey) : null;
    if (!container || !activeChip) return;

    const frame = window.requestAnimationFrame(() => {
      activeChip.scrollIntoView({
        behavior: items.length > 8 ? 'auto' : 'smooth',
        inline: isRtl ? 'start' : 'start',
        block: 'nearest',
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeKey, isRtl, items]);

  if (!items.length) return null;

  return (
    <div className="relative flex items-center gap-2">
      {canScrollLeft ? (
        <button
          type="button"
          onClick={() => scrollByViewport(-1)}
          className="flex shrink-0 rounded-full border border-gray-200 bg-white p-1.5 shadow-md transition hover:bg-gray-50"
          aria-label={scrollLeftLabel}
        >
          <ChevronLeft size={18} className="text-gray-800" />
        </button>
      ) : null}

      <div
        ref={scrollRef}
        dir={isRtl ? 'rtl' : 'ltr'}
        role="tablist"
        aria-label={ariaLabel}
        className={`min-w-0 flex-1 flex items-center gap-2.5 overflow-x-auto overscroll-x-contain py-1 scrollbar-hide ${
          isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'
        }`}
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'manipulation' }}
      >
        {items.map((item) => {
          const isActive = item.key === activeKey;

          return (
            <button
              key={item.key}
              ref={(node) => {
                if (node) chipRefs.current.set(item.key, node);
                else chipRefs.current.delete(item.key);
              }}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => handleChipClick(item.key)}
              className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2.5 text-sm font-semibold leading-none transition-all duration-200 ${
                isActive
                  ? 'border-gray-200 bg-gray-50 text-slate-900 shadow-sm ring-1 ring-gray-100'
                  : 'border-gray-200 bg-white text-slate-700 shadow-sm hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {canScrollRight ? (
        <button
          type="button"
          onClick={() => scrollByViewport(1)}
          className="flex shrink-0 rounded-full border border-gray-200 bg-white p-1.5 shadow-md transition hover:bg-gray-50"
          aria-label={scrollRightLabel}
        >
          <ChevronRight size={18} className="text-gray-800" />
        </button>
      ) : null}
    </div>
  );
}
