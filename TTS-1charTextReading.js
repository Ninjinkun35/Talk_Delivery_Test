(() => {
    // ==========================================
    // 【モジュール概要】1字ずつ読み上げる
    // ==========================================
    // このモジュールは、ひらがなのみを1文字ずつ読み上げます
    // 例：「あいうえお」→「あ」「い」「う」「え」「お」と1文字ずつ
    // 漢字が入ったら、その部分は読み上げません
    
    // テキスト入力欄を取得（できればid="Chat"、なければid="input"）
    const textarea = document.getElementById('Chat') || document.getElementById('input');
    if (!textarea) {
        console.error('TTS-1charTextReading.js: textarea element not found. Expected id="Chat" or id="input".');
        return;
    }

    // ================================================
    // 【状態管理用の変数】データ保存用
    // ================================================

    // 直前に読み上げた内容（重複読み上げ防止）
    // = 同じ内容を連続で読み上げないようにする
    let lastSpoken = '';

    // 直前までのテキストエリアの内容を保持
    // = 新しく入力された部分（差分）を検出するため
    let lastValue = '';

    // 音声読み上げ中に入力されたテキストをキューに保存
    // 理由：読み上げ中に新しい文字が入力されたら、
    //       現在の読み上げが終わったら順番に読む
    let queuedText = '';

    // 現在音声を読み上げ中かどうかのフラグ
    // true = 読み上げ中（次の読み上げは待つ）
    // false = 読み上げ終了（すぐに新しい読み上げを開始できる）
    let isSpeaking = false;

    // IME変換中かどうかのフラグ
    // true = 日本語入力の変換中（確定していない状態）
    // false = 変換完了または変換していない状態
    let composing = false;

    // ================================================
    // 【関数】ブラウザから日本語音声を取得
    // ================================================
    function getJapaneseVoice() {
        // ブラウザに登録されている全音声を取得
        const voices = window.speechSynthesis.getVoices();
        // その中から言語が「ja-JP（日本語）」のものを探す
        // 見つからない場合は null を返す
        return voices.find(v => v.lang === 'ja-JP') || null;
    }

    // ================================================
    // 【関数】テキストから記号を除去（読み上げ用クリーン化）
    // ================================================
    function cleanText(text) {
        // 対象を保持する文字：
        // \w = 英数字（a-z, A-Z, 0-9）とアンダースコア
        // \s = 空白
        // \u3040-\u309F = ひらがなの範囲
        // \u30A0-\u30FF = カタカナの範囲
        // \u4E00-\u9FFF = 漢字の範囲
        // $%& = 記号（これらは保持）
        // 理由：上記以外の記号は読み上げに支障をきたすため
        return text.replace(/[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF$%&]/g, '');
    }

    // ================================================
    // 【関数】テキストを音声で読み上げる（メイン処理）
    // ================================================
    function speak(text) {
        // テキストから記号を除去してキレイにする
        text = cleanText(text);
        
        // テキストが空、または前回と同じ内容なら読み上げない
        if (!text || text === lastSpoken) return;
        
        // （以前は cancel() で現在の再生を止めていたが、
        //  IME確定中でも音声を続けたいため、cancel() を削除）
        // window.speechSynthesis.cancel();

        // 音声合成のための「発言」オブジェクトを作成
        const utterance = new SpeechSynthesisUtterance(text);
        // 日本語の音声を取得して設定
        const jaVoice = getJapaneseVoice();
        if (jaVoice) utterance.voice = jaVoice;

        // テスト用：読み上げるテキストをコンソールに表示
        console.log('1charTextReading関数が呼ばれました。', '読み上げられたひらがな:', text);

        // 読み上げ中フラグを立てる（これから読み上げ開始）
        isSpeaking = true;
        
        // 【イベント】読み上げが終わったときの処理
        utterance.onend = () => {
            // 読み上げ終了したのでフラグを下ろす
            isSpeaking = false;
            // キューにテキストが入っているかチェック
            if (queuedText.trim()) {
                // キューに入っているテキストを取り出す
                const textToSpeak = queuedText;
                queuedText = '';  // キューをクリア
                // キューのテキストを読み上げ
                speak(textToSpeak);
            }
        };
        
        // 【イベント】エラーが発生したときの処理
        utterance.onerror = () => {
            // エラーが発生したらフラグを下ろす
            isSpeaking = false;
        };

        // ブラウザの音声合成機能で実際に読み上げを開始
        window.speechSynthesis.speak(utterance);
        // 今回読み上げた内容を保存（重複防止）
        lastSpoken = text;
    }

    // ================================================
    // 【関数】2つの文字列の「同じ部分の長さ」を求める
    // ================================================
    // 例：「abc」と「abd」→ 共通部分は「ab」なので戻り値は 2
    // 用途：前のテキストと現在のテキストで、何文字が同じか調べる
    function getCommonPrefixLength(a, b) {
        // 短い方の長さを取得（短い方が基準）
        const minLen = Math.min(a.length, b.length);
        let i = 0;
        // 同じ位置の文字が一致する限り、位置をすすめる
        while (i < minLen && a[i] === b[i]) i++;
        // 一致した文字の個数を返す
        return i;
    }

    // ================================================
    // 【関数】前のテキストからの「変更部分」を抽出
    // ================================================
    // 例：「こんにちは」→「こんにちいろは」に変わったら
    //    「いろは」が差分（新しく入力された部分）
    function getChangedText(prev, curr) {
        // 前のテキストが空なら、現在のテキスト全体が変更部分
        if (!prev) return curr;
        // 現在のテキストが前で始まっているなら（追加の場合）
        // 前のテキストの後ろ（新しく追加された部分）を返す
        if (curr.startsWith(prev)) return curr.slice(prev.length);
        // どちらでもない場合（例：編集・置き換え）
        // 共通部分の後ろを変更部分とする
        const prefixLen = getCommonPrefixLength(prev, curr);
        return curr.slice(prefixLen);
    }

    // ================================================
    // 【関数】「このの文字がひらがなか」を判定
    // ================================================
    // ひらがなは Unicode で特定の範囲を占めている
    function isHiragana(ch) {
        // 文字を Unicode 数値に変換
        const code = ch.charCodeAt(0);
        // ひらがなの範囲：0x3040 ～ 0x309F
        // （ぁ～ん）
        return code >= 0x3040 && code <= 0x309F;
    }

    // ================================================
    // 【関数】テキストに日本語が含まれているか判定
    // ================================================
    // ひらがな・カタカナ・漢字のいずれかが含まれているかチェック
    function containsJapanese(text) {
        // 正規表現で日本語文字を検索
        // \u3040-\u309F = ひらがな
        // \u30A0-\u30FF = カタカナ
        // \u4E00-\u9FFF = 漢字
        return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text);
    }

    // ================================================
    // 【関数】ローマ字（英字）をひらがなに変換
    // ================================================
    // 例：「konnichiwa」→「こんにちは」
    // 用途：キーボードで「k」「o」「n」と打ったら、
    //       リアルタイムで「こ」「ん」に変換して読み上げる
    function romajiToHiragana(text) {
        // ローマ字とひらがなの対応表
        // 「ka」→「か」「kya」→「きゃ」など
        const ROMAJI_TABLE = {
            a:'あ', i:'い', u:'う', e:'え', o:'お',
            ka:'か', ki:'き', ku:'く', ke:'け', ko:'こ',
            sa:'さ', si:'し', su:'す', se:'せ', so:'そ',
            ta:'た', ti:'ち', tu:'つ', te:'て', to:'と',
            na:'な', ni:'に', nu:'ぬ', ne:'ね', no:'の',
            ha:'は', hi:'ひ', hu:'ふ', he:'へ', ho:'ほ',
            ma:'ま', mi:'み', mu:'む', me:'め', mo:'も',
            ya:'や', yu:'ゆ', yo:'よ',
            ra:'ら', ri:'り', ru:'る', re:'れ', ro:'ろ',
            wa:'わ', wo:'を',
            ga:'が', gi:'ぎ', gu:'ぐ', ge:'げ', go:'ご',
            za:'ざ', zi:'じ', zu:'ず', ze:'ぜ', zo:'ぞ',
            da:'だ', di:'ぢ', du:'づ', de:'で', do:'ど',
            ba:'ば', bi:'び', bu:'ぶ', be:'べ', bo:'ぼ',
            pa:'ぱ', pi:'ぴ', pu:'ぷ', pe:'ぺ', po:'ぽ',
            kya:'きゃ', kyu:'きゅ', kyo:'きょ',
            sya:'しゃ', syu:'しゅ', syo:'しょ',
            sha:'しゃ', shu:'しゅ', sho:'しょ',
            tya:'ちゃ', tyu:'ちゅ', tyo:'ちょ',
            cha:'ちゃ', chu:'ちゅ', cho:'ちょ',
            nya:'にゃ', nyu:'にゅ', nyo:'にょ',
            hya:'ひゃ', hyu:'ひゅ', hyo:'ひょ',
            mya:'みゃ', myu:'みゅ', myo:'みょ',
            rya:'りゃ', ryu:'りゅ', ryo:'りょ',
            gya:'ぎゃ', gyu:'ぎゅ', gyo:'ぎょ',
            zya:'じゃ', zyu:'じゅ', zyo:'じょ',
            ja:'じゃ', ju:'じゅ', jo:'じょ',
            dya:'ぢゃ', dyu:'ぢゅ', dyo:'ぢょ',
            bya:'びゃ', byu:'びゅ', byo:'びょ',
            pya:'ぴゃ', pyu:'ぴゅ', pyo:'ぴょ'
        };

        // 変換後の結果を保存する変数
        let result = '';
        // テキストの現在位置（どこまで処理したか）
    let i = 0;
    // テキストの最後までループ
    while (i < text.length) {
        // マッチしたかどうかのフラグ
        let matched = false;
        // 特別な場合: "nn" は "ん" に変換
        if (text.slice(i, i + 2).toLowerCase() === 'nn') {
            result += 'ん';
            i += 2;
            continue;
        }
        // 最長一致から順にチェック（3文字→2文字→1文字）
        for (let len = 3; len >= 1; len--) {
            // 現在の位置からlen文字分の文字列を取得して小文字に
            const chunk = text.slice(i, i + len).toLowerCase();
            // 対応表にあれば変換
            if (ROMAJI_TABLE[chunk]) {
                result += ROMAJI_TABLE[chunk];
                i += len;
                matched = true;
                break;
            }
        }
        // マッチしなかったら、そのままの文字を追加
        if (!matched) {
            result += text[i];
            i++;
        }
    }
    // 変換結果を返す
    return result;
}

// ================================================
// 【状態管理の追加変数】IME変換中の処理用
// ================================================

// IME変換が終了した直後かどうかのフラグ
// 理由：「compositionend」と「input」の両方が発火するので重複防止
let justEndedComposition = false;
// IME変換中の前のテキスト（差分検出用）
let compositionPrev = '';
// IME変換中に読み上げたかどうかのフラグ（読み上げ済み判定用）
let compositionSpoken = false;

// ================================================
// 【関数】「ひらがなのみ」かをチェックして返す
// ================================================
// このモジュールはひらがなだけを読むモジュールなので、
// 漢字が含まれたテキストは読み上げない
function getSpeakableText(text) {
    // テキストが空なら空文字を返す
    if (!text) return '';
    // テキストの全ての文字をチェック
    for (let ch of text) {
        // 1文字でもひらがな以外があれば、空を返す（読み上げない）
        if (!isHiragana(ch)) return '';
    }
    // 全てひらがななら、テキストをそのまま返す
    return text;
}

// ================================================
// 【関数】入力テキストを読み上げ可能な形で処理
// ================================================
function handleInputText(text) {
    // 読み上げ可能なテキスト（ひらがなのみ）を取得
    const speakable = getSpeakableText(text);
    // 読み上げ可能なテキストがなければ何もしない
    if (!speakable) return;
    // 現在読み上げ中かどうかで処理を分ける
    if (isSpeaking) {
        // 読み上げ中なら、新しいテキストをキューに追加
        queuedText += speakable;
    } else {
        // 読み上げ完了なら、すぐに読み上げ開始
        speak(speakable);
    }
    // このIME変換セッションで読み上げたことを記録
    compositionSpoken = true;
}

// ================================================
// 【イベントハンドラ】IME変換開始時の処理
// ================================================
// 例：「こ」と打つ→変換候補（「こ」「呼」など）が表示
// このときに呼ばれる
function handleCompositionStart() {
    // 「IME変換中」というフラグを立てる
    composing = true;
    // 変換中の前のテキストをリセット
    compositionPrev = '';
    // 変換中に読み上げたフラグをリセット
    compositionSpoken = false;
}

// ================================================
// 【イベントハンドラ】IME変換中の文字変化処理
// ================================================
// 例：「こ」→「こん」→「こんに」と入力中
// この途中のステップそれぞれで呼ばれる
function handleCompositionUpdate(e) {
    // 現在の変換中のテキスト（未確定）を取得
    const currentComposition = e.data || '';
    // 前の変換テキストとの差分を取得（新しく追加された文字）
    const newText = getChangedText(compositionPrev, currentComposition);
    // 今のテキストを「前のテキスト」として記録（次の比較用）
    compositionPrev = currentComposition;
    // 新しいテキストがなければ何もしない
    if (!newText) return;
    // 複数文字が一度に変わったら読み上げない（1字ずつだけ読む）
    // 例）「きゃ」のような拗音は2文字だが1字扱い
    if (newText.length > 2) return;
    // 新しく追加された文字を読み上げる
    handleInputText(newText);
}

// ================================================
// 【イベントハンドラ】IME変換終了時（候補確定時）の処理
// ================================================
// 例：スペースキーで「こん」→「昆」に確定
// このときに呼ばれる
function handleCompositionEnd() {
    // 「IME変換中」というフラグを下ろす
    composing = false;
    // 現在のテキストエリアの値を【全体】取得
    const currentValue = textarea.value;
    // 前回記録したテキストからの差分を取得
    const newText = getChangedText(lastValue, currentValue);
    // 新しいテキストがあり、まだ読み上げていない場合のみ処理
    if (newText && !compositionSpoken) {
        handleInputText(newText);
    }
    // 変換中の読み上げフラグをリセット
    compositionSpoken = false;
    // 「変換直後」というフラグを立てる（次の input イベント対策）
    justEndedComposition = true;
    // 次の変更検出用に、現在のテキストを記録
    lastValue = currentValue;
}

// ================================================
// 【イベントハンドラ】通常のテキスト入力イベント
// ================================================
// IMEを使わない「直接入力」のときに呼ばれる
function handleInputEvent() {
    // IME変換中なら、ここでは処理しない（compositionupdate で処理する）
    if (composing) return;
    // 変換直後なら、重複防止のためスキップ
    if (justEndedComposition) {
        justEndedComposition = false;
        return;
    }
    // 現在のテキストエリアの値を取得
    const currentValue = textarea.value;
    // 値が空なら前の値をリセット
    if (!currentValue) {
        lastValue = '';
        return;
    }
    // 前の値との差分を取得
    const newText = getChangedText(lastValue, currentValue);
    // 新しいテキストがなければ前の値を更新して終了
    if (!newText) {
        lastValue = currentValue;
        return;
    }
    // 新しいテキストを処理して読み上げる
    handleInputText(newText);
    // 前の値を更新
    lastValue = currentValue;
}

function init() {
    // compositionstart イベント＝IME変換開始時
    textarea.addEventListener('compositionstart', handleCompositionStart);
    // compositionupdate イベント＝IME変換中の文字変化時
    textarea.addEventListener('compositionupdate', handleCompositionUpdate);
    // compositionend イベント＝IME変換終了（候補確定）時
    textarea.addEventListener('compositionend', handleCompositionEnd);
    // input イベント＝通常のテキスト入力などの全ての入力時
    textarea.addEventListener('input', handleInputEvent);
}

// ================================================
// 【関数】このモジュールをクリーンアップ（イベントリスナー削除）
// ================================================
// main.js から別のモジュール（例：「漢字変換」）に切り替えるとき呼ばれる
function cleanup() {
    // 登録したイベントリスナーを全て削除
    // 削除することで、このモジュールの処理が走らなくなる
    textarea.removeEventListener('compositionstart', handleCompositionStart);
    textarea.removeEventListener('compositionupdate', handleCompositionUpdate);
    textarea.removeEventListener('compositionend', handleCompositionEnd);
    textarea.removeEventListener('input', handleInputEvent);
}

// ================================================
// 【音声リスト非同期ローディング対策】
// ================================================
// ブラウザが音声リストを読み込む（または更新する）ときに呼ばれる
// 理由：ページ読み込み直後は音声がまだ準備できていないため
window.speechSynthesis.onvoiceschanged = () => {
    // 日本語音声を取得して準備する
    getJapaneseVoice();
};

// ================================================
// 【エクスポート】main.js にこのモジュールを登録
// ================================================
// main.js がこのモジュールを認識・管理できるようにする
window.ttsModule = {
    id: 'TTS-1charTextReading',   // このモジュールの識別子（「1字」対応）
    speak,                         // 読み上げ関数を公開
    init,                          // 初期化関数を公開
    cleanup,                       // クリーンアップ関数を公開
};

})();