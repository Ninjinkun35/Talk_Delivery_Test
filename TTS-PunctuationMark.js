(() => {
    // ==========================================
    // 【モジュール概要】句読点で区切り、確定時にログをインライン表示
    // ==========================================
    
    const moduleId = 'TTS-PunctuationMark';
    const textarea = document.getElementById("Chat");
    const logArea = document.getElementById("logArea");

    let lastSpokenIndex = 0;
    // let spokenLogEntries = [];
    let isComposing = false;
    let prevValue = "";

    /**
     * 発言ログエリアの描画
     * 改行せず、一つの文章として表示する
     */
    function renderLogEntries() {
        if (!logArea) return;
        logArea.innerHTML = "";

        const wrapper = document.createElement("div");
        wrapper.className = "log-entry-inline"; 
        wrapper.style.display = "inline"; 
        wrapper.style.wordBreak = "break-all";

        // 配列の中身を結合して表示
        wrapper.textContent = window.sharedLogEntries.join("");

        logArea.appendChild(wrapper);
        logArea.scrollTop = logArea.scrollHeight;
    }

    /**
     * 新しいテキストを句読点まで読み上げる
     */
    function speakNewText() {
        if (speechSynthesis.speaking) return false;

        const text = textarea.value.slice(lastSpokenIndex);
        if (!text) return false;

        // 句読点のパターン
        const punctuationPattern = /[,。、.,，．]/;
        const match = text.match(punctuationPattern);
        if (!match) return false;

        // 句読点までのインデックスを取得
        const endIndex = match.index + 1;
        const textToPunctuation = text.substring(0, endIndex);
        
        // --- テスト用ログ ---
        console.log('PunctuationMark読み上げ開始:', textToPunctuation);

        const utterance = new SpeechSynthesisUtterance(textToPunctuation);
        utterance.lang = "ja-JP";

        // ログ配列に追加して描画
        window.sharedLogEntries.push(textToPunctuation);
        renderLogEntries();

        // 読み上げ位置の更新
        lastSpokenIndex += endIndex;

        utterance.onend = () => {
            // --- テスト用ログ ---
            console.log('PunctuationMark読み上げ完了');
            
            // 次の文があれば連続して読む
            setTimeout(() => {
                speakNewText();
            }, 100);
        };

        speechSynthesis.speak(utterance);
        return true;
    }

    // --- 入力イベントハンドラ ---
    const inputHandler = (e) => {
        const currentValue = textarea.value;

        // 削除操作時のインデックス調整
        if (e.inputType && e.inputType.startsWith("delete")) {
            if (currentValue.length === 0) lastSpokenIndex = 0;
            prevValue = currentValue;
            return;
        }

        prevValue = currentValue;
        if (isComposing) return;

        // 末尾に句読点が入ったら読み上げ実行
        const lastChar = currentValue.slice(-1);
        if (/[ ,。、.，．]/.test(lastChar)) {
            speakNewText();
        }
    };

    const compositionstartHandler = () => { isComposing = true; };
    const compositionendHandler = () => {
        isComposing = false;
        // 確定したテキストに句読点が含まれていれば読み上げ
        const pendingText = textarea.value.slice(lastSpokenIndex);
        if (/[,。、.,，．]/.test(pendingText)) {
            speakNewText();
        }
    };

    function init() {
        textarea.addEventListener("input", inputHandler);
        textarea.addEventListener("compositionstart", compositionstartHandler);
        textarea.addEventListener("compositionend", compositionendHandler);
        
        // 初期状態の同期
        lastSpokenIndex = textarea.value.length;
        renderLogEntries();
    }

    function cleanup() {
        textarea.removeEventListener("input", inputHandler);
        textarea.removeEventListener("compositionstart", compositionstartHandler);
        textarea.removeEventListener("compositionend", compositionendHandler);
        // spokenLogEntries = [];
    }

    window.ttsModule = { id: moduleId, speak: (t) => {}, init, cleanup };
})();