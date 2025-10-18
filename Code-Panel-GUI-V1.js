// Code Panel GUI — ready-to-paste for TurboWarp & PenguinMod
// Full functionality: File/Edit/Tools/Tab Manager/Shortcuts, draggable GUI,
// Save/Load, import/export, Dev Mode (Console), Theme, keyboard shortcuts.
// Includes safe localStorage fallback for sandboxed environments.
// Creator: 2pro12342 (as requested)

(function () {
    'use strict';

    // --- SafeStorage: tries localStorage, falls back to in-memory store if unavailable ---
    const SafeStorage = (function () {
        try {
            const testKey = '__cp_test';
            localStorage.setItem(testKey, '1');
            localStorage.removeItem(testKey);
            return {
                get: (key) => {
                    const raw = localStorage.getItem(key);
                    try { return raw ? JSON.parse(raw) : {}; } catch (e) { return {}; }
                },
                set: (key, value) => {
                    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
                }
            };
        } catch (e) {
            console.warn('CodePanelGUI: localStorage unavailable, using in-memory fallback.', e);
            const mem = {};
            return {
                get: (key) => {
                    try { return mem[key] ? JSON.parse(mem[key]) : {}; } catch (e) { return {}; }
                },
                set: (key, value) => {
                    try { mem[key] = JSON.stringify(value); } catch (e) {}
                }
            };
        }
    })();

    // --- Helper detection for Scratch constants (makes it work across environments) ---
    const hasScratch = typeof Scratch !== 'undefined';
    const BLOCK_TYPE = hasScratch ? Scratch.BlockType : { COMMAND: 'command', REPORTER: 'reporter' };
    const ARG_TYPE = hasScratch ? Scratch.ArgumentType : { STRING: 'string' };

    class CodePanelGUI {
        constructor () {
            this.id = 'codepanelgui';
            this.panelId = 'code-panel-gui-root';
            this.storageKey = 'codepanelgui_saved';
            this.opened = false;
            this.devMode = false;
            this.theme = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
            this.tabs = [];
            this.visibleTabs = true; // toggle show/hide coding tabs
            this.activeTab = 'Welcome';
            this._consoleArea = null;
            this._ensureSavedStorage();
            this._ensureDefaultTabs();
            this._boundKeyHandler = this._keyboardHandler.bind(this);
            this._bindShortcuts();
        }

        getInfo () {
            return {
                id: this.id,
                name: 'Code Panel GUI',
                blocks: [
                    {
                        opcode: 'openPanel',
                        blockType: BLOCK_TYPE.COMMAND,
                        text: 'Open Code Panel'
                    },
                    {
                        opcode: 'closePanel',
                        blockType: BLOCK_TYPE.COMMAND,
                        text: 'Close Code Panel'
                    },
                    {
                        opcode: 'getAllSavedJSON',
                        blockType: BLOCK_TYPE.REPORTER,
                        text: 'Get all saved Code in JSON format'
                    },
                    {
                        opcode: 'getSavedById',
                        blockType: BLOCK_TYPE.REPORTER,
                        text: 'Get saved Code with [ID]',
                        arguments: {
                            ID: {
                                type: ARG_TYPE.STRING,
                                defaultValue: 'my-code-id'
                            }
                        }
                    }
                ]
            };
        }

        // --- Blocks ---
        openPanel () {
            if (this.opened) return;
            this.opened = true;
            this._renderPanel();
        }

        closePanel () {
            const root = document.getElementById(this.panelId);
            if (root) root.remove();
            this.opened = false;
        }

        getAllSavedJSON () {
            return JSON.stringify(this._getSavedObject());
        }

        getSavedById (args) {
            const id = (args && args.ID) ? args.ID : (typeof args === 'string' ? args : '');
            const saved = this._getSavedObject();
            return saved[id] ? JSON.stringify(saved[id]) : '';
        }

        // --- Storage helpers using SafeStorage ---
        _ensureSavedStorage () {
            try {
                const existing = SafeStorage.get(this.storageKey);
                if (!existing || typeof existing !== 'object') SafeStorage.set(this.storageKey, {});
            } catch (e) { /* ignore */ }
        }

        _getSavedObject () {
            try { return SafeStorage.get(this.storageKey) || {}; } catch (e) { return {}; }
        }

        _setSavedObject (obj) {
            try { SafeStorage.set(this.storageKey, obj); } catch (e) {}
        }

        // --- UI Rendering ---
        _renderPanel () {
            // remove any existing
            const existing = document.getElementById(this.panelId);
            if (existing) existing.remove();

            // root
            const root = document.createElement('div');
            root.id = this.panelId;
            root.style.position = 'fixed';
            root.style.left = '50px';
            root.style.top = '50px';
            root.style.width = '820px';
            root.style.height = '540px';
            root.style.zIndex = 9999999;
            root.style.borderRadius = '8px';
            root.style.boxShadow = '0 10px 30px rgba(0,0,0,0.4)';
            root.style.display = 'flex';
            root.style.flexDirection = 'column';
            root.style.overflow = 'hidden';
            root.style.fontFamily = 'Inter, Roboto, Arial, sans-serif';
            root.dataset.created = Date.now();

            // apply theme
            this._applyThemeToElement(root);

            // top bar
            const topBar = document.createElement('div');
            topBar.style.height = '40px';
            topBar.style.display = 'flex';
            topBar.style.alignItems = 'center';
            topBar.style.justifyContent = 'space-between';
            topBar.style.padding = '0 10px';
            topBar.style.cursor = 'move';
            topBar.style.userSelect = 'none';
            topBar.style.gap = '8px';
            topBar.style.borderBottom = '1px solid rgba(0,0,0,0.06)';

            const title = document.createElement('div');
            title.textContent = 'Code Panel GUI';
            title.style.fontWeight = '700';

            const controls = document.createElement('div');
            controls.style.display = 'flex';
            controls.style.gap = '6px';
            controls.style.alignItems = 'center';

            const minimizeBtn = this._makeButton('_', 'Minimize/Maximize', () => this._toggleMinimize(root));
            const fullscreenBtn = this._makeButton('[ ]', 'Fullscreen', () => this._toggleFullscreen(root));
            const closeBtn = this._makeButton('X', 'Close', () => this.closePanel());

            controls.appendChild(minimizeBtn);
            controls.appendChild(fullscreenBtn);
            controls.appendChild(closeBtn);

            topBar.appendChild(title);
            topBar.appendChild(controls);

            // menu row
            const menuRow = document.createElement('div');
            menuRow.style.display = 'flex';
            menuRow.style.gap = '6px';
            menuRow.style.padding = '8px';
            menuRow.style.alignItems = 'center';
            menuRow.style.borderBottom = '1px solid rgba(0,0,0,0.03)';

            const menuNames = ['File', 'Edit', 'Tools', 'Tab Manager', 'Shortcuts'];
            menuNames.forEach(n => {
                const mbtn = this._makeButton(n, n + ' menu', () => this._openMenu(n));
                mbtn.style.padding = '6px 10px';
                menuRow.appendChild(mbtn);
            });

            // tabs bar
            const tabsBar = document.createElement('div');
            tabsBar.id = this.panelId + '-tabsbar';
            tabsBar.style.display = 'flex';
            tabsBar.style.gap = '6px';
            tabsBar.style.padding = '6px';
            tabsBar.style.flexWrap = 'nowrap';
            tabsBar.style.overflowX = 'auto';
            tabsBar.style.borderBottom = '1px solid rgba(0,0,0,0.03)';

            // content
            const content = document.createElement('div');
            content.id = this.panelId + '-content';
            content.style.flex = '1';
            content.style.overflow = 'auto';
            content.style.padding = '12px';

            root.appendChild(topBar);
            root.appendChild(menuRow);
            root.appendChild(tabsBar);
            root.appendChild(content);
            document.body.appendChild(root);

            // make draggable
            this._makeDraggable(root, topBar);

            // render tabs & content
            this._renderTabsBar();
            this._showTab(this.activeTab);
        }

        _applyThemeToElement (root) {
            if (this.theme === 'dark') {
                root.style.background = '#1e1e1e';
                root.style.color = '#ddd';
            } else {
                root.style.background = '#ffffff';
                root.style.color = '#111';
            }
        }

        _makeButton (label, title, onClick) {
            const b = document.createElement('button');
            b.textContent = label;
            b.title = title || '';
            b.style.border = 'none';
            b.style.padding = '6px 8px';
            b.style.borderRadius = '6px';
            b.style.cursor = 'pointer';
            b.onclick = onClick;
            b.style.background = this.theme === 'dark' ? '#2b2b2b' : '#f0f0f0';
            return b;
        }

        _makeDraggable (el, handle) {
            let isDown = false, ox = 0, oy = 0;
            handle.addEventListener('mousedown', (e) => {
                isDown = true;
                ox = e.clientX - el.offsetLeft;
                oy = e.clientY - el.offsetTop;
                document.body.style.userSelect = 'none';
            });
            document.addEventListener('mousemove', (e) => {
                if (!isDown) return;
                let left = e.clientX - ox;
                let top = e.clientY - oy;
                if (left < 0) left = 0;
                if (top < 0) top = 0;
                el.style.left = left + 'px';
                el.style.top = top + 'px';
            });
            document.addEventListener('mouseup', () => {
                isDown = false;
                document.body.style.userSelect = '';
            });
        }

        _toggleMinimize (root) {
            const content = root.querySelector('#' + this.panelId + '-content');
            const tabs = root.querySelector('#' + this.panelId + '-tabsbar');
            if (!content) return;
            const hidden = content.style.display === 'none';
            content.style.display = hidden ? 'block' : 'none';
            tabs.style.display = hidden ? 'flex' : 'none';
        }

        _toggleFullscreen (root) {
            if (root.dataset.fullscreen === '1') {
                root.style.left = root.dataset.prevLeft || '50px';
                root.style.top = root.dataset.prevTop || '50px';
                root.style.width = root.dataset.prevWidth || '820px';
                root.style.height = root.dataset.prevHeight || '540px';
                delete root.dataset.fullscreen;
            } else {
                root.dataset.prevLeft = root.style.left;
                root.dataset.prevTop = root.style.top;
                root.dataset.prevWidth = root.style.width;
                root.dataset.prevHeight = root.style.height;
                root.style.left = '0px';
                root.style.top = '0px';
                root.style.width = '100vw';
                root.style.height = '100vh';
                root.dataset.fullscreen = '1';
            }
        }

        // --- Tabs management ---
        _ensureDefaultTabs () {
            if (this.tabs.length) return;
            this.tabs = [
                { name: 'Welcome', hidden: false, content: this._welcomeContent.bind(this) },
                { name: 'Info', hidden: false, content: this._infoContent.bind(this) },
                { name: 'Console', hidden: true, content: this._consoleContent.bind(this) },
                { name: 'Shortcuts', hidden: false, content: this._shortcutsContent.bind(this) }
            ];
        }

        _renderTabsBar () {
            const bar = document.getElementById(this.panelId + '-tabsbar');
            if (!bar) return;
            bar.innerHTML = '';
            const visible = this.tabs.filter(t => (!t.hidden || (t.name === 'Console' && this.devMode) || this.visibleTabs));
            visible.forEach(t => {
                const btn = document.createElement('button');
                btn.textContent = t.name;
                btn.style.padding = '6px 10px';
                btn.style.border = 'none';
                btn.style.borderRadius = '6px';
                btn.style.cursor = 'pointer';
                btn.onclick = () => this._showTab(t.name);
                bar.appendChild(btn);
            });
        }

        _showTab (name) {
            this.activeTab = name;
            const content = document.getElementById(this.panelId + '-content');
            if (!content) return;
            content.innerHTML = '';
            const tab = this.tabs.find(t => t.name === name);
            if (!tab) { content.textContent = 'Tab not found.'; return; }
            const frag = tab.content();
            content.appendChild(frag);
        }

        // --- Menus ---
        _openMenu (name) {
            const content = document.getElementById(this.panelId + '-content');
            if (!content) return;
            content.innerHTML = '';
            const container = document.createElement('div');
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.gap = '10px';
            container.style.padding = '4px';

            if (name === 'File') {
                const saveBtn = this._makeButton('Save (asks name & ID)', '', () => this._fileSave(false));
                const saveAsBtn = this._makeButton('Save as (download)', '', () => this._fileSave(true));
                const openBtn = this._makeButton('Open (from computer)', '', () => this._fileOpenFromComputer());
                [saveBtn, saveAsBtn, openBtn].forEach(b => { b.style.padding = '10px'; container.appendChild(b); });
            } else if (name === 'Edit') {
                const renameBtn = this._makeButton('Rename (tab/file/code)', '', () => this._editRename());
                const deleteBtn = this._makeButton('Delete (confirm)', '', () => this._editDelete());
                [renameBtn, deleteBtn].forEach(b => { b.style.padding = '10px'; container.appendChild(b); });
            } else if (name === 'Tools') {
                const devBtn = this._makeButton('Toggle Dev Mode', '', () => { this.devMode = !this.devMode; this._renderTabsBar(); alert('Dev Mode ' + (this.devMode ? 'Enabled' : 'Disabled')); });
                const themeBtn = this._makeButton('Toggle Theme', '', () => { this.theme = (this.theme === 'dark') ? 'light' : 'dark'; this._applyTheme(); });
                const toggleTabsBtn = this._makeButton('Toggle Visibility of Coding Tabs', '', () => { this.visibleTabs = !this.visibleTabs; this._renderTabsBar(); });
                [devBtn, themeBtn, toggleTabsBtn].forEach(b => { b.style.padding = '10px'; container.appendChild(b); });
            } else if (name === 'Tab Manager') {
                const findBtn = this._makeButton('Find Tab (ask and highlight)', '', () => this._tabManagerFind());
                const newTabBtn = this._makeButton('New Coding Tab', '', () => this._tabManagerNew());
                const delTabBtn = this._makeButton('Delete Coding Tab', '', () => this._tabManagerDelete());
                const showHiddenToggle = this._makeButton('Show Hidden Tabs Toggle', '', () => { this.visibleTabs = !this.visibleTabs; this._renderTabsBar(); });
                [findBtn, newTabBtn, delTabBtn, showHiddenToggle].forEach(b => { b.style.padding = '10px'; container.appendChild(b); });
            } else if (name === 'Shortcuts') {
                this._showTab('Shortcuts');
                return;
            }

            content.appendChild(container);
        }

        // --- File operations ---
        _fileSave (download) {
            const active = this.activeTab;
            const code = this._getEditorContentForTab(active);
            const name = prompt('Enter name for this code:', active || 'My Code');
            if (!name) return;
            const id = prompt('Enter ID for this code (unique):', (name || 'code').toLowerCase().replace(/\s+/g, '-'));
            if (!id) return;
            const saved = this._getSavedObject();
            saved[id] = { name: name, id: id, code: code, updated: Date.now() };
            this._setSavedObject(saved);
            alert('Saved as ' + id);
            if (download) {
                try {
                    const blob = new Blob([JSON.stringify(saved[id], null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = id + '.json';
                    a.click();
                    URL.revokeObjectURL(url);
                } catch (e) { alert('Download failed: ' + e.message); }
            }
        }

        _fileOpenFromComputer () {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json,application/json';
            input.onchange = (e) => {
                const f = e.target.files[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    try {
                        const obj = JSON.parse(ev.target.result);
                        const id = obj.id || prompt('Imported file has no ID. Enter ID to use:');
                        if (!id) return;
                        const saved = this._getSavedObject();
                        saved[id] = obj;
                        this._setSavedObject(saved);
                        alert('Imported as ' + id);
                    } catch (err) { alert('Failed to read JSON: ' + (err.message || err)); }
                };
                reader.readAsText(f);
            };
            input.click();
        }

        // --- Edit operations ---
        _editRename () {
            const id = prompt('Enter saved code ID or tab name to rename:');
            if (!id) return;
            const saved = this._getSavedObject();
            if (saved[id]) {
                const newName = prompt('Enter new name for saved file:', saved[id].name || id);
                if (!newName) return;
                saved[id].name = newName;
                this._setSavedObject(saved);
                alert('Renamed saved file.');
                return;
            }
            const tab = this.tabs.find(t => t.name === id);
            if (tab) {
                const newName = prompt('Enter new tab name:', tab.name);
                if (!newName) return;
                tab.name = newName;
                this._renderTabsBar();
                alert('Tab renamed.');
                return;
            }
            alert('Not found.');
        }

        _editDelete () {
            const id = prompt('Enter saved code ID or tab name to delete:');
            if (!id) return;
            if (!confirm('Are you sure you want to delete "' + id + '"?')) return;
            const saved = this._getSavedObject();
            if (saved[id]) {
                delete saved[id];
                this._setSavedObject(saved);
                alert('Deleted saved file.');
                return;
            }
            const idx = this.tabs.findIndex(t => t.name === id);
            if (idx !== -1) {
                this.tabs.splice(idx, 1);
                this._renderTabsBar();
                this._showTab('Welcome');
                alert('Deleted tab.');
                return;
            }
            alert('Not found.');
        }

        // --- Tab Manager ---
        _tabManagerFind () {
            const what = prompt('What tab are you looking for?');
            if (!what) return;
            const bar = document.getElementById(this.panelId + '-tabsbar');
            if (!bar) return;
            const btns = Array.from(bar.querySelectorAll('button'));
            const match = btns.find(b => b.textContent === what);
            if (match) {
                match.style.transition = 'box-shadow 0.2s';
                match.style.boxShadow = '0 0 0 4px rgba(255,200,0,0.9)';
                setTimeout(()=>{ match.style.boxShadow=''; }, 5000);
                this._showTab(what);
            } else alert('Tab not found.');
        }

        _tabManagerNew () {
            const name = prompt('Name of new code/tab:');
            if (!name) return;
            this.tabs.push({ name: name, hidden: false, content: () => this._editTabContent(name) });
            this._renderTabsBar();
            this._showTab(name);
        }

        _tabManagerDelete () {
            const name = prompt('Tab to delete:');
            if (!name) return;
            const idx = this.tabs.findIndex(t => t.name === name);
            if (idx === -1) return alert('Tab not found');
            if (!confirm('Delete tab "' + name + '"?')) return;
            this.tabs.splice(idx, 1);
            this._renderTabsBar();
            this._showTab('Welcome');
        }

        // --- Tab contents ---
        _welcomeContent () {
            const wrap = document.createElement('div');
            wrap.style.display = 'flex';
            wrap.style.flexDirection = 'column';
            wrap.style.alignItems = 'center';
            wrap.style.justifyContent = 'center';
            wrap.style.height = '100%';
            wrap.style.gap = '12px';

            const h = document.createElement('h2'); h.textContent = 'Welcome to Code Panel GUI';
            const info = document.createElement('div'); info.textContent = 'Creator: 2pro12342 — Use File / Edit / Tools / Tab Manager / Shortcuts';
            const btns = document.createElement('div'); btns.style.display = 'flex'; btns.style.gap = '8px';

            const createNew = this._makeButton('Create New File', '', ()=>this._tabManagerNew());
            const openNew = this._makeButton('Open New File', '', ()=>this._fileOpenFromComputer());
            const openInfo = this._makeButton('Open Info Tab', '', ()=>this._showTab('Info'));
            [createNew, openNew, openInfo].forEach(b=>{ b.style.padding = '8px 12px'; btns.appendChild(b); });

            wrap.appendChild(h);
            wrap.appendChild(info);
            wrap.appendChild(btns);
            return wrap;
        }

        _infoContent () {
            const wrap = document.createElement('div');
            wrap.style.display = 'flex';
            wrap.style.flexDirection = 'column';
            wrap.style.gap = '8px';
            const p = document.createElement('div');
            p.innerHTML = '<b>File:</b> Save, Save as (download), Open (from computer).<br>' +
                '<b>Edit:</b> Rename, Delete.<br>' +
                '<b>Tools:</b> Dev Mode (shows Console), Theme toggle, Toggle coding tabs visibility.<br><br>' +
                '<b>Dev Mode:</b> shows Console tab and basic error information.<br>' +
                'Creator: 2pro12342';
            wrap.appendChild(p);
            return wrap;
        }

        _consoleContent () {
            const wrap = document.createElement('div');
            wrap.style.display = 'flex';
            wrap.style.flexDirection = 'column';
            wrap.style.height = '100%';
            wrap.style.gap = '8px';
            const area = document.createElement('textarea');
            area.style.flex = '1'; area.style.width = '100%'; area.readOnly = true;
            area.value = 'Console output (Dev Mode).';
            this._consoleArea = area;
            wrap.appendChild(area);
            return wrap;
        }

        _shortcutsContent () {
            const wrap = document.createElement('div');
            wrap.style.display = 'flex';
            wrap.style.flexDirection = 'column';
            wrap.style.gap = '6px';
            const list = [
                { k: 'CTRL + C', d: 'Copy' },
                { k: 'CTRL + V', d: 'Paste' },
                { k: 'CTRL + S', d: 'Save or Save As (If unsaved)' },
                { k: 'CTRL + F', d: 'Find the text/code' }
            ];
            list.forEach(row => {
                const r = document.createElement('div');
                r.style.display = 'flex'; r.style.justifyContent = 'space-between'; r.style.alignItems = 'center';
                const info = document.createElement('div'); info.textContent = row.k + ' — ' + row.d;
                const icons = document.createElement('div'); icons.style.display = 'flex'; icons.style.gap = '4px';
                const edit = this._makeButton('✎','Edit', ()=>alert('Edit shortcut not implemented'));
                const clear = this._makeButton('🗑','Clear', ()=>alert('Clear shortcut not implemented'));
                const reset = this._makeButton('↺','Reset', ()=>alert('Reset to default not implemented'));
                [edit, clear, reset].forEach(b=>{ b.style.width='28px'; b.style.height='28px'; icons.appendChild(b); });
                r.appendChild(info); r.appendChild(icons); wrap.appendChild(r);
            });
            return wrap;
        }

        _editTabContent (tabName) {
            const wrapper = document.createElement('div');
            wrapper.style.display = 'flex';
            wrapper.style.flexDirection = 'column';
            wrapper.style.height = '100%';
            wrapper.style.gap = '8px';

            const toolbar = document.createElement('div'); toolbar.style.display = 'flex'; toolbar.style.gap = '6px';
            const saveBtn = this._makeButton('Save', '', ()=>this._fileSave(false));
            const saveAsBtn = this._makeButton('Save as', '', ()=>this._fileSave(true));
            const findBtn = this._makeButton('Find', '', ()=> {
                const q = prompt('Find:');
                if (q) this._findInEditor(q);
            });
            toolbar.appendChild(saveBtn); toolbar.appendChild(saveAsBtn); toolbar.appendChild(findBtn);

            const textarea = document.createElement('textarea');
            textarea.style.flex = '1'; textarea.style.width = '100%';
            textarea.placeholder = 'Write code here...';
            textarea.dataset.tab = tabName;

            wrapper.appendChild(toolbar);
            wrapper.appendChild(textarea);
            return wrapper;
        }

        _getEditorContentForTab (tabName) {
            const content = document.getElementById(this.panelId + '-content');
            if (!content) return '';
            const ta = content.querySelector('textarea');
            return ta ? ta.value : '';
        }

        _applyTheme () {
            const root = document.getElementById(this.panelId);
            if (!root) return;
            this._applyThemeToElement(root);
            this._renderTabsBar();
            this._showTab(this.activeTab);
        }

        // --- Keyboard shortcuts ---
        _bindShortcuts () {
            document.addEventListener('keydown', this._boundKeyHandler);
        }

        _keyboardHandler (e) {
            if (!(e.ctrlKey || e.metaKey)) return;
            const key = (e.key || '').toLowerCase();
            if (!this.opened) return;
            if (key === 's') { e.preventDefault(); this._fileSave(false); }
            if (key === 'f') { e.preventDefault(); const q = prompt('Find text:'); if (q) this._findInEditor(q); }
        }

        _findInEditor (q) {
            const content = document.getElementById(this.panelId + '-content');
            if (!content) return;
            const ta = content.querySelector('textarea');
            if (!ta) return alert('No editor found in active tab');
            const idx = ta.value.indexOf(q);
            if (idx === -1) return alert('Not found');
            ta.focus();
            ta.setSelectionRange(idx, idx + q.length);
        }

        // --- Console logging for Dev Mode ---
        _consoleLog (text) {
            if (!this.devMode) return;
            try {
                if (!this._consoleArea) {
                    // ensure console tab present
                    let ct = this.tabs.find(t => t.name === 'Console');
                    if (!ct) {
                        this.tabs.push({ name: 'Console', hidden: false, content: this._consoleContent.bind(this) });
                        this._renderTabsBar();
                    } else {
                        ct.hidden = false;
                        this._renderTabsBar();
                    }
                }
                if (this._consoleArea) {
                    this._consoleArea.value += '\n[' + new Date().toLocaleTimeString() + '] ' + text;
                    this._consoleArea.scrollTop = this._consoleArea.scrollHeight;
                }
            } catch (e) { /* ignore */ }
        }
    }

    // --- Try to register in multiple runtimes ---
    function tryRegister () {
        try {
            if (typeof Scratch !== 'undefined' && Scratch.extensions && Scratch.extensions.register) {
                Scratch.extensions.register(new CodePanelGUI());
                console.log('CodePanelGUI: registered via Scratch.extensions.register');
                return true;
            }
        } catch (e) { /* ignore */ }

        try {
            if (window.vm && window.vm.extensionManager && window.vm.extensionManager._registerExtension) {
                const ext = new CodePanelGUI(window.vm);
                window.vm.extensionManager._registerExtension('codePanelGUI', ext);
                console.log('CodePanelGUI: registered via vm.extensionManager._registerExtension');
                return true;
            }
        } catch (e) { /* ignore */ }

        try {
            window.CodePanelGUI = CodePanelGUI;
            console.warn('CodePanelGUI: automatic registration failed — instantiate with `new CodePanelGUI()` from console.');
            return false;
        } catch (e) {
            console.error('CodePanelGUI: registration failed', e);
            return false;
        }
    }

    tryRegister();

})();
