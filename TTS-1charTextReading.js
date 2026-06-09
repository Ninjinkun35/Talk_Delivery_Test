// (() => {
//     // ==========================================
//     // 【モジュール概要】1字ずつ読み上げ ＆ 確定時にログ表示
//     // ==========================================
    
//     const textarea = document.getElementById('Chat') || document.getElementById('input');
//     const logArea = document.getElementById("logArea");
//     if (!textarea) {
//         console.error('TTS-1charTextReading.js: textarea element not found.');
//         return;
//     }

//     let lastSpoken = '';
//     let lastValue = '';          
//     let lastConfirmedValue = ''; 
//     let queuedText = '';
//     let isSpeaking = false;
//     let composing = false;
//     // let spokenLogEntries = [];

//     // 【関数】発言ログエリアの描画（インライン表示）
//     function renderLogEntries() {
//         if (!logArea) return;
//         logArea.innerHTML = "";
//         const wrapper = document.createElement("div");
//         wrapper.className = "log-entry-inline"; 
//         wrapper.style.display = "inline"; 
//         wrapper.style.wordBreak = "break-all";
//         wrapper.textContent = window.sharedLogEntries.join("");
//         logArea.appendChild(wrapper);
//         logArea.scrollTop = logArea.scrollHeight;
//     }

//     function getJapaneseVoice() {
//         const voices = window.speechSynthesis.getVoices();
//         return voices.find(v => v.lang === 'ja-JP') || null;
//     }

//     // 【関数】読み上げメイン（console.logを保持）
//     function speak(text) {
//         text = text.replace(/[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF$%&]/g, '');
//         if (!text || text === lastSpoken) return;
        
//         // --- テスト用ログを残しています ---
//         console.log('1charTextReading関数が呼ばれました。', '読み上げられたひらがな:', text);

//         const utterance = new SpeechSynthesisUtterance(text);
//         const jaVoice = getJapaneseVoice();
//         if (jaVoice) utterance.voice = jaVoice;

//         isSpeaking = true;
//         utterance.onend = () => {
//             isSpeaking = false;
//             if (queuedText.trim()) {
//                 const textToSpeak = queuedText;
//                 queuedText = '';
//                 speak(textToSpeak);
//             }
//         };
//         utterance.onerror = () => { isSpeaking = false; };

//         window.speechSynthesis.speak(utterance);
//         lastSpoken = text;
//     }

//     function getCommonPrefixLength(a, b) {
//         const minLen = Math.min(a.length, b.length);
//         let i = 0;
//         while (i < minLen && a[i] === b[i]) i++;
//         return i;
//     }

//     function getChangedText(prev, curr) {
//         if (!prev) return curr;
//         if (curr.startsWith(prev)) return curr.slice(prev.length);
//         const prefixLen = getCommonPrefixLength(prev, curr);
//         return curr.slice(prefixLen);
//     }

//     function isHiragana(ch) {
//         const code = ch.charCodeAt(0);
//         return code >= 0x3040 && code <= 0x309F;
//     }

//     function handleInputText(text) {
//         let speakable = "";
//         for (let ch of text) { if (isHiragana(ch)) speakable += ch; }
//         if (!speakable) return;
//         if (isSpeaking) { queuedText += speakable; } else { speak(speakable); }
//     }

//     // --- イベントハンドラ ---
//     let compositionPrev = '';
//     function handleCompositionStart() { composing = true; compositionPrev = ''; }

//     function handleCompositionUpdate(e) {
//         const currentComposition = e.data || '';
//         const newText = getChangedText(compositionPrev, currentComposition);
//         compositionPrev = currentComposition;
//         if (!newText || newText.length > 2) return;
//         handleInputText(newText);
//     }

//     function handleCompositionEnd() {
//         composing = false;
//         const currentValue = textarea.value;
//         const confirmedDiff = currentValue.slice(getCommonPrefixLength(lastConfirmedValue, currentValue));
//         if (confirmedDiff) {
//             window.sharedLogEntries.push(confirmedDiff);
//             renderLogEntries();
//         }
//         lastConfirmedValue = currentValue;
//         lastValue = currentValue;
//     }

//     function handleInputEvent(e) {
//         if (composing) return;
//         const currentValue = textarea.value;
//         if (e.type === 'input' && !e.isComposing) {
//             const directDiff = currentValue.slice(getCommonPrefixLength(lastConfirmedValue, currentValue));
//             if (directDiff) {
//                 handleInputText(directDiff);
//                 window.sharedLogEntries.push(directDiff);
//                 renderLogEntries();
//                 lastConfirmedValue = currentValue;
//             }
//         }
//         lastValue = currentValue;
//     }

