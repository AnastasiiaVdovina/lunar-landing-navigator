import {
  LUNAR_DAY, SITES, bodyAzimuths, evaluate, nearestColdTrap, recommendPreset, resolveSite, suggestNearby,
  type Evaluation, type NearbySuggestion, type Site,
} from './model';
import {
  appendPassport, capturePassport, cyclePassportIndex, decodePassports,
  matchesPassport, type Passport,
} from './passports';

const $ = (id: string): any => document.getElementById(id)!;
const MS_DAY = 86_400_000;
const STORAGE_KEY = 'lunar-navigator-passports-v2';

const state: {
  site: Site;
  date: string;
  dayOffset: number;
  evaluation: Evaluation;
  later: Evaluation;
  passports: Passport[];
  activePassportIndex: number | null;
  suggestion: NearbySuggestion | null;
  markerX: number;
  soundOn: boolean;
} = {
  site: SITES[0],
  date: '2026-11-15',
  dayOffset: 0,
  evaluation: evaluate(SITES[0], '2026-11-15', 0),
  later: evaluate(SITES[0], '2026-11-15', 14),
  passports: [],
  activePassportIndex: null,
  suggestion: null,
  markerX: .50,
  soundOn: false,
};

let toastTimer = 0;
let audioContext: AudioContext | null = null;
let powerOscillator: OscillatorNode | null = null;
let powerGain: GainNode | null = null;
let pulseTimer: number | null = null;
let pulseOscillator: OscillatorNode | null = null;
let pulseGain: GainNode | null = null;

function showToast(message: string): void {
  const box = $('toast');
  box.textContent = message;
  box.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => box.classList.remove('show'), 3500);
}

function fmt(value: number, digits = 1): string {
  return value.toFixed(digits);
}

function fmtDays(days: number): string {
  if (days >= 29.5) return 'more than 29.5 days';
  if (days <= 0) return '0 days';
  if (days === 1) return '1 day';
  return `${fmt(days, days < 1 ? 2 : 1)} days`;
}

function fmtCoord(value: number, latitude: boolean): string {
  return `${fmt(Math.abs(value), 4)}° ${latitude ? (value < 0 ? 'S' : 'N') : (value < 0 ? 'W' : 'E')}`;
}

function fmtDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${date}T00:00:00Z`));
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * MS_DAY).toISOString().slice(0, 10);
}

function fitCanvas(canvas: HTMLCanvasElement): { ctx: CanvasRenderingContext2D; width: number; height: number } {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, width: rect.width, height: rect.height };
}

function ridgeY(x: number, width: number, height: number): number {
  const u = x / width;
  return height * .70 + height * (.014 * Math.sin(u * 11) + .009 * Math.sin(u * 29 + .8));
}

function bearingX(bearingDeg: number, width: number): number {
  // Rotate the 360° panorama so that north (0°) sits in the middle.
  return width * (.16 + .68 * ((bearingDeg + 180) % 360) / 360);
}

function horizonX(dayIndex: number, body: 'sun' | 'earth', width: number): number {
  const azimuths = bodyAzimuths(state.site, dayIndex);
  return bearingX(body === 'sun' ? azimuths.sunDeg : azimuths.earthDeg, width);
}

function drawBody(
  ctx: CanvasRenderingContext2D, x: number, y: number, radius: number,
  color: string, glow: string,
): void {
  ctx.save();
  ctx.shadowColor = glow; ctx.shadowBlur = radius * 4;
  const fill = ctx.createRadialGradient(x - radius * .3, y - radius * .4, 1, x, y, radius);
  fill.addColorStop(0, '#fffaf1'); fill.addColorStop(.35, color); fill.addColorStop(1, glow);
  ctx.fillStyle = fill;
  ctx.beginPath(); ctx.arc(x, y, radius, 0, 2 * Math.PI); ctx.fill();
  ctx.restore();
}

function drawHorizon(canvas: HTMLCanvasElement, evaluation: Evaluation, compact = false): void {
  const { ctx, width, height } = fitCanvas(canvas);
  ctx.clearRect(0, 0, width, height);
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#02040b'); sky.addColorStop(.72, '#090d18'); sky.addColorStop(1, '#1e2432');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
  const showLight = $('layer-light').checked;
  const showEarth = $('layer-earth').checked;
  const showIce = $('layer-ice').checked;
  const sunX = horizonX(evaluation.dayIndex, 'sun', width);
  const earthX = horizonX(evaluation.dayIndex, 'earth', width);
  const sunBase = ridgeY(sunX, width, height);
  const earthBase = ridgeY(earthX, width, height);
  const scale = height * (compact ? .10 : .12);
  const sunY = sunBase - (evaluation.sunDeg - evaluation.sunMask) * scale;
  const earthY = earthBase - evaluation.earthDeg * scale;

  // The ridge is a visual mask, not measured terrain. Every visibility result
  // comes from model.ts and stays unchanged when a drawing layer is toggled.
  if (showLight && evaluation.sunVisible) {
    const light = ctx.createRadialGradient(sunX, sunBase, 1, sunX, sunBase, width * .38);
    light.addColorStop(0, 'rgba(255,189,92,.29)'); light.addColorStop(1, 'rgba(255,189,92,0)');
    ctx.fillStyle = light; ctx.fillRect(0, 0, width, height);
  }
  if (showLight && evaluation.sunVisible) drawBody(ctx, sunX, sunY, compact ? 8 : 17, '#ffd17e', '#df821f');
  if (showEarth && evaluation.earthVisible) drawBody(ctx, earthX, earthY, compact ? 5 : 10, '#b8d5ff', '#6c90e5');

  ctx.beginPath(); ctx.moveTo(0, height);
  for (let x = 0; x <= width + 3; x += 3) ctx.lineTo(x, ridgeY(x, width, height));
  ctx.lineTo(width, height); ctx.closePath();
  const ground = ctx.createLinearGradient(0, height * .66, 0, height);
  ground.addColorStop(0, '#717987'); ground.addColorStop(.28, '#373f4e'); ground.addColorStop(1, '#111827');
  ctx.fillStyle = ground; ctx.fill();
  if (showLight && evaluation.sunVisible) {
    ctx.save();
    ctx.clip();
    const reflection = ctx.createRadialGradient(sunX, sunBase, 1, sunX, sunBase, width * .30);
    reflection.addColorStop(0, 'rgba(255,196,108,.47)');
    reflection.addColorStop(1, 'rgba(255,196,108,0)');
    ctx.fillStyle = reflection; ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
  ctx.strokeStyle = 'rgba(211,221,234,.55)'; ctx.lineWidth = compact ? 1 : 1.3; ctx.stroke();

  if (!compact) {
    const markerX = width * state.markerX;
    const markerY = ridgeY(markerX, width, height) - 8;
    ctx.fillStyle = '#bcf363'; ctx.shadowColor = '#bcf363'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.moveTo(markerX, markerY - 9); ctx.lineTo(markerX - 6, markerY);
    ctx.lineTo(markerX, markerY + 6); ctx.lineTo(markerX + 6, markerY); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    if (showIce) {
      const trap = nearestColdTrap(state.site);
      // A fixed crater shifts along this schematic horizon only when the
      // observer changes location. Time alone never moves the terrain.
      const iceX = bearingX(trap.bearingDeg, width);
      const iceY = ridgeY(iceX, width, height) + 13;
      ctx.fillStyle = '#61e7dc'; ctx.beginPath(); ctx.arc(iceX, iceY, 4, 0, 2 * Math.PI); ctx.fill();
      ctx.font = '12px system-ui'; ctx.fillText(`ice ${fmt(trap.distanceKm)} km away`, iceX + 9, iceY + 4);
    }
    ctx.textBaseline = 'top'; ctx.font = '600 13px system-ui';
    ctx.fillStyle = '#ffd38e'; ctx.fillText(`Sun ${fmt(evaluation.sunDeg - evaluation.sunMask)}°`, 18, 18);
    ctx.fillStyle = '#b9d1ff'; ctx.textAlign = 'right';
    ctx.fillText(`Earth ${fmt(evaluation.earthDeg)}°`, width - 18, 18);
    ctx.textAlign = 'left';
  }
}

function drawAllHorizons(): void {
  drawHorizon($('main-horizon') as HTMLCanvasElement, state.evaluation);
  drawHorizon($('now-horizon') as HTMLCanvasElement, state.evaluation, true);
  drawHorizon($('later-horizon') as HTMLCanvasElement, state.later, true);
}

function renderSites(): void {
  const list = $('site-list'); list.replaceChildren();
  const recommendation = recommendPreset(state.date, state.dayOffset);
  for (const site of SITES) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'place-button';
    button.classList.toggle('active', site.id === state.site.id);
    button.classList.toggle('best', site.id === recommendation?.site.id);
    button.setAttribute('aria-pressed', site.id === state.site.id ? 'true' : 'false');
    const text = document.createElement('span');
    const name = document.createElement('strong'); name.className = 'place-name'; name.textContent = site.name;
    const distance = document.createElement('small'); distance.className = 'place-distance';
    distance.textContent = `${fmt(nearestColdTrap(site).distanceKm)} km to ice`;
    text.append(name, distance); button.append(text);
    if (site.id === recommendation?.site.id) {
      const badge = document.createElement('span');
      badge.className = 'best-site-badge';
      badge.textContent = '★ Best';
      badge.title = 'Best balance for the selected time';
      button.append(badge);
    }
    button.addEventListener('click', () => {
      state.site = site; state.suggestion = null; state.markerX = .5; render();
    });
    list.append(button);
  }
  const summary = $('best-site-summary');
  summary.replaceChildren();
  summary.classList.toggle('unavailable', recommendation === null);
  const heading = document.createElement('strong');
  const detail = document.createElement('span');
  if (recommendation) {
    heading.textContent = `${recommendation.site.name} · ${fmt(recommendation.score)} points`;
    detail.textContent = 'Sunlight and Earth link now · 75% Survival + 25% Science.';
  } else {
    heading.textContent = 'No viable site right now';
    detail.textContent = 'None of the four has both sunlight and a direct Earth link. Try another date.';
  }
  summary.append(heading, detail);
}

function renderTimers(): void {
  const e = state.evaluation;
  $('sun-timer').textContent = e.sunVisible
    ? (e.currentLightDays >= 29.5 ? 'Sun visible throughout this cycle' : `Sun sets in ${fmtDays(e.currentLightDays)}`)
    : (e.nextSunDays >= 29.5 ? 'Sun does not rise this cycle' : `Sun rises in ${fmtDays(e.nextSunDays)}`);
  $('earth-timer').textContent = e.earthVisible
    ? (e.currentCommDays >= 29.5 ? 'Earth visible throughout this cycle' : `Earth sets in ${fmtDays(e.currentCommDays)}`)
    : (e.nextEarthDays >= 29.5 ? 'Earth does not rise this cycle' : `Earth rises in ${fmtDays(e.nextEarthDays)}`);
}

function renderPassports(): void {
  const list = $('passport-list'); list.replaceChildren();
  const count = state.passports.length;
  $('passport-position').textContent = `${state.activePassportIndex === null ? 0 : state.activePassportIndex + 1} / ${count}`;
  $('passport-prev').disabled = count < 2;
  $('passport-next').disabled = count < 2;
  $('passport-clear').disabled = count === 0;
  if (!state.passports.length) {
    const empty = document.createElement('div'); empty.className = 'empty-passports';
    empty.textContent = 'Save a site and date to compare up to three options.';
    list.append(empty); return;
  }
  for (const [index, passport] of state.passports.entries()) {
    const site = passport.site;
    const e = evaluate(site, passport.date, passport.dayOffset);
    const card = document.createElement('article'); card.className = 'passport-card';
    card.classList.toggle('active', index === state.activePassportIndex);
    const open = document.createElement('button'); open.type = 'button'; open.className = 'passport-open';
    open.setAttribute('aria-pressed', index === state.activePassportIndex ? 'true' : 'false');
    open.setAttribute('aria-label', `Restore mission card for ${site.name}, ${fmtDate(passport.date)}, ${fmtCoord(site.lat, true)}, ${fmtCoord(site.lon, false)}`);
    const title = document.createElement('strong'); title.textContent = site.name;
    const subtitle = document.createElement('small'); subtitle.textContent = `${fmtDate(passport.date)} · day ${fmt(passport.dayOffset)}`;
    const coords = document.createElement('small'); coords.className = 'passport-coords';
    coords.textContent = `${fmtCoord(site.lat, true)} · ${fmtCoord(site.lon, false)}`;
    const metrics = document.createElement('div'); metrics.className = 'passport-metrics';
    for (const [label, value] of [
      ['Sunlight', `${fmt(e.light14Days)} days`],
      ['Earth link', `${fmt(e.comm14Days)} days`],
      ['Science', `${fmt(e.science)}/100`],
      ['Survival', `${e.survival}/100`],
    ]) {
      const line = document.createElement('span');
      const key = document.createElement('span'); key.textContent = label;
      const number = document.createElement('b'); number.textContent = value;
      line.append(key, number); metrics.append(line);
    }
    const number = document.createElement('em'); number.className = 'passport-number'; number.textContent = `0${index + 1}`;
    open.append(number, title, subtitle, coords, metrics);
    open.addEventListener('click', () => openPassport(index));
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'passport-delete';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Delete mission card for ${site.name}, ${fmtDate(passport.date)}`);
    remove.title = 'Delete this mission card';
    remove.addEventListener('click', () => deletePassport(index));
    card.append(open, remove);
    list.append(card);
  }
}

