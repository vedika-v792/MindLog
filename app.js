/* ============================================================
   MindLog — Shared Application Logic (app.js)
   Handles: localStorage CRUD, Groq API stub, nav helpers, toast
   ============================================================ */

'use strict';

// ──────────────────────────────────────────────────────────────
//  CONFIG — Drop your Groq API key here when ready
// ──────────────────────────────────────────────────────────────
const MINDLOG_CONFIG = {
  GROQ_MODEL:   'llama-3.3-70b-versatile',
  WORKER_URL:   'https://raspy-leaf-d3bf.vedivinod2006.workers.dev/', // replaces GROQ_API_URL
  STORAGE_KEY:  'mindlog_entries',
};
// ──────────────────────────────────────────────────────────────
//  localStorage Helpers
// ──────────────────────────────────────────────────────────────

/**
 * Returns all stored entries, sorted newest first.
 * @returns {Array<Object>}
 */
function getEntries() {
  try {
    const raw = localStorage.getItem(MINDLOG_CONFIG.STORAGE_KEY);
    const entries = raw ? JSON.parse(raw) : [];
    return entries.sort((a, b) => new Date(b.date) - new Date(a.date));
  } catch (e) {
    console.error('[MindLog] Error reading entries:', e);
    return [];
  }
}

/**
 * Saves a new entry. Appends to existing list.
 * @param {Object} entry
 */
function saveEntry(entry) {
  try {
    const existing = getEntries();
    existing.push(entry);
    localStorage.setItem(MINDLOG_CONFIG.STORAGE_KEY, JSON.stringify(existing));
  } catch (e) {
    console.error('[MindLog] Error saving entry:', e);
  }
}

/**
 * Generates a simple unique ID.
 * @returns {string}
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// ──────────────────────────────────────────────────────────────
//  Date Formatting
// ──────────────────────────────────────────────────────────────

/**
 * Returns a human-readable date string (e.g., "June 17, 2026")
 * @param {string} isoString
 * @returns {string}
 */
function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Returns short date label for chart X-axis (e.g., "Jun 17")
 * @param {string} isoString
 * @returns {string}
 */
function formatShortDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Returns today's date as YYYY-MM-DD local string
 * @returns {string}
 */
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ──────────────────────────────────────────────────────────────
//  Mode Helpers
// ──────────────────────────────────────────────────────────────

const MODE_META = {
  win:        { label: 'Win',        icon: 'verified',     emoji: '✅' },
  unsure:     { label: 'Unsure',     icon: 'help_outline', emoji: '❓' },
  struggling: { label: 'Struggling', icon: 'warning',      emoji: '😔' },
};

/**
 * Returns mode metadata object.
 * @param {string} mode
 * @returns {{label: string, icon: string, emoji: string}}
 */
function getModeInfo(mode) {
  return MODE_META[mode] || MODE_META['unsure'];
}

// ──────────────────────────────────────────────────────────────
//  Groq API / AI Coach
// ──────────────────────────────────────────────────────────────

/**
 * Builds the user message string sent to the AI from entry data + history.
 * @param {Object} entry   - current entry
 * @param {Array}  history - last 7 days of entries (excluding current)
 * @returns {string}
 */
function buildCoachPrompt(entry, history) {
  const historyStr = history.slice(0, 7).map(e =>
    `${formatDate(e.date)}: Mode=${e.mode}, Mood=${e.mood}/10, Energy=${e.energy}/10, Note="${e.note}"`
  ).join('\n');

  return (
    `Today's log:\n` +
    `Mode: ${entry.mode}, Mood: ${entry.mood}/10, Energy: ${entry.energy}/10.\n` +
    `Note: "${entry.note || 'No note added.'}"\n\n` +
    `Recent history (last 7 days):\n` +
    (historyStr || 'No previous entries yet.') + '\n\n' +
    `Based on this data, give me one specific insight and end with one short question or micro-action.`
  );
}

/**
 * Calls the Groq API and returns the coach response string.
 * Falls back to a realistic placeholder if no API key is set.
 *
 * @param {Object} entry   - the entry just saved
 * @param {Array}  history - past entries for context
 * @returns {Promise<string>}
 */
