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
		// tasks will be loaded after storage migration in startWithStorage()
		this.setupEventListeners();
		this.setupKeyboardShortcuts();
		this.updateDateSelector();
		this.updateDateNavButtons();

		// running state and tasks are handled after storage migration in startWithStorage()

		// Warn before closing if a task is running
		window.addEventListener('beforeunload', (e) => {
			if (this.currentTask && this.startTime) {
				e.preventDefault();
				e.returnValue = '';
				return '';
			}
		});
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
		this.exportBtn = document.getElementById('exportBtn');
		this.downloadMdBtn = document.getElementById('downloadMdBtn');
		this.headerTitle = document.querySelector('.header h1');
	}

	async loadTheme() {
		const savedTheme = (await Storage.getItem('timetracker-theme')) || 'dark';
		this.setTheme(savedTheme);
	}

	async setTheme(theme) {
		document.body.setAttribute('data-theme', theme);
		this.themeToggle.textContent = theme === 'dark' ? '🌙 Dark' : '☀️ Light';
		await Storage.setItem('timetracker-theme', theme);
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
		if (this.headerTitle) {
			this.headerTitle.addEventListener('click', () => {
				const today = this.formatYMD(new Date());
				if (this.selectedDate !== today) {
					this.selectedDate = today;
					this.updateDateSelector();
					this.loadTasksForDate();
					this.updateDateNavButtons();
				}
			});
		}

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

		if (this.exportBtn) this.exportBtn.addEventListener('click', () => this.copyExportMarkdown());
		if (this.downloadMdBtn) this.downloadMdBtn.addEventListener('click', () => this.downloadMarkdownFile());

		this.taskNotes.addEventListener('input', (e) => {
			this.currentNotes = e.target.value;
		});
	}

	// Download the markdown export as a .md file
	async downloadMarkdownFile() {
		const tasks = await Storage.loadTasksForDate(this.selectedDate) || {};
		const md = this.buildExportMarkdown(tasks);
		const blob = new Blob([md], { type: 'text/markdown' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `tasks_${this.selectedDate}.md`;
		document.body.appendChild(a);
		a.click();
		setTimeout(function() {
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		}, 100);
		this.showToast('Markdown file downloaded');
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

	async startTask() {
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

		// Save running task info for resume
		await Storage.saveRunningState({
			task: this.currentTask,
			startTime: this.startTime,
			notes: this.currentNotes,
			date: this.selectedDate
		});

		this.timerInterval = setInterval(() => this.updateTimer(), 1000);
		this.updateTimer();
	}

	async stopTask() {
		if (!this.currentTask || !this.startTime) return;

		const endTime = Date.now();
		const duration = endTime - this.startTime;

		await this.saveTaskTime(this.currentTask, duration, this.currentNotes);

	this.currentTask = null;
	this.startTime = null;
	this.currentNotes = '';
	clearInterval(this.timerInterval);

		// Remove running task info
		await Storage.removeRunningState();

	this.currentTaskDiv.classList.remove('active');
	this.startBtn.disabled = false;
	this.stopBtn.disabled = true;
	this.taskInput.disabled = false;
	this.taskInput.value = '';
	this.taskNotes.value = '';

		this.updatePageTitle();
		await this.loadTasksForDate();
	this.taskInput.focus();
	}

	updateTimer() {
		if (!this.startTime) return;

		const elapsed = Date.now() - this.startTime;
		this.timerDisplay.textContent = this.formatTime(elapsed);
		this.updatePageTitle();
	}

	async saveTaskTime(taskName, duration, notes) {
		const storageKey = `tasks_${this.selectedDate}`;
		let tasks = await Storage.loadTasksForDate(this.selectedDate) || {};

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

		await Storage.saveTasksForDate(this.selectedDate, tasks);
	}

	async loadTasksForDate() {
		const tasks = await Storage.loadTasksForDate(this.selectedDate) || {};

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
					`<div class="task-notes">${notes.map(note => {
						let meta = '';
						if (note.timestamp) meta += this.escapeHtml(note.timestamp);
						if (note.duration && note.duration !== null) meta += ' (' + this.escapeHtml(note.duration) + ')';
						// Only show timestamp and duration if duration is not null
						return `<strong>${meta}</strong>\n${this.escapeHtml(note.text)}`;
					}).join('\n\n')}</div>` : '';

				return `
                    <div class="task-item" data-task-name="${this.escapeHtml(name)}">
                        <div class="task-header">
                            <div class="task-name">${this.escapeHtml(name)}</div>
                            <div style="display:flex; align-items:center; gap:10px;">
                                <div class="task-time">${this.formatTime(time)}</div>
                                <button class="edit-btn" title="Edit">✏️</button>
                                <button class="adjust-btn" title="Adjust">🛠️</button>
                            </div>
                        </div>
                        ${notesHtml}
                    </div>
                `;
			}).join('');

		// Add event listeners to task items
		this.taskList.querySelectorAll('.task-item').forEach(item => {
			// clicking the task selects it (for starting)
			item.addEventListener('click', () => {
				// If this item is in edit or adjust mode, ignore clicks so it doesn't steal focus
				if (item.classList.contains('edit-mode') || item.classList.contains('adjust-mode')) return;
				const taskName = item.getAttribute('data-task-name');
				this.selectTask(taskName);
			});
			// edit button: opens inline rename
			const editBtn = item.querySelector('.edit-btn');
			if (editBtn) {
				editBtn.addEventListener('click', (e) => {
					e.stopPropagation();
					const taskName = item.getAttribute('data-task-name');
					this.enterEditMode(taskName, item);
				});
			}
			// adjust button: opens inline adjust time
			const adjustBtn = item.querySelector('.adjust-btn');
			if (adjustBtn) {
				adjustBtn.addEventListener('click', (e) => {
					e.stopPropagation();
					const taskName = item.getAttribute('data-task-name');
					this.enterAdjustMode(taskName, item);
				});
			}
		});
	}
	// Inline adjust mode for task time
	async enterAdjustMode(taskName, itemElement) {
		itemElement.classList.add('adjust-mode');
		const tasks = await Storage.loadTasksForDate(this.selectedDate) || {};
		let data = tasks[taskName];
		if (typeof data === 'number') data = { time: data, notes: [] };
		const timeMs = typeof data === 'number' ? data : data.time;
		const timeStr = this.formatTime(timeMs);

		itemElement.innerHTML = `
            <div class="task-header">
                <div style="flex:1">
                    <input class="adjust-time-input" value="${timeStr}" />
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <button class="btn-save">Save</button>
                    <button class="btn-cancel">Cancel</button>
                </div>
            </div>
        `;
		const input = itemElement.querySelector('.adjust-time-input');
		const saveBtn = itemElement.querySelector('.btn-save');
		const cancelBtn = itemElement.querySelector('.btn-cancel');
		input.focus();
		input.select();

		const finishSave = () => {
			const newStr = input.value.trim();
			const ms = this.parseTimeToMs(newStr);
			if (ms === null) {
				input.focus();
				this.showToast('Invalid time format. Use HH:MM:SS');
				return;
			}
			this.saveAdjustedTime(taskName, ms);
		};
		saveBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			finishSave();
		});
		cancelBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			this.loadTasksForDate();
		});
		input.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				finishSave();
			} else if (e.key === 'Escape') {
				e.preventDefault();
				this.loadTasksForDate();
			}
		});
	}

	// Save adjusted time for a task
	async saveAdjustedTime(taskName, ms) {
		const tasks = await Storage.loadTasksForDate(this.selectedDate) || {};
		let data = tasks[taskName];
		if (typeof data === 'number') data = { time: data, notes: [] };
		data.time = ms;
		tasks[taskName] = data;
		await Storage.saveTasksForDate(this.selectedDate, tasks);
		this.showToast('Task time adjusted');
		await this.loadTasksForDate();
	}

	// Parse HH:MM:SS to ms
	parseTimeToMs(str) {
		const parts = str.split(':').map(Number);
		if (parts.length !== 3 || parts.some(isNaN)) return null;
		const [h, m, s] = parts;
		if (h < 0 || m < 0 || m > 59 || s < 0 || s > 59) return null;
		return ((h * 3600) + (m * 60) + s) * 1000;
	}

	// Inline edit mode for a task: rename and edit notes
	async enterEditMode(oldName, itemElement) {
		itemElement.classList.add('edit-mode');
		const tasks = await Storage.loadTasksForDate(this.selectedDate) || {};
		let data = tasks[oldName];
		if (typeof data === 'number') data = { time: data, notes: [] };
		const timeStr = this.formatTime(data.time);

		// Use a local copy of notes for mutation
		let notes = Array.isArray(data.notes) ? data.notes.map(n => ({ ...n })) : [];

		// Render notes list
		const renderNotesHtml = () => `
            <ul class="edit-notes-list">
                ${notes.map((note, idx) => {
			let meta = '';
			if (note.timestamp) meta += this.escapeHtml(note.timestamp);
			if (note.duration && note.duration !== null) meta += ' (' + this.escapeHtml(note.duration) + ')';
			return `
                        <li class="edit-note-item" data-note-idx="${idx}">
                            <span class="edit-note-meta">${meta}</span>
                            <input class="edit-note-text" type="text" value="${this.escapeHtml(note.text || '')}" />
                            <button class="edit-note-delete" title="Delete note">🗑️</button>
                        </li>
                    `;
		}).join('')}
            </ul>
            <div class="edit-note-add">
                <input class="edit-note-add-input" type="text" placeholder="Add new note..." />
                <button class="edit-note-add-btn">Add</button>
            </div>
        `;

		// Render the edit UI
		const renderEditUI = () => {
			itemElement.innerHTML = `
                <div class="task-header">
                    <div style="flex:1">
                        <input class="edit-name-input" value="${this.escapeHtml(oldName)}" />
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div class="task-time">${timeStr}</div>
                    </div>
                </div>
                <div class="edit-actions">
                    <button class="btn-save">Save</button>
                    <button class="btn-cancel">Cancel</button>
                </div>
                <div class="edit-notes-block">
                    <label style="font-size:13px; color:var(--text-secondary); margin-bottom:4px;">Notes:</label>
                    ${renderNotesHtml()}
                </div>
            `;

			const nameInput = itemElement.querySelector('.edit-name-input');
			const saveBtn = itemElement.querySelector('.btn-save');
			const cancelBtn = itemElement.querySelector('.btn-cancel');
			nameInput.focus();
			nameInput.select();

			// Save handler: rename and update notes
			const finishSave = () => {
				const newName = nameInput.value.trim();
				if (!newName) {
					nameInput.focus();
					return;
				}
				// Gather updated notes
				const noteInputs = Array.from(itemElement.querySelectorAll('.edit-note-text'));
				const updatedNotes = noteInputs.map((input, idx) => {
					const note = notes[idx] || {};
					return {
						...note,
						text: input.value
					};
				}).filter(n => n.text && n.text.trim());
				this.saveEditWithNotes(oldName, newName, updatedNotes);
			};

			saveBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				finishSave();
			});
			cancelBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				this.loadTasksForDate();
			});
			nameInput.addEventListener('keydown', (e) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					finishSave();
				} else if (e.key === 'Escape') {
					e.preventDefault();
					this.loadTasksForDate();
				}
			});

			// Note delete buttons
			itemElement.querySelectorAll('.edit-note-delete').forEach((btn, idx) => {
				btn.addEventListener('click', (e) => {
					e.stopPropagation();
					notes.splice(idx, 1);
					renderEditUI();
				});
			});

			// Add note
			const addInput = itemElement.querySelector('.edit-note-add-input');
			const addBtn = itemElement.querySelector('.edit-note-add-btn');
			addBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				const text = addInput.value.trim();
				if (!text) {
					addInput.focus();
					return;
				}
				notes.push({
					text,
					timestamp: new Date().toLocaleTimeString(),
					duration: null
				});
				renderEditUI();
			});
			addInput.addEventListener('keydown', (e) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					addBtn.click();
				}
			});
		};

		renderEditUI();
	}

	// Save a rename edit and notes update, auto-merge if newName exists
	async saveEditWithNotes(oldName, newName, updatedNotes) {
		if (!oldName) return;
		const storageKey = `tasks_${this.selectedDate}`;
		const tasks = await Storage.loadTasksForDate(this.selectedDate) || {};
		let oldData = tasks[oldName];
		if (oldData === undefined) return this.loadTasksForDate();
		if (typeof oldData === 'number') oldData = { time: oldData, notes: [] };

		// If newName equals oldName, just update notes
		if (newName === oldName) {
			oldData.notes = updatedNotes;
			tasks[oldName] = oldData;
			await Storage.saveTasksForDate(this.selectedDate, tasks);
			await this.loadTasksForDate();
			return;
		}

		// If target exists, merge: sum times and concat notes
		let targetData = tasks[newName];
		if (targetData === undefined) {
			// simple rename
			oldData.notes = updatedNotes;
			tasks[newName] = oldData;
		} else {
			if (typeof targetData === 'number') targetData = { time: targetData, notes: [] };
			// merge
			const merged = {
				time: (targetData.time || 0) + (oldData.time || 0),
				notes: (targetData.notes || []).concat(updatedNotes)
			};
			tasks[newName] = merged;
		}
		delete tasks[oldName];
		await Storage.saveTasksForDate(this.selectedDate, tasks);

		// If active task was renamed, update currentTask
		if (this.currentTask === oldName) {
			this.currentTask = newName;
			if (this.currentTaskName) this.currentTaskName.textContent = newName;
			if (this.taskInput) this.taskInput.value = newName;
			this.updatePageTitle();
		}
		if (this.taskInput && this.taskInput.value === oldName) {
			this.taskInput.value = newName;
		}
		await this.loadTasksForDate();
	}

	// Save a rename edit, auto-merge if newName exists
	async saveEdit(oldName, newName) {
		if (!oldName) return;
		const storageKey = `tasks_${this.selectedDate}`;
		const tasks = await Storage.loadTasksForDate(this.selectedDate) || {};

		// normalize old data
		let oldData = tasks[oldName];
		if (oldData === undefined) return this.loadTasksForDate();
		if (typeof oldData === 'number') oldData = { time: oldData, notes: [] };

		// If newName equals oldName - nothing to do
		if (newName === oldName) return this.loadTasksForDate();

		// If target exists, merge: sum times and concat notes
		let targetData = tasks[newName];
		if (targetData === undefined) {
			// simple rename
			tasks[newName] = oldData;
		} else {
			if (typeof targetData === 'number') targetData = { time: targetData, notes: [] };
			// merge
			const merged = {
				time: (targetData.time || 0) + (oldData.time || 0),
				notes: (targetData.notes || []).concat(oldData.notes || [])
			};
			tasks[newName] = merged;
		}

		// remove old key
		delete tasks[oldName];

		await Storage.saveTasksForDate(this.selectedDate, tasks);

		// If active task was renamed, update currentTask
		if (this.currentTask === oldName) {
			this.currentTask = newName;
			// update UI if current task display exists
			if (this.currentTaskName) this.currentTaskName.textContent = newName;
			// keep the start/stop bar in-sync (taskInput shows the current task name even when disabled)
			if (this.taskInput) this.taskInput.value = newName;
			// update page title to reflect the new name
			this.updatePageTitle();
		}

		// If the task input currently shows the old name (was selected but not active), update it too
		if (this.taskInput && this.taskInput.value === oldName) {
			this.taskInput.value = newName;
		}

		// re-render
		await this.loadTasksForDate();
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

	// show a transient toast message (non-blocking)
	showToast(message, duration = 3000) {
		try {
			// create container if missing
			let container = document.querySelector('.toast-container');
			if (!container) {
				container = document.createElement('div');
				container.className = 'toast-container';
				document.body.appendChild(container);
			}

			const toast = document.createElement('div');
			toast.className = 'toast';
			toast.textContent = message;
			container.appendChild(toast);

			// schedule removal
			setTimeout(() => {
				// play out animation
				toast.style.animation = 'toast-out 240ms ease forwards';
				setTimeout(() => {
					if (toast.parentNode) toast.parentNode.removeChild(toast);
					// if container empty, remove it
					if (container && container.children.length === 0 && container.parentNode) container.parentNode.removeChild(container);
				}, 260);
			}, duration);
		} catch (err) {
			// fallback to alert if DOM manipulation fails
			try { alert(message); } catch (e) { /* ignore */ }
		}
	}

	// Build markdown export for the selected date's tasks and copy to clipboard
	buildExportMarkdown(tasks) {
		// tasks: object where key is task name and value is {time, notes[]}
		const lines = [];
		const dateLine = `# Tasks for ${this.selectedDate}`;
		lines.push(dateLine, '');

		const entries = Object.entries(tasks);
		if (entries.length === 0) {
			lines.push('- No tasks tracked for this date.');
			return lines.join('\n');
		}

		// Sort by descending time
		entries.sort((a, b) => {
			const ta = typeof a[1] === 'number' ? a[1] : a[1].time || 0;
			const tb = typeof b[1] === 'number' ? b[1] : b[1].time || 0;
			return tb - ta;
		});

		for (const [name, data] of entries) {
			const t = typeof data === 'number' ? data : data.time || 0;
			const timeStr = this.formatTime(t);
			lines.push(`- **${name}** — ${timeStr}`);

			const notes = (typeof data === 'object' && data.notes) ? data.notes : [];
			for (const note of notes) {
				// note may be {text, timestamp, duration} in our format
				if (typeof note === 'string') {
					lines.push(`  - ${this.escapeHtml(note)}`);
				} else {
					const ts = note.timestamp ? note.timestamp : '';
					const dur = note.duration ? note.duration : '';
					const text = note.text ? note.text : '';
					const meta = [ts, dur].filter(Boolean).join(' ');
					lines.push(`  - ${meta ? `(${meta.trim()}) ` : ''}${text}`);
				}
			}

			lines.push('');
		}

		return lines.join('\n');
	}

	async copyExportMarkdown() {
		const tasks = await Storage.loadTasksForDate(this.selectedDate) || {};
		const md = this.buildExportMarkdown(tasks);

		// Try navigator.clipboard first
		try {
			if (navigator.clipboard && navigator.clipboard.writeText) {
				await navigator.clipboard.writeText(md);
				this.showToast('Export copied to clipboard');
				return;
			}
		} catch (err) {
			// fall through to legacy copy
		}

		// Fallback: create a hidden textarea and execCommand
		try {
			const ta = document.createElement('textarea');
			ta.value = md;
			ta.style.position = 'fixed';
			ta.style.left = '-9999px';
			document.body.appendChild(ta);
			ta.select();
			const ok = document.execCommand('copy');
			document.body.removeChild(ta);
			if (ok) {
				this.showToast('Export copied to clipboard');
			} else {
				// As a last resort, show the markdown so user can copy manually
				prompt('Copy the export below:', md);
			}
		} catch (err) {
			prompt('Copy the export below:', md);
		}
	}

	// Initialize storage (migrate from localStorage) and load tasks + running state
	async startWithStorage() {
		// Migrate any existing localStorage keys into LocalForage
		await Storage.migrateFromLocalStorage();

		// Load today's tasks (or selected date)
		await this.loadTasksForDate();

		// Check running state and offer resume
		const running = await Storage.loadRunningState();

		if (running && running.task && running.startTime && running.date === this.selectedDate) {
			setTimeout(async () => {
				const resume = confirm(`Resume tracking for "${running.task}" started at ${new Date(running.startTime).toLocaleTimeString()}?`);
				if (resume) {
					this.currentTask = running.task;
					this.startTime = running.startTime;
					this.currentNotes = running.notes || '';
					this.currentTaskName.textContent = running.task;
					this.currentTaskDiv.classList.add('active');
					this.taskNotes.value = this.currentNotes;
					this.startBtn.disabled = true;
					this.stopBtn.disabled = false;
					this.taskInput.disabled = true;
					this.timerInterval = setInterval(() => this.updateTimer(), 1000);
					this.updateTimer();
				} else {
					await Storage.removeRunningState();
				}
			}, 200);
		}
	}

	formatTime(milliseconds) {
		const seconds = Math.floor(milliseconds / 1000);
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		const remainingSeconds = seconds % 60;

		return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
	}
}

// Initialize the app and expose for tests
const _tt = new TaskTimeTracker();
window.taskTracker = _tt;
_tt.startWithStorage();
