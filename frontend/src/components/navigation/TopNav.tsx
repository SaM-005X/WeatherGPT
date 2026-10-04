'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocationContext } from '@/context/LocationContext';
import { LocationSearchModal } from '@/components/navigation/LocationSearchModal';

interface NavItem {
  name: string;
  href: string;
  icon?: string;
  badge?: string;
  description?: string;
}

interface NavCategory {
  name: string;
  items: NavItem[];
}

const NAV_CATEGORIES: NavCategory[] = [
  {
    name: 'Forecasts',
    items: [
      { name: 'Hourly Forecast', href: '/hourly', icon: '⏱️', description: '24–48 hour detailed timeline & charts' },
      { name: '7-Day Outlook', href: '/forecast', icon: '📅', description: 'Extended daily temperature & rain trends' },
      { name: 'Precipitation Nowcast', href: '/nowcast', icon: '🌧️', description: '15-minute minute-by-minute rain trajectory' },
    ],
  },
  {
    name: 'Environment',
    items: [
      { name: 'Air Quality', href: '/air-quality', icon: '🍃', description: 'AQI, PM2.5, PM10, ozone & pollen' },
      { name: 'Sun & Astronomy', href: '/astronomy', icon: '☀️', description: 'Sunrise, sunset, twilight & moon phases' },
      { name: 'Weather Activities', href: '/activities', icon: '🏃', description: 'Running, cycling, hiking & outdoor comfort' },
    ],
  },
  {
    name: 'Geohazards',
    items: [
      { name: 'Earthquakes', href: '/earthquakes', icon: '🌋', description: 'USGS live global seismic feed & map' },
      { name: 'Volcanoes', href: '/volcanoes', icon: '🌋', description: 'Smithsonian GVP active eruptions & unrest' },
      { name: 'Tsunamis', href: '/tsunamis', icon: '🌊', description: 'NOAA PTWC live tsunami advisories' },
      { name: 'Severe Alerts', href: '/alerts', icon: '⚠️', description: 'Watches, warnings & regional bulletins' },
      { name: 'Storm Tracker', href: '/storms', icon: '🌀', description: 'Tropical cyclones & hurricane forecast cones' },
    ],
  },

];

