// ==========================================
// 2種類のログを常に保持
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    const fontSizeRange = document.getElementById("fontSizeRange");
    const fontSizeValue = document.getElementById("fontSizeValue");
    const textarea = document.getElementById("Chat");

    fontSizeRange.addEventListener("input", () => {
        const size = fontSizeRange.value;
        fontSizeValue.textContent = size;
        textarea.style.fontSize = `${size}px`;
    });
});

if (!window.readingCheckLogEntries) {
    window.readingCheckLogEntries = [];
}

if (!window.speechLogEntries) {
    window.speechLogEntries = [];
}

window.currentLogMode = "readingCheck";
window.currentReadingRange = null;

window.addReadingCheckLog = function (text) {
    if (!text) return;
    window.readingCheckLogEntries.push(text);
    window.renderSharedLog();
};

window.addSpeechLog = function (text) {
    if (!text) return;
    window.speechLogEntries.push(text);
    window.renderSharedLog();
};

window.getCurrentLogText = function () {
    if (window.currentLogMode === "speechLog") {
        return window.speechLogEntries.join("");
    }
    return window.readingCheckLogEntries.join("");
};

window.setReadingHighlightByText = function (text) {
    // 発言ログモードでは絶対に赤色化しない
    if (window.currentLogMode !== "readingCheck") return;

    const fullText = window.readingCheckLogEntries.join("");
    const start = fullText.lastIndexOf(text);

    if (start === -1) return;

    window.currentReadingRange = {
        start,
        end: start + text.length
    };

    window.renderSharedLog();
};

window.clearReadingHighlight = function () {
    window.currentReadingRange = null;
    window.renderSharedLog();
};

window.renderSharedLog = function () {
    const logArea = document.getElementById("logArea");
    if (!logArea) return;

    const fullText = window.getCurrentLogText();
    logArea.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "log-entry-inline";
    wrapper.style.display = "inline";
    wrapper.style.wordBreak = "break-all";

    for (let i = 0; i < fullText.length; i++) {
        const span = document.createElement("span");
        span.textContent = fullText[i];
        span.className = "char";

        // 音声読み上げ確認モードだけ赤色表示
        if (
            window.currentLogMode === "readingCheck" &&
            window.currentReadingRange &&
            i >= window.currentReadingRange.start &&
            i < window.currentReadingRange.end
        ) {
            span.classList.add("read");
        }

        wrapper.appendChild(span);
    }

    logArea.appendChild(wrapper);
    logArea.scrollTop = logArea.scrollHeight;
};

document.addEventListener('DOMContentLoaded', async () => {
    const textarea = document.getElementById("Chat");
    const logArea = document.getElementById("logArea");
    const voiceType = document.getElementById("voiceType");
    const video = document.getElementById("video"); // index.htmlのvideo要素
    const readingCheckModeBtn = document.getElementById("readingCheckModeBtn");
    const speechLogModeBtn = document.getElementById("speechLogModeBtn");
    const reactionButtons = document.querySelectorAll(".reaction-btn");

    if (readingCheckModeBtn && speechLogModeBtn) {
        readingCheckModeBtn.addEventListener("click", () => {
        window.currentLogMode = "readingCheck";
        readingCheckModeBtn.classList.add("active");
        speechLogModeBtn.classList.remove("active");
        window.renderSharedLog();
    });

    speechLogModeBtn.addEventListener("click", () => {
        window.currentLogMode = "speechLog";

        // 発言ログモードでは赤色範囲を無効化
        window.currentReadingRange = null;

        speechLogModeBtn.classList.add("active");
        readingCheckModeBtn.classList.remove("active");
        window.renderSharedLog();
    });
    }
    let lastEnterTime = 0;
    window.currentSpeak = null;
    window.currentTTSModule = null;

    // ==========================================
    // 2. カメラの起動処理 (追加)
    // ==========================================
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ 
            video: {
                width: {理想: 1280},
                height: {理想: 720}
            }, 
            audio: false 
        })
        .then((stream) => {
            video.srcObject = stream;
            video.onloadedmetadata = () => {
                video.play();
            };
            console.log("カメラの起動に成功しました");
        })
        .catch((err) => {
            console.error("カメラの起動に失敗しました:", err);
        });
    }

    // ==========================================
    // 3. 自動スクロール機能
    // ==========================================
    const observer = new MutationObserver(() => {
        requestAnimationFrame(() => {
            logArea.scrollTo({
                top: logArea.scrollHeight,
                behavior: 'smooth'
            });
        });
    });

    if (logArea) {
        observer.observe(logArea, {
            childList: true,
            characterData: true,
            subtree: true
        });
    }

    // ==========================================
    // 4. 入力欄の制御 (Enter2回でクリア)
    // ==========================================
    textarea.addEventListener("keydown", (e) => {
        // if (e.key === "Enter") {
        //     const now = Date.now();
        //     if (now - lastEnterTime < 500) {
        //         textarea.value = "";
        //         console.log("Enter連打により入力をクリアしました");
        //     }
        //     lastEnterTime = now;
        // }
        if (e.key === "Enter" && e.shiftKey) {
            e.preventDefault();

            textarea.value = "";
        }
    });

    // ==========================================
    // 5. 音声合成モジュールの動的読み込み
    // ==========================================
    try {
        await loadVoiceScript(voiceType.value);
    } catch (error) {
        console.error('初期スクリプトの読み込み失敗:', error);
    }

    voiceType.addEventListener("change", async () => {
        const selected = voiceType.value;
        try {
            await loadVoiceScript(selected);
        } catch (error) {
            console.error('モジュール切り替え失敗:', error);
        }
    });

    async function loadVoiceScript(selected) {
        // 既存モジュールのクリーンアップ
        if (window.ttsModule && typeof window.ttsModule.cleanup === 'function') {
            window.ttsModule.cleanup();
        }

        const oldScript = document.getElementById('tts-script');
        if (oldScript) oldScript.remove();

        const script = document.createElement('script');
        script.id = 'tts-script';
        script.src = selected + '.js';
        document.head.appendChild(script);

        return new Promise((resolve, reject) => {
            script.onload = () => {
                if (window.ttsModule) {
                    if (typeof window.ttsModule.init === 'function') {
                        window.ttsModule.init();
                    }
                    window.currentSpeak = window.ttsModule.speak;
                    window.currentTTSModule = window.ttsModule.id;
                    console.log(`モジュール起動: ${window.ttsModule.id}`);
                }
                resolve();
            };
            script.onerror = (e) => reject(e);
        });
    }
    
    // ↓相槌ボタンのイベントリスナー↓
    reactionButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const text = button.dataset.text;
            if (!text) return;

            const originalText = button.textContent;

            button.disabled = true;
            button.classList.add("sending");
            button.textContent = "送信中…";

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = "ja-JP";

            utterance.onend = () => {
                button.disabled = false;
                button.classList.remove("sending");
                button.textContent = originalText;
            };

            utterance.onerror = () => {
                button.disabled = false;
                button.classList.remove("sending");
                button.textContent = originalText;
            };

            speechSynthesis.speak(utterance);
        });
    });
    // ↑相槌ボタンのイベントリスナー↑
});