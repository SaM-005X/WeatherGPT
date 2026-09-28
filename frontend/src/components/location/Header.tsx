'use client';

import React from 'react';
import { ActiveLocation } from '@/types/location';

interface HeaderProps {
  currentLocation: ActiveLocation;
  onOpenSearch?: () => void;
}

export function Header({ currentLocation, onOpenSearch }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white shadow-2xs">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Application Branding */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-600 text-white shadow-2xs">
            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 00-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-900 leading-none">
              WeatherGPT
            </h1>
            <p className="text-[11px] text-slate-500 font-normal mt-0.5">
              Live Weather & Forecasts
            </p>
          </div>
        </div>

        {/* Current Active Location Badge & Search Trigger */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSearch}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition"
            title="Change Location"
          >
            <svg className="h-3.5 w-3.5 text-sky-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="max-w-[120px] truncate sm:max-w-[180px]">
              {currentLocation.name}
            </span>
            <span className="rounded bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 uppercase">
              {currentLocation.source}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
