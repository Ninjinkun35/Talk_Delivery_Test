(() => {
    // ==========================================
    // 【モジュール概要】漢字変換・確定時にログを「継続表示」し読み上げる
    // ==========================================
    
    const moduleId = 'TTS-Kanjichange';
    const textarea = document.getElementById('Chat');
    const logArea = document.getElementById("logArea");

    // 確定・保管されたログの履歴
    let spokenLogEntries = []; 
    // 現在読み上げているログのインデックス
    let currentSpokenLogIndex = -1;
    // 現在読み上げている文字の位置（ワイプ用）
    let currentSpokenCharIndex = 0;

    let lastValue = '';
    let englishBuffer = '';
    let numberBuffer = '';
    let spaceKeyPressed = false;

    // ===============================
    // 【修正】ログ表示関数（改行せず、一続きの文章にする）
    // ===============================
    function renderLogEntries() {
        if (!logArea) return;
        logArea.innerHTML = "";

        // すべてのログを包む一つのコンテナ（ここで一つの段落にする）
        const wrapper = document.createElement("div");
        wrapper.className = "log-entry active"; 
        // 行間や折り返しの設定をCSSに合わせる
        wrapper.style.wordBreak = "break-word";
        wrapper.style.display = "inline"; 

        spokenLogEntries.forEach((entry, index) => {
            if (index < currentSpokenLogIndex || currentSpokenLogIndex === -1) {
                // すでに読み終わった過去のログ：赤い一つのカタマリ（span）として追加
                const span = document.createElement("span");
                span.textContent = entry;
                span.style.color = "red";
                span.style.fontWeight = "bold";
                wrapper.appendChild(span);
            } else if (index === currentSpokenLogIndex) {
                // 現在読み上げ中の最新ログ：1文字ずつ span で作成（ワイプ効果のため）
                const chars = Array.from(entry);
                chars.forEach((char, charIdx) => {
                    const charSpan = document.createElement("span");
                    charSpan.textContent = char;
                    charSpan.className = "char";
                    if (charIdx < currentSpokenCharIndex) {
                        charSpan.classList.add("read");
                    }
                    wrapper.appendChild(charSpan);
                });
            }
        });

        logArea.appendChild(wrapper);
        // 常に最新の文字が見えるように自動スクロール
        logArea.scrollTop = logArea.scrollHeight;
    }

    // ===============================
    // 読み上げ ＆ ログ保管
    // ===============================
    function speak(text, lang = 'ja') {
        if (!text) return;

        // ログに新規保管
        spokenLogEntries.push(text);
        currentSpokenLogIndex = spokenLogEntries.length - 1;
        currentSpokenCharIndex = 0;
        renderLogEntries();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = (lang === 'en') ? 'en-US' : 'ja-JP';

        utterance.onboundary = (event) => {
            if (event.charIndex != null) {
                currentSpokenCharIndex = event.charIndex;
                renderLogEntries();
            }
        };

        utterance.onend = () => {
            currentSpokenCharIndex = text.length;
            renderLogEntries();
            // 次の入力に備えてインデックスをリセット（すべて既読状態へ）
            currentSpokenLogIndex = -1; 
        };

        speechSynthesis.speak(utterance);
    }

    // --- 文字判定ロジック（変更なし） ---
    const isHalfEnglish = (ch) => /^[a-zA-Z]$/.test(ch);
    const isHalfNumber = (ch) => /^[0-9]$/.test(ch);
    const isSeparator = (ch) => ch === ' ' || ch === ',' || ch === '.';
    const isSymbol = (ch) => "!\"#'()*+,-./:;<=>?@[\\]^_`{|}~".includes(ch);

    function getCommonPrefixLength(a, b) {
        const len = Math.min(a.length, b.length);
        let i = 0;
        while (i < len && a[i] === b[i]) i++;
        return i;
    }

    function speakDiff(currentValue) {
        if (currentValue.length <= lastValue.length) {
            lastValue = currentValue;
            return;
        }

        const prefixLen = getCommonPrefixLength(lastValue, currentValue);
        const newText = currentValue.slice(prefixLen);
        let japaneseChunk = '';

        for (const ch of newText) {
            if (isHalfEnglish(ch)) { englishBuffer += ch; continue; }
            if (isHalfNumber(ch)) { numberBuffer += ch; continue; }
            if (isSeparator(ch)) {
                if (englishBuffer) { speak(englishBuffer, 'en'); englishBuffer = ''; }
                if (numberBuffer) { speak(numberBuffer, 'ja'); numberBuffer = ''; }
                continue;
            }
            if (isSymbol(ch)) continue;

            if (englishBuffer) { speak(englishBuffer, 'en'); englishBuffer = ''; }
            if (numberBuffer) { speak(numberBuffer, 'ja'); numberBuffer = ''; }
            japaneseChunk += ch;
        }

        if (japaneseChunk) {
            speak(japaneseChunk, 'ja');
        }

        lastValue = currentValue;
    }

    const keydownHandler = (e) => {
        if (e.code === 'Space' && !spaceKeyPressed) {
            speakDiff(textarea.value);
            spaceKeyPressed = true;
        }
    };

    const inputCompositionHandler = (e) => {
        const currentValue = textarea.value;

        if (e.type === 'input' && e.inputType === 'insertCompositionText') {
            return; 
        }
        
        if (spaceKeyPressed) {
            lastValue = currentValue;
            spaceKeyPressed = false;
            return;
        }
        
        if (currentValue.length === 0) {
            lastValue = '';
            return;
        }

        speakDiff(currentValue);
    };

    function init() {
        textarea.addEventListener('keydown', keydownHandler);
        textarea.addEventListener('input', inputCompositionHandler);
        textarea.addEventListener('compositionend', inputCompositionHandler);
        renderLogEntries();
    }

    function cleanup() {
        textarea.removeEventListener('keydown', keydownHandler);
        textarea.removeEventListener('input', inputCompositionHandler);
        textarea.removeEventListener('compositionend', inputCompositionHandler);
        spokenLogEntries = []; 
    }

    window.ttsModule = { id: moduleId, speak, init, cleanup };
})();