function openPassport(index: number): void {
  const passport = state.passports[index];
  if (!passport) return;
  state.site = { ...passport.site };
  state.date = passport.date;
  state.dayOffset = passport.dayOffset;
  state.markerX = passport.markerX;
  state.suggestion = null;
  state.activePassportIndex = index;
  render();
  showToast('Mission card restored.');
}

function flipPassport(direction: -1 | 1): void {
  const index = cyclePassportIndex(state.activePassportIndex, state.passports.length, direction);
  if (index !== null) openPassport(index);
}

function clearPassports(): void {
  if (!state.passports.length) return;
  try { localStorage.removeItem(STORAGE_KEY); }
  catch { showToast('The browser could not clear your mission cards.'); return; }
  state.passports = [];
  state.activePassportIndex = null;
  renderPassports();
  showToast('Mission cards cleared.');
}

function deletePassport(index: number): void {
  if (!state.passports[index]) return;
  const next = state.passports.filter((_, position) => position !== index);
  try {
    if (next.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  } catch { showToast('The browser could not delete this mission card.'); return; }
  state.passports = next;
  if (state.activePassportIndex === index) state.activePassportIndex = null;
  else if (state.activePassportIndex !== null && state.activePassportIndex > index)
    state.activePassportIndex--;
  renderPassports();
  showToast('Mission card deleted.');
}

function renameCustomSite(): void {
  if (state.site.teachingPreset) return;
  const name = ($('custom-name-input') as HTMLInputElement).value.trim();
  if (!name) { showToast('Enter a name for your custom site.'); return; }
  if (name.length > 48) { showToast('Use at most 48 characters for the name.'); return; }
  const next = state.passports.map(passport =>
    passport.site.id === state.site.id
      ? { ...passport, site: { ...passport.site, name } }
      : passport,
  );
  if (next.some((passport, index) => passport !== state.passports[index])) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
    catch { showToast('The browser could not save the new name.'); return; }
    state.passports = next;
  }
  state.site = { ...state.site, name };
  render();
  showToast('Custom site renamed.');
}

