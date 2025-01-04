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
    const response = await fetch(url);
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
        item.url = values[2].trim();
        item.startsec = values[3];
        item.endsec = values[4];
        item.hidden = values[5].trim();
        item.memo = values[6].trim();
        playlist.push(item);
    }
    return playlist;
}

async function loadCSVHeader(url = "https://raw.githubusercontent.com/kagasan/tsurusube.com/refs/heads/main/playlist.csv") {
    // utf8のcsvを読み込み、ヘッダ行を返す
    const response = await fetch(url);
    const text = await response.text();
    const rows = text.split("\n");
    return rows[0];
}

window.onload = () => {

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
                playlist: [{
                    title: "Loading...",
                    artist: "",
                    url: "",
                    startsec: 0,
                    endsec: 0,
                    hidden: 0,
                    memo: "",
                }],
                pointer: 0,
                play_state: false,
            };
        },
        async created() {
            try {
                this.playlist = await loadPlayList();
            } catch (e) {
                console.error(e);
            }
        },
        methods: {
            sample() {
                console.log('sample');
            },
            select(index) {
                console.log('index', index);
                this.pointer = index;
                this.play();
            },
            play() {
                yt_player.loadVideoById({
                    'videoId': formatURL(this.playlist[this.pointer].url),
                    'startSeconds': formatTime(this.playlist[this.pointer].startsec),
                    'endSeconds': 24*60*60,
                    'suggestedQuality': 'default'
                });
            },
            generateCSV() {
                // playlistをcsv形式に変換して新しいタブで開く
                console.log('generateCSV');

                // ヘッダ行を取得
                loadCSVHeader().then((header) => {
                    const rows = [header];
                    this.playlist.forEach((item) => {
                        // 半角カンマが含まれる場合は全角カンマに変換
                        const row = [
                            item.title.replace(/,/g, '，').trim(),
                            item.artist.replace(/,/g, '，').trim(),
                            item.url.replace(/,/g, '，').trim(),
                            item.startsec.replace(/,/g, '，').trim(),
                            item.endsec.replace(/,/g, '，').trim(),
                            item.hidden.replace(/,/g, '，').trim(),
                            item.memo.replace(/,/g, '，').trim(),
                        ];
                        rows.push(row.join(','));
                    });
                    const csv = rows.join('\n');
                    const blob = new Blob([csv], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    window.open(url);
                });
                
            }
        }

    }); // Vueインスタンスを生成

    const vueApp = app.mount("#edit"); // マウント

    // YouTube IFrame APIが準備完了したときに呼ばれる関数
    window.onYouTubeIframeAPIReady = () => {
        yt_player = new YT.Player('player', {
            width: '480',
            height: '270',
            videoId: 'cSGGM6yJZjI',
            events: {
                'onReady': (e) => {
                    yt_ready = true;
                    vueApp.play();
                },
                'onStateChange': (e) => {
                    if (e.data === 1) vueApp.play_state = true; // 再生中
                    if (e.data === 0 && vueApp.play_state === true) { // 再生終了
                        vueApp.play_state = false; // 再生中フラグを下げる
                    }
                    if (e.data === 2) vueApp.play_state = false; // 一時停止
                }
            }
        });
    }

};