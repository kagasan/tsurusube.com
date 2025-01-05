// 便利関数をまとめた

function formatTime(str_time) {
    // 文字列の-1, 123, 1:5:23などを整数型の秒数に変換
    // 負の数を含む場合は24:00:00扱いになる
    // からの場合は0を返す
    if (!str_time) return 0;

    str_time = str_time.trim();

    if (str_time.includes('-')) return 24 * 60 * 60;

    const parts = str_time.split(':');
    let seconds = 0;
    for (let i = 0; i < parts.length; i++) {
        seconds = seconds * 60 + parseInt(parts[i] || '0', 10);
    }

    return seconds;
}

function formatDuration(seconds) {
    // 秒数を00:00:00形式の文字列に変換
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatURL(url) {
    // クエリパラメータのvを取り出す
    // ない場合はurlパスの空でない最後の部分を返す
    const urlObj = new URL(url);
    const v = urlObj.searchParams.get('v');
    if (v) return v;
    const paths = urlObj.pathname.split('/').filter((s) => s);
    return paths[paths.length - 1];
}


async function loadPlayList(url = "https://raw.githubusercontent.com/kagasan/tsurusube.com/refs/heads/main/playlist.csv") {
    // utf8のcsvを読み込み、dictの配列に変換して返す
    const response = await fetch(url, { cache: 'no-store' });
    const text = await response.text();
    const rows = text.split("\n");
    const keys = rows[0].split(",");
    const playlist = [];
    for (let i = 1; i < rows.length; i++) {
        const values = rows[i].split(",");
        if (values.length !== keys.length) {
            // 最終行など列数が合わない場合はスキップ
            continue;
        }
        const item = {};
        item.title = values[0].trim();
        item.artist = values[1].trim();
        item.id = formatURL(values[2].trim());
        item.startsec = formatTime(values[3]);
        item.endsec = formatTime(values[4]);
        item.duration = formatDuration(item.endsec - item.startsec);
        if(!(values[5].includes('1')))playlist.push(item);
    }
    return playlist;
}


// 初回読み込み時に実行
window.onload = () => {
    // プレイヤーサイズの自動調整
    const resizePlayer = () => {
        const container = document.querySelector(".relative");
        const player = document.querySelector("#player");
        const controls = document.querySelector(".flex.justify-center"); // コントロール部分を選択
        const width = container.offsetWidth;
        const height = width * 9 / 16; // 16:9 の比率
    
        player.style.width = `${width}px`;
        player.style.height = `${height}px`;
    
        // コントロール部分の余白を調整
        if (controls) {
            controls.style.marginTop = `${height}px`; // プレイヤーの高さ分を余白として追加
        }
    };
    resizePlayer(); // 初期設定
    window.addEventListener("resize", resizePlayer); // リサイズ時にサイズを更新

    // https://developers.google.com/youtube/iframe_api_reference?hl=ja
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    let yt_player = null; // YT.Playerオブジェクトが入る
    let yt_ready = false; // プレイヤーが準備完了したかどうか
    let first_loaded = false; // 初回読み込みが完了したかどうか

    const app = Vue.createApp({
        data() {
            return {
                playing_title: "読み込み中...",
                playing_artist: "読み込み中...",
                playing_duration: "00:00:00",
                playing_spend: "00:00:00",
                playlist: [],
                pointer: 0,
                loop_flag: false,
                play_state: false,
            };
        },
        async created() {
            try {
                // プレイリストを取得
                const items = await loadPlayList();
                this.playlist = items;

                console.log('プレイリストを読み込みました:', this.playlist);

            } catch (error) {
                console.error('プレイリストの読み込みに失敗しました:', error);
            }
        },
        methods: {
            back() { // 戻る
                console.log('back');
                this.pointer = (this.pointer - 1 + this.playlist.length) % this.playlist.length;
                this.play(true);
            },
            play(start_head = false) { // 再生 / 一時停止
                // console.log('play', start_head);
                if (start_head === true || first_loaded === false) {
                    // console.log('start_head');
                    yt_player.loadVideoById({
                        'videoId': this.playlist[this.pointer].id,
                        'startSeconds': this.playlist[this.pointer].startsec,
                        'endSeconds': this.playlist[this.pointer].endsec,
                        'suggestedQuality': 'default'
                    });
                    this.playing_title = this.playlist[this.pointer].title;
                    this.playing_artist = this.playlist[this.pointer].artist;
                    this.playing_duration = this.playlist[this.pointer].duration;
                    // this.play_state = true;
                    first_loaded = true;
                } else {
                    // UIでの再生/一時停止ボタン
                    if (this.play_state === true) {
                        // console.log('pause');
                        yt_player.pauseVideo();
                        this.play_state = false;
                    } else {
                        // console.log('play from pause');
                        yt_player.playVideo();
                        this.play_state = true;
                    }
                }
            },
            next() { // 次へ
                // console.log('next');
                this.pointer = (this.pointer + 1) % this.playlist.length;
                this.play(true);
            },
            shuffle() {
                console.log('shuffle');
                // まず0番目とpointer番目を入れ替える
                let tmp = this.playlist[0];
                this.playlist[0] = this.playlist[this.pointer];
                this.playlist[this.pointer] = tmp;

                // pointerを0に書き換え
                this.pointer = 0;

                // 1番目以降をシャッフル
                for (let i = 1; i < this.playlist.length; i++) {
                    const j = Math.floor(Math.random() * (this.playlist.length - i) + i);
                    tmp = this.playlist[i];
                    this.playlist[i] = this.playlist[j];
                    this.playlist[j] = tmp;
                }
            },
            loop() {
                // console.log('loop');
                this.loop_flag = !this.loop_flag;
            },
            select(index) {
                // console.log('select_song', index);
                this.pointer = index;
                this.play(true);
            }
        }
    });

    const vueApp = app.mount('#app');

    // YouTube IFrame APIが準備完了したときに呼ばれる関数
    window.onYouTubeIframeAPIReady = () => {
        yt_player = new YT.Player('player', {
            width: '720',
            height: '405',
            videoId: 'cSGGM6yJZjI',
            events: {
                'onReady': (e) => {
                    yt_ready = true;
                    vueApp.play(true);
                    setInterval(() => {
                        if (yt_ready && vueApp.play_state) {
                            vueApp.playing_spend = formatDuration(Math.floor(yt_player.getCurrentTime()) - vueApp.playlist[vueApp.pointer].startsec);
                        }
                    }, 500);
                },
                'onStateChange': (e) => {
                    // console.log(e.data);
                    if (first_loaded === false) {
                        vueApp.play(true);
                    }
                    if (e.data === 1) vueApp.play_state = true; // 再生中
                    if (e.data === 0 && vueApp.play_state === true) { // 再生終了
                        // console.log('end', this.pointer);
                        vueApp.play_state = false; // 再生中フラグを下げる
                        if (vueApp.loop_flag) {
                            vueApp.play(true);
                        } else {
                            vueApp.next();
                        }
                    }
                    if (e.data === 2) vueApp.play_state = false; // 一時停止
                }
            }
        });
    }
}
