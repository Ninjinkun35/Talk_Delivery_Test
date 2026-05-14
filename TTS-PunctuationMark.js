(() => {
    const moduleId = 'TTS-PunctuationMark';
    const textarea = document.getElementById("Chat");
    const logArea = document.getElementById("logArea");

    let lastSpokenIndex = 0;
    let isComposing = false;
    let prevValue = "";
    let retryTimer = null;

    const punctuationPattern = /[,。、.，．]/;

    function renderLogEntries() {
        if (!logArea) return;
        logArea.innerHTML = "";

        const wrapper = document.createElement("div");
        wrapper.className = "log-entry-inline";
        wrapper.style.display = "inline";
        wrapper.style.wordBreak = "break-all";
        wrapper.textContent = window.sharedLogEntries.join("");

        logArea.appendChild(wrapper);
        logArea.scrollTop = logArea.scrollHeight;
    }

    function resetReadingPositionIfNeeded(currentValue) {
        // テキストが空なら完全リセット
        if (currentValue.length === 0) {
            lastSpokenIndex = 0;
            return;
        }

        // 削除によって読み上げ位置が現在文字数を超えた場合、
        // 0に戻すのではなく「現在の末尾」に合わせる。
        // これにより、削除後に新しく入力した文章だけを読む。
        if (lastSpokenIndex > currentValue.length) {
            lastSpokenIndex = currentValue.length;
        }
    }

    function scheduleSpeak() {
        if (retryTimer) clearTimeout(retryTimer);

        retryTimer = setTimeout(() => {
            retryTimer = null;
            speakNewText();
        }, 100);
    }

    function speakNewText() {
        if (!textarea) return false;

        const currentValue = textarea.value;
        resetReadingPositionIfNeeded(currentValue);

        // 読み上げ中なら、読み上げ終了後に再確認する
        if (speechSynthesis.speaking || speechSynthesis.pending) {
            scheduleSpeak();
            return false;
        }

        const text = currentValue.slice(lastSpokenIndex);
        if (!text) return false;

        const match = text.match(punctuationPattern);
        if (!match) return false;

        const endIndex = match.index + 1;
        const textToPunctuation = text.substring(0, endIndex);

        if (!textToPunctuation.trim()) {
            lastSpokenIndex += endIndex;
            return speakNewText();
        }

        console.log('PunctuationMark読み上げ開始:', textToPunctuation);

        const utterance = new SpeechSynthesisUtterance(textToPunctuation);
        utterance.lang = "ja-JP";

        window.sharedLogEntries.push(textToPunctuation);
        renderLogEntries();

        lastSpokenIndex += endIndex;

        utterance.onend = () => {
            console.log('PunctuationMark読み上げ完了');
            scheduleSpeak();
        };

        utterance.onerror = () => {
            console.warn('PunctuationMark読み上げエラー');
            scheduleSpeak();
        };

        speechSynthesis.speak(utterance);
        return true;
    }

    const inputHandler = (e) => {
        const currentValue = textarea.value;

        resetReadingPositionIfNeeded(currentValue);

        // 削除時は「現在の末尾」を新しい開始位置にする
        if (e.inputType && e.inputType.startsWith("delete")) {
            lastSpokenIndex = currentValue.length;
            prevValue = currentValue;
            return;
        }

        // inputType が取れない環境向け
        if (currentValue.length < prevValue.length) {
            resetReadingPositionIfNeeded(currentValue);
            prevValue = currentValue;
            return;
        }

        prevValue = currentValue;

        if (isComposing) return;

        const pendingText = currentValue.slice(lastSpokenIndex);
        if (punctuationPattern.test(pendingText)) {
            speakNewText();
        }
    };

    const compositionstartHandler = () => {
        isComposing = true;
    };

    const compositionendHandler = () => {
        isComposing = false;

        const currentValue = textarea.value;
        resetReadingPositionIfNeeded(currentValue);

        const pendingText = currentValue.slice(lastSpokenIndex);
        if (punctuationPattern.test(pendingText)) {
            speakNewText();
        }
    };

    function init() {
        if (!textarea) return;

        textarea.addEventListener("input", inputHandler);
        textarea.addEventListener("compositionstart", compositionstartHandler);
        textarea.addEventListener("compositionend", compositionendHandler);

        // ここを textarea.value.length にすると、
        // 初期入力済みテキストを読まなくなるため 0 にする
        lastSpokenIndex = 0;
        prevValue = textarea.value;

        renderLogEntries();
    }

    function cleanup() {
        if (!textarea) return;

        textarea.removeEventListener("input", inputHandler);
        textarea.removeEventListener("compositionstart", compositionstartHandler);
        textarea.removeEventListener("compositionend", compositionendHandler);

        if (retryTimer) {
            clearTimeout(retryTimer);
            retryTimer = null;
        }
    }

    window.ttsModule = {
        id: moduleId,
        speak: speakNewText,
        init,
        cleanup
    };
})();