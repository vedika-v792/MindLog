/* ============================================================
   MindLog — Coach Page Logic (coach.js)
   Handles: latest insight hero, history list with
            expand/collapse, empty states
   ============================================================ */

'use strict';

// ──────────────────────────────────────────────────────────────
//  Init
// ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const entries = getEntries(); // sorted newest first
  renderLatestInsight(entries);
  renderHistoryList(entries);
});

// ──────────────────────────────────────────────────────────────
//  Mode → display helpers
// ──────────────────────────────────────────────────────────────
function getModeIcon(mode) {
  const icons = { win: 'verified', unsure: 'help_outline', struggling: 'warning' };
  return icons[mode] || 'help_outline';
}

function getModeLabel(mode) {
  const labels = { win: 'Win', unsure: 'Unsure', struggling: 'Struggling' };
  return labels[mode] || 'Unsure';
}

/** Returns a set of contextual tag labels based on mode + mood/energy */
function getTags(entry) {
  const tags = [];
  if (entry.mode === 'win')        tags.push('Progress');
  if (entry.mode === 'unsure')     tags.push('Reflection');
  if (entry.mode === 'struggling') tags.push('Resilience');
  if (entry.mood   >= 7)           tags.push('High Mood');
  if (entry.energy >= 7)           tags.push('High Energy');
  if (entry.mood   <= 3)           tags.push('Low Mood');
  if (entry.energy <= 3)           tags.push('Low Energy');
  if (entry.note && entry.note.length > 10) tags.push('Journaled');
  return tags;
}

// ──────────────────────────────────────────────────────────────
//  Latest Insight Hero
// ──────────────────────────────────────────────────────────────
function renderLatestInsight(entries) {
  const emptyEl   = document.getElementById('latest-insight-empty');
  const cardEl    = document.getElementById('latest-insight-card');
  const headlineEl= document.getElementById('latest-insight-headline');

  if (!entries.length) {
    if (emptyEl)  emptyEl.classList.remove('hidden');
    if (cardEl)   cardEl.classList.add('hidden');
    return;
  }

  const latest = entries[0];

  if (emptyEl) emptyEl.classList.add('hidden');
  if (cardEl)  cardEl.classList.remove('hidden');

  // Headline
  if (headlineEl) {
    const modeLabel = getModeLabel(latest.mode);
    headlineEl.textContent = `Processing Your "${modeLabel}" Day`;
  }

  // Mode icon
  const iconEl = document.getElementById('latest-mode-icon');
  if (iconEl) {
    iconEl.textContent = getModeIcon(latest.mode);
    iconEl.style.fontVariationSettings = "'FILL' 1";
  }

  // Date
  const dateEl = document.getElementById('latest-date');
  if (dateEl) dateEl.textContent = formatDate(latest.date);

  // Mood + Energy scores
  const scoresEl = document.getElementById('latest-scores');
  if (scoresEl) scoresEl.textContent = `Mood ${latest.mood}/10 · Energy ${latest.energy}/10`;

  // Coach response
  const textEl = document.getElementById('latest-coach-text');
  if (textEl) textEl.textContent = latest.coachResponse || 'Your insight is being prepared…';

  // User's note
  const noteRow = document.getElementById('latest-note-row');
  const noteText = document.getElementById('latest-note-text');
  if (noteRow && noteText && latest.note) {
    noteRow.classList.remove('hidden');
    noteText.textContent = `"${latest.note}"`;
  } else if (noteRow) {
    noteRow.classList.add('hidden');
  }

  // Tags
  const tagsEl = document.getElementById('latest-tags');
  if (tagsEl) {
    const tags = getTags(latest);
    tagsEl.innerHTML = tags
      .map(t => `<span class="pill-tag">${t}</span>`)
      .join('');
  }
}

