(() => {
    const moduleId = 'TTS-Kanjichange';
    const textarea = document.getElementById('Chat');

    let lastValue = '';          // 読み上げ（TTS）判定用の前回値
    let lastConfirmedValue = ''; // ログ表示（確定）判定用の前回値
    let englishBuffer = '';
    let numberBuffer = '';
    let spaceKeyPressed = false;
    let hasSpokenCurrentComposition = false; // 現在の変換セッションで読み上げ済みか


    /**
     * 音声読み上げ
     */
    function speak(text, lang = 'ja') {
        if (!text) return;

        console.log('Kanjichange読み上げ:', text, `(言語: ${lang})`);

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = (lang === 'en') ? 'en-US' : 'ja-JP';

        utterance.onstart = () => {
            if (typeof window.setReadingHighlightByText === "function") {
                window.setReadingHighlightByText(text);
            }
        };

        utterance.onend = () => {
            if (typeof window.clearReadingHighlight === "function") {
                window.clearReadingHighlight();
            }
        };

        utterance.onerror = () => {
            if (typeof window.clearReadingHighlight === "function") {
                window.clearReadingHighlight();
            }
        };

        speechSynthesis.speak(utterance);
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
    };

    const inputCompositionHandler = (e) => {
        const currentValue = textarea.value;
        if (e.type === 'compositionstart') {
            hasSpokenCurrentComposition = false;
            return;
        }

    if (e.type === 'compositionend') {
        console.log('IME確定イベント検知');

        const prefixLen = getCommonPrefixLength(lastConfirmedValue, currentValue);
        const confirmedText = currentValue.slice(prefixLen);

        if (confirmedText) {
            window.addSpeechLog(confirmedText);

            if (!hasSpokenCurrentComposition) {
                window.addReadingCheckLog(confirmedText);
                speak(confirmedText, 'ja');
            }
        }

        lastConfirmedValue = currentValue;
        lastValue = currentValue;
        hasSpokenCurrentComposition = false;
        return;
    }

        if (e.type === 'input') {
            // 削除時
            if (currentValue.length < lastValue.length) {
                lastValue = currentValue;
                lastConfirmedValue = currentValue;
                englishBuffer = '';
                numberBuffer = '';
                return;
            }

            if (e.isComposing) {
                // 漢字変換（スペースキー）中
                if (spaceKeyPressed) {
                    const prefixLen = getCommonPrefixLength(lastConfirmedValue, currentValue);
                    const convertedText = currentValue.slice(prefixLen);

                    if (convertedText && !hasSpokenCurrentComposition) {
                        window.addReadingCheckLog(convertedText);
                        speak(convertedText, 'ja');
                        hasSpokenCurrentComposition = true;
                    }

                    lastValue = currentValue;
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
    }

    function cleanup() {
        textarea.removeEventListener('keydown', keydownHandler);
        textarea.removeEventListener('input', inputCompositionHandler);
        textarea.removeEventListener('compositionstart', inputCompositionHandler);
        textarea.removeEventListener('compositionend', inputCompositionHandler);
    }

    window.ttsModule = { id: moduleId, speak, init, cleanup };
})();