function savePassport(): void {
  const passport = capturePassport(state.site, state.date, state.dayOffset, state.markerX);
  const next = appendPassport(state.passports, passport);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
  catch {
    showToast('The browser could not save this mission card.');
    return;
  }
  state.passports = next;
  state.activePassportIndex = state.passports.length - 1;
  renderPassports();
  showToast('Mission card saved in this browser.');
}

function loadPassports(): void {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    state.passports = decodePassports(raw);
  } catch { state.passports = []; }
}

function stopPulse(): void {
  if (!audioContext) return;
  const now = audioContext.currentTime;
  if (pulseGain) pulseGain.gain.setValueAtTime(0, now);
  try { pulseOscillator?.stop(now); } catch { /* It may already have stopped. */ }
  pulseOscillator = null; pulseGain = null;
}

function playPulse(): void {
  if (!audioContext || !state.soundOn || !state.evaluation.earthVisible) return;
  stopPulse();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = 'sine'; oscillator.frequency.value = 660;
  gain.gain.setValueAtTime(.018, audioContext.currentTime);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + .075);
  oscillator.onended = () => {
    if (pulseOscillator === oscillator) { pulseOscillator = null; pulseGain = null; }
    oscillator.disconnect(); gain.disconnect();
  };
  pulseOscillator = oscillator; pulseGain = gain;
}

