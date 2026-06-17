'use client';

import { useMemo, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import Loading from '@/components/Loading';
import {
  MARKETING_STACK_SECTIONS,
  STATUS_LABELS,
  TAG_LABELS,
  getMarketingStackStats,
} from '@/lib/marketingStackCatalog';

export default function MarketingStackPage() {
  const stats = useMemo(() => getMarketingStackStats(), []);
  const [openSections, setOpenSections] = useState({ analytics: true });

  const toggleSection = (id) => {
    setOpenSections((current) => ({ ...current, [id]: !current[id] }));
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Marketing & Tracking Stack</h1>
        <p className="mt-1 text-xs text-slate-600 sm:text-sm">
          Your full ecommerce tracking roadmap. Click any category to expand. Green = live, amber = partial, grey = planned next.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-md">
          <p className="text-[10px] uppercase text-slate-500">Total tools</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 shadow-md">
          <p className="text-[10px] uppercase text-emerald-700">Live</p>
          <p className="mt-1 text-2xl font-bold text-emerald-800">{stats.live}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 shadow-md">
          <p className="text-[10px] uppercase text-amber-700">Partial</p>
          <p className="mt-1 text-2xl font-bold text-amber-800">{stats.partial}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-md">
          <p className="text-[10px] uppercase text-slate-500">Planned</p>
          <p className="mt-1 text-2xl font-bold text-slate-700">{stats.planned}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[11px] text-slate-600 shadow-md sm:text-xs">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#1D9E75]" /> Must-have</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#BA7517]" /> Nice-to-have</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#7F77DD]" /> Advanced</span>
      </div>

      <div className="space-y-0.5">
        {MARKETING_STACK_SECTIONS.map((section) => {
          const isOpen = Boolean(openSections[section.id]);
          return (
            <div key={section.id} className="overflow-hidden rounded-xl">
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition hover:opacity-90 sm:gap-3"
                style={{
                  background: section.color,
                  border: `1px solid ${section.borderColor}33`,
                }}
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
                  style={{ background: section.iconBg, color: section.textColor }}
                >
                  {section.label.slice(0, 1)}
                </div>
                <span className="flex-1 text-sm font-medium sm:text-[15px]" style={{ color: section.textColor }}>
                  {section.label}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{ background: `${section.borderColor}22`, color: section.textColor }}
                >
                  {section.items.length} tools
                </span>
                <ChevronDown
                  size={16}
                  className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  style={{ color: section.textColor }}
                />
              </button>

              {isOpen ? (
                <div className="grid grid-cols-1 gap-2 bg-white p-2 sm:grid-cols-2 sm:p-3">
                  {section.items.map((item) => {
                    const status = STATUS_LABELS[item.status] || STATUS_LABELS.planned;
                    const tag = TAG_LABELS[item.tag] || TAG_LABELS.must;

                    return (
                      <div
                        key={item.id}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-3 sm:p-3.5"
                      >
                        <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
                          <p className="text-sm font-medium text-slate-900">{item.name}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.className}`}>
                            {status.label}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed text-slate-600">{item.desc}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${tag.className}`}>
                            {tag.label}
                          </span>
                          {item.href && item.status !== 'planned' ? (
                            <Link
                              href={item.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:underline"
                            >
                              Open <ExternalLink size={12} />
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
