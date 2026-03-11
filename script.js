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

const PROMPT_TEMPLATES = {
    'meta': `# 命令\nあなたはプロンプトエンジニアリングの専門家です。以下の【目的】を達成するために、AIに対する最適なプロンプトを作成してください。\n\n# 目的\n[ここにあなたが達成したい目的を入力してください。例：新商品のキャッチコピーを考えてほしい]\n\n# 条件\n- プロンプト内には人間が後から入力・調整しやすいように変数（例：[ターゲット層]、[商品の特徴]など）を設けること。\n- 出力の形式（箇条書き、表、文章形式など）を明確に指定する項目を設けること。\n- 必要に応じて、AIが質の高い回答を出すための「制約条件」や「参考情報」欄を設けること。\n# 出力\n作成したプロンプトをそのままコピーして使えるよう、コードブロックの中に書き出してください。`,
    'summary': `# 命令\n以下の文章を要約してください。\n\n# 条件\n- 文字数：[300文字]程度\n- 要点を[3つ]の箇条書きでまとめること\n- 誰にでもわかりやすい表現で記述すること\n\n# 対象の文章\n[ここに文章を入力]`,
    'proofread': `# 命令\n以下の文章を校正・推敲してください。\n\n# 確認事項\n- 誤字・脱字がないか\n- 日本語として不自然な表現や、回りくどい言い回しがないか\n- 文末表現（です・ます調 / だ・である調）が統一されているか\n- 【オプション】より魅力的な文章にするための改善案があれば提示すること\n\n# 対象の文章\n[ここに文章を入力]`,
    'translate': `# 命令\n以下の文章を[英語]に翻訳してください。\n\n# 条件\n- [ビジネス/カジュアル]なトーンで翻訳すること\n- 直訳ではなく、ネイティブが自然に感じる表現を心がけること\n\n# 対象の文章\n[ここに文章を入力]`,
    'code': `# 命令\n以下のコードの処理内容を、初心者エンジニアにもわかるように解説してください。\n\n# 対象のコード\n\`\`\`[言語名]\n[ここにコードを入力]\n\`\`\`\n\n# 出力形式\n1. 全体の処理の概要\n2. 各行・またはブロックごとの詳細な解説\n3. このコードの改善点があれば1〜2点`,
    'idea': `# 命令\n[テーマ]に関するアイデアを[10個]出してください。\n\n# テーマ\n[ここにテーマを入力]\n\n# 条件\n- 既存の枠にとらわれない斬新な視点を含めること\n- 各アイデアに対して、「なぜそれが良いのか」という理由も簡潔に添えること`
};

function insertPrompt(type) {
    const promptText = PROMPT_TEMPLATES[type];
    if (!promptText) return;
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