function syncSound(): void {
  if (!audioContext || !powerGain) return;
  powerGain.gain.setValueAtTime(state.soundOn && state.evaluation.sunVisible ? .012 : 0, audioContext.currentTime);
  if (!state.soundOn || !state.evaluation.earthVisible) {
    if (pulseTimer !== null) window.clearInterval(pulseTimer);
    pulseTimer = null; stopPulse(); return;
  }
  if (pulseTimer === null) {
    playPulse();
    pulseTimer = window.setInterval(playPulse, 1850);
  }
}

async function toggleSound(): Promise<void> {
  if (!state.soundOn) {
    try {
      if (!audioContext) {
        audioContext = new AudioContext();
        powerOscillator = audioContext.createOscillator();
        powerGain = audioContext.createGain();
        powerOscillator.type = 'sine'; powerOscillator.frequency.value = 105;
        powerGain.gain.value = 0;
        powerOscillator.connect(powerGain).connect(audioContext.destination);
        powerOscillator.start();
      }
      await audioContext.resume();
      state.soundOn = true;
    } catch {
      showToast('Sound is unavailable in this browser.'); return;
    }
  } else {
    state.soundOn = false;
  }
  const label = $('sound-toggle').querySelector('.sound-label');
  if (label) label.textContent = state.soundOn ? 'Sound on' : 'Sound off';
  $('sound-toggle').setAttribute('aria-pressed', state.soundOn ? 'true' : 'false');
  syncSound();
}

function render(): void {
  if (state.activePassportIndex !== null) {
    const active = state.passports[state.activePassportIndex];
    if (!active || !matchesPassport(active, state.site, state.date, state.dayOffset, state.markerX))
      state.activePassportIndex = null;
  }
  state.evaluation = evaluate(state.site, state.date, state.dayOffset);
  state.later = evaluate(state.site, state.date, state.dayOffset + 14);
  const e = state.evaluation;
  $('selected-name').textContent = state.site.name;
  const customControls = $('custom-name-controls') as HTMLElement;
  const customNameInput = $('custom-name-input') as HTMLInputElement;
  customControls.hidden = state.site.teachingPreset;
  if (!state.site.teachingPreset) {
    if (document.activeElement !== customNameInput || customNameInput.dataset.siteId !== state.site.id)
      customNameInput.value = state.site.name;
    customNameInput.dataset.siteId = state.site.id;
  }
  $('current-coords').textContent = `${fmtCoord(state.site.lat, true)} · ${fmtCoord(state.site.lon, false)}`;
  $('lat-input').value = state.site.lat.toFixed(5);
  $('lon-input').value = state.site.lon.toFixed(5);
  $('landing-date').value = state.date;
  $('day-slider').value = String(state.dayOffset);
  $('day-label').textContent = `${fmt(state.dayOffset, 2)} / ${fmt(LUNAR_DAY, 2)} days`;
  $('sun-label').textContent = `Sun ${fmt(e.sunDeg - e.sunMask)}°`;
  $('earth-label').textContent = `Earth ${fmt(e.earthDeg)}°`;
  $('science-value').textContent = fmt(e.science);
  $('survival-value').textContent = `${e.survival}`;
  $('battery-value').textContent = `${e.battery}%`;
  $('science-fill').style.width = `${e.science}%`;
  $('survival-fill').style.width = `${e.survival}%`;
  $('battery-fill').style.width = `${e.battery}%`;
  $('now-light').textContent = `${fmtDays(e.currentLightDays)} of sunlight`;
  $('later-light').textContent = `${fmtDays(state.later.currentLightDays)} of sunlight`;
  $('now-comm').textContent = fmtDays(e.currentCommDays);
  $('later-comm').textContent = fmtDays(state.later.currentCommDays);
  $('comm-shift').textContent = `Earth link ${fmtDays(e.currentCommDays)} → ${fmtDays(state.later.currentCommDays)}`;
  $('verdict').textContent = state.suggestion
    ? `This site is in shadow on the new date. A point ${fmt(state.suggestion.distanceKm)} km along the same ridge has better survival conditions (${e.survival} → ${state.suggestion.evaluation.survival}).`
    : e.verdict;
  const suggestionButton = $('suggestion-action');
  suggestionButton.hidden = !state.suggestion;
  $('main-horizon').setAttribute('aria-valuenow', state.site.lon.toFixed(2));
  $('main-horizon').setAttribute('aria-valuetext', `Longitude ${fmtCoord(state.site.lon, false)}`);
  renderTimers(); renderSites(); renderPassports(); drawAllHorizons(); syncSound();
}

