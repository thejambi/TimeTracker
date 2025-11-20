const { JSDOM } = require('jsdom');
const assert = require('assert');
const path = require('path');

(async () => {
  try {
    const filePath = path.resolve(__dirname, '..', 'timetracker.html');
    // Inline CSS and JS into the HTML so JSDOM doesn't try to fetch them over HTTP.
    const fs = require('fs');
    let html = fs.readFileSync(filePath, 'utf8');
    const cssPath = path.resolve(__dirname, '..', 'timetracker.css');
    const jsPath = path.resolve(__dirname, '..', 'timetracker.js');
    const css = fs.readFileSync(cssPath, 'utf8');
    const js = fs.readFileSync(jsPath, 'utf8');
    html = html.replace('<link rel="stylesheet" href="timetracker.css">', `<style>${css}</style>`);
    html = html.replace('<script src="timetracker.js"></script>', `<script>${js}</script>`);

    const dom = new JSDOM(html, {
      runScripts: 'dangerously',
      resources: 'usable',
      url: 'http://localhost/' // provide a non-opaque origin so localStorage is available
    });

    // wait for scripts to load
    await new Promise((resolve) => {
      dom.window.addEventListener('load', () => resolve(), { once: true });
    });

    const w = dom.window;
    assert.ok(w.taskTracker, 'taskTracker instance should be exposed on window');

    const tt = w.taskTracker;

    // Test date helpers
    const d = new Date(2025, 10, 19); // 2025-11-19
    const ymd = tt.formatYMD(d);
    assert.strictEqual(ymd, '2025-11-19', 'formatYMD should produce YYYY-MM-DD');

    const parsed = tt.parseYMD('2025-11-19');
    assert.strictEqual(parsed.getFullYear(), 2025);
    assert.strictEqual(parsed.getMonth(), 10);
    assert.strictEqual(parsed.getDate(), 19);

    // Test updateDateNavButtons: future date should disable next button
    const future = new Date();
    future.setDate(future.getDate() + 2);
    tt.selectedDate = tt.formatYMD(future);
    tt.updateDateSelector();
    tt.updateDateNavButtons();
    const nextBtn = w.document.getElementById('nextDayBtn');
    assert.ok(nextBtn.disabled, 'Next button should be disabled for future dates');

    // Test saveEdit merge behavior
    // prepare localStorage for today's date
    const today = tt.formatYMD(new Date());
    const storageKey = `tasks_${today}`;
    const store = {};
    store['A'] = { time: 1000, notes: [{ text: 'noteA', timestamp: '09:00', duration: '00:00:01' }] };
    store['B'] = { time: 2000, notes: [{ text: 'noteB', timestamp: '10:00', duration: '00:00:02' }] };
    w.localStorage.setItem(storageKey, JSON.stringify(store));

    tt.selectedDate = today;
    // merge A into B
    tt.saveEdit('A', 'B');
    const after = JSON.parse(w.localStorage.getItem(storageKey));
    assert.ok(!after['A'], 'old key A should be removed after merge');
    assert.ok(after['B'], 'target key B should exist');
    assert.strictEqual(after['B'].time, 3000, 'times should be summed after merge');
    assert.strictEqual(after['B'].notes.length, 2, 'notes should be concatenated after merge');

    // Test active rename synchronization
    // create entry C and start tracking it
    const tasks = JSON.parse(w.localStorage.getItem(storageKey));
    tasks['C'] = { time: 0, notes: [] };
    w.localStorage.setItem(storageKey, JSON.stringify(tasks));

    tt.selectedDate = today;
    // simulate starting task C
    tt.taskInput.value = 'C';
    tt.startTask();
    assert.strictEqual(tt.currentTask, 'C');

    // rename C -> D
    tt.saveEdit('C', 'D');
    assert.strictEqual(tt.currentTask, 'D', 'currentTask should be updated when active task is renamed');
    assert.strictEqual(tt.taskInput.value, 'D', 'taskInput should reflect new name after rename');

    console.log('All tests passed');
    process.exit(0);
  } catch (err) {
    console.error('Tests failed:', err);
    process.exit(1);
  }
})();
