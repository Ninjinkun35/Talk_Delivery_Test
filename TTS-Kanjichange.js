(() => {
    const moduleId = 'TTS-Kanjichange';
    const textarea = document.getElementById('Chat');
    const logArea = document.getElementById("logArea");

    // main.js で定義した共通のログ配列を使用
    const spokenLogEntries = window.sharedLogEntries;

    let lastValue = '';          // 読み上げ（TTS）判定用の前回値
    let lastConfirmedValue = ''; // ログ表示（確定）判定用の前回値
    let englishBuffer = '';
    let numberBuffer = '';
    let spaceKeyPressed = false;
    let hasSpokenCurrentComposition = false; // 現在の変換セッションで読み上げ済みか

    /**
     * 発言ログエリアの描画（インライン形式）
     */
    function renderLogEntries() {
        if (!logArea) return;
        logArea.innerHTML = "";
        const wrapper = document.createElement("div");
        wrapper.className = "log-entry-inline"; 
        wrapper.style.display = "inline"; 
        wrapper.style.wordBreak = "break-all";
        
        // 共通ログ配列を結合して表示
        wrapper.textContent = spokenLogEntries.join("");
        logArea.appendChild(wrapper);
        
        // 自動スクロールは main.js が担当
        logArea.scrollTop = logArea.scrollHeight;
    }

    /**
     * 音声読み上げ
     */
    function speak(text, lang = 'ja') {
        if (!text) return;
        console.log('Kanjichange読み上げ:', text, `(言語: ${lang})`);
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = (lang === 'en') ? 'en-US' : 'ja-JP';
        speechSynthesis.speak(utterance);
    }

    /**
     * ログ領域を確定・保存する関数
     */
    function updateLog(currentValue) {
        // 前回「確定」した位置からの差分を抽出
        const prefixLen = getCommonPrefixLength(lastConfirmedValue, currentValue);
        const confirmedDiff = currentValue.slice(prefixLen);
        
        if (confirmedDiff) {
            console.log('【IME確定】ログに保管:', confirmedDiff);
            spokenLogEntries.push(confirmedDiff);
            renderLogEntries();
        }
        // 確定した時点の値を保存
        lastConfirmedValue = currentValue;
    }

    function getCommonPrefixLength(a, b) {
        const len = Math.min(a.length, b.length);
        let i = 0;
        while (i < len && a[i] === b[i]) i++;
        return i;
    }

    /**
     * 読み上げ用の差分抽出
     */
    function speakDiff(currentValue) {
        if (currentValue.length < lastValue.length) {
            lastValue = currentValue; 
            englishBuffer = ''; 
            numberBuffer = '';
            return; 
        }

        if (currentValue === lastValue) return;
        const prefixLen = getCommonPrefixLength(lastValue, currentValue);
        const newText = currentValue.slice(prefixLen);
        if (!newText) { lastValue = currentValue; return; }

        let japaneseChunk = '';
        for (const ch of newText) {
            const isHalfEnglish = (c) => /^[a-zA-Z]$/.test(c);
            const isHalfNumber = (c) => /^[0-9]$/.test(c);
            
            if (isHalfEnglish(ch)) { englishBuffer += ch; continue; }
            if (isHalfNumber(ch)) { numberBuffer += ch; continue; }
            
            if (englishBuffer) { speak(englishBuffer, 'en'); englishBuffer = ''; }
            if (numberBuffer) { speak(numberBuffer, 'ja'); numberBuffer = ''; }
            japaneseChunk += ch;
        }
        if (japaneseChunk) speak(japaneseChunk, 'ja');
        lastValue = currentValue;
    }

    const keydownHandler = (e) => { 
        if (e.code === 'Space') { 
            spaceKeyPressed = true; 
        } 
        // Enterキー（直接入力＝IMEを介さない確定）
        if (e.key === 'Enter' && !e.isComposing) {
            updateLog(textarea.value);
            lastValue = textarea.value;
        }
    };

    const inputCompositionHandler = (e) => {
        const currentValue = textarea.value;

        if (e.type === 'compositionstart') {
            hasSpokenCurrentComposition = false;
            return;
        }

        // --- 【理想の実現】IME確定時にのみログを保管 ---
        if (e.type === 'compositionend') {
            console.log('IME確定イベント検知');
            // 変換なしで確定された場合（Enter一発押しなど）の読み上げ
            if (!hasSpokenCurrentComposition) {
                speakDiff(currentValue);
            }
            // 確定した内容をログに保管
            updateLog(currentValue);
            
            lastValue = currentValue;
            hasSpokenCurrentComposition = false;
            return;
        }

        if (e.type === 'input') {
            // 削除時
            if (currentValue.length < lastValue.length) {
                speakDiff(currentValue);
                lastConfirmedValue = currentValue; // 削除時はログの基準点も同期
                return;
            }

            if (e.isComposing) {
                // 漢字変換（スペースキー）中
                if (spaceKeyPressed) {
                    // 読み上げは初回のみ実行
                    if (!hasSpokenCurrentComposition) {
                        speakDiff(currentValue);
                        hasSpokenCurrentComposition = true;
                    } else {
                        // 基準点だけ更新（読み上げはしない）
                        lastValue = currentValue;
                    }
                    // ここでは updateLog は呼ばない（確定時まで待つ）
                    spaceKeyPressed = false;
                }
            } else {
                // 直接入力（半角英数など）
                speakDiff(currentValue);
                // 直接入力はEnterを押すまでログには出しません
            }
        }
    };

    function init() {
        textarea.addEventListener('keydown', keydownHandler);
        textarea.addEventListener('input', inputCompositionHandler);
        textarea.addEventListener('compositionstart', inputCompositionHandler);
        textarea.addEventListener('compositionend', inputCompositionHandler);
        
        lastValue = textarea.value;
        lastConfirmedValue = textarea.value;
        renderLogEntries();
    }

    function cleanup() {
        textarea.removeEventListener('keydown', keydownHandler);
        textarea.removeEventListener('input', inputCompositionHandler);
        textarea.removeEventListener('compositionstart', inputCompositionHandler);
        textarea.removeEventListener('compositionend', inputCompositionHandler);
    }

    window.ttsModule = { id: moduleId, speak, init, cleanup };
})();