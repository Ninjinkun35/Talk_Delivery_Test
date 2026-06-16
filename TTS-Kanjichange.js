(() => {
    const moduleId = 'TTS-Kanjichange';
    const textarea = document.getElementById('Chat');

    let lastValue = '';
    let composing = false;

    let compositionBaseValue = '';
    let spaceKeyPressedDuringComposition = false;
    let hasSpokenCurrentComposition = false;

    let halfWidthBuffer = '';

    function getTrailingHalfWidthAlphaNum(text) {
        const match = text.match(/[a-zA-Z0-9]+$/);
        return match ? match[0] : "";
    }

    function syncSpeechLog() {
        // window.speechLogEntries = [textarea.value];

        if (typeof window.renderSharedLog === 'function') {
            window.renderSharedLog();
        }
    }

    function getInsertedText(prev, curr) {
        let start = 0;

        while (
            start < prev.length &&
            start < curr.length &&
            prev[start] === curr[start]
        ) {
            start++;
        }

        let prevEnd = prev.length - 1;
        let currEnd = curr.length - 1;

        while (
            prevEnd >= start &&
            currEnd >= start &&
            prev[prevEnd] === curr[currEnd]
        ) {
            prevEnd--;
            currEnd--;
        }

        return curr.slice(start, currEnd + 1);
    }

    function isHalfWidthAlphaNum(ch) {
        return /^[a-zA-Z0-9]$/.test(ch);
    }

    function isNumericOnly(text) {
        return /^[0-9]+$/.test(text);
    }

    function isHalfWidthSeparator(ch) {
        return /[\s,.!?;:]/.test(ch);
    }

    function speak(text, lang = 'ja') {
        if (!text || !text.trim()) return;

        if (typeof window.addReadingCheckLog === 'function') {
            window.addReadingCheckLog(text);
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang === 'en' ? 'en-US' : 'ja-JP';

        utterance.onstart = () => {
            if (typeof window.setReadingHighlightByText === 'function') {
                window.setReadingHighlightByText(text);
            }
        };

        utterance.onend = () => {
            if (typeof window.clearReadingHighlight === 'function') {
                window.clearReadingHighlight();
            }
        };

        utterance.onerror = () => {
            if (typeof window.clearReadingHighlight === 'function') {
                window.clearReadingHighlight();
            }
        };

        speechSynthesis.speak(utterance);
    }

    function flushHalfWidthBuffer() {
        const text = halfWidthBuffer.trim();
        if (!text) return;

        if (isNumericOnly(text)) {
            speak(text, 'ja');
        } else {
            speak(text, 'en');
        }

        halfWidthBuffer = '';
    }

    function handleDirectInput(currentValue) {
        // syncSpeechLog();

        if (currentValue.length < lastValue.length) {
            halfWidthBuffer = getTrailingHalfWidthAlphaNum(currentValue);
            lastValue = currentValue;
            return;
        }

        const insertedText = getInsertedText(lastValue, currentValue);

        if (insertedText && typeof window.addSpeechLog === 'function') {
            window.addSpeechLog(insertedText);
        }

        for (const ch of insertedText) {
            if (isHalfWidthAlphaNum(ch)) {
                halfWidthBuffer += ch;
            } else if (isHalfWidthSeparator(ch)) {
                flushHalfWidthBuffer();
            }
        }

        lastValue = currentValue;
    }

    function handleCompositionStart() {
        // 日本語入力開始時点で、直前の英字バッファを確定読み上げ
        flushHalfWidthBuffer();

        composing = true;
        compositionBaseValue = textarea.value;
        spaceKeyPressedDuringComposition = false;
        hasSpokenCurrentComposition = false;

        syncSpeechLog();
    }

    function handleCompositionUpdate() {
        syncSpeechLog();

        if (!spaceKeyPressedDuringComposition) return;
        if (hasSpokenCurrentComposition) return;

        const currentValue = textarea.value;
        const convertedText = getInsertedText(compositionBaseValue, currentValue);

        if (convertedText && convertedText.trim()) {
            speak(convertedText, 'ja');
            hasSpokenCurrentComposition = true;
        }

        spaceKeyPressedDuringComposition = false;
        lastValue = currentValue;
    }

    function handleCompositionEnd() {
        composing = false;

        syncSpeechLog();

         const currentValue = textarea.value;
         const confirmedText = getInsertedText(compositionBaseValue, currentValue);

        if (confirmedText && confirmedText.trim()) {
            // 発言ログモード用：1文字方式と同じく追記する
            if (typeof window.addSpeechLog === 'function') {
                window.addSpeechLog(confirmedText);
            }
        }

        // IME確定時点では読み上げない
        // Space変換時に読めなかったケースだけ救済する
        if (!hasSpokenCurrentComposition) {
            const currentValue = textarea.value;
            const confirmedText = getInsertedText(compositionBaseValue, currentValue);

            // ひらがなだけを確定した場合はここで読む
            // 漢字変換済みなら通常は compositionupdate で読んでいる
            if (confirmedText && confirmedText.trim()) {
                speak(confirmedText, 'ja');
            }
        }

        lastValue = textarea.value;
        compositionBaseValue = textarea.value;
        spaceKeyPressedDuringComposition = false;
        hasSpokenCurrentComposition = false;
    }

    function handleInput(e) {
        if (e.isComposing || composing) {
            syncSpeechLog();
            return;
        }

        handleDirectInput(textarea.value);
    }

    function handleKeydown(e) {
        if (composing && e.code === 'Space') {
            spaceKeyPressedDuringComposition = true;
            return;
        }

        if (!composing && e.key === ' ') {
            setTimeout(() => {
                syncSpeechLog();
                flushHalfWidthBuffer();
                lastValue = textarea.value;
            }, 0);
        }
    }

    function init() {
        textarea.addEventListener('keydown', handleKeydown);
        textarea.addEventListener('input', handleInput);
        textarea.addEventListener('compositionstart', handleCompositionStart);
        textarea.addEventListener('compositionupdate', handleCompositionUpdate);
        textarea.addEventListener('compositionend', handleCompositionEnd);

        lastValue = textarea.value;
        compositionBaseValue = textarea.value;

        syncSpeechLog();
    }

    function cleanup() {
        textarea.removeEventListener('keydown', handleKeydown);
        textarea.removeEventListener('input', handleInput);
        textarea.removeEventListener('compositionstart', handleCompositionStart);
        textarea.removeEventListener('compositionupdate', handleCompositionUpdate);
        textarea.removeEventListener('compositionend', handleCompositionEnd);
    }

    window.ttsModule = {
        id: moduleId,
        speak,
        init,
        cleanup,
        resetState() {
            halfWidthBuffer = getTrailingHalfWidthAlphaNum(textarea.value);
            lastValue = textarea.value;
            compositionBaseValue = textarea.value;
            composing = false;
            spaceKeyPressedDuringComposition = false;
            hasSpokenCurrentComposition = false;
        }
    };
})();