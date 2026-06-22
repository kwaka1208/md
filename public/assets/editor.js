const editor = document.getElementById('editor');
const preview = document.getElementById('preview');

const renderer = {
    code(code, infostring) {
        const lang = (infostring || '').match(/\S*/)[0];

        let highlighted = '';
        if (lang && hljs.getLanguage(lang)) {
            try {
                highlighted = hljs.highlight(code, { language: lang }).value;
            } catch (e) { }
        } else {
            try {
                highlighted = hljs.highlightAuto(code).value;
            } catch (e) { }
        }

        if (!highlighted) {
            highlighted = code.replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        }

        const languageClass = lang ? `language-${lang}` : '';
        return `<pre><code class="hljs ${languageClass}">${highlighted}</code></pre>\n`;
    }
};

marked.use({ renderer });

const STORAGE_FILES_KEY = 'md_editor_files';
const STORAGE_CURRENT_KEY = 'md_editor_current_id';
const STORAGE_DISCLAIMER_KEY = 'md_editor_disclaimer_accepted';

const MAX_ZIP_FILES = 50;
const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024; // 1MB per file

let files = [];
let currentFileId = null;

function init() {
    if (!localStorage.getItem(STORAGE_DISCLAIMER_KEY) && !sessionStorage.getItem('md_editor_disclaimer_session')) {
        document.getElementById('disclaimerModal').classList.add('active');
    }

    loadFilesFromStorage();
    updateFileList();
    loadCurrentFile();
    updatePreview();
}

function acceptDisclaimer() {
    const noShow = document.getElementById('disclaimerNoShow').checked;
    if (noShow) {
        localStorage.setItem(STORAGE_DISCLAIMER_KEY, 'true');
    } else {
        sessionStorage.setItem('md_editor_disclaimer_session', 'true');
    }
    document.getElementById('disclaimerModal').classList.remove('active');
}

function loadFilesFromStorage() {
    const savedFiles = localStorage.getItem(STORAGE_FILES_KEY);
    if (savedFiles) {
        try {
            files = JSON.parse(savedFiles);
        } catch (e) {
            files = [];
        }
    }

    if (files.length === 0) {
        const oldData = localStorage.getItem('md_editor_autosave_data');
        files.push({
            id: 'doc_' + Date.now(),
            title: '無題のドキュメント',
            content: oldData !== null ? oldData : ''
        });
        localStorage.removeItem('md_editor_autosave_data');
        saveFilesToStorage();
    }
}

function saveFilesToStorage() {
    try {
        localStorage.setItem(STORAGE_FILES_KEY, JSON.stringify(files));
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
            alert('保存領域の上限に達しました。不要なドキュメントを削除してください。');
        }
    }
}

function updateFileList() {
    const select = document.getElementById('fileSelect');
    select.innerHTML = '';
    files.forEach(f => {
        const option = document.createElement('option');
        option.value = f.id;
        option.textContent = f.title;
        select.appendChild(option);
    });
    if (currentFileId) {
        select.value = currentFileId;
    }
}

function loadCurrentFile() {
    let savedCurrentId = localStorage.getItem(STORAGE_CURRENT_KEY);
    let file = files.find(f => f.id === savedCurrentId);

    if (!file && files.length > 0) {
        file = files[0];
    }

    if (file) {
        currentFileId = file.id;
        document.getElementById('fileSelect').value = currentFileId;
        editor.value = file.content;
        localStorage.setItem(STORAGE_CURRENT_KEY, currentFileId);
    }
}

function loadFile() {
    const select = document.getElementById('fileSelect');
    currentFileId = select.value;
    localStorage.setItem(STORAGE_CURRENT_KEY, currentFileId);
    const file = files.find(f => f.id === currentFileId);
    if (file) {
        editor.value = file.content;
        updatePreview();
    }
}

function createNewFile() {
    const title = prompt('新しいドキュメントの名前を入力してください', '新しいドキュメント');
    if (title) {
        const newFile = {
            id: 'doc_' + Date.now(),
            title: title.trim() || '無題のドキュメント',
            content: ''
        };
        files.push(newFile);
        currentFileId = newFile.id;

        saveFilesToStorage();
        localStorage.setItem(STORAGE_CURRENT_KEY, currentFileId);

        updateFileList();
        editor.value = '';
        updatePreview();
    }
}

function renameCurrentFile() {
    const file = files.find(f => f.id === currentFileId);
    if (file) {
        const newTitle = prompt('ドキュメントの新しい名前を入力してください', file.title);
        if (newTitle && newTitle.trim() !== '') {
            file.title = newTitle.trim();
            saveFilesToStorage();
            updateFileList();
        }
    }
}