async function callGroqCoach(entry, history) {
  // ── LIVE CALL VIA WORKER (key lives server-side, not here) ───
  const systemPrompt = `You are a direct, honest AI mental health coach. Your role is to help users see patterns in their own emotional data that they cannot see themselves. You do NOT give generic wellness advice. You reference specific data from this user's log history but dont say it directly or obviously to the user. you just keep it in your mind while typing out the response. You speak in plain, warm language — not clinical, not fluffy. You are honest even when the truth is uncomfortable, but always with care. Your response is a few words maximum and should always be valid to their context. Be sharp and specific.You write statements. You dont ask the user anything`;

  try {
    const res = await fetch(MINDLOG_CONFIG.WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MINDLOG_CONFIG.GROQ_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: buildCoachPrompt(entry, history) },
        ],
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    if (!res.ok) throw new Error(`Worker error: ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || getPlaceholderResponse(entry, history);
  } catch (err) {
    console.error('[MindLog] Groq API call failed:', err);
    return getPlaceholderResponse(entry, history);
  }
}

/**
 * Returns a context-aware placeholder coach response based on mode + scores.
 * @param {Object} entry
 * @param {Array}  history
 * @returns {string}
 */
function getPlaceholderResponse(entry, history) {
  const hasHistory = history.length > 0;
  const avgMood = hasHistory
    ? Math.round(history.slice(0, 7).reduce((s, e) => s + e.mood, 0) / Math.min(history.length, 7))
    : null;

  const responses = {
    win: [
      `You logged a win today with mood at ${entry.mood}/10 — that's a real data point, not just a feeling. ${avgMood ? `Your recent average has been around ${avgMood}/10, so today you're tracking above baseline.` : 'This is your first entry, so you\'re building the baseline now.'} The fact that you noticed and named something you're proud of is the skill itself. What made today's win feel different from a typical day?`,
      `A mood of ${entry.mood}/10 paired with energy at ${entry.energy}/10 — that's a coherent state, not scattered. ${hasHistory ? 'Looking at your recent logs, wins tend to appear when your energy holds steady.' : 'Keep logging; the patterns will become visible quickly.'} The act of naming a win rewires how your brain scans for positive events. What's one thing you did today that you want to repeat tomorrow?`,
    ],
    unsure: [
      `You're unsure, but you still showed up — that distinction matters more than it feels like right now. With mood at ${entry.mood}/10, your system isn't in freefall; it's in a holding pattern. ${hasHistory ? `Your logs suggest these doubt periods tend to be short — usually 1-2 days.` : 'Uncertainty is actually a sign you\'re tracking reality accurately, not catastrophising.'} What would "slightly clearer" look like for you tomorrow — even just one thing?`,
      `An "unsure" log with energy at ${entry.energy}/10 often means your body knows something before your mind catches up. ${avgMood ? `Your average mood recently has been ${avgMood}/10, which means you have context — this probably isn\'t a trend shift, just a wobble.` : 'This is useful baseline data.'} Doubt at this stage of a growth journey is almost always signal, not noise. What's the smallest version of the thing you're unsure about that you could test tomorrow?`,
    ],
    struggling: [
      `A hard day logged is still a day accounted for — and that consistency is what the data will thank you for later. Energy at ${entry.energy}/10 tells me your system is running low, not broken. ${avgMood ? `Your baseline mood of ${avgMood}/10 shows this is a dip, not your new normal.` : 'Even without history, naming the struggle clearly is the first move toward it.'} What's one small thing — absurdly small — that you could protect for yourself tonight?`,
      `Struggling with mood at ${entry.mood}/10 — I hear that. ${hasHistory ? 'Your recent logs show you\'ve navigated dips before and come out with clearer entries afterward.' : 'Starting the log habit on a hard day actually tells me a lot about your commitment.'} The fact that you opened this app and logged today means part of you is still steering. What does your body need most in the next two hours?`,
    ],
  };

  const pool = responses[entry.mode] || responses['unsure'];
  return pool[Math.floor(Math.random() * pool.length)];
}

// ──────────────────────────────────────────────────────────────
//  Toast Notification
// ──────────────────────────────────────────────────────────────

/**
 * Shows a brief toast notification at the bottom of the screen.
 * @param {string} message
 * @param {number} [duration=2500] ms
 */
function showToast(message, duration = 2500) {
  let toast = document.getElementById('ml-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'ml-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

// ──────────────────────────────────────────────────────────────
//  Navigation Active State
// ──────────────────────────────────────────────────────────────

/**
 * Marks the correct bottom nav item as active based on current page filename.
 * Call this on DOMContentLoaded in each page's JS.
 */
function initNav() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  const map = {
    'index.html':  'nav-home',
    '':            'nav-home',
    'log.html':    'nav-log',
    'coach.html':  'nav-coach',
  };
  const activeId = map[page];
  if (activeId) {
    const el = document.getElementById(activeId);
    if (el) el.classList.add('active');
  }
}
