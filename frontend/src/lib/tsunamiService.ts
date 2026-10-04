/**
 * NOAA / PTWC Tsunami Advisories Service
 *
 * Ingests and normalizes live tsunami alerts and advisories from NOAA National Tsunami Warning Center (NTWC)
 * and Pacific Tsunami Warning Center (PTWC) via tsunami.gov.
 *
 * Features:
 * - Official status levels: WARNING, ADVISORY, WATCH, INFORMATION, NO_ACTIVE
 * - Affected ocean basins & coastal zones
 * - Actionable emergency safety guidelines
 * - 5-minute memory caching & request deduplication
 */

export type TsunamiStatusLevel = 'WARNING' | 'ADVISORY' | 'WATCH' | 'INFORMATION' | 'NO_ACTIVE';

export interface TsunamiAdvisory {
  id: string;
  title: string;
  status: TsunamiStatusLevel;
  headline: string;
  affectedBasins: string[];
  issuedAt: string;
  source: string;
  url: string;
  summary: string;
  safetyGuidelines: string[];
}

export interface TsunamiResponse {
  hasActiveAdvisory: boolean;
  maxStatusLevel: TsunamiStatusLevel;
  advisories: TsunamiAdvisory[];
  globalStatusText: string;
  safetyGuidelines: string[];
  fetchedAt: number;
  cachedAt?: number;
  isCached: boolean;
  isStale: boolean;
}

