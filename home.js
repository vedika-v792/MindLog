/* ============================================================
   MindLog — Home Page Logic (home.js)
   Handles: Chart.js rendering, stats, coach insight injection
   ============================================================ */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  renderHomeData();
});

// ──────────────────────────────────────────────────────────────
//  Main Orchestrator
// ──────────────────────────────────────────────────────────────
function renderHomeData() {
  const entries = getEntries(); // sorted newest first (from app.js)

  renderCoachInsight(entries);
  renderChart(entries);
  renderStats(entries);
  renderStreakInfo(entries);
}

// ──────────────────────────────────────────────────────────────
//  Coach Insight Panel
// ──────────────────────────────────────────────────────────────
function renderCoachInsight(entries) {
  const textEl = document.getElementById('coach-insight-text');
  const dateEl = document.getElementById('coach-insight-date');
  if (!textEl) return;

  if (entries.length === 0) return; // keep default placeholder

  const latest = entries[0];
  if (latest.coachResponse) {
    textEl.textContent = `"${latest.coachResponse}"`;
    if (dateEl) dateEl.textContent = formatDate(latest.date);
  }
}

// ──────────────────────────────────────────────────────────────
//  Chart.js — 14-Day Line Chart
// ──────────────────────────────────────────────────────────────
function renderChart(entries) {
  const canvas = document.getElementById('progress-chart');
  const emptyEl = document.getElementById('chart-empty');
  const summaryEl = document.getElementById('chart-summary');
  if (!canvas) return;

  // Build a 14-day window of dates (today back 13 days)
  const labels = [];
  const moodData = [];
  const energyData = [];
  const today = new Date();

  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dayStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

    // Find entries logged on this calendar day
    const dayEntries = entries.filter(e => e.date.startsWith(dayStr));

    // Average mood/energy if multiple entries on same day
    const avgMood   = dayEntries.length ? Math.round(dayEntries.reduce((s,e)=>s+e.mood,0) / dayEntries.length) : null;
    const avgEnergy = dayEntries.length ? Math.round(dayEntries.reduce((s,e)=>s+e.energy,0) / dayEntries.length) : null;

    labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    moodData.push(avgMood);
    energyData.push(avgEnergy);
  }

  const hasAnyData = moodData.some(v => v !== null);

  if (!hasAnyData) {
    // Show empty state instead of empty chart
    if (emptyEl) {
      emptyEl.classList.remove('hidden');
      canvas.style.display = 'none';
    }
    if (summaryEl) summaryEl.textContent = 'Log your first check-in to start tracking your emotional pulse.';
    return;
  }

  // Chart styling constants
  const CHART_FONT = "'Hanken Grotesk', sans-serif";
  const INK       = '#000000';
  const GRAY      = '#747878';
  const LIGHT     = '#c4c7c7';

  const ctx = canvas.getContext('2d');

  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Mood',
          data: moodData,
          borderColor: INK,
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          pointBackgroundColor: INK,
          pointRadius: moodData.map(v => v !== null ? 3 : 0),
          pointHoverRadius: 5,
          tension: 0.4,
          spanGaps: true,
        },
        {
          label: 'Energy',
          data: energyData,
          borderColor: GRAY,
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderDash: [4, 3],
          pointBackgroundColor: GRAY,
          pointRadius: energyData.map(v => v !== null ? 3 : 0),
          pointHoverRadius: 5,
          tension: 0.4,
          spanGaps: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#fff',
          borderColor: '#c4c7c7',
          borderWidth: 1,
          titleColor: '#1b1c1c',
          bodyColor: '#5d5f5f',
          titleFont: { family: CHART_FONT, size: 12, weight: '600' },
          bodyFont:  { family: CHART_FONT, size: 12 },
          padding: 10,
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y !== null ? ctx.parsed.y + '/10' : '—'}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: '#f0eeee', drawBorder: false },
          ticks: {
            font: { family: CHART_FONT, size: 10 },
            color: GRAY,
            maxRotation: 0,
            maxTicksLimit: 7,
          },
          border: { display: false },
        },
        y: {
          min: 1,
          max: 10,
          grid: { color: '#f0eeee', drawBorder: false },
          ticks: {
            font: { family: CHART_FONT, size: 10 },
            color: GRAY,
            stepSize: 3,
            callback: v => v,
          },
          border: { display: false },
        },
      },
    },
  });

  // Chart summary text
  if (summaryEl) {
    const validMoods = moodData.filter(v => v !== null);
    const validEnergies = energyData.filter(v => v !== null);
    if (validMoods.length >= 2) {
      const firstMood = validMoods[0];
      const lastMood  = validMoods[validMoods.length - 1];
      const avgMood   = Math.round(validMoods.reduce((s,v)=>s+v,0)/validMoods.length);
      const avgEnergy = validEnergies.length ? Math.round(validEnergies.reduce((s,v)=>s+v,0)/validEnergies.length) : null;
      const trend = lastMood > firstMood ? '↑ trending up' : lastMood < firstMood ? '↓ trending down' : 'holding steady';
      summaryEl.textContent = `Mood ${trend} · Average mood ${avgMood}/10${avgEnergy ? ` · Average energy ${avgEnergy}/10` : ''} over this period.`;
    } else {
      summaryEl.textContent = `${validMoods.length} data point${validMoods.length !== 1 ? 's' : ''} logged. Keep going to see your patterns emerge.`;
    }
  }
}

// ──────────────────────────────────────────────────────────────
//  Stats Row
// ──────────────────────────────────────────────────────────────
function renderStats(entries) {
  const totalEl   = document.getElementById('stat-entries');
  const avgMoodEl = document.getElementById('stat-avg-mood');
  const streakEl  = document.getElementById('stat-streak');

  if (totalEl) totalEl.textContent = entries.length;

  if (avgMoodEl && entries.length > 0) {
    const avg = (entries.reduce((s, e) => s + e.mood, 0) / entries.length).toFixed(1);
    avgMoodEl.textContent = avg;
  }

  if (streakEl) {
    streakEl.textContent = calcStreak(entries);
  }
}

// ──────────────────────────────────────────────────────────────
//  Streak Banner
// ──────────────────────────────────────────────────────────────
function renderStreakInfo(entries) {
  const textEl = document.getElementById('streak-text');
  if (!textEl) return;

  if (entries.length === 0) {
    textEl.textContent = 'Start your first log today';
    return;
  }

  const streak = calcStreak(entries);
  const lastDate = formatDate(entries[0].date);
  if (streak > 1) {
    textEl.textContent = `${streak}-day streak · Last logged ${lastDate}`;
  } else {
    textEl.textContent = `Last logged ${lastDate}`;
  }
}

// ──────────────────────────────────────────────────────────────
//  Streak Calculator
// ──────────────────────────────────────────────────────────────
function calcStreak(entries) {
  if (!entries.length) return 0;

  // Get unique logged dates as YYYY-MM-DD strings, sorted newest first
  const uniqueDates = [...new Set(
    entries.map(e => e.date.slice(0, 10))
  )].sort((a, b) => b.localeCompare(a));

  const today = todayStr();
  let streak = 0;
  let current = today;

  for (const d of uniqueDates) {
    if (d === current) {
      streak++;
      // Move to previous calendar day
      const prev = new Date(current + 'T12:00:00');
      prev.setDate(prev.getDate() - 1);
      current = `${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,'0')}-${String(prev.getDate()).padStart(2,'0')}`;
    } else {
      break;
    }
  }

  return streak;
}
