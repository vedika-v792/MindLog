/* ============================================================
   MindLog — Chat Page Logic (chat.js)
   Handles: tab switching, chat message rendering,
            Groq AI conversation with log history context,
            localStorage persistence of chat history
   ============================================================ */

'use strict';

// ──────────────────────────────────────────────────────────────
//  Constants
// ──────────────────────────────────────────────────────────────
const CHAT_STORAGE_KEY = 'mindlog_chat';

// System prompt for the chat — includes user log history dynamically
function buildChatSystemPrompt() {
  const entries = getEntries().slice(0, 10);
  const historyContext = entries.length
    ? entries.map(e =>
        `${formatDate(e.date)}: Mode=${e.mode}, Mood=${e.mood}/10, Energy=${e.energy}/10, Note="${e.note || 'none'}"`
      ).join('\n')
    : 'No log entries yet.';

  return `You are a direct, honest AI mental health coach. The user is talking to you in real time about their worries, doubts, and daily experiences.

You have access to their recent log history:
${historyContext}

Rules:
- Reference their actual data when relevant — don't give generic advice
- Be warm but direct — no fluff, no toxic positivity
- Keep responses concise: but dont make it such that it lacks understanding or meaning
- Ask one follow-up question at the end to keep them reflecting
- Never diagnose or suggest medication — you are a coach, not a therapist
- If they seem to be in crisis, gently suggest professional support`;
}

// ──────────────────────────────────────────────────────────────
//  Chat History (localStorage)
// ──────────────────────────────────────────────────────────────
function getChatHistory() {
  try {
    return JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || '[]');
  } catch { return []; }
}

function saveChatHistory(messages) {
  // Keep last 60 messages to avoid bloating storage
  const trimmed = messages.slice(-60);
  localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(trimmed));
}

function addMessageToHistory(role, content) {
  const history = getChatHistory();
  history.push({ role, content, timestamp: new Date().toISOString() });
  saveChatHistory(history);
  return history;
}

// ──────────────────────────────────────────────────────────────
//  Tab Switching
// ──────────────────────────────────────────────────────────────
function switchTab(tab) {
  const insightsPanel = document.getElementById('panel-insights');
  const chatPanel     = document.getElementById('panel-chat');
  const insightsTab   = document.getElementById('tab-insights');
  const chatTab       = document.getElementById('tab-chat');

  if (tab === 'chat') {
    insightsPanel.style.display  = 'none';
    chatPanel.style.display      = 'flex';
    insightsTab.classList.remove('active-tab');
    insightsTab.setAttribute('aria-selected', 'false');
    chatTab.classList.add('active-tab');
    chatTab.setAttribute('aria-selected', 'true');
    setTimeout(() => {
      document.getElementById('chat-input')?.focus();
      scrollToBottom();
    }, 50);
  } else {
    chatPanel.style.display      = 'none';
    insightsPanel.style.display  = '';
    chatTab.classList.remove('active-tab');
    chatTab.setAttribute('aria-selected', 'false');
    insightsTab.classList.add('active-tab');
    insightsTab.setAttribute('aria-selected', 'true');
  }
}


// ──────────────────────────────────────────────────────────────
//  Groq Connection Status
// ──────────────────────────────────────────────────────────────
function initGroqStatus() {
  const dot  = document.getElementById('groq-status-dot');
  const text = document.getElementById('groq-status-text');
  if (!dot || !text) return;

  const onLocalServer = window.location.protocol !== 'file:';
  const hasKey        = !!(MINDLOG_CONFIG.GROQ_API_KEY);

  if (onLocalServer && hasKey) {
    // 🟢 Live
    dot.style.background  = '#22c55e';
    dot.style.boxShadow   = '0 0 0 3px rgba(34,197,94,0.2)';
    text.textContent       = 'Groq AI · Live';
    text.style.color       = '#16a34a';
  } else if (!onLocalServer && hasKey) {
    // 🔴 Has key but on file://
    dot.style.background  = '#ef4444';
    text.textContent       = 'Offline — open via start-server.bat to use Groq AI';
    text.style.color       = '#dc2626';
  } else if (!hasKey) {
    // 🟡 No key set
    dot.style.background  = '#f59e0b';
    text.textContent       = 'No API key — add Groq key to app.js line 12';
    text.style.color       = '#d97706';
  }
}

// ──────────────────────────────────────────────────────────────
//  Render Chat on Load
// ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initGroqStatus();

  const history = getChatHistory();
  if (history.length > 0) {
    const welcome = document.getElementById('chat-welcome');
    if (welcome) welcome.style.display = 'none';
    history.forEach(msg => renderBubble(msg.role, msg.content, msg.timestamp, false));
    scrollToBottom();
  }
});