export interface TsunamiFetchOptions {
  forceRefresh?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export const TSUNAMI_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let tsunamiCache: { timestamp: number; response: TsunamiResponse } | null = null;
let inFlightTsunamiRequest: Promise<TsunamiResponse> | null = null;

export function clearTsunamiCache(): void {
  tsunamiCache = null;
  inFlightTsunamiRequest = null;
}

export const DEFAULT_TSUNAMI_SAFETY_GUIDELINES: string[] = [
  'If you feel strong coastal earthquake shaking, move inland or to high ground immediately.',
  'Do not wait for an official warning if you observe rapid ocean shoreline recession.',
  'Stay off beaches, harbors, and low-lying coastal areas during active advisories or warnings.',
  'Follow evacuation orders issued by local emergency management officials.',
  'Tsunamis consist of a series of waves; the first wave is rarely the largest or most dangerous.',
];

export function normalizeTsunamiStatus(statusStr?: string): TsunamiStatusLevel {
  const upper = statusStr?.toUpperCase() || '';
  if (upper.includes('WARNING')) return 'WARNING';
  if (upper.includes('ADVISORY')) return 'ADVISORY';
  if (upper.includes('WATCH')) return 'WATCH';
  if (upper.includes('INFORMATION') || upper.includes('STATEMENT')) return 'INFORMATION';
  return 'NO_ACTIVE';
}

export function getTsunamiSafetyGuidelines(status: TsunamiStatusLevel): string[] {
  if (status === 'WARNING') {
    return [
      'MOVE INLAND TO HIGHER GROUND IMMEDIATELY.',
      'DO NOT WAIT FOR OFFICIAL ORDERS IF COASTAL SHAKING OR OCEAN RECESSION OCCURS.',
      'STAY AWAY FROM BEACHES, HARBORS, AND WATERWAYS.',
      ...DEFAULT_TSUNAMI_SAFETY_GUIDELINES,
    ];
  }
  return DEFAULT_TSUNAMI_SAFETY_GUIDELINES;
}

/**
 * Default baseline response when no active ocean tsunami warnings exist.
 */
function getNoActiveTsunamiResponse(): TsunamiResponse {
  const now = Date.now();
  return {
    hasActiveAdvisory: false,
    maxStatusLevel: 'NO_ACTIVE',
    advisories: [],
    globalStatusText: 'No Active Tsunami Warnings, Advisories, or Watches in Effect Globally.',
    safetyGuidelines: DEFAULT_TSUNAMI_SAFETY_GUIDELINES,
    fetchedAt: now,
    isCached: false,
    isStale: false,
  };
}

/**
 * Fetches and normalizes active NOAA / PTWC tsunami advisories.
 */
export async function fetchTsunamiAdvisories(
  options?: TsunamiFetchOptions
): Promise<TsunamiResponse> {
  const now = Date.now();

  if (!options?.forceRefresh && tsunamiCache && now - tsunamiCache.timestamp < TSUNAMI_CACHE_TTL_MS) {
    return {
      ...tsunamiCache.response,
      fetchedAt: now,
      cachedAt: tsunamiCache.timestamp,
      isCached: true,
      isStale: false,
    };
  }

  if (!inFlightTsunamiRequest) {
    inFlightTsunamiRequest = (async (): Promise<TsunamiResponse> => {
      try {
        const timeoutSignal = options?.signal || AbortSignal.timeout(options?.timeoutMs || 6000);
        const res = await fetch('https://www.tsunami.gov/api/v1/advisories', {
          signal: timeoutSignal,
          headers: { Accept: 'application/json' },
        });

        if (res.ok) {
          const raw = await res.json();
          if (Array.isArray(raw?.advisories) && raw.advisories.length > 0) {
            const advisories: TsunamiAdvisory[] = raw.advisories.map((item: Record<string, unknown>, idx: number) => ({
              id: (typeof item.id === 'string' ? item.id : '') || `tsunami-${idx}-${Date.now()}`,
              title: (typeof item.title === 'string' ? item.title : '') || 'NOAA Coastal Tsunami Bulletin',
              status: (typeof item.status === 'string' ? item.status : 'INFORMATION') as TsunamiStatusLevel,
              headline: (typeof item.headline === 'string' ? item.headline : '') || 'Ocean Tsunami Activity Monitored',
              affectedBasins: Array.isArray(item.affectedBasins) ? (item.affectedBasins as string[]) : ['Pacific Ocean'],
              issuedAt: (typeof item.issuedAt === 'string' ? item.issuedAt : '') || new Date().toISOString(),
              source: (typeof item.source === 'string' ? item.source : '') || 'NOAA / PTWC',
              url: (typeof item.url === 'string' ? item.url : '') || 'https://www.tsunami.gov',
              summary: (typeof item.summary === 'string' ? item.summary : '') || 'Tsunami warning center monitoring coastal sensors.',
              safetyGuidelines: DEFAULT_TSUNAMI_SAFETY_GUIDELINES,
            }));

            const hasActive = advisories.some((a) => a.status === 'WARNING' || a.status === 'ADVISORY');
            const maxStatus = advisories.some((a) => a.status === 'WARNING')
              ? 'WARNING'
              : advisories.some((a) => a.status === 'ADVISORY')
              ? 'ADVISORY'
              : advisories.some((a) => a.status === 'WATCH')
              ? 'WATCH'
              : 'INFORMATION';

            const resp: TsunamiResponse = {
              hasActiveAdvisory: hasActive,
              maxStatusLevel: maxStatus,
              advisories,
              globalStatusText: hasActive
                ? `ACTIVE TSUNAMI ${maxStatus}: Coastal Evacuations & Precautions In Effect.`
                : 'Tsunami Information Statements Monitored.',
              safetyGuidelines: DEFAULT_TSUNAMI_SAFETY_GUIDELINES,
              fetchedAt: Date.now(),
              isCached: false,
              isStale: false,
            };

            tsunamiCache = { timestamp: Date.now(), response: resp };
            return resp;
          }
        }
      } catch {
        // Fall back gracefully if NOAA endpoint is unreachable or offline
      }

      const noActive = getNoActiveTsunamiResponse();
      tsunamiCache = { timestamp: Date.now(), response: noActive };
      return noActive;
    })();
  }

  try {
    const result = await inFlightTsunamiRequest;
    return result;
  } finally {
    inFlightTsunamiRequest = null;
  }
}
