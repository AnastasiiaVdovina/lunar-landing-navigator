/**
 * Flat-horizon teaching model for Lunar Landing Site Navigator.
 * Coordinates and distances for the four example locations are rounded for demonstration.
 * These are not LOLA or Horizons measurements, ice detections, or landing safety assessments.
 */

export const LUNAR_DAY = 29.53;
const EARTH_WOBBLE_DAY = 27.3;
const SOLAR_SEASON_DAYS = 365.2422;
const MS_DAY = 86_400_000;
const MOON_RADIUS_KM = 1737.4;
const SCAN_STEP = 0.25;
const MAX_SCAN = 29.5;
const TWO_PI = 2 * Math.PI;
const ORIGIN_DATE_MS = Date.parse('2026-11-15T00:00:00Z');

export interface Site {
  id: string;
  name: string;
  lat: number;
  lon: number;
  iceKm: number;
  sunMask: number;
  sitePhase: number;
  siteSunBias: number;
  siteEarthBase: number;
  teachingPreset: boolean;
}

export interface Evaluation {
  dayIndex: number;
  sunDeg: number;
  earthDeg: number;
  sunVisible: boolean;
  earthVisible: boolean;
  sunMask: number;
  science: number;
  survival: number;
  battery: number;
  currentLightDays: number;
  nextSunDays: number;
  currentCommDays: number;
  nextEarthDays: number;
  light14Days: number;
  comm14Days: number;
  joint14Fraction: number;
  verdict: string;
}

export interface NearbySuggestion {
  site: Site;
  evaluation: Evaluation;
  distanceKm: number;
}

export interface PresetRecommendation {
  site: Site;
  evaluation: Evaluation;
  score: number;
}

// Rounded teaching coordinates and illustrative distances to cold-trap targets.
// Legacy phase/bias fields remain for passports saved by earlier versions; the
// spherical astronomy below no longer uses them.
export const SITES: readonly Site[] = [
  { id: 'shackleton', name: 'Shackleton', lat: -89.9, lon: 0, iceKm: 1.2,
    sunMask: 0.5, sitePhase: 5.0, siteSunBias: 0.2, siteEarthBase: 0.25, teachingPreset: true },
  { id: 'mouton', name: 'Mouton', lat: -84.6, lon: 31, iceKm: 4.0,
    sunMask: 1.5, sitePhase: 10.0, siteSunBias: 1.45, siteEarthBase: 0.15, teachingPreset: true },
  { id: 'malapert', name: 'Malapert', lat: -86, lon: 3, iceKm: 6.0,
    sunMask: 1.0, sitePhase: 7.0, siteSunBias: 2.25, siteEarthBase: 0.75, teachingPreset: true },
  { id: 'cabeus', name: 'Cabeus', lat: -84.9, lon: -35.5, iceKm: 0.3,
    sunMask: 2.0, sitePhase: 16.0, siteSunBias: 0.45, siteEarthBase: -0.2, teachingPreset: true },
];

const rad = (degrees: number): number => degrees * Math.PI / 180;
const deg = (radians: number): number => radians * 180 / Math.PI;
const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value));

function wrapLon(lon: number): number {
  return ((lon + 180) % 360 + 360) % 360 - 180;
}

/** Approximate lunar subsolar longitude, east positive, in [-180, 180). */
export function subsolarLongitude(dayIndex: number): number {
  // 29.53 days is the synodic lunar day. The 84° starting phase is an
  // illustrative anchor, not an ephemeris for 2026-11-15.
  return wrapLon(84 - 360 * dayIndex / LUNAR_DAY);
}

function subsolarLatitude(dayIndex: number): number {
  // Lunar obliquity is about 1.54°. The seasonal phase is illustrative.
  return 1.54 * Math.sin(TWO_PI * (dayIndex - 24.5) / SOLAR_SEASON_DAYS);
}

