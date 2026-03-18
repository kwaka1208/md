// --- コピー機能 ---
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

// --- ダウンロード機能 ---
function downloadFile(type) {
    let content = "";
    let mimeType = "";
    let fileName = "";

    if (type === 'md') {
        content = editor.value;
        mimeType = "text/markdown";
        fileName = "document.md";
    } else if (type === 'html') {
        const style = document.querySelector('style')?.textContent || '';
        const isDark = document.body.classList.contains('dark-mode');
        const hljsCss = isDark
            ? 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css'
            : 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css';

        content = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
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
        fileName = "document.html";
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

// --- テーマ切り替え ---
let isDark = false;
function toggleTheme() {
    isDark = !isDark;
    document.body.classList.toggle('dark-mode', isDark);
    document.getElementById('themeBtn').textContent = isDark ? '☀️' : '🌙';
    document.getElementById('hljs-light').disabled = isDark;
    document.getElementById('hljs-dark').disabled = !isDark;
}

// --- モーダル制御 ---
function openHelp() {
    document.getElementById('helpModal').classList.add('active');
}
function closeHelp() {
    document.getElementById('helpModal').classList.remove('active');
}
function closeHelpOnOutside(e) {
    if (e.target.id === 'helpModal') {
        closeHelp();
    }
}

function openPromptModal() {
    document.getElementById('promptModal').classList.add('active');
}
function closePrompt() {
    document.getElementById('promptModal').classList.remove('active');
}
function closePromptOnOutside(e) {
    if (e.target.id === 'promptModal') {
        closePrompt();
    }
}

async function insertPrompt(type) {
    try {
        const response = await fetch(`/assets/prompts/${type}.md`);
        if (!response.ok) {
            throw new Error('ネットワークエラーによりプロンプトの取得に失敗しました。');
        }
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

// --- スクロール同期 (簡易版) ---
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
