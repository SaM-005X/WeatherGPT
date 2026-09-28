import React from 'react';

interface LoadingSkeletonProps {
  className?: string;
}

export function LoadingSkeleton({ className = 'h-6 w-full' }: LoadingSkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded bg-slate-200/80 ${className}`}
      aria-hidden="true"
    />
  );
}

export function WeatherCardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <LoadingSkeleton className="h-7 w-40" />
        <LoadingSkeleton className="h-5 w-24" />
      </div>
      <div className="my-6 flex items-baseline gap-4">
        <LoadingSkeleton className="h-14 w-28" />
        <LoadingSkeleton className="h-5 w-24" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 pt-4 border-t border-slate-100">
        <LoadingSkeleton className="h-10 w-full" />
        <LoadingSkeleton className="h-10 w-full" />
        <LoadingSkeleton className="h-10 w-full" />
        <LoadingSkeleton className="h-10 w-full" />
      </div>
    </div>
  );
}