// ──────────────────────────────────────────────────────────────
//  Render a single bubble into the DOM
// ──────────────────────────────────────────────────────────────
function renderBubble(role, content, timestamp, animate = true) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  // Hide welcome screen as soon as first message appears
  const welcome = document.getElementById('chat-welcome');
  if (welcome) welcome.style.display = 'none';

  if (role === 'user') {
    // User bubble
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble-user';
    if (!animate) bubble.style.animation = 'none';
    bubble.textContent = content;
    container.appendChild(bubble);

    // Timestamp
    const ts = document.createElement('div');
    ts.className = 'chat-timestamp';
    ts.textContent = formatTime(timestamp);
    container.appendChild(ts);

  } else {
    // Coach wrapper (label + bubble)
    const wrapper = document.createElement('div');
    wrapper.className = 'flex flex-col';
    wrapper.style.alignItems = 'flex-start';

    const label = document.createElement('div');
    label.className = 'chat-coach-label';
    label.innerHTML = `<span class="material-symbols-outlined" style="font-size:13px;font-variation-settings:'FILL' 1;">psychology</span> AI Coach`;

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble-coach';
    if (!animate) bubble.style.animation = 'none';
    bubble.textContent = content;

    const ts = document.createElement('div');
    ts.className = 'chat-timestamp';
    ts.textContent = formatTime(timestamp);

    wrapper.appendChild(label);
    wrapper.appendChild(bubble);
    wrapper.appendChild(ts);
    container.appendChild(wrapper);
  }

  scrollToBottom();
}

// ──────────────────────────────────────────────────────────────
//  Send Message Flow
// ──────────────────────────────────────────────────────────────
async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send-btn');
  const text = input?.value?.trim();
  if (!text) return;

  // Clear input
  input.value = '';
  autoResizeTextarea(input);

  // Render user bubble + save
  const userTimestamp = new Date().toISOString();
  renderBubble('user', text, userTimestamp);
  addMessageToHistory('user', text);

  // Disable send while thinking
  if (sendBtn) sendBtn.disabled = true;

  // Show typing indicator
  showTyping(true);

  // Call AI
  try {
    const reply = await callGroqChat(text);
    showTyping(false);
    const coachTimestamp = new Date().toISOString();
    renderBubble('assistant', reply, coachTimestamp);
    addMessageToHistory('assistant', reply);
  } catch (err) {
    showTyping(false);
    const fallback = getChatFallback(text);
    const coachTimestamp = new Date().toISOString();
    renderBubble('assistant', fallback, coachTimestamp);
    addMessageToHistory('assistant', fallback);
  }

  if (sendBtn) sendBtn.disabled = false;
}

// Starter prompt chip handler
function sendStarterPrompt(btn) {
  const input = document.getElementById('chat-input');
  if (input) {
    input.value = btn.textContent;
    sendChatMessage();
  }
}

// ──────────────────────────────────────────────────────────────
//  Groq Chat API Call (multi-turn with history)
// ──────────────────────────────────────────────────────────────
async function callGroqChat(userMessage) {
  // Build message array: system + last 20 messages for context
  const stored = getChatHistory();
  const recent = stored.slice(-20);

  const messages = [
    { role: 'system', content: buildChatSystemPrompt() },
    ...recent.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
  ];

  const res = await fetch(MINDLOG_CONFIG.WORKER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MINDLOG_CONFIG.GROQ_MODEL,
      messages,
      max_tokens: 600,
      temperature: 0.75,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }

  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new Error('Empty response');
  return reply;
}