function deleteCurrentFile() {
    if (files.length <= 1) {
        alert('最後のドキュメントは削除できません。内容をクリアするか、新しいドキュメントを作成してから削除してください。');
        return;
    }

    const file = files.find(f => f.id === currentFileId);
    if (confirm(`「${file.title}」を削除してもよろしいですか？\n※この操作は取り消せません。`)) {
        files = files.filter(f => f.id !== currentFileId);
        currentFileId = files[0].id;

        saveFilesToStorage();
        localStorage.setItem(STORAGE_CURRENT_KEY, currentFileId);

        updateFileList();
        loadCurrentFile();
        updatePreview();
    }
}

function updatePreview() {
    const markdownText = editor.value;

    if (currentFileId) {
        const file = files.find(f => f.id === currentFileId);
        if (file) {
            file.content = markdownText;
            saveFilesToStorage();
        }
    }

    const htmlContent = DOMPurify.sanitize(marked.parse(markdownText));
    preview.innerHTML = htmlContent;
}

editor.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        if (e.isComposing) return;

        const start = this.selectionStart;
        const end = this.selectionEnd;

        const text = this.value;
        const prevLineStart = text.lastIndexOf('\n', start - 1) + 1;
        const currentLine = text.substring(prevLineStart, start);

        const listMatch = currentLine.match(/^(\s*)([-*]|\d+\.)\s/);

        if (listMatch) {
            e.preventDefault();

            const indent = listMatch[1];
            const marker = listMatch[2];

            if (currentLine.trim() === marker || currentLine.trim() === marker + '.') {
                const newText = text.substring(0, prevLineStart) + '\n' + text.substring(end);
                this.value = newText;
                this.selectionStart = this.selectionEnd = prevLineStart + 1;
            } else {
                let newMarker = marker;
                if (/^\d+\.$/.test(marker)) {
                    const num = parseInt(marker);
                    newMarker = (num + 1) + '.';
                }

                const insertion = `\n${indent}${newMarker} `;
                const newText = text.substring(0, start) + insertion + text.substring(end);

                this.value = newText;
                this.selectionStart = this.selectionEnd = start + insertion.length;
            }
            updatePreview();
        }
    }

    if (e.key === 'Tab') {
        e.preventDefault();
        const start = this.selectionStart;
        const end = this.selectionEnd;
        const value = this.value;

        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        const lineEnd = value.indexOf('\n', end);
        const endLinePos = lineEnd === -1 ? value.length : lineEnd;

        const lines = value.substring(lineStart, endLinePos).split('\n');
        const indentUnit = '  ';

        let newText = '';
        let newStart = start;
        let newEnd = end;

        if (e.shiftKey) {
            let nextNum = 1;
            const preLines = value.substring(0, lineStart).split('\n');

            const firstSelLine = lines[0];
            const firstSelIndentMatch = firstSelLine.match(/^\s*/);
            const currentIndentLen = firstSelIndentMatch ? firstSelIndentMatch[0].length : 0;
            const targetIndentLen = Math.max(0, currentIndentLen - indentUnit.length);

            for (let i = preLines.length - 1; i >= 0; i--) {
                const pLine = preLines[i];
                const pIndentMatch = pLine.match(/^\s*/);
                const pIndentLen = pIndentMatch ? pIndentMatch[0].length : 0;

                if (pIndentLen === targetIndentLen) {
                    const listMatch = pLine.match(/^(\s*)(\d+)\./);
                    if (listMatch) {
                        nextNum = parseInt(listMatch[2]) + 1;
                    }
                    if (pLine.trim().length > 0) break;
                } else if (pIndentLen < targetIndentLen) {
                    if (pLine.trim().length > 0) break;
                }
            }

            newText = lines.map((line, i) => {
                let processedLine = line;

                if (line.startsWith(indentUnit)) {
                    processedLine = line.substring(indentUnit.length);
                    if (i === 0) newStart -= indentUnit.length;
                    newEnd -= indentUnit.length;
                } else if (line.startsWith(' ') || line.startsWith('\t')) {
                    const match = line.match(/^\s+/);
                    const len = match ? Math.min(match[0].length, indentUnit.length) : 0;
                    processedLine = line.substring(len);
                    if (i === 0) newStart -= len;
                    newEnd -= len;
                }

                const listMatch = processedLine.match(/^(\s*)(\d+)\.(\s+)/);
                if (listMatch) {
                    processedLine = processedLine.replace(/^(\s*)\d+\./, `$1${nextNum}.`);
                    nextNum++;
                }

                return processedLine;
            }).join('\n');
        } else {
            let nextNum = 1;
            const preLines = value.substring(0, lineStart).split('\n');

            const firstSelLine = lines[0];
            const firstSelIndentMatch = firstSelLine.match(/^\s*/);
            const currentIndentLen = firstSelIndentMatch ? firstSelIndentMatch[0].length : 0;
            const targetIndentLen = currentIndentLen + indentUnit.length;

            for (let i = preLines.length - 1; i >= 0; i--) {
                const pLine = preLines[i];
                const pIndentMatch = pLine.match(/^\s*/);
                const pIndentLen = pIndentMatch ? pIndentMatch[0].length : 0;

                if (pIndentLen === targetIndentLen) {
                    const listMatch = pLine.match(/^(\s*)(\d+)\./);
                    if (listMatch) {
                        nextNum = parseInt(listMatch[2]) + 1;
                    }
                    if (pLine.trim().length > 0) break;
                } else if (pIndentLen < targetIndentLen) {
                    if (pLine.trim().length > 0) break;
                }
            }

            newText = lines.map((line, i) => {
                let indentedLine = indentUnit + line;

                const listMatch = indentedLine.match(/^(\s*)(\d+)\.(\s+)/);
                if (listMatch) {
                    indentedLine = indentedLine.replace(/^(\s*)\d+\./, `$1${nextNum}.`);
                    nextNum++;
                }

                const diff = indentedLine.length - line.length;
                if (i === 0) newStart += diff;
                newEnd += diff;

                return indentedLine;
            }).join('\n');
        }

        this.value = value.substring(0, lineStart) + newText + value.substring(endLinePos);

        this.selectionStart = Math.max(lineStart, newStart);
        this.selectionEnd = Math.max(lineStart, newEnd);
        updatePreview();
    }
});

