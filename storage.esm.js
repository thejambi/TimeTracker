import localforage from 'localforage';

// storage.esm.js - LocalForage adapter (ES module)
const lf = localforage;

lf.config({
  name: 'task-tracker',
  storeName: 'task_data'
});

const Storage = {
  async getItem(key) {
    return await lf.getItem(key);
  },
  async setItem(key, value) {
    return await lf.setItem(key, value);
  },
  async removeItem(key) {
    return await lf.removeItem(key);
  },
  async loadTasksForDate(date) {
    const data = await lf.getItem(`tasks_${date}`);
    return data || {};
  },
  async saveTasksForDate(date, tasks) {
    await lf.setItem(`tasks_${date}`, tasks);
  },
  async saveRunningState(state) {
    await lf.setItem('timetracker-running', state);
  },
  async loadRunningState() {
    return await lf.getItem('timetracker-running');
  },
  async removeRunningState() {
    await lf.removeItem('timetracker-running');
  },
  // Migrate from localStorage to LocalForage. Safe to run multiple times.
  async migrateFromLocalStorage() {
    try {
      const keys = Object.keys(localStorage || {});
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
        } else if (key === 'timetracker-theme') {
          try {
            const theme = localStorage.getItem('timetracker-theme');
            const existing = await lf.getItem('timetracker-theme');
            if (!existing && theme) await lf.setItem('timetracker-theme', theme);
          } catch (e) {}
        }
      }
    } catch (err) {
      console.warn('Migration failed', err);
    }
  }
};

// expose for existing code that expects window.Storage
window.Storage = Storage;
export { Storage };
