// Reading questions now come from src/learn/reading.js (CKLA-gated) and progress lives in src/learn/profile.js.
// This module only keeps the old import path working.
export { settings, saveSettings } from './learn/profile.js';
export { makeReadingQuestion as makeQuestion } from './learn/reading.js';