function subearthLongitude(dayIndex: number): number {
  // Small monthly libration around the mean Earth-facing meridian.
  return 6 * Math.sin(TWO_PI * (dayIndex + 6) / EARTH_WOBBLE_DAY);
}

function subearthLatitude(dayIndex: number): number {
  return 6 * Math.sin(TWO_PI * (dayIndex + 18.5) / EARTH_WOBBLE_DAY);
}

function altitudeDeg(site: Pick<Site, 'lat' | 'lon'>, subLat: number, subLon: number): number {
  // Spherical astronomical altitude: sin(h) = sin(phi)sin(delta) +
  // cos(phi)cos(delta)cos(lambda - lambda_sub).
  const sinAltitude = Math.sin(rad(site.lat)) * Math.sin(rad(subLat)) +
    Math.cos(rad(site.lat)) * Math.cos(rad(subLat)) * Math.cos(rad(site.lon - subLon));
  return deg(Math.asin(clamp(sinAltitude, -1, 1)));
}

function bearingDeg(from: Pick<Site, 'lat' | 'lon'>, to: Pick<Site, 'lat' | 'lon'>): number {
  const latitude = rad(from.lat), targetLatitude = rad(to.lat);
  const longitudeDelta = rad(to.lon - from.lon);
  const y = Math.sin(longitudeDelta) * Math.cos(targetLatitude);
  const x = Math.cos(latitude) * Math.sin(targetLatitude) -
    Math.sin(latitude) * Math.cos(targetLatitude) * Math.cos(longitudeDelta);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Apparent compass bearings of Sun and Earth, north=0°, east=90°. */
export function bodyAzimuths(site: Pick<Site, 'lat' | 'lon'>, dayIndex: number): { sunDeg: number; earthDeg: number } {
  return {
    sunDeg: bearingDeg(site, { lat: subsolarLatitude(dayIndex), lon: subsolarLongitude(dayIndex) }),
    earthDeg: bearingDeg(site, { lat: subearthLatitude(dayIndex), lon: subearthLongitude(dayIndex) }),
  };
}

export function distanceKm(a: Pick<Site, 'lat' | 'lon'>, b: Pick<Site, 'lat' | 'lon'>): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return MOON_RADIUS_KM * 2 * Math.asin(Math.sqrt(clamp(h, 0, 1)));
}

// These targets are explicitly hypothetical: each is placed on the lunar
// sphere at the user-supplied demonstration distance from its preset. They
// allow a continuous *teaching* proximity score, not a claim of measured ice.
const COLD_TRAPS = SITES.map(site => ({ siteId: site.id, ...destination(site, site.iceKm, 0) }));

export function nearestColdTrap(site: Pick<Site, 'lat' | 'lon'>): { distanceKm: number; bearingDeg: number } {
  let nearest = COLD_TRAPS[0];
  let nearestDistance = distanceKm(site, nearest);
  for (const trap of COLD_TRAPS.slice(1)) {
    const distance = distanceKm(site, trap);
    if (distance < nearestDistance) { nearest = trap; nearestDistance = distance; }
  }
  return { distanceKm: nearestDistance, bearingDeg: bearingDeg(site, nearest) };
}

