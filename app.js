(() => {
  'use strict';

  const STORAGE_KEY = 'candace.s25.habits.v1';
  const NOTES_STORAGE_KEY = 'candace.s25.notes.v1';
  const CYCLE_STORAGE_KEY = 'candace.s25.cycle.v1';
  const THEME_KEY = 'candace.s25.theme.v1';
  const MODE_KEY = 'candace.s25.mode.v1';

  const CATEGORIES = ['Health', 'Focus', 'Mind', 'Craft', 'Home'];
  const CATEGORY_COLORS = {
    Health: 'var(--cat-health)',
    Focus: 'var(--cat-focus)',
    Mind: 'var(--cat-mind)',
    Craft: 'var(--cat-craft)',
    Home: 'var(--cat-home)',
  };

  const TIMES_OF_DAY = ['Morning', 'Afternoon', 'Evening', 'Anytime'];

  const FLOW_OPTIONS = [
    { id: 'spotting', label: 'Spotting', drops: 1, outline: true },
    { id: 'light', label: 'Light', drops: 1, outline: false },
    { id: 'medium', label: 'Medium', drops: 2, outline: false },
    { id: 'heavy', label: 'Heavy', drops: 3, outline: false },
  ];

  const PERIOD_FLOWS = new Set(['light', 'medium', 'heavy']);

  const BODY_SYMPTOMS = [
    'Cramps',
    'Headache',
    'Bloating',
    'Backache',
    'Tenderness',
    'Fatigue',
    'Acne',
    'Nausea',
  ];

  const MOOD_OPTIONS = [
    'Calm',
    'Happy',
    'Sensitive',
    'Anxious',
    'Irritable',
    'Low energy',
    'Focused',
    'Motivated',
  ];

  const CARE_OPTIONS = [
    'Rested',
    'Hydrated',
    'Warm compress',
    'Light movement',
    'Cravings',
    'Poor sleep',
  ];

  /* ------------------------------------------------------------------------
     Date Helpers (Local timezone safe)
     ------------------------------------------------------------------------ */
  function toDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function parseDateKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function diffDays(keyA, keyB) {
    const a = parseDateKey(keyA);
    const b = parseDateKey(keyB);
    return Math.round((b - a) / 86400000);
  }

  function addDays(date, delta) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + delta);
  }

  function startOfToday() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function formatSheetDate(date) {
    const compact = window.innerWidth <= 480;
    const sameYear = date.getFullYear() === startOfToday().getFullYear();
    if (compact) {
      return date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        ...(sameYear ? {} : { year: 'numeric' }),
      });
    }
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function formatShortDate(dateKey) {
    const d = parseDateKey(dateKey);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function hapticTick(ms = 10) {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(ms);
      } catch {
        // Ignore vibration restrictions
      }
    }
  }

  /* ------------------------------------------------------------------------
     Persistence (Habits, Daily Notes, Cycle Logs)
     ------------------------------------------------------------------------ */
  function buildSampleHabits() {
    return [
      {
        id: 'hab_walk',
        name: 'Morning sunlight walk',
        note: '20 minutes outside before checking email',
        timeOfDay: 'Morning',
        category: 'Health',
        completions: [],
      },
      {
        id: 'hab_deepwork',
        name: 'Deep work block (90m)',
        note: 'Phone on Do Not Disturb, single prioritized task',
        timeOfDay: 'Morning',
        category: 'Focus',
        completions: [],
      },
      {
        id: 'hab_hydrate',
        name: 'Drink 2L of water',
        note: 'Refill carafe at desk before lunch',
        timeOfDay: 'Anytime',
        category: 'Health',
        completions: [],
      },
      {
        id: 'hab_craft',
        name: 'Ship one small project improvement',
        note: 'Keep daily momentum on a personal build',
        timeOfDay: 'Afternoon',
        category: 'Craft',
        completions: [],
      },
      {
        id: 'hab_reset',
        name: '10-minute kitchen & desk reset',
        note: 'Clear surfaces so tomorrow starts fresh',
        timeOfDay: 'Evening',
        category: 'Home',
        completions: [],
      },
      {
        id: 'hab_read',
        name: 'Read 15 pages',
        note: 'No screens during the last 30 minutes of the night',
        timeOfDay: 'Evening',
        category: 'Mind',
        completions: [],
      },
    ];
  }

  function defaultCycleData() {
    return {
      cycleLength: 28,
      periodLength: 5,
      logs: {},
    };
  }

  function normalizeHabit(item) {
    if (!item || typeof item.name !== 'string' || !item.name.trim()) return null;
    return {
      id: typeof item.id === 'string' && item.id ? item.id : `hab_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: item.name.trim().slice(0, 72),
      note: typeof item.note === 'string' ? item.note.trim().slice(0, 120) : '',
      timeOfDay: TIMES_OF_DAY.includes(item.timeOfDay) ? item.timeOfDay : 'Anytime',
      category: CATEGORIES.includes(item.category) ? item.category : 'Health',
      completions: Array.isArray(item.completions)
        ? Array.from(new Set(item.completions.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))))
        : [],
    };
  }

  function normalizeCycleData(raw) {
    const base = defaultCycleData();
    if (!raw || typeof raw !== 'object') return base;
    const cl = Number(raw.cycleLength);
    const pl = Number(raw.periodLength);
    base.cycleLength = Number.isFinite(cl) ? Math.min(45, Math.max(21, Math.round(cl))) : 28;
    base.periodLength = Number.isFinite(pl) ? Math.min(10, Math.max(2, Math.round(pl))) : 5;
    if (raw.logs && typeof raw.logs === 'object' && !Array.isArray(raw.logs)) {
      for (const [k, v] of Object.entries(raw.logs)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !v || typeof v !== 'object') continue;
        const entry = {
          flow: FLOW_OPTIONS.some((f) => f.id === v.flow) ? v.flow : null,
          symptoms: Array.isArray(v.symptoms) ? v.symptoms.filter((s) => typeof s === 'string') : [],
          moods: Array.isArray(v.moods) ? v.moods.filter((m) => typeof m === 'string') : [],
          care: Array.isArray(v.care) ? v.care.filter((c) => typeof c === 'string') : [],
          note: typeof v.note === 'string' ? v.note : '',
        };
        if (entry.flow || entry.symptoms.length || entry.moods.length || entry.care.length || entry.note.trim()) {
          base.logs[k] = entry;
        }
      }
    }
    return base;
  }

  function loadHabits() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const seeded = buildSampleHabits();
        saveHabits(seeded);
        return seeded;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return buildSampleHabits();
      return parsed.map(normalizeHabit).filter(Boolean);
    } catch {
      return buildSampleHabits();
    }
  }

  function saveHabits(habits) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
    } catch {
      // Ignore quota errors
    }
  }

  function loadNotes() {
    try {
      const raw = localStorage.getItem(NOTES_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveNotes(notes) {
    try {
      localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
    } catch {
      // Ignore quota errors
    }
  }

  function loadCycleData() {
    try {
      const raw = localStorage.getItem(CYCLE_STORAGE_KEY);
      if (!raw) return defaultCycleData();
      return normalizeCycleData(JSON.parse(raw));
    } catch {
      return defaultCycleData();
    }
  }

  function saveCycleData(data) {
    try {
      localStorage.setItem(CYCLE_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Ignore quota errors
    }
  }

  /* ------------------------------------------------------------------------
     Streak & Safe HTML Highlighting
     ------------------------------------------------------------------------ */
  function calculateStreakAsOf(completions, anchorDate) {
    if (!completions.length) return 0;
    const set = new Set(completions);
    const anchorKey = toDateKey(anchorDate);
    const prevKey = toDateKey(addDays(anchorDate, -1));

    let cursor = set.has(anchorKey) ? anchorDate : set.has(prevKey) ? addDays(anchorDate, -1) : null;
    if (!cursor) return 0;

    let streak = 0;
    while (set.has(toDateKey(cursor))) {
      streak += 1;
      cursor = addDays(cursor, -1);
    }
    return streak;
  }

  function escapeHtml(val) {
    return String(val)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function highlightText(text, query) {
    const safe = escapeHtml(text);
    const trimmed = query.trim();
    if (!trimmed) return safe;
    const escaped = escapeHtml(trimmed).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return safe.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
  }

  /* ------------------------------------------------------------------------
     Cycle Analytics & Prediction Engine (Clue / Euki Style)
     ------------------------------------------------------------------------ */
  function getPeriodEpisodes(cycleData) {
    const periodKeys = Object.entries(cycleData.logs)
      .filter(([, entry]) => entry && PERIOD_FLOWS.has(entry.flow))
      .map(([key]) => key)
      .sort();

    if (!periodKeys.length) return [];

    const episodes = [];
    let current = { startKey: periodKeys[0], endKey: periodKeys[0], days: [periodKeys[0]] };

    for (let i = 1; i < periodKeys.length; i += 1) {
      const k = periodKeys[i];
      if (diffDays(current.endKey, k) <= 2) {
        current.endKey = k;
        current.days.push(k);
      } else {
        episodes.push({
          ...current,
          length: diffDays(current.startKey, current.endKey) + 1,
        });
        current = { startKey: k, endKey: k, days: [k] };
      }
    }
    episodes.push({
      ...current,
      length: diffDays(current.startKey, current.endKey) + 1,
    });

    for (let i = 1; i < episodes.length; i += 1) {
      episodes[i - 1].cycleLengthAfter = diffDays(episodes[i - 1].startKey, episodes[i].startKey);
    }

    return episodes;
  }

  function computeObservedAverageCycle(episodes) {
    const intervals = episodes
      .map((ep) => ep.cycleLengthAfter)
      .filter((n) => typeof n === 'number' && n >= 18 && n <= 60);
    if (!intervals.length) return null;
    return Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);
  }

  function computeCyclePredictions(cycleData, episodes) {
    const predictedPeriodKeys = new Set();
    const fertileKeys = new Set();
    if (!episodes.length) {
      return { predictedPeriodKeys, fertileKeys, nextStartKey: null };
    }

    const latest = episodes[episodes.length - 1];
    const cl = cycleData.cycleLength;
    const pl = cycleData.periodLength;
    const latestStart = parseDateKey(latest.startKey);

    // Current cycle's estimated fertile window
    const ovOffset = Math.max(8, cl - 14);
    for (let o = ovOffset - 4; o <= ovOffset + 1; o += 1) {
      fertileKeys.add(toDateKey(addDays(latestStart, o)));
    }

    // Project next 4 future cycles for calendar browsing
    let nextStartKey = null;
    for (let cycleIdx = 1; cycleIdx <= 4; cycleIdx += 1) {
      const projStart = addDays(latestStart, cl * cycleIdx);
      if (cycleIdx === 1) nextStartKey = toDateKey(projStart);

      for (let p = 0; p < pl; p += 1) {
        predictedPeriodKeys.add(toDateKey(addDays(projStart, p)));
      }
      for (let o = ovOffset - 4; o <= ovOffset + 1; o += 1) {
        fertileKeys.add(toDateKey(addDays(projStart, o)));
      }
    }

    return { predictedPeriodKeys, fertileKeys, nextStartKey };
  }

  function describeCycleStatus(cycleData, episodes, activeKey, nextStartKey) {
    if (!episodes.length) {
      return {
        dayNum: '—',
        phaseTitle: 'No period logged yet',
        phaseSub: 'Tap Light, Medium, or Heavy below to start',
        nextPill: '',
      };
    }

    const cl = cycleData.cycleLength;
    const pl = cycleData.periodLength;
    const ovDay = Math.max(9, cl - 14 + 1);
    const activeEntry = cycleData.logs[activeKey];
    const isLoggedBleeding = activeEntry && PERIOD_FLOWS.has(activeEntry.flow);

    // Find most recent period start on or before activeKey
    let anchorEp = null;
    for (let i = episodes.length - 1; i >= 0; i -= 1) {
      if (episodes[i].startKey <= activeKey) {
        anchorEp = episodes[i];
        break;
      }
    }

    let nextPill = '';
    if (nextStartKey) {
      const daysUntil = diffDays(activeKey, nextStartKey);
      if (daysUntil > 0) nextPill = `Next in ${daysUntil}d`;
      else if (daysUntil === 0) nextPill = 'Expected today';
      else if (!isLoggedBleeding && Math.abs(daysUntil) <= 14) nextPill = `${Math.abs(daysUntil)}d late`;
    }

    if (!anchorEp) {
      const firstStart = episodes[0].startKey;
      const before = diffDays(activeKey, firstStart);
      return {
        dayNum: '—',
        phaseTitle: 'Before first logged cycle',
        phaseSub: `First logged period starts ${formatShortDate(firstStart)} (${before}d later)`,
        nextPill: '',
      };
    }

    const cycleDay = diffDays(anchorEp.startKey, activeKey) + 1;
    let phaseTitle = 'Follicular phase';
    let phaseSub = `Cycle started ${formatShortDate(anchorEp.startKey)}`;

    if (isLoggedBleeding || cycleDay <= pl) {
      phaseTitle = 'Period';
      phaseSub = isLoggedBleeding
        ? `Logged ${activeEntry.flow} flow · Day ${cycleDay} of cycle`
        : `Cycle started ${formatShortDate(anchorEp.startKey)}`;
    } else if (cycleDay >= ovDay - 4 && cycleDay <= ovDay + 1) {
      phaseTitle = cycleDay === ovDay ? 'Estimated ovulation' : 'Fertile window';
      phaseSub = `Around cycle day ${ovDay} · Next est. ${nextStartKey ? formatShortDate(nextStartKey) : '—'}`;
    } else if (cycleDay > ovDay + 1 && cycleDay <= cl) {
      phaseTitle = 'Luteal phase';
      phaseSub = nextStartKey ? `Next period estimated ${formatShortDate(nextStartKey)}` : phaseSub;
    } else if (cycleDay > cl) {
      phaseTitle = 'Late / Extended cycle';
      phaseSub = `Cycle day ${cycleDay} · Typical length ${cl}d`;
    }

    return {
      dayNum: String(cycleDay),
      phaseTitle,
      phaseSub,
      nextPill,
    };
  }

  /* ------------------------------------------------------------------------
     App State & DOM
     ------------------------------------------------------------------------ */
  const todayInit = startOfToday();

  const state = {
    mode: 'habits', // 'habits' | 'cycle'
    baseTheme: 'light', // 'light' | 'dark'
    habits: loadHabits(),
    notesByDate: loadNotes(),
    cycle: loadCycleData(),
    activeDate: todayInit,
    cycleDate: todayInit,
    calYear: todayInit.getFullYear(),
    calMonth: todayInit.getMonth(),
    search: '',
    status: 'all',
    timeOfDay: 'all',
    category: 'all',
    sort: 'sheet',
    deletedBuffer: null,
    toastTimer: null,
    noteStatusTimer: null,
    cycleNoteTimer: null,
    deferredInstallPrompt: null,
  };

  const els = {
    themeMeta: document.getElementById('theme-color-meta'),
    cycleModeBtn: document.getElementById('cycle-mode-btn'),
    heartIcon: document.getElementById('heart-icon'),
    themeToggle: document.getElementById('theme-toggle'),
    themeIcon: document.getElementById('theme-icon'),
    addBtn: document.getElementById('add-habit-btn'),
    installBanner: document.getElementById('android-install-banner'),
    installBtn: document.getElementById('install-app-btn'),
    dismissInstallBtn: document.getElementById('dismiss-install-btn'),
    habitSheet: document.getElementById('habit-sheet'),
    cycleSheet: document.getElementById('cycle-sheet'),
    // Habit sheet elements
    prevDayBtn: document.getElementById('prev-day-btn'),
    nextDayBtn: document.getElementById('next-day-btn'),
    sheetDateHeading: document.getElementById('sheet-date-heading'),
    todayBadge: document.getElementById('today-badge'),
    jumpTodayBtn: document.getElementById('jump-today-btn'),
    summaryCompleted: document.getElementById('summary-completed'),
    summaryPct: document.getElementById('summary-pct'),
    summaryStreak: document.getElementById('summary-streak'),
    progressBar: document.getElementById('progress-bar'),
    progressFill: document.getElementById('progress-fill'),
    dailyNotes: document.getElementById('daily-notes'),
    notesStatus: document.getElementById('notes-status'),
    searchInput: document.getElementById('search-input'),
    searchKbd: document.getElementById('search-kbd'),
    searchClear: document.getElementById('search-clear'),
    timeFilter: document.getElementById('time-filter'),
    sortSelect: document.getElementById('sort-select'),
    statusFilter: document.getElementById('status-filter'),
    categoryPills: document.getElementById('category-pills'),
    resultsSummary: document.getElementById('results-summary'),
    resetFiltersBtn: document.getElementById('reset-filters-btn'),
    sheetRows: document.getElementById('sheet-rows'),
    // Cycle tracker elements
    cycleMasthead: document.getElementById('cycle-masthead'),
    cyclePrevDay: document.getElementById('cycle-prev-day'),
    cycleNextDay: document.getElementById('cycle-next-day'),
    cycleDateHeading: document.getElementById('cycle-date-heading'),
    cycleTodayBadge: document.getElementById('cycle-today-badge'),
    cycleJumpToday: document.getElementById('cycle-jump-today'),
    cycleDayNum: document.getElementById('cycle-day-num'),
    cyclePhaseTitle: document.getElementById('cycle-phase-title'),
    cyclePhaseSub: document.getElementById('cycle-phase-sub'),
    cycleNextPill: document.getElementById('cycle-next-pill'),
    calPrevMonth: document.getElementById('cal-prev-month'),
    calNextMonth: document.getElementById('cal-next-month'),
    calMonthTitle: document.getElementById('cal-month-title'),
    calGrid: document.getElementById('cal-grid'),
    cycleFlowGrid: document.getElementById('cycle-flow-grid'),
    cycleFlowStatus: document.getElementById('cycle-flow-status'),
    cycleSymptomsChips: document.getElementById('cycle-symptoms-chips'),
    cycleSymptomsCount: document.getElementById('cycle-symptoms-count'),
    cycleMoodsChips: document.getElementById('cycle-moods-chips'),
    cycleMoodsCount: document.getElementById('cycle-moods-count'),
    cycleCareChips: document.getElementById('cycle-care-chips'),
    cycleCareCount: document.getElementById('cycle-care-count'),
    cycleNotes: document.getElementById('cycle-notes'),
    cycleNotesStatus: document.getElementById('cycle-notes-status'),
    settingCycleLen: document.getElementById('setting-cycle-len'),
    settingPeriodLen: document.getElementById('setting-period-len'),
    cycleAvgReadout: document.getElementById('cycle-avg-readout'),
    cycleHistoryList: document.getElementById('cycle-history-list'),
    // Footer, Modal, Toast
    exportBtn: document.getElementById('export-btn'),
    importBtn: document.getElementById('import-btn'),
    importFile: document.getElementById('import-file'),
    resetDemoBtn: document.getElementById('reset-demo-btn'),
    modal: document.getElementById('habit-modal'),
    modalTitle: document.getElementById('modal-title'),
    modalClose: document.getElementById('modal-close'),
    modalCancel: document.getElementById('modal-cancel'),
    habitForm: document.getElementById('habit-form'),
    habitIdInput: document.getElementById('habit-id'),
    habitNameInput: document.getElementById('habit-name'),
    habitNoteInput: document.getElementById('habit-note'),
    habitTimeInput: document.getElementById('habit-time'),
    habitCategoryInput: document.getElementById('habit-category'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toast-message'),
    toastAction: document.getElementById('toast-action'),
  };

  /* ------------------------------------------------------------------------
     Mode & Theme Management (Light / Dark / Pink Period Mode)
     ------------------------------------------------------------------------ */
  function updateThemeVisuals() {
    const isCycle = state.mode === 'cycle';
    const activeTheme = isCycle ? 'pink' : state.baseTheme;
    document.documentElement.setAttribute('data-theme', activeTheme);

    if (els.themeMeta) {
      els.themeMeta.setAttribute(
        'content',
        activeTheme === 'pink' ? '#fdf0f5' : activeTheme === 'dark' ? '#000000' : '#f4f1ea'
      );
    }

    els.cycleModeBtn.classList.toggle('active', isCycle);
    els.cycleModeBtn.setAttribute('aria-pressed', String(isCycle));
    els.heartIcon.setAttribute('fill', isCycle ? 'currentColor' : 'none');

    els.habitSheet.hidden = isCycle;
    els.cycleSheet.hidden = !isCycle;
    els.addBtn.style.display = isCycle ? 'none' : 'inline-flex';
    els.resetDemoBtn.textContent = isCycle ? 'Reset cycle logs' : 'Reset sample sheet';

    els.themeIcon.innerHTML =
      state.baseTheme === 'dark' && !isCycle
        ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>'
        : '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>';
  }

  function setMode(nextMode) {
    state.mode = nextMode === 'cycle' ? 'cycle' : 'habits';
    try {
      localStorage.setItem(MODE_KEY, state.mode);
    } catch {
      // ignore
    }
    updateThemeVisuals();
    if (state.mode === 'cycle') renderCycle();
    else renderHabits();
  }

  function initThemeAndMode() {
    let savedTheme = null;
    let savedMode = null;
    try {
      savedTheme = localStorage.getItem(THEME_KEY);
      savedMode = localStorage.getItem(MODE_KEY);
    } catch {
      // ignore
    }
    if (savedTheme === 'dark' || savedTheme === 'light') {
      state.baseTheme = savedTheme;
    } else {
      const dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      state.baseTheme = dark ? 'dark' : 'light';
    }
    state.mode = savedMode === 'cycle' ? 'cycle' : 'habits';
    updateThemeVisuals();
  }

  /* ------------------------------------------------------------------------
     Habit Filtering & Rendering
     ------------------------------------------------------------------------ */
  function hasActiveFilters() {
    return (
      state.search.trim() !== '' ||
      state.status !== 'all' ||
      state.timeOfDay !== 'all' ||
      state.category !== 'all'
    );
  }

  function getFilteredHabits(dateKey) {
    const query = state.search.trim().toLowerCase();

    const filtered = state.habits.filter((habit) => {
      const done = habit.completions.includes(dateKey);
      if (state.status === 'todo' && done) return false;
      if (state.status === 'done' && !done) return false;
      if (state.timeOfDay !== 'all' && habit.timeOfDay !== state.timeOfDay) return false;
      if (state.category !== 'all' && habit.category !== state.category) return false;
      if (query) {
        const hay = `${habit.name} ${habit.note} ${habit.timeOfDay} ${habit.category}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });

    const sorted = [...filtered];
    if (state.sort === 'todo-first') {
      sorted.sort((a, b) => Number(a.completions.includes(dateKey)) - Number(b.completions.includes(dateKey)));
    } else if (state.sort === 'time') {
      sorted.sort((a, b) => TIMES_OF_DAY.indexOf(a.timeOfDay) - TIMES_OF_DAY.indexOf(b.timeOfDay));
    } else if (state.sort === 'streak-desc') {
      sorted.sort(
        (a, b) =>
          calculateStreakAsOf(b.completions, state.activeDate) -
          calculateStreakAsOf(a.completions, state.activeDate)
      );
    } else if (state.sort === 'name-asc') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    }

    return sorted;
  }

  function renderCategoryPills() {
    const counts = { all: state.habits.length };
    for (const cat of CATEGORIES) counts[cat] = 0;
    for (const h of state.habits) counts[h.category] = (counts[h.category] || 0) + 1;

    els.categoryPills.innerHTML = [
      `<button type="button" class="pill-btn ${state.category === 'all' ? 'active' : ''}" data-category="all">
        All <span class="pill-count">${counts.all}</span>
      </button>`,
      ...CATEGORIES.map(
        (cat) => `<button type="button" class="pill-btn ${state.category === cat ? 'active' : ''}" data-category="${cat}">
          <span class="cat-dot" style="background:${CATEGORY_COLORS[cat]}"></span>
          ${cat} <span class="pill-count">${counts[cat]}</span>
        </button>`
      ),
    ].join('');
  }

  function syncDailyNotesField(activeKey) {
    const savedNote = state.notesByDate[activeKey] || '';
    if (els.dailyNotes.value !== savedNote) {
      els.dailyNotes.value = savedNote;
    }
    els.notesStatus.textContent = savedNote.trim() ? 'Saved for this day' : 'Saved per day';
    els.notesStatus.classList.remove('saved');
  }

  function renderHabits() {
    const today = startOfToday();
    const todayKey = toDateKey(today);
    const activeKey = toDateKey(state.activeDate);
    const isToday = activeKey === todayKey;

    els.sheetDateHeading.textContent = formatSheetDate(state.activeDate);
    els.todayBadge.style.display = isToday ? 'inline-block' : 'none';
    els.jumpTodayBtn.style.display = isToday ? 'none' : 'inline-block';
    els.nextDayBtn.disabled = isToday;

    syncDailyNotesField(activeKey);

    const total = state.habits.length;
    const doneCount = state.habits.filter((h) => h.completions.includes(activeKey)).length;
    const pct = total ? Math.round((doneCount / total) * 100) : 0;
    const bestStreak = total
      ? Math.max(...state.habits.map((h) => calculateStreakAsOf(h.completions, state.activeDate)))
      : 0;

    els.summaryCompleted.textContent = `${doneCount} / ${total}`;
    els.summaryPct.textContent = `${pct}%`;
    els.summaryStreak.textContent = `${bestStreak}d`;
    els.progressFill.style.width = `${pct}%`;
    els.progressBar.setAttribute('aria-valuenow', String(pct));

    renderCategoryPills();

    els.searchClear.classList.toggle('visible', state.search.length > 0);
    els.searchKbd.style.display = state.search.length > 0 ? 'none' : 'inline-block';

    const visible = getFilteredHabits(activeKey);
    const filtered = hasActiveFilters();
    els.resultsSummary.textContent = filtered
      ? `Showing ${visible.length} of ${total} daily ${total === 1 ? 'habit' : 'habits'}`
      : `${total} daily ${total === 1 ? 'habit' : 'habits'} on this sheet`;
    els.resetFiltersBtn.classList.toggle('hidden', !filtered);

    if (visible.length === 0) {
      els.sheetRows.innerHTML =
        total === 0
          ? `<div class="empty-sheet">
              <p class="empty-title">Your daily sheet is blank</p>
              <p class="empty-desc">Tap New Habit above to add your first daily habit.</p>
            </div>`
          : `<div class="empty-sheet">
              <p class="empty-title">No matching daily habits</p>
              <p class="empty-desc">Try a different search term or reset your active filters.</p>
              <button type="button" class="btn btn-ghost" data-action="clear-filters">Clear all filters</button>
            </div>`;
      return;
    }

    const query = state.search;
    els.sheetRows.innerHTML = visible
      .map((habit) => {
        const isDone = habit.completions.includes(activeKey);
        const streak = calculateStreakAsOf(habit.completions, state.activeDate);
        const catColor = CATEGORY_COLORS[habit.category] || 'var(--accent)';

        return `<div class="sheet-row ${isDone ? 'is-done' : ''}" data-habit-id="${escapeHtml(habit.id)}">
          <div class="check-cell">
            <button
              type="button"
              class="check-btn ${isDone ? 'checked' : ''}"
              data-action="toggle"
              data-id="${escapeHtml(habit.id)}"
              aria-label="Mark ${escapeHtml(habit.name)} ${isDone ? 'incomplete' : 'complete'}"
              aria-pressed="${isDone}"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </button>
          </div>

          <div class="habit-cell">
            <p class="habit-name">${highlightText(habit.name, query)}</p>
            ${habit.note ? `<p class="habit-note">${highlightText(habit.note, query)}</p>` : ''}
          </div>

          <div class="time-tag">${highlightText(habit.timeOfDay, query)}</div>

          <div class="cat-tag">
            <span class="cat-dot" style="background:${catColor}"></span>
            <span>${highlightText(habit.category, query)}</span>
          </div>

          <div class="streak-cell">
            <span class="streak-pill ${streak >= 1 ? 'hot' : ''}" title="Consecutive daily streak">${streak}d</span>
          </div>

          <div class="row-actions">
            <button type="button" class="row-action-btn" data-action="edit" data-id="${escapeHtml(habit.id)}" title="Edit habit" aria-label="Edit ${escapeHtml(habit.name)}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </button>
            <button type="button" class="row-action-btn delete" data-action="delete" data-id="${escapeHtml(habit.id)}" title="Delete habit" aria-label="Delete ${escapeHtml(habit.name)}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18" />
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              </svg>
            </button>
          </div>
        </div>`;
      })
      .join('');
  }

  /* ------------------------------------------------------------------------
     Cycle Tracker Rendering (Euki & Clue Style)
     ------------------------------------------------------------------------ */
  function getCycleEntry(dateKey) {
    const existing = state.cycle.logs[dateKey];
    if (existing) return existing;
    return { flow: null, symptoms: [], moods: [], care: [], note: '' };
  }

  function mutateCycleEntry(dateKey, mutator) {
    const entry = {
      flow: null,
      symptoms: [],
      moods: [],
      care: [],
      note: '',
      ...(state.cycle.logs[dateKey] || {}),
    };
    entry.symptoms = [...entry.symptoms];
    entry.moods = [...entry.moods];
    entry.care = [...entry.care];

    mutator(entry);

    const hasAny =
      Boolean(entry.flow) ||
      entry.symptoms.length > 0 ||
      entry.moods.length > 0 ||
      entry.care.length > 0 ||
      entry.note.trim().length > 0;

    if (hasAny) {
      state.cycle.logs[dateKey] = entry;
    } else {
      delete state.cycle.logs[dateKey];
    }
    saveCycleData(state.cycle);
  }

  function renderDroplets(count, outline) {
    const dropSvg = outline
      ? '<svg width="12" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>'
      : '<svg width="12" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>';
    return Array.from({ length: count }, () => dropSvg).join('');
  }

  function renderCycleCalendar(todayKey, activeKey, predictions) {
    const firstOfMonth = new Date(state.calYear, state.calMonth, 1);
    els.calMonthTitle.textContent = firstOfMonth.toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    });

    // Monday-first grid offset (0 = Mon ... 6 = Sun)
    const startOffset = (firstOfMonth.getDay() + 6) % 7;
    const gridStart = addDays(firstOfMonth, -startOffset);

    const cells = [];
    for (let i = 0; i < 42; i += 1) {
      const d = addDays(gridStart, i);
      const key = toDateKey(d);
      const outside = d.getMonth() !== state.calMonth;
      const entry = state.cycle.logs[key];
      const flowClass = entry && entry.flow ? `flow-${entry.flow}` : '';
      const isPredicted = predictions.predictedPeriodKeys.has(key);
      const isFertile = predictions.fertileKeys.has(key);
      const hasLoggedExtras =
        entry &&
        (entry.symptoms.length > 0 || entry.moods.length > 0 || entry.care.length > 0 || entry.note.trim().length > 0);

      const classes = [
        'cal-day',
        outside ? 'is-outside' : '',
        key === todayKey ? 'is-today' : '',
        key === activeKey ? 'is-selected' : '',
        flowClass,
        isPredicted ? 'is-predicted' : '',
        isFertile ? 'is-fertile' : '',
      ]
        .filter(Boolean)
        .join(' ');

      const dotsHtml =
        hasLoggedExtras || (isFertile && !flowClass)
          ? `<span class="cal-dots">
              ${hasLoggedExtras ? '<span class="cal-dot-sym"></span>' : ''}
              ${isFertile && !flowClass ? '<span class="cal-dot-fertile"></span>' : ''}
            </span>`
          : '';

      cells.push(
        `<button type="button" class="${classes}" data-cal-date="${key}" aria-label="${d.toDateString()}">
          <span>${d.getDate()}</span>
          ${dotsHtml}
        </button>`
      );
    }

    els.calGrid.innerHTML = cells.join('');
  }

  function renderCycle() {
    const today = startOfToday();
    const todayKey = toDateKey(today);
    const activeKey = toDateKey(state.cycleDate);
    const isToday = activeKey === todayKey;

    els.cycleDateHeading.textContent = formatSheetDate(state.cycleDate);
    els.cycleTodayBadge.style.display = isToday ? 'inline-block' : 'none';
    els.cycleJumpToday.style.display = isToday ? 'none' : 'inline-block';

    const episodes = getPeriodEpisodes(state.cycle);
    const predictions = computeCyclePredictions(state.cycle, episodes);
    const status = describeCycleStatus(state.cycle, episodes, activeKey, predictions.nextStartKey);

    els.cycleDayNum.textContent = status.dayNum;
    els.cyclePhaseTitle.textContent = status.phaseTitle;
    els.cyclePhaseSub.textContent = status.phaseSub;
    if (status.nextPill) {
      els.cycleNextPill.textContent = status.nextPill;
      els.cycleNextPill.style.display = 'inline-block';
    } else {
      els.cycleNextPill.style.display = 'none';
    }

    renderCycleCalendar(todayKey, activeKey, predictions);

    const entry = getCycleEntry(activeKey);

    // Flow buttons
    els.cycleFlowStatus.textContent = entry.flow
      ? `Logged: ${FLOW_OPTIONS.find((f) => f.id === entry.flow)?.label || ''}`
      : 'Tap to log';
    els.cycleFlowGrid.innerHTML = FLOW_OPTIONS.map((opt) => {
      const active = entry.flow === opt.id;
      return `<button type="button" class="flow-btn ${active ? 'active' : ''}" data-flow="${opt.id}" aria-pressed="${active}">
        <span class="flow-drops" aria-hidden="true">${renderDroplets(opt.drops, opt.outline)}</span>
        <span>${opt.label}</span>
      </button>`;
    }).join('');

    // Symptom, Mood & Care chip groups
    const renderChips = (container, countEl, options, selectedList, groupName) => {
      countEl.textContent = selectedList.length ? `${selectedList.length} selected` : '';
      container.innerHTML = options
        .map((label) => {
          const active = selectedList.includes(label);
          return `<button type="button" class="track-chip ${active ? 'active' : ''}" data-chip-group="${groupName}" data-chip-val="${escapeHtml(label)}" aria-pressed="${active}">
            ${escapeHtml(label)}
          </button>`;
        })
        .join('');
    };

    renderChips(els.cycleSymptomsChips, els.cycleSymptomsCount, BODY_SYMPTOMS, entry.symptoms, 'symptoms');
    renderChips(els.cycleMoodsChips, els.cycleMoodsCount, MOOD_OPTIONS, entry.moods, 'moods');
    renderChips(els.cycleCareChips, els.cycleCareCount, CARE_OPTIONS, entry.care, 'care');

    // Cycle notes
    if (els.cycleNotes.value !== entry.note) {
      els.cycleNotes.value = entry.note;
    }
    els.cycleNotesStatus.textContent = entry.note.trim() ? 'Saved for this day' : 'Saved privately on device';
    els.cycleNotesStatus.classList.remove('saved');

    // Settings & History
    els.settingCycleLen.textContent = `${state.cycle.cycleLength}d`;
    els.settingPeriodLen.textContent = `${state.cycle.periodLength}d`;

    const avgObserved = computeObservedAverageCycle(episodes);
    els.cycleAvgReadout.textContent = avgObserved ? `Observed avg: ${avgObserved}d` : '';

    if (!episodes.length) {
      els.cycleHistoryList.innerHTML =
        '<p class="cycle-empty-history">Your past periods will appear here once you log your first flow day.</p>';
    } else {
      const recent = [...episodes].reverse().slice(0, 6);
      els.cycleHistoryList.innerHTML = recent
        .map((ep) => {
          const rangeText =
            ep.startKey === ep.endKey
              ? formatShortDate(ep.startKey)
              : `${formatShortDate(ep.startKey)} – ${formatShortDate(ep.endKey)}`;
          const cycleMeta = ep.cycleLengthAfter ? `${ep.length}d flow · ${ep.cycleLengthAfter}d cycle` : `${ep.length}d flow`;
          return `<div class="history-row">
            <span class="history-dates">${escapeHtml(rangeText)}</span>
            <span class="history-meta">${escapeHtml(cycleMeta)}</span>
          </div>`;
        })
        .join('');
    }
  }

  /* ------------------------------------------------------------------------
     Habit Mutations
     ------------------------------------------------------------------------ */
  function toggleHabit(habitId) {
    const habit = state.habits.find((h) => h.id === habitId);
    if (!habit) return;
    const key = toDateKey(state.activeDate);
    const idx = habit.completions.indexOf(key);
    if (idx >= 0) habit.completions.splice(idx, 1);
    else habit.completions.push(key);
    hapticTick(12);
    saveHabits(state.habits);
    renderHabits();
  }

  function deleteHabit(habitId) {
    const index = state.habits.findIndex((h) => h.id === habitId);
    if (index === -1) return;
    const [removed] = state.habits.splice(index, 1);
    state.deletedBuffer = { habit: removed, index };
    saveHabits(state.habits);
    renderHabits();
    showToast(`Removed "${removed.name}"`, true);
  }

  function undoDelete() {
    if (!state.deletedBuffer) return;
    const { habit, index } = state.deletedBuffer;
    state.habits.splice(Math.min(index, state.habits.length), 0, habit);
    state.deletedBuffer = null;
    saveHabits(state.habits);
    hideToast();
    renderHabits();
  }

  function clearAllFilters() {
    state.search = '';
    state.status = 'all';
    state.timeOfDay = 'all';
    state.category = 'all';
    els.searchInput.value = '';
    els.timeFilter.value = 'all';
    els.statusFilter.querySelectorAll('.seg-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.status === 'all');
    });
    renderHabits();
  }

  /* ------------------------------------------------------------------------
     Modal & Toast
     ------------------------------------------------------------------------ */
  function openModal(habit = null) {
    if (habit) {
      els.modalTitle.textContent = 'Edit Daily Habit';
      els.habitIdInput.value = habit.id;
      els.habitNameInput.value = habit.name;
      els.habitNoteInput.value = habit.note;
      els.habitTimeInput.value = habit.timeOfDay;
      els.habitCategoryInput.value = habit.category;
    } else {
      els.modalTitle.textContent = 'New Daily Habit';
      els.habitIdInput.value = '';
      els.habitForm.reset();
      if (state.timeOfDay !== 'all') els.habitTimeInput.value = state.timeOfDay;
      if (state.category !== 'all') els.habitCategoryInput.value = state.category;
    }
    els.modal.classList.add('open');
    requestAnimationFrame(() => els.habitNameInput.focus());
  }

  function closeModal() {
    els.modal.classList.remove('open');
  }

  function showToast(message, withUndo = false) {
    clearTimeout(state.toastTimer);
    els.toastMessage.textContent = message;
    els.toastAction.style.display = withUndo ? 'inline-block' : 'none';
    els.toast.classList.add('show');
    state.toastTimer = setTimeout(hideToast, 4500);
  }

  function hideToast() {
    clearTimeout(state.toastTimer);
    els.toast.classList.remove('show');
  }

  /* ------------------------------------------------------------------------
     Android Native WebAPK Install Flow
     ------------------------------------------------------------------------ */
  function initAndroidInstallPrompt() {
    if (!els.installBanner || !els.installBtn || !els.dismissInstallBtn) return;

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      state.deferredInstallPrompt = e;
      let dismissed = false;
      try {
        dismissed = localStorage.getItem('candace.s25.installDismissed.v1') === '1';
      } catch {
        // ignore
      }
      if (!dismissed) els.installBanner.hidden = false;
    });

    els.installBtn.addEventListener('click', async () => {
      if (!state.deferredInstallPrompt) return;
      state.deferredInstallPrompt.prompt();
      try {
        await state.deferredInstallPrompt.userChoice;
      } catch {
        // ignore
      }
      state.deferredInstallPrompt = null;
      els.installBanner.hidden = true;
    });

    els.dismissInstallBtn.addEventListener('click', () => {
      els.installBanner.hidden = true;
      try {
        localStorage.setItem('candace.s25.installDismissed.v1', '1');
      } catch {
        // ignore
      }
    });

    window.addEventListener('appinstalled', () => {
      els.installBanner.hidden = true;
      state.deferredInstallPrompt = null;
      showToast('Candace installed for offline use');
    });
  }

  /* ------------------------------------------------------------------------
     Swipe Helper
     ------------------------------------------------------------------------ */
  function attachHorizontalSwipe(el, onSwipeRight, onSwipeLeft) {
    if (!el) return;
    let startX = null;
    let startY = null;
    el.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length !== 1) return;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
      },
      { passive: true }
    );
    el.addEventListener(
      'touchend',
      (e) => {
        if (startX === null || e.changedTouches.length !== 1) return;
        const dx = e.changedTouches[0].clientX - startX;
        const dy = e.changedTouches[0].clientY - startY;
        startX = null;
        startY = null;
        if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
        if (dx > 0) onSwipeRight();
        else onSwipeLeft();
      },
      { passive: true }
    );
  }

  /* ------------------------------------------------------------------------
     Event Wiring — Top Bar (Heart Button & Theme Toggle)
     ------------------------------------------------------------------------ */
  els.cycleModeBtn.addEventListener('click', () => {
    hapticTick(12);
    setMode(state.mode === 'cycle' ? 'habits' : 'cycle');
  });

  els.themeToggle.addEventListener('click', () => {
    hapticTick(8);
    if (state.mode === 'cycle') {
      // Pressing dark/light button returns from pink cycle mode to dark/light habit mode
      state.baseTheme = state.baseTheme === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(THEME_KEY, state.baseTheme);
      } catch {
        // ignore
      }
      setMode('habits');
      return;
    }
    state.baseTheme = state.baseTheme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(THEME_KEY, state.baseTheme);
    } catch {
      // ignore
    }
    updateThemeVisuals();
  });

  /* ------------------------------------------------------------------------
     Event Wiring — Habit Sheet
     ------------------------------------------------------------------------ */
  els.prevDayBtn.addEventListener('click', () => {
    hapticTick(8);
    state.activeDate = addDays(state.activeDate, -1);
    renderHabits();
  });

  els.nextDayBtn.addEventListener('click', () => {
    const next = addDays(state.activeDate, 1);
    if (next <= startOfToday()) {
      hapticTick(8);
      state.activeDate = next;
      renderHabits();
    }
  });

  els.jumpTodayBtn.addEventListener('click', () => {
    hapticTick(8);
    state.activeDate = startOfToday();
    renderHabits();
  });

  attachHorizontalSwipe(
    els.habitSheet.querySelector('.sheet-masthead'),
    () => {
      hapticTick(8);
      state.activeDate = addDays(state.activeDate, -1);
      renderHabits();
    },
    () => {
      const next = addDays(state.activeDate, 1);
      if (next <= startOfToday()) {
        hapticTick(8);
        state.activeDate = next;
        renderHabits();
      }
    }
  );

  els.dailyNotes.addEventListener('input', (e) => {
    const activeKey = toDateKey(state.activeDate);
    const val = e.target.value;
    if (val.trim()) state.notesByDate[activeKey] = val;
    else delete state.notesByDate[activeKey];
    saveNotes(state.notesByDate);
    els.notesStatus.textContent = 'Saved';
    els.notesStatus.classList.add('saved');
    clearTimeout(state.noteStatusTimer);
    state.noteStatusTimer = setTimeout(() => {
      els.notesStatus.textContent = val.trim() ? 'Saved for this day' : 'Saved per day';
      els.notesStatus.classList.remove('saved');
    }, 1200);
  });

  els.addBtn.addEventListener('click', () => openModal());
  els.modalClose.addEventListener('click', closeModal);
  els.modalCancel.addEventListener('click', closeModal);
  els.modal.addEventListener('click', (e) => {
    if (e.target === els.modal) closeModal();
  });

  els.habitForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = els.habitNameInput.value.trim();
    if (!name) return;

    const id = els.habitIdInput.value;
    const payload = {
      name: name.slice(0, 72),
      note: els.habitNoteInput.value.trim().slice(0, 120),
      timeOfDay: els.habitTimeInput.value,
      category: els.habitCategoryInput.value,
    };

    if (id) {
      const existing = state.habits.find((h) => h.id === id);
      if (existing) Object.assign(existing, payload);
    } else {
      state.habits.push({
        id: `hab_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        ...payload,
        completions: [],
      });
    }

    saveHabits(state.habits);
    closeModal();
    renderHabits();
  });

  els.searchInput.addEventListener('input', (e) => {
    state.search = e.target.value;
    renderHabits();
  });

  els.searchClear.addEventListener('click', () => {
    state.search = '';
    els.searchInput.value = '';
    els.searchInput.focus();
    renderHabits();
  });

  els.statusFilter.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (!btn) return;
    state.status = btn.dataset.status;
    els.statusFilter.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('active', b === btn));
    renderHabits();
  });

  els.categoryPills.addEventListener('click', (e) => {
    const btn = e.target.closest('.pill-btn');
    if (!btn) return;
    state.category = btn.dataset.category;
    renderHabits();
  });

  els.timeFilter.addEventListener('change', (e) => {
    state.timeOfDay = e.target.value;
    renderHabits();
  });

  els.sortSelect.addEventListener('change', (e) => {
    state.sort = e.target.value;
    renderHabits();
  });

  els.resetFiltersBtn.addEventListener('click', clearAllFilters);

  els.sheetRows.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    if (action === 'toggle') toggleHabit(id);
    else if (action === 'edit') {
      const habit = state.habits.find((h) => h.id === id);
      if (habit) openModal(habit);
    } else if (action === 'delete') deleteHabit(id);
    else if (action === 'clear-filters') clearAllFilters();
  });

  /* ------------------------------------------------------------------------
     Event Wiring — Cycle Period Tracker (Euki & Clue Style)
     ------------------------------------------------------------------------ */
  function setCycleDate(nextDate) {
    state.cycleDate = nextDate;
    state.calYear = nextDate.getFullYear();
    state.calMonth = nextDate.getMonth();
    renderCycle();
  }

  els.cyclePrevDay.addEventListener('click', () => {
    hapticTick(8);
    setCycleDate(addDays(state.cycleDate, -1));
  });

  els.cycleNextDay.addEventListener('click', () => {
    hapticTick(8);
    setCycleDate(addDays(state.cycleDate, 1));
  });

  els.cycleJumpToday.addEventListener('click', () => {
    hapticTick(8);
    setCycleDate(startOfToday());
  });

  attachHorizontalSwipe(
    els.cycleMasthead,
    () => {
      hapticTick(8);
      setCycleDate(addDays(state.cycleDate, -1));
    },
    () => {
      hapticTick(8);
      setCycleDate(addDays(state.cycleDate, 1));
    }
  );

  els.calPrevMonth.addEventListener('click', () => {
    hapticTick(6);
    const prev = new Date(state.calYear, state.calMonth - 1, 1);
    state.calYear = prev.getFullYear();
    state.calMonth = prev.getMonth();
    renderCycle();
  });

  els.calNextMonth.addEventListener('click', () => {
    hapticTick(6);
    const next = new Date(state.calYear, state.calMonth + 1, 1);
    state.calYear = next.getFullYear();
    state.calMonth = next.getMonth();
    renderCycle();
  });

  els.calGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cal-date]');
    if (!btn) return;
    hapticTick(8);
    setCycleDate(parseDateKey(btn.dataset.calDate));
  });

  els.cycleFlowGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-flow]');
    if (!btn) return;
    const flowId = btn.dataset.flow;
    const key = toDateKey(state.cycleDate);
    hapticTick(12);
    mutateCycleEntry(key, (entry) => {
      entry.flow = entry.flow === flowId ? null : flowId;
    });
    renderCycle();
  });

  els.cycleSheet.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-chip-group]');
    if (chip) {
      const group = chip.dataset.chipGroup;
      const val = chip.dataset.chipVal;
      const key = toDateKey(state.cycleDate);
      hapticTick(8);
      mutateCycleEntry(key, (entry) => {
        const list = entry[group];
        const idx = list.indexOf(val);
        if (idx >= 0) list.splice(idx, 1);
        else list.push(val);
      });
      renderCycle();
      return;
    }

    const stepper = e.target.closest('[data-cycle-step]');
    if (stepper) {
      const [field, deltaStr] = stepper.dataset.cycleStep.split(':');
      const delta = Number(deltaStr);
      hapticTick(6);
      if (field === 'cycle') {
        state.cycle.cycleLength = Math.min(45, Math.max(21, state.cycle.cycleLength + delta));
      } else if (field === 'period') {
        state.cycle.periodLength = Math.min(10, Math.max(2, state.cycle.periodLength + delta));
      }
      saveCycleData(state.cycle);
      renderCycle();
    }
  });

  els.cycleNotes.addEventListener('input', (e) => {
    const key = toDateKey(state.cycleDate);
    const val = e.target.value;
    mutateCycleEntry(key, (entry) => {
      entry.note = val;
    });
    els.cycleNotesStatus.textContent = 'Saved';
    els.cycleNotesStatus.classList.add('saved');
    clearTimeout(state.cycleNoteTimer);
    state.cycleNoteTimer = setTimeout(() => {
      els.cycleNotesStatus.textContent = val.trim() ? 'Saved for this day' : 'Saved privately on device';
      els.cycleNotesStatus.classList.remove('saved');
    }, 1200);
  });

  /* ------------------------------------------------------------------------
     Shared Utilities (Export / Import / Reset / Resize / Keyboard)
     ------------------------------------------------------------------------ */
  els.toastAction.addEventListener('click', undoDelete);

  els.exportBtn.addEventListener('click', () => {
    const payload = {
      habits: state.habits,
      notesByDate: state.notesByDate,
      cycle: state.cycle,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `candace-backup-${toDateKey(startOfToday())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported habits, notes & cycle data');
  });

  els.importBtn.addEventListener('click', () => els.importFile.click());
  els.importFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const rawHabits = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.habits) ? parsed.habits : null;
        if (rawHabits) {
          state.habits = rawHabits.map(normalizeHabit).filter(Boolean);
          saveHabits(state.habits);
        }
        if (parsed && parsed.notesByDate && typeof parsed.notesByDate === 'object' && !Array.isArray(parsed.notesByDate)) {
          state.notesByDate = parsed.notesByDate;
          saveNotes(state.notesByDate);
        }
        if (parsed && parsed.cycle && typeof parsed.cycle === 'object') {
          state.cycle = normalizeCycleData(parsed.cycle);
          saveCycleData(state.cycle);
        }
        clearAllFilters();
        renderCycle();
        showToast('Imported Candace backup');
      } catch {
        showToast('Could not import file — invalid JSON');
      } finally {
        els.importFile.value = '';
      }
    };
    reader.readAsText(file);
  });

  els.resetDemoBtn.addEventListener('click', () => {
    if (state.mode === 'cycle') {
      state.cycle = defaultCycleData();
      state.cycleDate = startOfToday();
      state.calYear = state.cycleDate.getFullYear();
      state.calMonth = state.cycleDate.getMonth();
      saveCycleData(state.cycle);
      renderCycle();
      showToast('Cleared all cycle logs');
    } else {
      state.habits = buildSampleHabits();
      state.notesByDate = {};
      state.activeDate = startOfToday();
      saveHabits(state.habits);
      saveNotes(state.notesByDate);
      clearAllFilters();
      showToast('Reset to blank sample sheet');
    }
  });

  window.addEventListener('resize', () => {
    els.sheetDateHeading.textContent = formatSheetDate(state.activeDate);
    els.cycleDateHeading.textContent = formatSheetDate(state.cycleDate);
  });

  document.addEventListener('keydown', (e) => {
    const inField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
    if (state.mode === 'habits' && e.key === '/' && !inField && !els.modal.classList.contains('open')) {
      e.preventDefault();
      els.searchInput.focus();
    } else if (e.key === 'Escape') {
      if (els.modal.classList.contains('open')) closeModal();
      else if (document.activeElement === els.searchInput && state.search) {
        state.search = '';
        els.searchInput.value = '';
        renderHabits();
      }
    }
  });

  function registerOfflineWorker() {
    if (
      'serviceWorker' in navigator &&
      (window.location.protocol === 'https:' || window.location.protocol === 'http:')
    ) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {
          // Ignore registration failures in restricted contexts
        });
      });
    }
  }

  initThemeAndMode();
  initAndroidInstallPrompt();
  renderHabits();
  renderCycle();
  registerOfflineWorker();
})();
