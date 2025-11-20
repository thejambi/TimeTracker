class TaskTimeTracker {
    constructor() {
        this.currentTask = null;
        this.startTime = null;
        this.timerInterval = null;
    // Use local date (YYYY-MM-DD) to avoid UTC/ISO conversion issues around midnight
    this.selectedDate = this.formatYMD(new Date());
        this.originalTitle = document.title;
        this.currentNotes = '';

        this.initializeElements();
        this.loadTheme();
        this.loadTasksForDate();
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        this.updateDateSelector();
        this.updateDateNavButtons();
    }

    initializeElements() {
        this.taskInput = document.getElementById('taskInput');
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.currentTaskDiv = document.getElementById('currentTask');
        this.currentTaskName = document.getElementById('currentTaskName');
        this.timerDisplay = document.getElementById('timerDisplay');
        this.taskList = document.getElementById('taskList');
        this.totalTimeDisplay = document.getElementById('totalTimeDisplay');
        this.dateSelector = document.getElementById('dateSelector');
        this.taskNotes = document.getElementById('taskNotes');
        this.themeToggle = document.getElementById('themeToggle');
        this.prevDayBtn = document.getElementById('prevDayBtn');
        this.nextDayBtn = document.getElementById('nextDayBtn');
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('timetracker-theme') || 'dark';
        this.setTheme(savedTheme);
    }

    setTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        this.themeToggle.textContent = theme === 'dark' ? '🌙 Dark' : '☀️ Light';
        localStorage.setItem('timetracker-theme', theme);
    }

    toggleTheme() {
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    }

    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.startTask());
        this.stopBtn.addEventListener('click', () => this.stopTask());
        this.themeToggle.addEventListener('click', () => this.toggleTheme());

        this.taskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.startTask();
        });

        this.dateSelector.addEventListener('change', (e) => {
            this.selectedDate = e.target.value;
            this.loadTasksForDate();
            this.updateDateNavButtons();
        });

        this.prevDayBtn.addEventListener('click', () => this.navigateDate(-1));
        this.nextDayBtn.addEventListener('click', () => this.navigateDate(1));

        this.taskNotes.addEventListener('input', (e) => {
            this.currentNotes = e.target.value;
        });
    }

    navigateDate(days) {
        // Parse using local date components to avoid timezone shifts
        const currentDate = this.parseYMD(this.selectedDate);
        currentDate.setDate(currentDate.getDate() + days);
        this.selectedDate = this.formatYMD(currentDate);
        this.updateDateSelector();
        this.loadTasksForDate();
        this.updateDateNavButtons();
    }

    updateDateNavButtons() {
        // Use local Date objects for a robust comparison (disable Next for today or any future date)
        const todayDate = this.parseYMD(this.formatYMD(new Date()));
        const selectedDateObj = this.parseYMD(this.selectedDate);

        this.nextDayBtn.disabled = selectedDateObj.getTime() >= todayDate.getTime();

        // Previous day button is always enabled (can go back indefinitely)
        this.prevDayBtn.disabled = false;
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+Space: Start/Stop task
            if (e.ctrlKey && e.code === 'Space') {
                e.preventDefault();
                if (this.currentTask) {
                    this.stopTask();
                } else {
                    this.startTask();
                }
            }

            // Ctrl+Enter: Start task (alternative)
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                this.startTask();
            }

            // Escape: Clear input and focus
            if (e.key === 'Escape') {
                this.taskInput.value = '';
                this.taskInput.focus();
            }

            // Ctrl+D: Toggle theme
            if (e.ctrlKey && e.key === 'd') {
                e.preventDefault();
                this.toggleTheme();
            }

            // Ctrl+N: Focus on notes (when task is active)
            if (e.ctrlKey && e.key === 'n' && this.currentTask) {
                e.preventDefault();
                this.taskNotes.focus();
            }

            // Alt+T: Focus on task input
            if (e.altKey && e.key === 't') {
                e.preventDefault();
                this.taskInput.focus();
            }
        });
    }

    updateDateSelector() {
        this.dateSelector.value = this.selectedDate;
    }

    // Helper: format Date -> 'YYYY-MM-DD' using local date components
    formatYMD(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    // Helper: parse 'YYYY-MM-DD' into a local Date at midnight
    parseYMD(ymd) {
        const [y, m, d] = ymd.split('-').map(Number);
        return new Date(y, m - 1, d);
    }

    updatePageTitle() {
        if (this.currentTask) {
            const elapsed = Date.now() - this.startTime;
            const timeStr = this.formatTime(elapsed);
            document.title = `🔄 ${this.currentTask} - ${timeStr} | Task Time Tracker`;
        } else {
            document.title = this.originalTitle;
        }
    }

    startTask() {
        const taskName = this.taskInput.value.trim();
        if (!taskName) {
            this.taskInput.focus();
            return;
        }

        if (this.currentTask) {
            this.stopTask();
        }

        this.currentTask = taskName;
        this.startTime = Date.now();
        this.currentNotes = '';

        this.currentTaskName.textContent = taskName;
        this.currentTaskDiv.classList.add('active');
        this.taskNotes.value = '';

        this.startBtn.disabled = true;
        this.stopBtn.disabled = false;
        this.taskInput.disabled = true;

        this.timerInterval = setInterval(() => this.updateTimer(), 1000);
        this.updateTimer();
    }

    stopTask() {
        if (!this.currentTask || !this.startTime) return;

        const endTime = Date.now();
        const duration = endTime - this.startTime;
        
        this.saveTaskTime(this.currentTask, duration, this.currentNotes);

        this.currentTask = null;
        this.startTime = null;
        this.currentNotes = '';
        clearInterval(this.timerInterval);
        
        this.currentTaskDiv.classList.remove('active');
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.taskInput.disabled = false;
        this.taskInput.value = '';
        this.taskNotes.value = '';

        this.updatePageTitle();
        this.loadTasksForDate();
        this.taskInput.focus();
    }

    updateTimer() {
        if (!this.startTime) return;
        
        const elapsed = Date.now() - this.startTime;
        this.timerDisplay.textContent = this.formatTime(elapsed);
        this.updatePageTitle();
    }

    saveTaskTime(taskName, duration, notes) {
        const storageKey = `tasks_${this.selectedDate}`;
        let tasks = JSON.parse(localStorage.getItem(storageKey) || '{}');
        
        if (!tasks[taskName]) {
            tasks[taskName] = {
                time: 0,
                notes: []
            };
        }

        // If it's a simple number (old format), convert to new format
        if (typeof tasks[taskName] === 'number') {
            tasks[taskName] = {
                time: tasks[taskName],
                notes: []
            };
        }

        tasks[taskName].time += duration;

        // Add notes if they exist
        if (notes && notes.trim()) {
            const timestamp = new Date().toLocaleTimeString();
            tasks[taskName].notes.push({
                text: notes.trim(),
                timestamp: timestamp,
                duration: this.formatTime(duration)
            });
        }

        localStorage.setItem(storageKey, JSON.stringify(tasks));
    }

    loadTasksForDate() {
        const storageKey = `tasks_${this.selectedDate}`;
        const tasks = JSON.parse(localStorage.getItem(storageKey) || '{}');
        
        this.renderTaskList(tasks);
        this.updateTotalTime(tasks);
    }

    renderTaskList(tasks) {
        const taskEntries = Object.entries(tasks);
        
        if (taskEntries.length === 0) {
            this.taskList.innerHTML = `
                <div class="no-tasks">
                    No tasks tracked for this date.
                </div>
            `;
            return;
        }

        this.taskList.innerHTML = taskEntries
            .sort((a, b) => {
                const timeA = typeof a[1] === 'number' ? a[1] : a[1].time;
                const timeB = typeof b[1] === 'number' ? b[1] : b[1].time;
                return timeB - timeA;
            })
            .map(([name, data]) => {
                const time = typeof data === 'number' ? data : data.time;
                const notes = typeof data === 'object' && data.notes ? data.notes : [];

                const notesHtml = notes.length > 0 ?
                    `<div class="task-notes">${notes.map(note =>
                        `<strong>${note.timestamp} (${note.duration}):</strong>\n${this.escapeHtml(note.text)}`
                    ).join('\n\n')}</div>` : '';

                return `
                    <div class="task-item" data-task-name="${this.escapeHtml(name)}">
                        <div class="task-header">
                            <div class="task-name">${this.escapeHtml(name)}</div>
                            <div class="task-time">${this.formatTime(time)}</div>
                        </div>
                        ${notesHtml}
                    </div>
                `;
            }).join('');

        // Add event listeners to task items
        this.taskList.querySelectorAll('.task-item').forEach(item => {
            item.addEventListener('click', () => {
                const taskName = item.getAttribute('data-task-name');
                this.selectTask(taskName);
            });
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    selectTask(taskName) {
        if (this.currentTask) {
            if (confirm('Stop current task and switch to this one?')) {
                this.stopTask();
            } else {
                return;
            }
        }

        this.taskInput.value = taskName;
        this.taskInput.focus();
    }

    updateTotalTime(tasks) {
        const total = Object.values(tasks).reduce((sum, data) => {
            const time = typeof data === 'number' ? data : data.time;
            return sum + time;
        }, 0);
        this.totalTimeDisplay.textContent = this.formatTime(total);
    }

    formatTime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
}

// Initialize the app
const taskTracker = new TaskTimeTracker();
