/* ============================================================
   MindLog — Log Page Logic (log.js)
   Handles: mode selection, slider updates, form save,
            AI coach call, localStorage write, redirect
   ============================================================ */

'use strict';

// ──────────────────────────────────────────────────────────────
//  State
// ──────────────────────────────────────────────────────────────
let selectedMode = 'win';

const MODE_DESCRIPTIONS = {
  win:        'Something you did today that you\'re proud of.',
  unsure:     'Something you\'re doing but not sure if it\'s working.',
  struggling: 'A hard day — naming it still counts.',
};

// ──────────────────────────────────────────────────────────────
//  Init
// ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initModePicker();
  initSliders();
  initNoteField();
  initSaveButton();
});

// ──────────────────────────────────────────────────────────────
//  Mode Picker
// ──────────────────────────────────────────────────────────────
function initModePicker() {
  const cards = document.querySelectorAll('.mode-card');
  cards.forEach(card => {
    card.addEventListener('click', () => selectMode(card));
  });
  // Ensure first card (win) starts with FILL 1
  const winIcon = document.getElementById('icon-win');
  if (winIcon) winIcon.style.fontVariationSettings = "'FILL' 1";
}

function selectMode(card) {
  const mode = card.dataset.mode;
  if (!mode) return;

  selectedMode = mode;

  // Reset all cards
  document.querySelectorAll('.mode-card').forEach(c => {
    c.classList.remove('active');
    c.setAttribute('aria-pressed', 'false');
    const icon = c.querySelector('.material-symbols-outlined');
    if (icon) icon.style.fontVariationSettings = "'FILL' 0";
  });

  // Activate selected
  card.classList.add('active');
  card.setAttribute('aria-pressed', 'true');
  const activeIcon = card.querySelector('.material-symbols-outlined');
  if (activeIcon) activeIcon.style.fontVariationSettings = "'FILL' 1";

  // Update description
  const descEl = document.getElementById('mode-description');
  if (descEl) {
    descEl.style.opacity = '0';
    setTimeout(() => {
      descEl.textContent = MODE_DESCRIPTIONS[mode] || '';
      descEl.style.opacity = '1';
    }, 150);
  }
}

// ──────────────────────────────────────────────────────────────
//  Sliders
// ──────────────────────────────────────────────────────────────
function initSliders() {
  const moodSlider   = document.getElementById('mood-slider');
  const energySlider = document.getElementById('energy-slider');

  if (moodSlider) {
    moodSlider.addEventListener('input', () => updateMood(moodSlider.value));
    updateMood(moodSlider.value);
  }

  if (energySlider) {
    energySlider.addEventListener('input', () => updateEnergy(energySlider.value));
    updateEnergy(energySlider.value);
  }
}

/** Maps 0–100 slider value to 1–10 score */
function sliderToScore(val) {
  return Math.round((parseInt(val, 10) / 100) * 9) + 1;
}

function updateMood(val) {
  const score = sliderToScore(val);
  const labelEl = document.getElementById('mood-label');
  const scoreEl = document.getElementById('mood-score-display');
  const slider  = document.getElementById('mood-slider');

  if (labelEl) labelEl.textContent = getMoodLabel(score);
  if (scoreEl) scoreEl.textContent = `${score} / 10`;
  if (slider)  slider.setAttribute('aria-valuenow', val);
}

function updateEnergy(val) {
  const score = sliderToScore(val);
  const labelEl = document.getElementById('energy-label');
  const scoreEl = document.getElementById('energy-score-display');
  const slider  = document.getElementById('energy-slider');

  if (labelEl) labelEl.textContent = getEnergyLabel(score);
  if (scoreEl) scoreEl.textContent = `${score} / 10`;
  if (slider)  slider.setAttribute('aria-valuenow', val);
}

function getMoodLabel(score) {
  if (score <= 2)  return 'Heavy';
  if (score <= 4)  return 'Quiet';
  if (score <= 6)  return 'Neutral';
  if (score <= 8)  return 'Bright';
  return 'Radiant';
}

function getEnergyLabel(score) {
  if (score <= 2)  return 'Drained';
  if (score <= 4)  return 'Languid';
  if (score <= 6)  return 'Steady';
  if (score <= 8)  return 'Active';
  return 'Electric';
}

// ──────────────────────────────────────────────────────────────
//  Note Field — Character Counter
// ──────────────────────────────────────────────────────────────
function initNoteField() {
  const input   = document.getElementById('quick-note');
  const counter = document.getElementById('note-char-count');
  if (!input || !counter) return;

  input.addEventListener('input', () => {
    const len = input.value.length;
    counter.textContent = `${len} / 280`;
    counter.style.color = len > 250 ? '#ba1a1a' : '';
  });
}

// ──────────────────────────────────────────────────────────────
//  Save Entry
// ──────────────────────────────────────────────────────────────
function initSaveButton() {
  const btn = document.getElementById('save-entry-btn');
  if (btn) btn.addEventListener('click', handleSave);
}

async function handleSave() {
  const moodSlider   = document.getElementById('mood-slider');
  const energySlider = document.getElementById('energy-slider');
  const noteInput    = document.getElementById('quick-note');
  const btn          = document.getElementById('save-entry-btn');
  const btnText      = document.getElementById('save-btn-text');

  const moodScore   = sliderToScore(moodSlider?.value   || 50);
  const energyScore = sliderToScore(energySlider?.value || 50);
  const note        = noteInput?.value?.trim() || '';

  // ── Build entry object ──
  const entry = {
    id:            generateId(),
    date:          new Date().toISOString(),
    mode:          selectedMode,
    mood:          moodScore,
    energy:        energyScore,
    note:          note,
    coachResponse: '', // will be filled below
  };

  // ── Loading state ──
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span><span id="save-btn-text">Getting your insight…</span>';
  }

  // ── Call AI Coach (async) ──
  try {
    const history        = getEntries(); // existing entries for context
    const coachResponse  = await callGroqCoach(entry, history);
    entry.coachResponse  = coachResponse;
  } catch (err) {
    console.error('[MindLog] Coach call failed:', err);
    entry.coachResponse = 'Your log has been saved. Keep going — the patterns will surface over time.';
  }

  // ── Save to localStorage ──
  saveEntry(entry);

  // ── Restore button & show toast ──
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<span id="save-btn-text">Entry Saved ✓</span>';
  }
  showToast('Entry saved · Opening your insight');

  // ── Redirect to coach page ──
  setTimeout(() => {
    window.location.href = 'coach.html';
  }, 900);
}