// ──────────────────────────────────────────────────────────────
//  Chat Fallback Responses (when API unavailable)
// ──────────────────────────────────────────────────────────────
function getChatFallback(userMessage) {
  const entries = getEntries();
  const lower = userMessage.toLowerCase().trim();

  // Helper: pick a random item from an array
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  // ── Identity / intro questions ──
  if (lower.match(/your name|who are you|what are you|what do you do|how do you work|are you (an )?ai/)) {
    return pick([
      `I'm your MindLog AI Coach — I read your log history and give you honest, specific feedback on what I actually see in your data. I'm not here to tell you you're doing great. I'm here to help you see what you can't see yourself. What's on your mind?`,
      `I'm an AI coach built into MindLog. I have access to your mood and energy logs, so I can spot patterns you might be missing. Think of me as a direct, data-aware thinking partner. What do you want to work through?`,
      `I'm your coach. I look at your log data and tell you what I actually notice — not what you want to hear. What's going on for you right now?`,
    ]);
  }

  // ── Greetings / small talk ──
  if (lower.match(/^(hi|hey|hello|sup|yo|good morning|good evening|huh|ok|okay|hmm|lol|what|hm)[\s!?.]*$/)) {
    return pick([
      `Hey. What's actually on your mind — not the surface thing, the thing underneath it?`,
      `Hi. I'm not here for small talk, but I am here if something's weighing on you. What's going on?`,
      `Hello. Something brought you here. What is it?`,
      `I'm here. What do you want to talk through?`,
    ]);
  }

  // ── Progress / habits working ──
  if (lower.match(/progress|working|helping|making a difference|worth it|doing anything|point/)) {
    return pick([
      entries.length > 0
        ? `Progress in mental health is almost always invisible in the short term. Your ${entries.length} log${entries.length > 1 ? 's' : ''} show you're showing up — that's the actual work, even when it doesn't feel like it. What would "progress" need to look like for you to believe it?`
        : `Progress in mental health rarely looks the way we expect. It's usually not a straight line — it's more like you suddenly realise you handled something better than you would have six months ago. What specifically makes you doubt it's working?`,
      `The fact that you're asking "is this working?" usually means something has shifted — otherwise you wouldn't care enough to question it. What did you expect to feel by now that you don't?`,
      `Most people quit right before the data starts to show something. The discomfort of not knowing if it's working is itself part of the process. What's one thing that's even slightly different compared to a month ago?`,
    ]);
  }

  // ── Consistency / habits ──
  if (lower.match(/consist|habit|keep|routine|every day|forget|stop|quit|giving up/)) {
    return pick([
      `Consistency breaks when the habit requires more willpower than you have on a bad day. The fix is almost always making the action smaller. What's the version of this habit you could do in under two minutes?`,
      `The consistency problem is almost never about discipline — it's about the habit requiring peak-you when average-you shows up. What does your worst day look like, and does your habit survive it?`,
      `You don't lose consistency because you're lazy. You lose it because the trigger is weak or the action is too big. Which one is it for you?`,
    ]);
  }

  // ── Anxiety / stress / overwhelm ──
  if (lower.match(/anxi|stress|overwhelm|panic|worry|nervous|scared|fear/)) {
    return pick([
      `Anxiety spikes when there's a gap between what we're trying to control and what we actually can. Before we go further — on a scale of 1 to 10, how intense is what you're feeling right now?`,
      `That kind of overwhelm usually means too many open loops — things you're tracking mentally that haven't been decided or actioned. What's the one thing that if you resolved it, would take the most weight off?`,
      `Stress at this level is often your nervous system saying "too much, too fast." What's the smallest thing you could take off your plate or postpone today?`,
    ]);
  }

  // ── Sadness / low mood ──
  if (lower.match(/sad|depress|low|down|empty|numb|hopeless|unmotivat|tired|exhaust/)) {
    return pick([
      `That kind of low deserves to be taken seriously, not managed. Has this been building gradually, or did something specific shift recently?`,
      `Feeling that way is real data, not weakness. When did you last feel even slightly different — even for an hour?`,
      `Low energy and low mood together usually mean one of a few things: sleep, connection, or something unresolved sitting in the background. Which of those feels most likely right now?`,
    ]);
  }

  // ── Anger / frustration ──
  if (lower.match(/angry|anger|frustrat|annoyed|irritat|mad|rage|upset/)) {
    return pick([
      `Anger is almost always a secondary emotion — something else is underneath it. What's the story you're telling yourself about what happened?`,
      `That frustration makes sense as a reaction. What's the thing that feels most unfair or out of your control right now?`,
      `Anger is useful information. What specifically triggered it — a person, a situation, or something you said to yourself?`,
    ]);
  }

  // ── Relationships ──
  if (lower.match(/friend|family|partner|relationship|people|someone|person|lonely|alone/)) {
    return pick([
      `Relationships are where most of our patterns show up most clearly. What's the dynamic you keep finding yourself in, even when you try to change it?`,
      `Loneliness and being alone are different things. Which one is this — too little connection, or the wrong kind?`,
      `What do you need from this person or situation that you're not getting? Be specific — not "support," but what support would actually look like.`,
    ]);
  }

  // ── Default — varied, never the same twice ──
  return pick([
    `That's worth sitting with. What's the part of this that bothers you the most — the feeling itself, or not knowing why you're feeling it?`,
    `Say more. What's underneath that?`,
    `That's a real thing to be carrying. How long has this been sitting with you?`,
    `I hear that. What would you want to be different — and what's actually in your control to change?`,
    `What does that feel like in your body right now — is it tension, heaviness, numbness, something else?`,
    `If a close friend told you they were feeling exactly this, what would you say to them?`,
  ]);

}


// ──────────────────────────────────────────────────────────────
//  UI Helpers
// ──────────────────────────────────────────────────────────────
function showTyping(show) {
  const indicator = document.getElementById('typing-indicator');
  if (!indicator) return;
  if (show) {
    indicator.classList.remove('hidden');
    scrollToBottom();
  } else {
    indicator.classList.add('hidden');
  }
}

function scrollToBottom() {
  const container = document.getElementById('chat-messages');
  if (container) {
    setTimeout(() => {
      container.scrollTop = container.scrollHeight;
    }, 50);
  }
}

function handleChatKey(event) {
  // Send on Enter (not Shift+Enter)
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendChatMessage();
  }
}

function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function formatTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}