/** Resolve a user entered location. Preset coordinates retain their teaching values. */
export function resolveSite(lat: number, lon: number, name = 'Custom point', snapToPreset = true): Site | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > -80 || lon < -180 || lon > 180) return null;
  const preset = snapToPreset
    ? SITES.find(site => Math.abs(site.lat - lat) < 0.0001 && Math.abs(site.lon - lon) < 0.0001)
    : undefined;
  if (preset) return preset;
  const nearest = SITES.map(site => ({ site, km: distanceKm({ lat, lon }, site) }))
    .sort((a, b) => a.km - b.km)[0];
  const iceKm = nearestColdTrap({ lat, lon }).distanceKm;
  const dLon = rad(wrapLon(lon - nearest.site.lon));
  const eastKm = MOON_RADIUS_KM * Math.cos(rad((lat + nearest.site.lat) / 2)) * dLon;
  const northKm = MOON_RADIUS_KM * rad(lat - nearest.site.lat);
  // An illustrative local horizon mask varies along a notional ridge. The
  // subsolar position itself is global and never receives a site-specific bias.
  const ridgeMask = 1.5 * Math.sin(eastKm / 2.2) + 1.6 * Math.sin(northKm / 2.2);
  const sunMask = clamp(1 + 0.45 * ((-lat - 80) / 10) + ridgeMask, 0.05, 3);
  return {
    id: `custom-${lat.toFixed(5)}-${wrapLon(lon).toFixed(5)}`, name, lat, lon: wrapLon(lon), iceKm,
    sunMask, sitePhase: nearest.site.sitePhase,
    siteSunBias: 0, siteEarthBase: 0,
    teachingPreset: false,
  };
}

export function dayIndexAt(landingDate: string, dayOffset = 0): number {
  const time = Date.parse(`${landingDate}T00:00:00Z`);
  if (!Number.isFinite(time) || !Number.isFinite(dayOffset)) throw new Error('Invalid date or time.');
  return (time - ORIGIN_DATE_MS) / MS_DAY + dayOffset;
}

export function bodyAngles(site: Site, dayIndex: number): { sunDeg: number; earthDeg: number } {
  return {
    sunDeg: altitudeDeg(site, subsolarLatitude(dayIndex), subsolarLongitude(dayIndex)),
    earthDeg: altitudeDeg(site, subearthLatitude(dayIndex), subearthLongitude(dayIndex)),
  };
}

function visible(site: Site, dayIndex: number): { sun: boolean; earth: boolean } {
  const { sunDeg, earthDeg } = bodyAngles(site, dayIndex);
  return { sun: sunDeg > site.sunMask, earth: earthDeg > 0 };
}

function daysToChange(site: Site, at: number, key: 'sun' | 'earth'): number {
  const now = visible(site, at)[key];
  for (let days = SCAN_STEP; days <= MAX_SCAN; days += SCAN_STEP) {
    if (visible(site, at + days)[key] !== now) return days;
  }
  return MAX_SCAN;
}

function shadowAgeDays(site: Site, at: number): number {
  for (let days = SCAN_STEP; days <= MAX_SCAN; days += SCAN_STEP) {
    if (visible(site, at - days).sun) return days;
  }
  return MAX_SCAN;
}

function verdictFor(site: Site, sun: boolean, earth: boolean, science: number): string {
  if (sun && earth && science >= 45) return 'Power is holding and Earth is in view. The cold-trap target is close-a strong option.';
  if (sun && earth && science < 30) return 'Power and contact look good. The cold-trap target is farther away.';
  if (!sun && science >= 45) return 'The cold-trap target is nearby, but the Sun is below the ridge. Battery reserve is shrinking.';
  if (sun && !earth) return 'Sunlight can power the lander, but Earth is below the horizon. Wait for a direct-link window.';
  if (!sun && !earth) return 'Sun and Earth are both below the horizon. This is a poor landing time.';
  if (!sun) return 'Earth is in view, but the Sun is below the ridge. Battery reserve is limited.';
  return nearestColdTrap(site).distanceKm < 4
    ? 'Light and contact are available. The cold-trap target is relatively close.'
    : 'Light and contact are available. The cold-trap target is far away.';
}

