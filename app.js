(() => {
  'use strict';

  const STORAGE_KEY = 'candace.s25.habits.v1';
  const NOTES_STORAGE_KEY = 'candace.s25.notes.v1';
  const THEME_KEY = 'candace.s25.theme.v1';

  const CATEGORIES = ['Health', 'Focus', 'Mind', 'Craft', 'Home'];
  const CATEGORY_COLORS = {
    Health: 'var(--cat-health)',
    Focus: 'var(--cat-focus)',
    Mind: 'var(--cat-mind)',
    Craft: 'var(--cat-craft)',
    Home: 'var(--cat-home)',
  };

  const TIMES_OF_DAY = ['Morning', 'Afternoon', 'Evening', 'Anytime'];

  /* ------------------------------------------------------------------------
     Date Helpers (Local timezone safe)
     ------------------------------------------------------------------------ */
  function toDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
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
     Sample Data (Starts Blank — Zero Pre-Recorded Checks) & Local Storage
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
     State & DOM
     ------------------------------------------------------------------------ */
  const state = {
    habits: loadHabits(),
    notesByDate: loadNotes(),
    activeDate: startOfToday(),
    search: '',
    status: 'all',
    timeOfDay: 'all',
    category: 'all',
    sort: 'sheet',
    deletedBuffer: null,
    toastTimer: null,
    noteStatusTimer: null,
    deferredInstallPrompt: null,
  };

  const els = {
    themeMeta: document.getElementById('theme-color-meta'),
    themeToggle: document.getElementById('theme-toggle'),
    themeIcon: document.getElementById('theme-icon'),
    addBtn: document.getElementById('add-habit-btn'),
    installBanner: document.getElementById('android-install-banner'),
    installBtn: document.getElementById('install-app-btn'),
    dismissInstallBtn: document.getElementById('dismiss-install-btn'),
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
     Filtering & Sorting
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

  /* ------------------------------------------------------------------------
     Rendering
     ------------------------------------------------------------------------ */
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

  function render() {
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
     Mutations
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
    render();
  }

  function deleteHabit(habitId) {
    const index = state.habits.findIndex((h) => h.id === habitId);
    if (index === -1) return;
    const [removed] = state.habits.splice(index, 1);
    state.deletedBuffer = { habit: removed, index };
    saveHabits(state.habits);
    render();
    showToast(`Removed "${removed.name}"`, true);
  }

  function undoDelete() {
    if (!state.deletedBuffer) return;
    const { habit, index } = state.deletedBuffer;
    state.habits.splice(Math.min(index, state.habits.length), 0, habit);
    state.deletedBuffer = null;
    saveHabits(state.habits);
    hideToast();
    render();
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
    render();
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
     Theme (Syncs Android Status & Navigation Bar theme-color Dynamically)
     ------------------------------------------------------------------------ */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (els.themeMeta) {
      els.themeMeta.setAttribute('content', theme === 'dark' ? '#000000' : '#f4f1ea');
    }
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore
    }
    els.themeIcon.innerHTML =
      theme === 'dark'
        ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>'
        : '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>';
  }

  function initTheme() {
    let saved = null;
    try {
      saved = localStorage.getItem(THEME_KEY);
    } catch {
      // ignore
    }
    if (saved === 'dark' || saved === 'light') applyTheme(saved);
    else {
      const dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(dark ? 'dark' : 'light');
    }
  }

  /* ------------------------------------------------------------------------
     Android Native WebAPK Install Flow (Chrome / Samsung Internet)
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
      if (!dismissed) {
        els.installBanner.hidden = false;
      }
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
     Event Wiring
     ------------------------------------------------------------------------ */
  els.themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });

  els.prevDayBtn.addEventListener('click', () => {
    hapticTick(8);
    state.activeDate = addDays(state.activeDate, -1);
    render();
  });

  els.nextDayBtn.addEventListener('click', () => {
    const today = startOfToday();
    const next = addDays(state.activeDate, 1);
    if (next <= today) {
      hapticTick(8);
      state.activeDate = next;
      render();
    }
  });

  els.jumpTodayBtn.addEventListener('click', () => {
    hapticTick(8);
    state.activeDate = startOfToday();
    render();
  });

  // One-handed swipe left/right on masthead to flip days on Galaxy S25 Ultra
  const mastheadEl = document.querySelector('.sheet-masthead');
  if (mastheadEl) {
    let touchStartX = null;
    let touchStartY = null;
    mastheadEl.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length !== 1) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      },
      { passive: true }
    );
    mastheadEl.addEventListener(
      'touchend',
      (e) => {
        if (touchStartX === null || e.changedTouches.length !== 1) return;
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        touchStartX = null;
        touchStartY = null;
        if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
        if (dx > 0) {
          hapticTick(8);
          state.activeDate = addDays(state.activeDate, -1);
          render();
        } else {
          const next = addDays(state.activeDate, 1);
          if (next <= startOfToday()) {
            hapticTick(8);
            state.activeDate = next;
            render();
          }
        }
      },
      { passive: true }
    );
  }

  window.addEventListener('resize', () => {
    els.sheetDateHeading.textContent = formatSheetDate(state.activeDate);
  });

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
    render();
  });

  els.searchInput.addEventListener('input', (e) => {
    state.search = e.target.value;
    render();
  });

  els.searchClear.addEventListener('click', () => {
    state.search = '';
    els.searchInput.value = '';
    els.searchInput.focus();
    render();
  });

  els.statusFilter.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (!btn) return;
    state.status = btn.dataset.status;
    els.statusFilter.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('active', b === btn));
    render();
  });

  els.categoryPills.addEventListener('click', (e) => {
    const btn = e.target.closest('.pill-btn');
    if (!btn) return;
    state.category = btn.dataset.category;
    render();
  });

  els.timeFilter.addEventListener('change', (e) => {
    state.timeOfDay = e.target.value;
    render();
  });

  els.sortSelect.addEventListener('change', (e) => {
    state.sort = e.target.value;
    render();
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

  els.toastAction.addEventListener('click', undoDelete);

  els.exportBtn.addEventListener('click', () => {
    const payload = {
      habits: state.habits,
      notesByDate: state.notesByDate,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `candace-s25-${toDateKey(startOfToday())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported habits & notes');
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
        if (!rawHabits) throw new Error('Invalid format');
        const cleaned = rawHabits.map(normalizeHabit).filter(Boolean);
        state.habits = cleaned;
        if (parsed && parsed.notesByDate && typeof parsed.notesByDate === 'object' && !Array.isArray(parsed.notesByDate)) {
          state.notesByDate = parsed.notesByDate;
          saveNotes(state.notesByDate);
        }
        saveHabits(state.habits);
        clearAllFilters();
        showToast(`Imported ${cleaned.length} daily habits`);
      } catch {
        showToast('Could not import file — invalid JSON');
      } finally {
        els.importFile.value = '';
      }
    };
    reader.readAsText(file);
  });

  els.resetDemoBtn.addEventListener('click', () => {
    state.habits = buildSampleHabits();
    state.notesByDate = {};
    state.activeDate = startOfToday();
    saveHabits(state.habits);
    saveNotes(state.notesByDate);
    clearAllFilters();
    showToast('Reset to blank sample sheet');
  });

  document.addEventListener('keydown', (e) => {
    const inField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
    if (e.key === '/' && !inField && !els.modal.classList.contains('open')) {
      e.preventDefault();
      els.searchInput.focus();
    } else if (e.key === 'Escape') {
      if (els.modal.classList.contains('open')) closeModal();
      else if (document.activeElement === els.searchInput && state.search) {
        state.search = '';
        els.searchInput.value = '';
        render();
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

  initTheme();
  initAndroidInstallPrompt();
  render();
  registerOfflineWorker();
})();
