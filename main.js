// 発言入力の動的処理
document.addEventListener('DOMContentLoaded', async () => {
    // テキストエリアにイベントリスナーを設定
    const toggle = document.getElementById("readToggle");
    const label = document.getElementById("toggleLabel");
    const textarea = document.getElementById("Chat");
    const readToggle = document.getElementById("readToggle");
    // const displayArea = document.getElementById("displayArea");
    const logArea = document.getElementById("logArea");
    const voiceType = document.getElementById("voiceType");
    let lastKeyWasEnter;

    let lastEnterTime = 0;

    window.currentSpeak = null;
    window.currentTTSModule = null;

    // function speakText(text) {
    //     if (typeof window.currentSpeak === 'function') {
    //         window.currentSpeak(text);
    //     } else if (typeof window.speak === 'function') {
    //         window.speak(text);
    //     } else {
    //         console.warn('No TTS speak function is loaded yet.');
    //     }
    // }

    // 初期選択に基づいて音声スクリプトを読み込み
    try {
        await loadVoiceScript(voiceType.value);
    } catch (error) {
        console.error('Failed to load initial voice script:', error);
    }

    // 音声タイプ選択のイベントリスナー
    voiceType.addEventListener("change", async () => {
        const selected = voiceType.value;
        try {
            await loadVoiceScript(selected);
        } catch (error) {
            console.error('Failed to load voice script:', error);
        }
    });

    textarea.addEventListener("keyup", function(e){
        // Enterがクリックされる場合に発話する
        if(e.key === 'Enter'){
            if(lastKeyWasEnter){
                textarea.value = '';
                lastKeyWasEnter = false;
                return;
            }

            const cursorPos = textarea.selectionStart;
            const textBeforeCursor = textarea.value.substring(0, cursorPos);

            // 最後の改行位置を探す
            const lines = textBeforeCursor.split('\n');
            const lastLine = lines[lines.length - 2] || ''; //1つ前の行

            // if(lastLine.trim() !== ''){
            //     speakText(lastLine);
            // }
            lastKeyWasEnter = true;
        }else{
            lastKeyWasEnter = false;
        }
    });
});

// 呼びかけボタンの動的処理
// DOMが完全にロードされたらイベントリスナーを設定
document.addEventListener('DOMContentLoaded', function(){
    const playButton = document.getElementById("Calling");
    const callingType = document.getElementById("CallingType");

    if(playButton){
        playButton.addEventListener("click", function(){
            const mode = callingType.value;

            playButton.disabled = true;
            playButton.textContent = "🔴 呼びかけ中...";
            playButton.classList.add("blink");

            if(mode === 'TextDisplay'){ // 今いいですか？モード
                const utterance = new SpeechSynthesisUtterance("今いいですか？");
                utterance.lang = "ja-JP";
                utterance.rate = 1.0;

                utterance.onend = () => {
                    resetCallButton();
                };

                window.speechSynthesis.speak(utterance);
            } else if(mode === 'ModeDisplay'){ // 通知音モード
                const audio = new Audio('CallingSound2.mp3');
                let playCount = 0;

                audio.addEventListener('ended', () => {
                    playCount++;
                    if(playCount < 2){
                        audio.currentTime = 0;
                        audio.play();
                    } else {
                        resetCallButton();
                    }
                });

                audio.play().catch(function(e){
                    console.log('音声再生に失敗しました。', e);
                    resetCallButton();
                });
            } else if(mode === 'BlinkMode'){ // 点滅モード
                document.body.classList.add('blink-background');

                setTimeout(() => {
                    document.body.classList.remove('blink-background');
                    resetCallButton();
                }, 3000);
            }
        });

        function resetCallButton(){
            playButton.textContent = "呼びかけ";
            playButton.classList.remove("blink");
            playButton.disabled = false;
        }
    } else {
        console.error("ボタンがDOMに存在しません。");
    }
});

// カメラの動的処理
window.addEventListener('load', function(){
    // Videoのstream
    let stream = null;
    // Videoの設定値
    const constraints = {
        audio: false,
        video: {
            width: 300,
            height: 300,
            // フロントカメラの場合
            facingMode: 'user',
        },
    }
    // カメラ起動
    async function startCamera(constraints) {
        try{
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            const video = document.getElementById('video');
            video.srcObject = stream;
            video.onloadedmetadata = () => {
                video.play();
            };
        } catch(err){
            //エラーハンドリング
            console.error(err);
        }
    }
    // カメラ停止
    function stopCamera(){
        const video = document.getElementById('video');
        const tracks = video.srcObject.getTracks();
        tracks.forEach((track) => {
            track.stop();
        });
        video.srcObject = null;
    }

    // 初期処理
    startCamera(constraints);
});

// 音声スクリプトを動的に読み込む関数
async function loadVoiceScript(selected) {
    console.log('Loading voice script:', selected);
    const textarea = document.getElementById("Chat");
    // 既存の TTS スクリプトを削除
    const existingScript = document.getElementById('tts-script');
    if (existingScript) {
        existingScript.remove();
        console.log('Removed existing script');
    }

    // 既存の TTS モジュールが持つイベントリスナーを解除
    if (window.ttsModule && typeof window.ttsModule.cleanup === 'function') {
        window.ttsModule.cleanup();
        console.log('Cleaned up previous TTS module:', window.ttsModule.id);
    }
    window.ttsModule = null;
    window.currentSpeak = null;
    window.currentTTSModule = null;

    // 既存のイベントリスナーを削除
    if (window.inputHandler) {
        textarea.removeEventListener('input', window.inputHandler);
        window.inputHandler = null;
    }
    if (window.compositionstartHandler) {
        textarea.removeEventListener('compositionstart', window.compositionstartHandler);
        window.compositionstartHandler = null;
    }
    if (window.compositionendHandler) {
        textarea.removeEventListener('compositionend', window.compositionendHandler);
        window.compositionendHandler = null;
    }
    if (window.keydownHandler) {
        textarea.removeEventListener('keydown', window.keydownHandler);
        window.keydownHandler = null;
    }
    if (window.inputCompositionHandler) {
        textarea.removeEventListener('input', window.inputCompositionHandler);
        textarea.removeEventListener('compositionend', window.inputCompositionHandler);
        window.inputCompositionHandler = null;
    }

    // 新しいスクリプトを読み込み
    const script = document.createElement('script');
    script.id = 'tts-script';
    script.src = selected + '.js';
    console.log('Loading script:', script.src);
    document.head.appendChild(script);

    // スクリプトの読み込みが完了するまで待つ（オプション）
    return new Promise((resolve, reject) => {
        script.onload = () => {
            console.log('Script loaded successfully:', selected);
            if (window.ttsModule) {
                console.log('Registered TTS module:', window.ttsModule.id);
                if (typeof window.ttsModule.init === 'function') {
                    window.ttsModule.init();
                }
                window.currentSpeak = window.ttsModule.speak;
                window.currentTTSModule = window.ttsModule.id;
            } else if (typeof window.speak === 'function') {
                window.currentSpeak = window.speak;
                console.warn('Loaded script did not register a ttsModule object. Falling back to global speak().');
            } else {
                console.warn('Loaded script did not register a TTS module or speak() function.');
            }
            resolve();
        };
        script.onerror = (e) => {
            console.error('Failed to load script:', selected, e);
            reject(e);
        };
    });
}