/** Calculate all displayed values locally from the selected site/date/slider. */
export function evaluate(site: Site, landingDate: string, dayOffset: number): Evaluation {
  const dayIndex = dayIndexAt(landingDate, dayOffset);
  const { sunDeg, earthDeg } = bodyAngles(site, dayIndex);
  const sunVisible = sunDeg > site.sunMask;
  const earthVisible = earthDeg > 0;
  let lightSamples = 0, commSamples = 0, jointSamples = 0;
  for (let i = 0; i < 56; i++) {
    const state = visible(site, dayIndex + i * SCAN_STEP);
    if (state.sun) lightSamples++;
    if (state.earth) commSamples++;
    if (state.sun && state.earth) jointSamples++;
  }
  const joint14Fraction = jointSamples / 56;
  const survival = Math.round(100 * joint14Fraction);
  const science = Math.round(1000 * (1.2 / (nearestColdTrap(site).distanceKm + 1.2))) / 10;
  const battery = sunVisible
    ? Math.round(clamp(70 + 10 * (sunDeg - site.sunMask), 70, 100))
    : Math.round(clamp(40 - 5 * shadowAgeDays(site, dayIndex), 5, 40));
  const sunChange = daysToChange(site, dayIndex, 'sun');
  const earthChange = daysToChange(site, dayIndex, 'earth');
  return {
    dayIndex, sunDeg, earthDeg, sunVisible, earthVisible, sunMask: site.sunMask,
    science, survival, battery,
    currentLightDays: sunVisible ? sunChange : 0,
    nextSunDays: sunVisible ? 0 : sunChange,
    currentCommDays: earthVisible ? earthChange : 0,
    nextEarthDays: earthVisible ? 0 : earthChange,
    light14Days: lightSamples * SCAN_STEP,
    comm14Days: commSamples * SCAN_STEP,
    joint14Fraction,
    verdict: verdictFor(site, sunVisible, earthVisible, science),
  };
}

/** Choose a teaching preset for the selected moment, with immediate visibility required. */
export function recommendPreset(landingDate: string, dayOffset: number): PresetRecommendation | null {
  let best: PresetRecommendation | null = null;
  for (const site of SITES) {
    const evaluation = evaluate(site, landingDate, dayOffset);
    if (!evaluation.sunVisible || !evaluation.earthVisible || evaluation.survival === 0) continue;
    // Mission operation is weighted more heavily than the illustrative ice score.
    const score = 0.75 * evaluation.survival + 0.25 * evaluation.science;
    if (!best || score > best.score ||
      (score === best.score && evaluation.survival > best.evaluation.survival) ||
      (score === best.score && evaluation.survival === best.evaluation.survival &&
        evaluation.science > best.evaluation.science)) {
      best = { site, evaluation, score };
    }
  }
  return best;
}

function destination(site: Site, km: number, bearingDeg: number): { lat: number; lon: number } {
  const bearing = rad(bearingDeg);
  const delta = km / MOON_RADIUS_KM;
  const latitude = rad(site.lat), longitude = rad(site.lon);
  const newLat = Math.asin(Math.sin(latitude) * Math.cos(delta) + Math.cos(latitude) * Math.sin(delta) * Math.cos(bearing));
  const newLon = longitude + Math.atan2(Math.sin(bearing) * Math.sin(delta) * Math.cos(latitude),
    Math.cos(delta) - Math.sin(latitude) * Math.sin(newLat));
  return { lat: deg(newLat), lon: wrapLon(deg(newLon)) };
}

/** Search 2–3 km along the same notional ridge; never jump to another crater. */
export function suggestNearby(site: Site, landingDate: string, dayOffset = 0): NearbySuggestion | null {
  const current = evaluate(site, landingDate, dayOffset);
  let best: NearbySuggestion | null = null;
  for (const km of [2, 2.5, 3]) for (const bearing of [90, 270, 80, 100, 260, 280, 0, 180, 30, 150, 210, 330]) {
    const point = destination(site, km, bearing);
    const candidate = resolveSite(point.lat, point.lon, 'Nearby on the same ridge');
    if (!candidate) continue;
    const evaluation = evaluate(candidate, landingDate, dayOffset);
    if (evaluation.survival <= current.survival) continue;
    if (!best || evaluation.survival > best.evaluation.survival ||
      (evaluation.survival === best.evaluation.survival && km < best.distanceKm)) {
      best = { site: candidate, evaluation, distanceKm: km };
    }
  }
  return best;
}
