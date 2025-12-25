document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const noteTitle = document.getElementById('noteTitle');
    const noteContent = document.getElementById('noteContent');
    const noteList = document.getElementById('noteList');
    const searchInput = document.getElementById('searchNotes');
    const themeToggle = document.getElementById('themeToggle');
    const wordCountEl = document.getElementById('wordCount');
    const lastSavedEl = document.getElementById('lastSaved');
    const statusMessageEl = document.getElementById('statusMessage');
    const noteCountEl = document.getElementById('noteCount');
    const pinButton = document.getElementById('pinNote');
    const fileInput = document.getElementById('fileInput');
    const deleteButton = document.getElementById('deleteNote');
    
    // NEW Alignment Selector
    const alignSelect = document.getElementById('alignSelect'); 
    
    // --- Menu Elements ---
    const menuNew = document.getElementById('menuNew');
    const menuOpen = document.getElementById('menuOpen');
    const menuSave = document.getElementById('menuSave');
    const menuPrint = document.getElementById('menuPrint');
    const menuExportPdf = document.getElementById('menuExportPdf');
    
    // Edit Menu
    const menuUndo = document.getElementById('menuUndo');
    const menuRedo = document.getElementById('menuRedo');
    const menuCut = document.getElementById('menuCut');
    const menuCopy = document.getElementById('menuCopy');
    const menuPaste = document.getElementById('menuPaste');
    const menuSelectAll = document.getElementById('menuSelectAll');
    const menuFind = document.getElementById('menuFind');

    // Insert Menu
    const menuDate = document.getElementById('menuDate');
    const menuSpecial = document.getElementById('menuSpecial');
    const menuNbsp = document.getElementById('menuNbsp');

    // --- Modals ---
    const findModal = document.getElementById('findReplaceModal');
    const findInput = document.getElementById('findInput');
    const replaceInput = document.getElementById('replaceInput');
    const btnReplace = document.getElementById('btnReplace');
    const btnReplaceAll = document.getElementById('btnReplaceAll');
    
    // Special Char
    const charModal = document.getElementById('specialCharModal');
    const charGrid = document.getElementById('charGrid');
    
    let currentNoteId = null;
    let saveTimeout;
    
    // --- SELECTION TRACKING ---
    let lastRange = null;

    function saveSelection() {
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            if (noteContent.contains(range.commonAncestorContainer)) {
                lastRange = range.cloneRange();
            }
        }
    }

    function restoreSelection() {
        noteContent.focus();
        if (lastRange) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(lastRange);
        }
    }

    // --- History System ---
    const history = {
        stack: [], currentIndex: -1, maxSize: 50,
        add(state) {
            if (this.currentIndex < this.stack.length - 1) this.stack = this.stack.slice(0, this.currentIndex + 1);
            this.stack.push(state);
            if (this.stack.length > this.maxSize) this.stack.shift(); else this.currentIndex++;
        },
        undo() { if (this.currentIndex > 0) { this.currentIndex--; return this.stack[this.currentIndex]; } return null; },
        redo() { if (this.currentIndex < this.stack.length - 1) { this.currentIndex++; return this.stack[this.currentIndex]; } return null; },
        reset(initialState) { this.stack = [initialState]; this.currentIndex = 0; }
    };

    function init() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        loadNotes();
        setupEventListeners();
        setupMenuListeners();
        setupInsertMenu();
        updateWordCount();
        generateCharGrid();
    }

    function setupEventListeners() {
        themeToggle.addEventListener('click', toggleTheme);
        pinButton.addEventListener('click', togglePin);
        deleteButton.addEventListener('click', deleteCurrentNote);

        // Toolbar Buttons
        document.querySelectorAll('.toolbar button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                insertFormatting(e.currentTarget.getAttribute('data-format'));
            });
        });

        // NEW: Align Select Listener
        alignSelect.addEventListener('change', () => {
            restoreSelection(); 
            const command = alignSelect.value;
            document.execCommand(command, false, null); // Execute justifyLeft, justifyCenter, or justifyRight
            noteContent.focus();
            saveSelection();
            history.add(noteContent.innerHTML);
            handleContentChange();
            alignSelect.selectedIndex = 0; // Reset to "Align" label
        });

        noteTitle.addEventListener('input', () => { handleContentChange(); autoSave(); });
        
        // Editor Listeners
        noteContent.addEventListener('input', () => { 
            handleContentChange(); 
            autoSave(); 
            saveSelection();
        });
        
        noteContent.addEventListener('mouseup', saveSelection);
        noteContent.addEventListener('keyup', saveSelection);
        
        noteContent.addEventListener('focus', () => { 
            if(history.stack.length === 0) history.add(noteContent.innerHTML); 
        });
        
        noteContent.addEventListener('keyup', (e) => {
            if (e.key === ' ' || e.key === 'Enter') {
                const currentVal = noteContent.innerHTML;
                if (currentVal !== history.stack[history.currentIndex]) history.add(currentVal);
            }
        });

        searchInput.addEventListener('input', handleSearch);
        document.addEventListener('keydown', handleKeyboardShortcuts);
        
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                findModal.style.display = "none";
                charModal.style.display = "none";
            });
        });
        
        window.addEventListener('click', (e) => {
            if (e.target == findModal) findModal.style.display = "none";
            if (e.target == charModal) charModal.style.display = "none";
        });
        
        fileInput.addEventListener('change', handleFileImport);
    }

    function autoSave() {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(saveNote, 1000);
    }

    function setupMenuListeners() {
        menuNew.addEventListener('click', createNewNote);
        menuSave.addEventListener('click', () => { saveNote(); showStatus('Saved!', 'success'); });
        menuOpen.addEventListener('click', () => fileInput.click());
        menuPrint.addEventListener('click', () => setTimeout(() => window.print(), 300));
        menuExportPdf.addEventListener('click', exportToPDF);

        menuUndo.addEventListener('click', () => { document.execCommand('undo'); handleContentChange(); });
        menuRedo.addEventListener('click', () => { document.execCommand('redo'); handleContentChange(); });
        menuCut.addEventListener('click', () => { document.execCommand('cut'); handleContentChange(); });
        menuCopy.addEventListener('click', () => { document.execCommand('copy'); });
        menuPaste.addEventListener('click', async () => {
            try { 
                const txt = await navigator.clipboard.readText(); 
                restoreSelection();
                document.execCommand('insertText', false, txt);
                handleContentChange();
            } 
            catch(e) { 
                noteContent.focus();
                showStatus('Use Ctrl+V to paste', 'info'); 
            }
        });
        menuSelectAll.addEventListener('click', () => { 
            noteContent.focus();
            document.execCommand('selectAll');
            saveSelection();
        });
        menuFind.addEventListener('click', () => { 
            saveSelection(); 
            findModal.style.display = "block"; 
            findInput.focus(); 
        });
        
        btnReplace.addEventListener('click', () => {
            const innerHTML = noteContent.innerHTML;
            const newHTML = innerHTML.replace(findInput.value, replaceInput.value);
            if(innerHTML !== newHTML) { 
                noteContent.innerHTML = newHTML; 
                history.add(newHTML); 
                handleContentChange(); 
            }
        });
        btnReplaceAll.addEventListener('click', () => {
            const innerHTML = noteContent.innerHTML;
            const regex = new RegExp(escapeRegExp(findInput.value), 'g');
            const newHTML = innerHTML.replace(regex, replaceInput.value);
            if(innerHTML !== newHTML) { 
                noteContent.innerHTML = newHTML; 
                history.add(newHTML); 
                handleContentChange(); 
                showStatus('Replaced All', 'success'); 
                findModal.style.display="none"; 
            }
        });
    }

    function setupInsertMenu() {
        menuDate.addEventListener('click', () => {
            restoreSelection();
            insertTextAtCursor(new Date().toLocaleString());
        });
        menuNbsp.addEventListener('click', () => {
            restoreSelection();
            insertHtmlAtCursor('&nbsp;');
        });
        menuSpecial.addEventListener('click', () => {
            saveSelection();
            charModal.style.display = "block";
        });
        
        // Font Size
        document.querySelectorAll('.size-opt').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                restoreSelection();
                document.execCommand('fontSize', false, btn.getAttribute('data-size'));
                handleContentChange();
            });
        });
    }
    
    // --- Helper Logic ---

    function handleFileImport(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const content = ev.target.result;
            createNewNote(file.name.replace(/\.[^/.]+$/, "")); 
            noteContent.innerHTML = content.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
            history.reset(noteContent.innerHTML);
            handleContentChange();
            saveNote();
        };
        reader.readAsText(file);
        fileInput.value = '';
    }

    function generateCharGrid() {
        const chars = ['©','®','™','€','£','¥','¢','§','¶','←','→','↑','↓','•','∞','≈','≠','≤','≥','±','µ','π','Ω','°'];
        charGrid.innerHTML = '';
        chars.forEach(char => {
            const btn = document.createElement('div');
            btn.className = 'char-btn';
            btn.textContent = char;
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                restoreSelection();
                insertTextAtCursor(char);
                charModal.style.display = 'none';
            });
            charGrid.appendChild(btn);
        });
    }

    function insertTextAtCursor(text) {
        document.execCommand('insertText', false, text);
        noteContent.focus();
        saveSelection();
        history.add(noteContent.innerHTML);
        handleContentChange();
    }
    
    function insertHtmlAtCursor(html) {
        document.execCommand('insertHTML', false, html);
        noteContent.focus();
        saveSelection();
        history.add(noteContent.innerHTML);
        handleContentChange();
    }

    function insertFormatting(format) {
        restoreSelection();
        if (format === 'createLink') {
            const url = prompt('Enter the link URL:', 'http://');
            if (url) document.execCommand(format, false, url);
        } else {
            document.execCommand(format, false, null);
        }
        noteContent.focus();
        saveSelection();
        history.add(noteContent.innerHTML);
        handleContentChange();
    }

    function exportToPDF() {
        if (!currentNoteId) return;
        showStatus('Generating PDF...', 'info');
        const title = noteTitle.value || 'Untitled';
        const element = document.createElement('div');
        element.innerHTML = `
            <div style="padding: 20px; font-family: Arial;">
                <h1 style="border-bottom: 2px solid #333;">${title}</h1>
                <div style="font-size: 14px; line-height: 1.6;">${noteContent.innerHTML}</div>
            </div>`;
        const opt = { margin: 10, filename: `${title}.pdf`, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4' } };
        html2pdf().set(opt).from(element).save().then(() => showStatus('Downloaded!', 'success'));
    }

    function togglePin() {
        if (!currentNoteId) return;
        const notes = getNotes();
        const idx = notes.findIndex(n => n.id === currentNoteId);
        if (idx !== -1) {
            notes[idx].pinned = !notes[idx].pinned;
            saveNotes(notes);
            renderNoteList(notes);
            updatePinButtonVisual(notes[idx].pinned);
        }
    }

    function handleContentChange() {
        updateWordCount();
    }

    function updateWordCount() {
        const t = noteContent.innerText || "";
        wordCountEl.textContent = `${t.trim() ? t.trim().split(/\s+/).length : 0} words • ${t.length} chars`;
    }

    function toggleTheme() {
        const n = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', n);
        localStorage.setItem('theme', n);
    }

    function handleSearch() {
        const term = searchInput.value.toLowerCase();
        const notes = getNotes();
        if (!term) return renderNoteList(notes);
        renderNoteList(notes.filter(n => n.title.toLowerCase().includes(term) || n.content.toLowerCase().includes(term)));
    }

    function loadNotes() {
        const notes = getNotes();
        renderNoteList(notes);
        updateNoteCount(notes.length);
        if (notes.length > 0 && !currentNoteId) loadNote(notes[0].id);
        else if (notes.length === 0) createNewNote();
    }

    function renderNoteList(notes) {
        noteList.innerHTML = '';
        const sorted = notes.sort((a, b) => (a.pinned === b.pinned) ? new Date(b.updatedAt) - new Date(a.updatedAt) : a.pinned ? -1 : 1);
        sorted.forEach(note => {
            const div = document.createElement('div');
            div.className = `note-item ${note.pinned ? 'pinned' : ''} ${note.id === currentNoteId ? 'active' : ''}`;
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = note.content;
            const plainText = tempDiv.innerText || "";
            div.innerHTML = `${note.pinned ? '<i class="fa fa-thumbtack pin-icon"></i>' : ''}<h3>${note.title||'Untitled'}</h3><p>${plainText.substring(0,30)}</p>`;
            div.addEventListener('click', () => loadNote(note.id));
            noteList.appendChild(div);
        });
    }

    function createNewNote(title = 'Untitled Note') {
        const t = typeof title === 'string' ? title : 'Untitled Note';
        const newNote = { id: Date.now().toString(), title: t, content: '', pinned: false, updatedAt: new Date().toISOString() };
        const notes = getNotes();
        notes.push(newNote);
        saveNotes(notes);
        currentNoteId = newNote.id;
        noteTitle.value = t;
        noteContent.innerHTML = '';
        lastRange = null; 
        history.reset('');
        updatePinButtonVisual(false);
        renderNoteList(notes);
        noteTitle.focus();
    }

    function loadNote(id) {
        const note = getNotes().find(n => n.id === id);
        if (note) {
            currentNoteId = note.id;
            noteTitle.value = note.title;
            noteContent.innerHTML = note.content;
            history.reset(note.content);
            lastRange = null;
            updatePinButtonVisual(!!note.pinned);
            renderNoteList(getNotes());
            handleContentChange();
        }
    }

    function saveNote() {
        if (!currentNoteId) return;
        const notes = getNotes();
        const idx = notes.findIndex(n => n.id === currentNoteId);
        if (idx !== -1) {
            notes[idx] = { ...notes[idx], title: noteTitle.value.trim()||'Untitled', content: noteContent.innerHTML, updatedAt: new Date().toISOString() };
            saveNotes(notes);
            renderNoteList(notes);
            lastSavedEl.textContent = `Last saved: ${new Date().toLocaleTimeString()}`;
        }
    }
    
    function deleteCurrentNote() {
        if (!currentNoteId || !confirm('Delete this note?')) return;
        const notes = getNotes().filter(n => n.id !== currentNoteId);
        saveNotes(notes);
        if (notes.length > 0) loadNote(notes[0].id); else createNewNote();
        updateNoteCount(notes.length);
    }

    function updatePinButtonVisual(isPinned) {
        if (isPinned) pinButton.classList.add('active'); else pinButton.classList.remove('active');
        pinButton.style.color = isPinned ? 'white' : ''; 
    }

    function getNotes() { return JSON.parse(localStorage.getItem('notes') || '[]'); }
    function saveNotes(notes) { localStorage.setItem('notes', JSON.stringify(notes)); }
    function updateNoteCount(c) { noteCountEl.textContent = `${c} notes`; }
    function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
    function showStatus(msg, type='info') {
        statusMessageEl.textContent = msg;
        statusMessageEl.className = 'status-message show';
        statusMessageEl.style.color = type==='success'?'var(--success)':'#fff';
        setTimeout(() => statusMessageEl.classList.remove('show'), 2000);
    }
    function handleKeyboardShortcuts(e) {
        if ((e.ctrlKey || e.metaKey)) {
            switch(e.key.toLowerCase()) {
                case 's': e.preventDefault(); saveNote(); showStatus('Saved', 'success'); break;
                case 'n': e.preventDefault(); createNewNote(); break;
                case 'o': e.preventDefault(); fileInput.click(); break;
                case 'p': e.preventDefault(); menuPrint.click(); break;
                case 'f': e.preventDefault(); menuFind.click(); break;
                case 'b': e.preventDefault(); insertFormatting('bold'); break;
                case 'i': e.preventDefault(); insertFormatting('italic'); break;
                case 'u': e.preventDefault(); insertFormatting('underline'); break;
            }
        }
    }

    init();
});