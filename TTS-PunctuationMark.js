(() => {
    // ==========================================
    // 【モジュール概要】句読点で区切り、1文字ずつ色を変えて読み上げる
    // ==========================================
    
    const moduleId = 'TTS-PunctuationMark';
    const textarea = document.getElementById("Chat");
    const logArea = document.getElementById("logArea");

    let lastSpokenIndex = 0;
    let spokenLogEntries = [];
    let currentSpokenLogIndex = -1;
    let currentSpokenCharIndex = 0;
    let isComposing = false;
    let prevValue = "";
    
    // 【追加】カラオケワイプ用のタイマー
    let charWalkTimer = null;

    function speakNewText() {
        if (speechSynthesis.speaking) return false;

        const text = textarea.value.slice(lastSpokenIndex);
        if (!text) return false;

        const punctuationPattern = /[,。、.,，．]/;
        const match = text.match(punctuationPattern);
        if (!match) return false;

        const endIndex = match.index + 1;
        const textToPunctuation = text.substring(0, endIndex);
        const filteredText = sanitizeForSpeech(textToPunctuation);
        if (!filteredText) return false;

        const utterance = new SpeechSynthesisUtterance(filteredText);
        utterance.lang = detectLanguage(filteredText);

        lastSpokenIndex += endIndex;
        addLogEntry(textToPunctuation);

        // 読み上げ開始
        utterance.onstart = () => {
            currentSpokenCharIndex = 0;
            // 文字数に応じてタイマーを開始（滑らかに動かす）
            startCharWalker(textToPunctuation.length);
        };

        // 単語の区切りで位置を微調整（OS/ブラウザの通知に同期）
        utterance.onboundary = (event) => {
            if (event.name === 'word' || event.charIndex != null) {
                currentSpokenCharIndex = event.charIndex;
                renderLogEntries();
            }
        };

        // 読み上げ終了
        utterance.onend = () => {
            stopCharWalker();
            currentSpokenCharIndex = textToPunctuation.length; // 最後まで赤くする
            renderLogEntries();
            
            setTimeout(() => {
                clearLogHighlight();
                speakNewText(); // 次の文があれば読む
            }, 300);
        };

        speechSynthesis.speak(utterance);
        return true;
    }

    // 【追加】タイマーで1文字ずつインデックスを進める
    function startCharWalker(maxLength) {
        stopCharWalker();
        // 約120msごとに1文字進める（標準的な発話速度）
        charWalkTimer = setInterval(() => {
            if (currentSpokenCharIndex < maxLength) {
                currentSpokenCharIndex++;
                renderLogEntries();
            } else {
                stopCharWalker();
            }
        }, 120); 
    }

    function stopCharWalker() {
        if (charWalkTimer) {
            clearInterval(charWalkTimer);
            charWalkTimer = null;
        }
    }

    // 【大幅修正】1文字ずつ span で出力
    function renderLogEntries() {
        if (!logArea) return;
        logArea.innerHTML = "";
        spokenLogEntries.forEach((entry, index) => {
            const entryElement = document.createElement("div");
            entryElement.className = "log-entry" + (index === currentSpokenLogIndex ? " active" : "");
            
            if (index === currentSpokenLogIndex) {
                // 読み上げ中の行：1文字ずつ分解
                const chars = Array.from(entry);
                chars.forEach((char, charIdx) => {
                    const charSpan = document.createElement("span");
                    charSpan.textContent = char;
                    charSpan.className = "char";
                    // 読み上げ済みの文字に 'read' クラスを付与
                    if (charIdx < currentSpokenCharIndex) {
                        charSpan.classList.add("read");
                    }
                    entryElement.appendChild(charSpan);
                });
            } else {
                // 読み上げが終わった行は赤色で固定、これからの行は黒
                entryElement.textContent = entry;
                if (index < currentSpokenLogIndex) {
                    entryElement.style.color = "red";
                }
            }
            logArea.appendChild(entryElement);
        });
        logArea.scrollTop = logArea.scrollHeight;
    }

    function speak(text) {
        if (!text) return;
        const filteredText = sanitizeForSpeech(text);
        if (!filteredText) return;
        const utterance = new SpeechSynthesisUtterance(filteredText);
        utterance.lang = detectLanguage(filteredText);
        speechSynthesis.speak(utterance);
    }

    function detectLanguage(text) {
        return /[A-Za-zＡ-Ｚａ-ｚ]/.test(text) ? "en-US" : "ja-JP";
    }

    function sanitizeForSpeech(text) {
        return text.replace(/[^\p{L}\p{N}\s$%&]/gu, "");
    }

    function addLogEntry(text) {
        spokenLogEntries.push(text);
        currentSpokenLogIndex = spokenLogEntries.length - 1;
        currentSpokenCharIndex = 0;
        renderLogEntries();
    }

    function clearLogHighlight() {
        currentSpokenLogIndex = -1;
        currentSpokenCharIndex = 0;
        renderLogEntries();
    }

    const inputHandler = (e) => {
        const currentValue = textarea.value;
        if (e.inputType && e.inputType.startsWith("delete")) {
            if (currentValue.length === 0) lastSpokenIndex = 0;
            prevValue = currentValue;
            return;
        }
        if (currentValue.length < prevValue.length) {
            let diffIndex = 0;
            while (diffIndex < currentValue.length && currentValue[diffIndex] === prevValue[diffIndex]) diffIndex++;
            if (diffIndex < lastSpokenIndex) lastSpokenIndex = diffIndex;
        }
        prevValue = currentValue;
        if (isComposing) return;

        const lastChar = currentValue.slice(-1);
        if (/[ ,。、.，．]/.test(lastChar)) {
            if (!speechSynthesis.speaking) speakNewText();
        }
    };

    const compositionstartHandler = () => { isComposing = true; };
    const compositionendHandler = () => {
        isComposing = false;
        const pendingText = textarea.value.slice(lastSpokenIndex);
        if (/[,。、.,，．]/.test(pendingText)) speakNewText();
    };

    function init() {
        textarea.addEventListener("input", inputHandler);
        textarea.addEventListener("compositionstart", compositionstartHandler);
        textarea.addEventListener("compositionend", compositionendHandler);
    }

    function cleanup() {
        textarea.removeEventListener("input", inputHandler);
        textarea.removeEventListener("compositionstart", compositionstartHandler);
        textarea.removeEventListener("compositionend", compositionendHandler);
        stopCharWalker();
    }

    window.ttsModule = { id: moduleId, speak, init, cleanup };
})();