export function TopNav() {
  const pathname = usePathname();
  const { activeLocation, units, setUnits, isSearchModalOpen, setIsSearchModalOpen } = useLocationContext();

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNavClick = () => {
    setIsMobileMenuOpen(false);
    setOpenDropdown(null);
  };

  const handleLocationClick = () => {
    if (pathname === '/') {
      const el = document.getElementById('location-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
    setIsSearchModalOpen(true);
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-2xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6">
          
          {/* Left: Brand Identity */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-600 text-white shadow-2xs group-hover:bg-sky-700 transition">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 00-9.78 2.096A4.001 4.001 0 003 15z" />
                </svg>
              </div>
              <div>
                <span className="text-base font-bold tracking-tight text-slate-900 group-hover:text-sky-600 transition flex items-center gap-1.5">
                  WeatherGPT
                </span>
                <p className="text-[10px] text-slate-500 font-normal leading-tight hidden sm:block">
                  Live Meteorological Platform
                </p>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-1" ref={dropdownRef}>
              {/* Dashboard Link */}
              <Link
                href="/"
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  pathname === '/'
                    ? 'bg-sky-50 text-sky-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Dashboard
              </Link>

              {/* Categorized Dropdowns */}
              {NAV_CATEGORIES.map((cat) => {
                const isCatActive = cat.items.some((item) => pathname.startsWith(item.href));
                const isOpen = openDropdown === cat.name;

                return (
                  <div key={cat.name} className="relative">
                    <button
                      onClick={() => setOpenDropdown(isOpen ? null : cat.name)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                        isCatActive || isOpen
                          ? 'bg-slate-100 text-slate-900 font-semibold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <span>{cat.name}</span>
                      <svg
                        className={`h-3.5 w-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-sky-600' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Dropdown Menu */}
                    {isOpen && (
                      <div className="absolute left-0 mt-1.5 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-lg ring-1 ring-black/5 animate-in fade-in slide-in-from-top-1 duration-150 z-50">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2.5 py-1">
                          {cat.name} Sections
                        </div>
                        {cat.items.map((item) => {
                          const isActive = pathname === item.href;
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={handleNavClick}
                              className={`flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition ${
                                isActive
                                  ? 'bg-sky-50 text-sky-700'
                                  : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                              }`}
                            >
                              <span className="text-base shrink-0">{item.icon}</span>
                              <div>
                                <p className={`text-xs font-medium leading-none ${isActive ? 'font-semibold text-sky-700' : 'text-slate-900'}`}>
                                  {item.name}
                                </p>
                                {item.description && (
                                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                                    {item.description}
                                  </p>
                                )}
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Maps & Radar Direct Link */}
              <Link
                href="/maps"
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                  pathname === '/maps'
                    ? 'bg-sky-50 text-sky-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>🗺️</span>
                <span>Radar & Maps</span>
              </Link>
            </nav>
          </div>

          {/* Right Controls: Unit Toggle & Active Location Pill */}
          <div className="flex items-center gap-2.5">
            {/* Unit Toggle (°C / °F) */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-semibold shadow-2xs">
              <button
                onClick={() => setUnits('metric')}
                className={`rounded-md px-2.5 py-1 transition cursor-pointer ${
                  units === 'metric'
                    ? 'bg-white text-sky-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Switch to Celsius"
              >
                °C
              </button>
              <button
                onClick={() => setUnits('imperial')}
                className={`rounded-md px-2.5 py-1 transition cursor-pointer ${
                  units === 'imperial'
                    ? 'bg-white text-sky-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Switch to Fahrenheit"
              >
                °F
              </button>
            </div>

            {/* Active Location Badge */}
            <button
              onClick={handleLocationClick}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition cursor-pointer shadow-2xs"
              title="Click to search or change location"
            >
              <svg className="h-3.5 w-3.5 text-sky-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="max-w-[110px] truncate sm:max-w-[160px] font-semibold text-slate-800">
                {activeLocation.name}
              </span>
              <span className="rounded bg-slate-200/80 px-1 py-0.2 text-[9px] font-semibold text-slate-600 uppercase hidden sm:inline-block">
                {activeLocation.source}
              </span>
            </button>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Full Menu Drawer */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-4 max-h-[80vh] overflow-y-auto shadow-md">
            <div>
              <Link
                href="/"
                onClick={handleNavClick}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  pathname === '/' ? 'bg-sky-50 text-sky-700' : 'text-slate-800 hover:bg-slate-50'
                }`}
              >
                <span>🏠</span>
                <span>Dashboard Overview</span>
              </Link>
              <Link
                href="/maps"
                onClick={handleNavClick}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition mt-1 ${
                  pathname === '/maps' ? 'bg-sky-50 text-sky-700' : 'text-slate-800 hover:bg-slate-50'
                }`}
              >
                <span>🗺️</span>
                <span>Radar & Weather Maps</span>
              </Link>
            </div>

            {NAV_CATEGORIES.map((cat) => (
              <div key={cat.name} className="border-t border-slate-100 pt-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3">
                  {cat.name}
                </span>
                <div className="mt-1 space-y-1">
                  {cat.items.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={handleNavClick}
                        className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition ${
                          isActive
                            ? 'bg-sky-50 text-sky-700 font-semibold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-base">{item.icon}</span>
                          <span>{item.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400">›</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </header>

      {/* Global Location Search Modal */}
      {isSearchModalOpen && (
        <LocationSearchModal onClose={() => setIsSearchModalOpen(false)} />
      )}

      {/* Mobile Fixed Bottom Dock for 1-hand navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md px-3 py-1 flex items-center justify-around shadow-lg">
        <Link
          href="/"
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-medium transition ${
            pathname === '/' ? 'text-sky-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="text-base leading-none">🏠</span>
          <span className="mt-0.5">Overview</span>
        </Link>
        <Link
          href="/hourly"
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-medium transition ${
            pathname === '/hourly' ? 'text-sky-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="text-base leading-none">⏱️</span>
          <span className="mt-0.5">Hourly</span>
        </Link>
        <Link
          href="/maps"
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-medium transition ${
            pathname === '/maps' ? 'text-sky-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="text-base leading-none">🗺️</span>
          <span className="mt-0.5">Radar</span>
        </Link>
        <Link
          href="/air-quality"
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-medium transition ${
            pathname === '/air-quality' ? 'text-sky-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="text-base leading-none">🍃</span>
          <span className="mt-0.5">Air Quality</span>
        </Link>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
        >
          <span className="text-base leading-none">☰</span>
          <span className="mt-0.5">More</span>
        </button>
      </nav>
    </>
  );
}
