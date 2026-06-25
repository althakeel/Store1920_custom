'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

const fieldClassName =
  'w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-left text-slate-900 outline-none transition focus:border-[#f59e0b] focus:bg-white focus:ring-4 focus:ring-[#fde7c2]';

function normalizeSearchText(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function matchesSearchOption(option, needle) {
  const normalizedOption = normalizeSearchText(option);
  const normalizedNeedle = normalizeSearchText(needle);
  if (!normalizedNeedle) return true;
  if (normalizedOption.includes(normalizedNeedle)) return true;

  const tokens = normalizedNeedle.split(' ').filter(Boolean);
  return tokens.every((token) => normalizedOption.includes(token));
}

export default function SearchableSelect({
  id,
  value = '',
  onChange,
  options = [],
  placeholder = 'Select option',
  searchPlaceholder = 'Search...',
  required = false,
  disabled = false,
  hasError = false,
  className = '',
  triggerClassName = '',
  emptyMessage = 'No matches found',
  allowCustomValue = false,
  formatCustomOption,
  listHint,
}) {
  const listId = useId();
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filteredOptions = useMemo(() => {
    const needle = query.trim();
    if (!needle) return options;
    return options.filter((option) => matchesSearchOption(option, needle));
  }, [options, query]);

  const displayOptions = useMemo(() => {
    const selected = String(value || '').trim();
    const inBaseList = options.some(
      (option) => String(option).trim().toLowerCase() === selected.toLowerCase(),
    );
    const needle = query.trim().toLowerCase();

    if (!selected || inBaseList) return filteredOptions;

    const matchesQuery = !needle || selected.toLowerCase().includes(needle);
    if (!matchesQuery) return filteredOptions;

    const withoutDuplicate = filteredOptions.filter(
      (option) => String(option).trim().toLowerCase() !== selected.toLowerCase(),
    );
    return [selected, ...withoutDuplicate];
  }, [filteredOptions, options, query, value]);

  const trimmedQuery = query.trim();
  const showCustomOption = Boolean(
    allowCustomValue
    && trimmedQuery
    && !displayOptions.some((option) => String(option).trim().toLowerCase() === trimmedQuery.toLowerCase()),
  );

  const renderCustomOptionLabel = (label) => {
    if (typeof formatCustomOption === 'function') {
      return formatCustomOption(label);
    }
    return `Use "${label}"`;
  };

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
        setQuery('');
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      window.requestAnimationFrame(() => searchRef.current?.focus());
    } else {
      setQuery('');
    }
  }, [open]);

  const handleSelect = (option) => {
    onChange?.(option);
    setOpen(false);
    setQuery('');
  };

  const errorClass = hasError ? 'border-red-400 ring-4 ring-red-100' : '';
  const openStateClass = triggerClassName
    ? (open ? 'border-gray-400 bg-white' : '')
    : (open ? 'border-[#f59e0b] bg-white ring-4 ring-[#fde7c2]' : '');

  return (
    <div ref={rootRef} id={id} className={`relative ${className}`.trim()}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-invalid={hasError || undefined}
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev);
        }}
        className={`${triggerClassName || fieldClassName} flex items-center justify-between gap-3 disabled:cursor-not-allowed disabled:opacity-60 ${errorClass} ${openStateClass}`}
      >
        <span className={value ? 'truncate' : 'truncate text-slate-400'}>
          {value || placeholder}
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {required && !value ? (
        <input
          tabIndex={-1}
          aria-hidden="true"
          value=""
          onChange={() => {}}
          required
          className="pointer-events-none absolute h-0 w-0 opacity-0"
        />
      ) : null}

      {open ? (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-[120] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.14)]"
        >
          <div className="border-b border-slate-100 p-3">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <Search size={16} className="shrink-0 text-slate-400" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto py-1">
            {!query.trim() && options.length > 0 ? (
              <p className="border-b border-slate-100 px-4 py-2 text-xs text-slate-500">
                {listHint || `Showing ${options.length} areas — scroll or type to search`}
              </p>
            ) : null}
            {displayOptions.length > 0 ? (
              displayOptions.map((option) => {
                const isSelected = option === value;
                const isCustomSaved = allowCustomValue
                  && !options.some(
                    (entry) => String(entry).trim().toLowerCase() === String(option).trim().toLowerCase(),
                  );
                return (
                  <button
                    key={option}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(option)}
                    className={`flex w-full items-center px-4 py-2.5 text-left text-sm transition ${
                      isSelected
                        ? 'bg-[#fff7e8] font-semibold text-[#b45309]'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="truncate">{option}</span>
                    {isCustomSaved ? (
                      <span className="ms-2 shrink-0 text-[11px] font-medium text-slate-400">Custom</span>
                    ) : null}
                  </button>
                );
              })
            ) : null}
            {showCustomOption ? (
              <button
                type="button"
                role="option"
                aria-selected={value === trimmedQuery}
                onClick={() => handleSelect(trimmedQuery)}
                className="flex w-full items-center border-t border-slate-100 px-4 py-3 text-left text-sm font-semibold text-[#b45309] transition hover:bg-[#fff7e8]"
              >
                {renderCustomOptionLabel(trimmedQuery)}
              </button>
            ) : null}
            {displayOptions.length === 0 && !showCustomOption ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">{emptyMessage}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
