import type { Metadata } from 'next';
import './globals.css';
import { LocationProvider } from '@/context/LocationContext';
import { TopNav } from '@/components/navigation/TopNav';

export const metadata: Metadata = {
  title: 'WeatherGPT — Full-Stack Weather & Environmental Platform',
  description: 'Real-time weather, hourly projections, 7-day outlook, interactive radar, geohazards and environmental intelligence.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 antialiased">
        <LocationProvider>
          <TopNav />
          <div className="flex-1 pb-16 lg:pb-0">{children}</div>
        </LocationProvider>
      </body>
    </html>
  );
}