function setSiteFromInputs(): void {
  const lat = Number($('lat-input').value);
  const lon = Number($('lon-input').value);
  const name = state.site.teachingPreset ? 'Custom point' : state.site.name;
  const site = resolveSite(lat, lon, name);
  if (!site) {
    const error = 'Latitude must be between −90° and −80°; longitude must be between −180° and 180°.';
    $('coord-error').textContent = error;
    showToast(error);
    return;
  }
  $('coord-error').textContent = '';
  state.site = site; state.suggestion = null; state.markerX = .5; render();
}

function delayStart(): void {
  state.date = addDays(state.date, 14);
  state.dayOffset = 0;
  const after = evaluate(state.site, state.date, 0);
  state.suggestion = after.sunVisible ? null : suggestNearby(state.site, state.date, 0);
  render();
  if (!after.sunVisible && !state.suggestion) {
    $('verdict').textContent = 'This site is in shadow on the new date. The model found no better point nearby on the same ridge.';
  }
}

function installDrag(): void {
  const canvas = $('main-horizon') as HTMLCanvasElement;
  let dragging = false;
  let startX = 0;
  let startLon = 0;
  let startMarker = .5;
  canvas.addEventListener('pointerdown', event => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const markerY = ridgeY(rect.width * state.markerX, rect.width, rect.height);
    if (Math.abs(x - rect.width * state.markerX) > 38 || Math.abs(y - markerY) > 50) return;
    dragging = true; startX = event.clientX; startLon = state.site.lon; startMarker = state.markerX;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!dragging) return;
    const width = Math.max(1, canvas.getBoundingClientRect().width);
    const delta = (event.clientX - startX) / width;
    const lon = Math.max(-180, Math.min(180, startLon + delta * 5));
    const name = state.site.teachingPreset ? 'Custom point' : state.site.name;
    const site = resolveSite(state.site.lat, lon, name, false);
    if (!site) return;
    state.site = site; state.markerX = Math.max(.15, Math.min(.85, startMarker + delta));
    state.suggestion = null; render();
  });
  canvas.addEventListener('pointerup', () => { dragging = false; });
  canvas.addEventListener('pointercancel', () => { dragging = false; });
  canvas.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const step = event.key === 'ArrowRight' ? .2 : -.2;
    const name = state.site.teachingPreset ? 'Custom point' : state.site.name;
    const site = resolveSite(state.site.lat, Math.max(-180, Math.min(180, state.site.lon + step)), name, false);
    if (!site) return;
    state.site = site; state.markerX = Math.max(.15, Math.min(.85, state.markerX + step / 5));
    state.suggestion = null; render();
  });
}

function wireEvents(): void {
  $('coord-apply').addEventListener('click', setSiteFromInputs);
  $('custom-name-save').addEventListener('click', renameCustomSite);
  $('custom-name-input').addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Enter') renameCustomSite();
  });
  for (const id of ['lat-input', 'lon-input']) $(id).addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Enter') setSiteFromInputs();
  });
  $('landing-date').addEventListener('change', () => {
    const date = $('landing-date').value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { showToast('Choose a valid date.'); return; }
    state.date = date; state.suggestion = null; render();
  });
  $('day-slider').addEventListener('input', () => {
    state.dayOffset = Number($('day-slider').value); state.suggestion = null; render();
  });
  for (const id of ['layer-light', 'layer-earth', 'layer-ice']) $(id).addEventListener('change', drawAllHorizons);
  $('delay-start').addEventListener('click', delayStart);
  $('save-passport').addEventListener('click', savePassport);
  $('passport-prev').addEventListener('click', () => flipPassport(-1));
  $('passport-next').addEventListener('click', () => flipPassport(1));
  $('passport-clear').addEventListener('click', clearPassports);
  $('sound-toggle').addEventListener('click', toggleSound);
  $('suggestion-action').addEventListener('click', () => {
    if (!state.suggestion) return;
    state.site = state.suggestion.site; state.markerX = .58; state.suggestion = null; render();
  });
  window.addEventListener('resize', drawAllHorizons);
  installDrag();
}

function main(): void {
  $('day-slider').min = '0'; $('day-slider').max = '29.5'; $('day-slider').step = '.25';
  loadPassports(); wireEvents(); render();
}

main();
