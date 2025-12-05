// storage.js - LocalForage adapter for Task Time Tracker
// This file expects `localforage` to be available as a global (via CDN script).
const lf = window.localforage || (typeof localforage !== 'undefined' && localforage);
if (!lf) console.warn('localforage not found; please include it via CDN or bundle it.' );

lf && lf.config && lf.config({
  name: 'task-tracker',
  storeName: 'task_data'
});

const Storage = {
  async loadTasksForDate(date) {
    if (!lf) return {};
    const data = await lf.getItem(`tasks_${date}`);
    return data || {};
  },

  async saveTasksForDate(date, tasks) {
    if (!lf) return;
    await lf.setItem(`tasks_${date}`, tasks);
  },

  async saveRunningState(state) {
    if (!lf) return;
    await lf.setItem('timetracker-running', state);
  },

  async loadRunningState() {
    if (!lf) return null;
    return await lf.getItem('timetracker-running');
  },

  async removeRunningState() {
    if (!lf) return;
    await lf.removeItem('timetracker-running');
  },

  // Migrate from localStorage to LocalForage. Safe to run multiple times.
  async migrateFromLocalStorage() {
    if (!lf) return;
    try {
      // Migrate tasks_YYYY-MM-DD keys
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (!key) continue;
        if (key.startsWith('tasks_')) {
          try {
            const value = JSON.parse(localStorage.getItem(key));
            const existing = await lf.getItem(key);
            if (!existing && value) await lf.setItem(key, value);
          } catch (e) {
            // ignore parse errors
          }
        } else if (key === 'timetracker-running') {
          try {
            const running = JSON.parse(localStorage.getItem(key));
            const existing = await lf.getItem('timetracker-running');
            if (!existing && running) await lf.setItem('timetracker-running', running);
          } catch (e) {}
        }
      }
    } catch (err) {
      console.warn('Migration failed', err);
    }
  }
};

window.Storage = Storage;
export { Storage };
