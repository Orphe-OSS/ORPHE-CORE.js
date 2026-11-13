// store.js — settings, saved calibrations and the session history, all in localStorage.
// Nothing leaves the browser.

import { DEFAULT_RALLY_PACE } from './game.js';

const KEY_SETTINGS = 'orphe.pingpong.settings.v1';
const KEY_CALIB = 'orphe.pingpong.calibration.v1';
const KEY_HISTORY = 'orphe.pingpong.history.v1';
const HISTORY_MAX = 60;

export const PLAYER_NAMES = ['あか', 'あお'];

export const DEFAULT_SETTINGS = {
  mode: 'vs',            // vs | coop | solo
  points: 5,
  ballSpeed: 4,          // 1..10 (4 = the original example's default pace)
  ballSize: 3,           // 1..5
  rallyPace: DEFAULT_RALLY_PACE,   // 0..4, how fast a rally speeds up (game.js RALLY_PACES)
  items: true,
  guide: true,
  cpuLevel: 0,
  bgm: 'wafu',           // wafu | classic | off
  bgmVolume: 0.7,
  sfxVolume: 0.8,
  muted: false,
  record: false,         // save the raw sensor data of every match as CSV
  season: 'auto',        // auto | spring | summer | autumn | winter
  players: [
    { exercise: 'ankle', gain: 1.25, smooth: 0.4, invert: false, paddle: 3, assist: 1, character: 'daruma' },
    { exercise: 'ankle', gain: 1.25, smooth: 0.4, invert: false, paddle: 3, assist: 1, character: 'daruma' },
  ],
};

/** How strongly each "おたすけ" level pulls the paddle towards the ball. */
export const ASSIST_PULL = [0, 0.4, 0.75];

function read(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode or full: keep playing */ }
}

export function loadSettings() {
  const stored = read(KEY_SETTINGS);
  const saved = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  const out = { ...DEFAULT_SETTINGS, ...saved };
  // the first release had an on/off switch (`accel`) instead of the pace steps
  if (!Number.isFinite(saved.rallyPace)) out.rallyPace = saved.accel === false ? 0 : DEFAULT_RALLY_PACE;
  delete out.accel;
  // hand-edited or stale values must not reach array lookups
  if (![0, 1, 2].includes(out.cpuLevel)) out.cpuLevel = DEFAULT_SETTINGS.cpuLevel;
  out.players = [0, 1].map((i) => ({ ...DEFAULT_SETTINGS.players[i], ...((Array.isArray(saved.players) ? saved.players : [])[i] || {}) }));
  return out;
}
export function saveSettings(settings) { write(KEY_SETTINGS, settings); }

function calibrationMap() {
  const map = read(KEY_CALIB);
  return map && typeof map === 'object' && !Array.isArray(map) ? map : {};
}
export function loadCalibration(side) { return calibrationMap()[side] || null; }
export function saveCalibration(side, calibration) {
  const all = calibrationMap();
  if (calibration) all[side] = { ...calibration, at: Date.now() }; else delete all[side];
  write(KEY_CALIB, all);
}

function historyList() {
  const list = read(KEY_HISTORY);
  return Array.isArray(list) ? list.filter((h) => h && typeof h === 'object' && h.scores && typeof h.scores === 'object' && Number.isFinite(h.total)) : [];
}
/** Past sessions of one player slot and exercise, oldest first. */
export function loadHistory(side, exercise) {
  return historyList().filter((h) => h.side === side && h.exercise === exercise);
}
export function addHistory(entry) {
  const all = historyList();
  all.push(entry);
  write(KEY_HISTORY, all.slice(-HISTORY_MAX));
}
export function clearHistory() { write(KEY_HISTORY, []); }