async function copyToClipboard(type) {
    let text = "";
    if (type === 'markdown') {
        text = editor.value;
    } else if (type === 'html') {
        text = preview.innerHTML;
    }

    try {
        await navigator.clipboard.writeText(text);
        alert(`${type === 'markdown' ? 'Markdown' : 'HTML'} をクリップボードにコピーしました！`);
    } catch (err) {
        console.error('コピーに失敗しました:', err);
        alert('コピーに失敗しました');
    }
}

function downloadFile(type) {
    let content = "";
    let mimeType = "";
    let fileName = "";

    const currentFile = files.find(f => f.id === currentFileId);
    const baseFileName = currentFile && currentFile.title ? currentFile.title : 'document';

    if (type === 'md') {
        content = editor.value;
        mimeType = "text/markdown";
        fileName = `${baseFileName}.md`;
    } else if (type === 'html') {
        const isDark = document.body.classList.contains('dark-mode');
        const hljsCss = isDark
            ? 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css'
            : 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css';

        const safeTitle = baseFileName
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');

        content = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>${safeTitle}</title>
<link rel="stylesheet" href="${hljsCss}">
<style>
body { font-family: sans-serif; line-height: 1.6; color: ${isDark ? '#c9d1d9' : '#333'}; background-color: ${isDark ? '#0d1117' : '#fff'}; max-width: 800px; margin: 0 auto; padding: 20px; }
h1, h2, h3 { border-bottom: 1px solid #ddd; padding-bottom: 0.3em; }
code { background-color: ${isDark ? '#161b22' : '#f6f8fa'}; padding: 0.2em 0.4em; border-radius: 3px; font-family: monospace; }
pre { background-color: ${isDark ? '#161b22' : '#f6f8fa'}; padding: 16px; border-radius: 6px; overflow: auto; line-height: 1.5; }
blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 1em; color: #666; }
img { max-width: 100%; }
table { border-collapse: collapse; width: 100%; margin: 1em 0; }
th, td { border: 1px solid #ddd; padding: 6px 13px; }
th { background-color: ${isDark ? '#21262d' : '#f0f0f0'}; }
</style>
</head>
<body>
${preview.innerHTML}
</body>
</html>`;
        mimeType = "text/html";
        fileName = `${baseFileName}.html`;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function exportZip() {
    if (files.length === 0) {
        alert("エクスポートするドキュメントがありません。");
        return;
    }

    try {
        const JSZipObj = window.JSZip;
        if (!JSZipObj) {
            alert("JSZipライブラリがロードされていません。リロードして再試行してください。");
            return;
        }

        const zip = new JSZipObj();
        const usedNames = new Set();

        files.forEach((f, idx) => {
            let title = f.title.trim() || `Untitled_${idx + 1}`;
            if (!title.toLowerCase().endsWith('.md')) {
                title += '.md';
            }

            let uniqueTitle = title;
            let counter = 1;
            while (usedNames.has(uniqueTitle)) {
                uniqueTitle = title.replace(/\.md$/i, `_${counter}.md`);
                counter++;
            }
            usedNames.add(uniqueTitle);

            zip.file(uniqueTitle, f.content || '');
        });

        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const HH = String(now.getHours()).padStart(2, '0');
        const MM = String(now.getMinutes()).padStart(2, '0');

        a.download = `md_export_${yyyy}${mm}${dd}_${HH}${MM}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("ZIPエクスポートエラー", error);
        alert("ZIPエクスポートに失敗しました。");
    }
}

async function importZip(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const JSZipObj = window.JSZip;
        if (!JSZipObj) {
            alert("JSZipライブラリがロードされていません。");
            return;
        }

        const zip = new JSZipObj();
        const contents = await zip.loadAsync(file);

        const allEntries = Object.entries(contents.files).filter(
            ([filename, entry]) => !entry.dir && filename.toLowerCase().endsWith('.md')
        );

        if (allEntries.length > MAX_ZIP_FILES) {
            alert(`インポートできるファイルは最大 ${MAX_ZIP_FILES} 件です（ZIPに ${allEntries.length} 件含まれています）。`);
            return;
        }

        let importedCount = 0;
        const newFiles = [];

        for (const [filename, zipEntry] of allEntries) {
            const textContent = await zipEntry.async("string");

            if (textContent.length > MAX_FILE_SIZE_BYTES) {
                alert(`「${filename}」のサイズが上限（1MB）を超えているためスキップしました。`);
                continue;
            }

            const title = filename.replace(/\.md$/i, '').split('/').pop() || 'Imported Document';

            newFiles.push({
                id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                title: title,
                content: textContent
            });

            importedCount++;
        }

        if (importedCount > 0) {
            files = files.concat(newFiles);
            currentFileId = newFiles[newFiles.length - 1].id;

            saveFilesToStorage();
            localStorage.setItem(STORAGE_CURRENT_KEY, currentFileId);
            updateFileList();
            loadFile();

            alert(`${importedCount}個のファイルをインポートしました。`);
        } else {
            alert("ZIPファイル内に有効な .md ファイルが見つかりませんでした。");
        }

    } catch (error) {
        console.error("ZIPインポートエラー", error);
        alert("ZIPファイルの読み込みに失敗しました。ファイルが破損している可能性があります。");
    } finally {
        event.target.value = '';
    }
}

let isDark = false;
function toggleTheme() {
    isDark = !isDark;
    document.body.classList.toggle('dark-mode', isDark);
    document.getElementById('themeBtn').textContent = isDark ? '☀️' : '🌙';

    document.getElementById('hljs-light').disabled = isDark;
    document.getElementById('hljs-dark').disabled = !isDark;
}

function openFileModal() {
    document.getElementById('fileModal').classList.add('active');
}

function closeFileModal() {
    document.getElementById('fileModal').classList.remove('active');
}

function closeFileModalOnOutside(e) {
    if (e.target.id === 'fileModal') closeFileModal();
}

function openHelp() {
    document.getElementById('helpModal').classList.add('active');
}

function closeHelp() {
    document.getElementById('helpModal').classList.remove('active');
}

function closeHelpOnOutside(e) {
    if (e.target.id === 'helpModal') closeHelp();
}

function openPromptModal() {
    document.getElementById('promptModal').classList.add('active');
}

function closePrompt() {
    document.getElementById('promptModal').classList.remove('active');
}

function closePromptOnOutside(e) {
    if (e.target.id === 'promptModal') closePrompt();
}

async function insertPrompt(type) {
    try {
        const response = await fetch(`/assets/prompts/${type}.md`);
        if (!response.ok) throw new Error('ネットワークエラー');
        const promptText = await response.text();

        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const text = editor.value;

        let insertText = promptText;
        if (start > 0 && text[start - 1] !== '\n') {
            insertText = '\n\n' + insertText;
        }
        insertText = insertText + '\n\n';

        editor.value = text.substring(0, start) + insertText + text.substring(end);

        editor.selectionStart = editor.selectionEnd = start + insertText.length;
        editor.focus();

        updatePreview();
        closePrompt();
    } catch (error) {
        console.error('プロンプトの読み込みエラー:', error);
        alert('プロンプトテンプレートの読み込みに失敗しました。');
    }
}

let isSyncingEditor = false;
let isSyncingPreview = false;

editor.addEventListener('scroll', function () {
    if (!isSyncingEditor) {
        isSyncingPreview = true;
        const percentage = this.scrollTop / (this.scrollHeight - this.clientHeight);
        preview.scrollTop = percentage * (preview.scrollHeight - preview.clientHeight);
    }
    isSyncingEditor = false;
});

preview.addEventListener('scroll', function () {
    if (!isSyncingPreview) {
        isSyncingEditor = true;
        const percentage = this.scrollTop / (this.scrollHeight - this.clientHeight);
        editor.scrollTop = percentage * (editor.scrollHeight - editor.clientHeight);
    }
    isSyncingPreview = false;
});

init();