//     function init() {
//         textarea.addEventListener('compositionstart', handleCompositionStart);
//         textarea.addEventListener('compositionupdate', handleCompositionUpdate);
//         textarea.addEventListener('compositionend', handleCompositionEnd);
//         textarea.addEventListener('input', handleInputEvent);
//         lastValue = textarea.value;
//         lastConfirmedValue = textarea.value;
//         renderLogEntries();
//     }

//     function cleanup() {
//         textarea.removeEventListener('compositionstart', handleCompositionStart);
//         textarea.removeEventListener('compositionupdate', handleCompositionUpdate);
//         textarea.removeEventListener('compositionend', handleCompositionEnd);
//         textarea.removeEventListener('input', handleInputEvent);
//         // spokenLogEntries = [];
//     }

//     window.ttsModule = { id: 'TTS-1charTextReading', speak, init, cleanup };
// })();

(() => {
    // ==========================================
    // 【モジュール概要】1字ずつ読み上げ ＆ 確定時にログ表示
    //  (最初の入力から数秒間溜めてから読み上げる新フロー)
    // ==========================================
    
    const textarea = document.getElementById('Chat') || document.getElementById('input');
    if (!textarea) {
        console.error('TTS-1charTextReading.js: textarea element not found.');
        return;
    }

    // --- 設定 ---
    const WAIT_TIME = 700; // キューを保管する時間（ミリ秒）例：2000 = 2秒

    // --- 状態管理用の変数 ---
    let lastValue = '';          
    let lastConfirmedValue = ''; 
    let queuedText = '';      // 読み上げ待ちのテキスト（キュー）
    let isSpeaking = false;   // 音声再生中か
    let isWaiting = false;    // キューの保管中（数秒間の待機中）か
    let waitTimer = null;     // 保管用タイマー
    let composing = false;
    let hasSpokenCurrentComposition = false;
    let isSelectingCandidate = false;
    let isSpaceConversion = false;
    let isPredictionCandidate = false;

    function getJapaneseVoice() {
        const voices = window.speechSynthesis.getVoices();
        return voices.find(v => v.lang === 'ja-JP') || null;
    }

    /**
     * 音声読み上げの実行
     */
    function speak(text) {
        text = text.replace(/[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF$%&]/g, '');
        if (!text) return;

        console.log('1charTextReading読み上げ開始:', text);

        if (typeof window.addReadingCheckLog === "function") {
            window.addReadingCheckLog(text);
        }

        if (typeof window.setReadingHighlightByText === "function") {
            window.setReadingHighlightByText(text);
        }

        const utterance = new SpeechSynthesisUtterance(text);
        const jaVoice = getJapaneseVoice();
        if (jaVoice) utterance.voice = jaVoice;

        isSpeaking = true;

        utterance.onend = () => {
            if (typeof window.clearReadingHighlight === "function") {
                window.clearReadingHighlight();
            }

            isSpeaking = false;
            console.log('1charTextReading読み上げ完了');

            if (queuedText.trim()) {
                const nextText = queuedText;
                queuedText = '';
                speak(nextText);
            } else {
                isWaiting = false;
            }
        };

        utterance.onerror = () => {
            if (typeof window.clearReadingHighlight === "function") {
                window.clearReadingHighlight();
            }

            isSpeaking = false;
            isWaiting = false;
        };

        window.speechSynthesis.speak(utterance);
    }

    /**
     * 入力されたテキストをキューに振り分けるフロー
     */
    function handleInputText(text) {
        // ひらがな・カタカナ・英数字のみを抽出
        let validChars = "";
        for (let ch of text) {
            if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\w]/.test(ch)) {
                validChars += ch;
            }
        }
        if (!validChars) return;

        // キューに溜める
        queuedText += validChars;
        console.log('キューに保管中:', queuedText);

        // 再生中でも待機中でもない（全くの新規入力）場合
        if (!isSpeaking && !isWaiting) {
            isWaiting = true;
            console.log(`${WAIT_TIME}ms のキュー保管を開始します...`);

            // 指定時間待ってから読み上げを開始する
            waitTimer = setTimeout(() => {
                const textToSpeak = queuedText;
                queuedText = '';
                // 待機フラグは speak の onend でキューが空になった時に下ろすのでここではそのまま
                speak(textToSpeak);
            }, WAIT_TIME);
        }
    }

    // --- 文字比較・イベントハンドラ (既存ロジック維持) ---
    function getCommonPrefixLength(a, b) {
        const minLen = Math.min(a.length, b.length);
        let i = 0;
        while (i < minLen && a[i] === b[i]) i++;
        return i;
    }

    function getChangedText(prev, curr) {
        if (!prev) return curr;
        if (curr.startsWith(prev)) return curr.slice(prev.length);
        const prefixLen = getCommonPrefixLength(prev, curr);
        return curr.slice(prefixLen);
    }

    let compositionPrev = '';

    function handleCompositionStart() {
        isSpaceConversion = false;
        isPredictionCandidate = false;
        composing = true;
        compositionPrev = '';
        hasSpokenCurrentComposition = false;
        isSelectingCandidate = false;
    }

    const keydownHandler = (e) => {
        if (!composing) return;

        if (e.code === 'Space') {
            isSpaceConversion = true;
            isSelectingCandidate = true;
        }

        if (e.code === 'ArrowDown' || e.code === 'ArrowUp') {
            isPredictionCandidate = true;
            isSelectingCandidate = true;
        }
    };

    function handleCompositionUpdate(e) {
        const currentComposition = e.data || '';

        // 候補選択中は読まない
        if (isSelectingCandidate) {
            compositionPrev = currentComposition;
            return;
        }

        const newText = getChangedText(compositionPrev, currentComposition);
        compositionPrev = currentComposition;

        if (!newText) return;

        // 通常入力だけ1字ずつ読む
        handleInputText(newText);
    }

    function handleInputEvent(e) {
    if (composing) return;

    const currentValue = textarea.value;

    if (currentValue.length < lastValue.length) {
        lastValue = currentValue;
        lastConfirmedValue = currentValue;
        queuedText = '';

        if (waitTimer) {
            clearTimeout(waitTimer);
            waitTimer = null;
        }

        isWaiting = false;
        return;
    }

    if (e.type === 'input' && !e.isComposing) {
        const directDiff = currentValue.slice(
            getCommonPrefixLength(lastConfirmedValue, currentValue)
        );

        if (directDiff) {

            // 音声読み上げ確認モード用
            handleInputText(directDiff);

            // 発言ログモード用（IME確定時点保存）
            if (typeof window.addSpeechLog === "function") {
                window.addSpeechLog(directDiff);
            }

            lastConfirmedValue = currentValue;
        }
    }

    lastValue = currentValue;
    }

    function handleCompositionEnd() {
        composing = false;

        const currentValue = textarea.value;

        const confirmedDiff = currentValue.slice(
            getCommonPrefixLength(lastConfirmedValue, currentValue)
        );

        if (confirmedDiff) {

            // 発言ログモード
            if (typeof window.addSpeechLog === "function") {
                window.addSpeechLog(confirmedDiff);
            }

            // 予測候補確定時だけ読む
            if (isPredictionCandidate && !isSpaceConversion) {
                handleInputText(confirmedDiff);
            }
        }

        lastConfirmedValue = currentValue;
        lastValue = currentValue;

        isSelectingCandidate = false;
        compositionPrev = '';
        isSelectingCandidate = false;
    }

    function init() {
        textarea.addEventListener('compositionstart', handleCompositionStart);
        textarea.addEventListener('compositionupdate', handleCompositionUpdate);
        textarea.addEventListener('compositionend', handleCompositionEnd);
        textarea.addEventListener('input', handleInputEvent);
        textarea.addEventListener('keydown', keydownHandler);
        lastValue = textarea.value;
        lastConfirmedValue = textarea.value;
    }

    function cleanup() {
        textarea.removeEventListener('compositionstart', handleCompositionStart);
        textarea.removeEventListener('compositionupdate', handleCompositionUpdate);
        textarea.removeEventListener('compositionend', handleCompositionEnd);
        textarea.removeEventListener('input', handleInputEvent);
        textarea.removeEventListener('keydown', keydownHandler);
        if (waitTimer) clearTimeout(waitTimer);
        // sharedLogEntries はリセットしない
    }

    window.ttsModule = {
        id: 'TTS-1charTextReading',
        speak,
        init,
        cleanup,
        resetState() {
            queuedText = '';
            composing = false;
            isWaiting = false;
            compositionPrev = '';
            hasSpokenCurrentComposition = false;
            isSelectingCandidate = false;
            isSpaceConversion = false;
            isPredictionCandidate = false;

            if (waitTimer) {
                clearTimeout(waitTimer);
                waitTimer = null;
            }

            lastValue = textarea.value;
            lastConfirmedValue = textarea.value;
        }
    };
})();