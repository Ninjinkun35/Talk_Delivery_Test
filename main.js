// ==========================================
// 1. 全モード共通のログ保管場所
// ==========================================
// モードを切り替えても消えないように window オブジェクトに保持します
if (!window.sharedLogEntries) {
    window.sharedLogEntries = [];
}

document.addEventListener('DOMContentLoaded', async () => {
    const textarea = document.getElementById("Chat");
    const logArea = document.getElementById("logArea");
    const voiceType = document.getElementById("voiceType");
    const video = document.getElementById("video"); // index.htmlのvideo要素

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
        if (e.key === "Enter") {
            const now = Date.now();
            if (now - lastEnterTime < 500) {
                textarea.value = "";
                console.log("Enter連打により入力をクリアしました");
            }
            lastEnterTime = now;
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
});