// ──────────────────────────────────────────────────────────────
//  History List
// ──────────────────────────────────────────────────────────────
function renderHistoryList(entries) {
  const listEl  = document.getElementById('history-list');
  const emptyEl = document.getElementById('history-empty');
  const countEl = document.getElementById('entry-count-label');

  if (!listEl) return;

  // The history list excludes the very latest entry (shown in hero)
  const historyEntries = entries.length > 1 ? entries.slice(1) : [];

  if (countEl) {
    countEl.textContent = entries.length
      ? `${entries.length} entr${entries.length !== 1 ? 'ies' : 'y'}`
      : '';
  }

  if (!historyEntries.length) {
    if (emptyEl) emptyEl.classList.remove('hidden');
    listEl.innerHTML = '';
    return;
  }

  if (emptyEl) emptyEl.classList.add('hidden');

  listEl.innerHTML = historyEntries.map((entry, idx) => {
    const modeIcon  = getModeIcon(entry.mode);
    const modeLabel = getModeLabel(entry.mode);
    const tags      = getTags(entry);
    const tagsPill  = tags.slice(0, 2).map(t => `<span class="pill-tag">${t}</span>`).join('');
    const notePreview = entry.note ? `"${entry.note.substring(0, 80)}${entry.note.length > 80 ? '…' : ''}"` : '';
    const coachPreview = entry.coachResponse
      ? entry.coachResponse.substring(0, 90) + (entry.coachResponse.length > 90 ? '…' : '')
      : 'No insight recorded.';

    return `
      <div
        class="history-item"
        data-index="${idx}"
        role="listitem"
        tabindex="0"
        aria-expanded="false"
        onclick="toggleHistoryItem(this)"
        onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleHistoryItem(this)}"
      >
        <!-- Summary row (always visible) -->
        <div class="flex justify-between items-start w-full gap-4">
          <div class="flex-1 min-w-0">
            <!-- Date + mode -->
            <div class="flex items-center gap-2 mb-1">
              <span class="material-symbols-outlined text-[16px] text-secondary" style="font-variation-settings:'FILL' 1;">${modeIcon}</span>
              <span class="font-label-sm text-label-sm text-secondary">${formatDate(entry.date)}</span>
            </div>
            <!-- Mood/energy scores -->
            <div class="font-body-lg text-body-lg text-ink-black mb-1">${modeLabel} day — ${entry.mood}/10 mood · ${entry.energy}/10 energy</div>
            <!-- Coach preview -->
            <p class="font-body-md text-body-md text-on-surface-variant leading-snug">${coachPreview}</p>
          </div>
          <!-- Chevron -->
          <span class="material-symbols-outlined text-outline chevron flex-shrink-0 mt-1">chevron_right</span>
        </div>

        <!-- Expanded detail panel -->
        <div class="detail-panel">
          <div class="pt-4 mt-4 border-t border-outline-variant flex flex-col gap-3">
            <!-- Full coach response -->
            <div>
              <p class="font-label-sm text-label-sm text-secondary uppercase tracking-widest mb-2">Coach Insight</p>
              <blockquote class="font-body-lg text-body-lg text-on-surface italic leading-relaxed border-l-2 border-outline-variant pl-4">
                ${entry.coachResponse || 'No insight recorded for this entry.'}
              </blockquote>
            </div>
            ${notePreview ? `
            <!-- User note -->
            <div>
              <p class="font-label-sm text-label-sm text-secondary uppercase tracking-widest mb-1">Your Reflection</p>
              <p class="font-body-md text-body-md text-on-surface-variant">${notePreview}</p>
            </div>` : ''}
            <!-- Tags -->
            ${tagsPill ? `<div class="flex flex-wrap gap-2">${tagsPill}</div>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ──────────────────────────────────────────────────────────────
//  Toggle history item expand / collapse
// ──────────────────────────────────────────────────────────────
function toggleHistoryItem(el) {
  const isExpanded = el.classList.toggle('expanded');
  el.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
}
