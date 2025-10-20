// --- ゲーム設定 ---
const GRID_SIZE = 8;
const TILE_SIZE = 62; // タイルのサイズ (60px) + ボーダー (1px*2)
const EMOJIS = ['🍎', '🍌', '🍇', '🍓']; 
const BASE_SCORE = 10;
const boardElement = document.getElementById('board');
const scoreElement = document.getElementById('score');
const comboDisplayElement = document.getElementById('combo-display'); 

// --- ゲーム状態 ---
let board = [];
let score = 0;
let selectedTile = null; // ドラッグ開始タイル (DOM要素)
let isProcessing = false; // コンボ中など、操作を受け付けない状態
let currentCombo = 0; // 現在のコンボ回数

// --- スライド操作用の変数 ---
let startX = 0;
let startY = 0;
let currentTileElement = null;

// --- 初期化 ---

/**
 * ランダムな絵文字を取得
 */
function getRandomEmoji() {
    return EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
}

/**
 * ボードを初期化し、HTMLに描画
 */
function initGame() {
    // CSS Gridの設定
    boardElement.style.gridTemplateColumns = `repeat(${GRID_SIZE}, ${TILE_SIZE - 2}px)`; // タイルサイズに合わせる

    // 衝突のない初期ボードを生成
    board = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(null).map(getRandomEmoji));
    
    // 初期マッチを削除し、新しい絵文字で補充 (安定化)
    while (checkAllMatches().length > 0) {
        removeMatches(checkAllMatches());
        gravity();
        fillEmptyTiles();
    }
    
    drawBoard();
    updateComboDisplay(0); // コンボ表示をリセット
}

/**
 * ボード配列からHTMLにタイルを描画
 */
function drawBoard() {
    boardElement.innerHTML = '';
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const tile = createTileElement(board[r][c], r, c);
            boardElement.appendChild(tile);
        }
    }
}

/**
 * タイルのDOM要素を生成
 */
function createTileElement(emoji, r, c) {
    const tile = document.createElement('div');
    tile.classList.add('tile');
    tile.textContent = emoji;
    tile.dataset.r = r;
    tile.dataset.c = c;
    
    // クリックイベントの代わりにスライドイベントを設定
    tile.addEventListener('mousedown', handleDragStart);
    tile.addEventListener('touchstart', handleDragStart);

    return tile;
}

// --- スライド操作処理 ---

/**
 * ドラッグ開始
 */
function handleDragStart(event) {
    if (isProcessing) return; 

    // タッチイベントまたはマウスイベントから座標を取得
    const clientX = event.clientX || event.touches[0].clientX;
    const clientY = event.clientY || event.touches[0].clientY;

    startX = clientX;
    startY = clientY;
    
    // ドラッグを開始したタイルを記憶
    currentTileElement = event.currentTarget; 
    currentTileElement.classList.add('selected'); // 選択状態を表示

    // イベントリスナーを設定
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('touchmove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
    document.addEventListener('touchend', handleDragEnd);
}

/**
 * ドラッグ移動 (ここではアニメーション処理は行わず、方向の判定のみに使う)
 */
function handleDragMove(event) {
    // デフォルトのスクロール動作などをキャンセル
    if (event.cancelable) {
        event.preventDefault();
    }
    // ここでリアルタイムにタイルを動かす処理を入れることも可能だが、今回は単純化し、Endでスワップ判定のみを行う
}

/**
 * ドラッグ終了 (スワップの判定と実行)
 */
function handleDragEnd(event) {
    if (!currentTileElement) return;

    // タッチイベントまたはマウスイベントから終了座標を取得
    const clientX = event.clientX || (event.changedTouches && event.changedTouches[0].clientX);
    const clientY = event.clientY || (event.changedTouches && event.changedTouches[0].clientY);

    // 移動距離の計算
    const deltaX = clientX - startX;
    const deltaY = clientY - startY;

    currentTileElement.classList.remove('selected'); // 選択解除

    const r1 = parseInt(currentTileElement.dataset.r);
    const c1 = parseInt(currentTileElement.dataset.c);
    
    let r2 = r1;
    let c2 = c1;
    
    const threshold = 20; // スライド判定のしきい値 (ピクセル)
    
    // スライド方向の判定
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > threshold) {
        // 水平方向へのスライド
        if (deltaX > 0) {
            c2 = c1 + 1; // 右
        } else {
            c2 = c1 - 1; // 左
        }
    } else if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > threshold) {
        // 垂直方向へのスライド
        if (deltaY > 0) {
            r2 = r1 + 1; // 下
        } else {
            r2 = r1 - 1; // 上
        }
    } else {
        // 移動量が少ない、またはスライド判定されなかった場合は何もしない
        resetDragListeners();
        return;
    }

    // 隣接タイルが存在し、盤面内かチェック
    if (isAdjacent(r1, c1, r2, c2) && r2 >= 0 && r2 < GRID_SIZE && c2 >= 0 && c2 < GRID_SIZE) {
        isProcessing = true; // スワップ処理開始
        swapTiles(r1, c1, r2, c2);
    } 

    resetDragListeners();
}

/**
 * ドラッグ関連のイベントリスナーを解除
 */
function resetDragListeners() {
    currentTileElement = null;
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('touchmove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
    document.removeEventListener('touchend', handleDragEnd);
}

/**
 * 2つの座標が隣接しているかチェック
 */
function isAdjacent(r1, c1, r2, c2) {
    const dr = Math.abs(r1 - r2);
    const dc = Math.abs(c1 - c2);
    return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
}

/**
 * タイルを交換し、マッチングチェックと処理を行う
 */
function swapTiles(r1, c1, r2, c2) {
    
    // DOM要素のテキスト内容とデータ属性を交換
    const tile1 = document.querySelector(`.tile[data-r="${r1}"][data-c="${c1}"]`);
    const tile2 = document.querySelector(`.tile[data-r="${r2}"][data-c="${c2}"]`);

    // 盤面配列で値を交換
    [board[r1][c1], board[r2][c2]] = [board[r2][c2], board[r1][c1]];

    // 視覚的な交換アニメーション
    const dx = c2 - c1;
    const dy = r2 - r1;
    
    tile1.style.transform = `translate(${dx * TILE_SIZE}px, ${dy * TILE_SIZE}px)`;
    tile2.style.transform = `translate(${-dx * TILE_SIZE}px, ${-dy * TILE_SIZE}px)`;
    
    
    // マッチングサイクルを開始
    setTimeout(() => {
        // アニメーション完了後、DOMをリセット
        tile1.style.transform = '';
        tile2.style.transform = '';

        // データとDOMコンテンツの交換
        [tile1.dataset.r, tile2.dataset.r] = [tile2.dataset.r, tile1.dataset.r];
        [tile1.dataset.c, tile2.dataset.c] = [tile2.dataset.c, tile1.dataset.c];
        [tile1.textContent, tile2.textContent] = [tile2.textContent, tile1.textContent];
        
        currentCombo = 0; // 新しい操作なのでコンボをリセット
        swapMatchCycle(r1, c1, r2, c2);
    }, 200); // CSS transitionの時間 (0.2s) に合わせる
}

/**
 * 交換後のマッチング、消去、落下、補充のサイクル
 */
function swapMatchCycle(originalR1 = -1, originalC1 = -1, originalR2 = -1, originalC2 = -1) {
    const matches = checkAllMatches();

    if (matches.length > 0) {
        currentCombo++; // マッチが発生したのでコンボをカウントアップ
        updateComboDisplay(currentCombo);
        
        removeMatches(matches); // 消去
        updateScore(matches);   // スコア更新
        
        setTimeout(() => {
            gravity();              // 落下
            fillEmptyTiles();       // 補充
            drawBoard();            // 再描画 (タイルの位置をデータに合わせる)
            
            // 連続マッチチェック（再帰）
            setTimeout(() => {
                swapMatchCycle(); // 引数なしで呼ぶことで、再帰呼び出しをトリガー
            }, 300); 
            
        }, 300); // 消去アニメーションを待つ
        
    } else {
        // マッチが存在しない場合
        if (currentCombo === 0 && originalR1 !== -1) {
            // 最初のスワップでマッチしなかった場合のみ、元に戻す
            const r1 = originalR1;
            const c1 = originalC1;
            const r2 = originalR2;
            const c2 = originalC2;
            
            // 盤面配列で値を元に戻す
            [board[r1][c1], board[r2][c2]] = [board[r2][c2], board[r1][c1]];
            drawBoard(); // 再描画

            // 失敗時の「戻す」アニメーション (オプション)
            // 実装が複雑になるため、今回は配列とDOMの即時リセットに留めます。
        }
        isProcessing = false; // 処理完了、操作を受け付ける
        updateComboDisplay(0); // コンボをリセット
    }
}

// --- マッチングロジック (変更なし) ---

/**
 * ボード全体の全てのマッチをチェックし、一致したタイルの座標リストを返す
 */
function checkAllMatches() {
    const matches = [];

    // 行方向のチェック
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE - 2; c++) {
            const current = board[r][c];
            if (!current) continue;
            
            let matchLength = 1;
            for (let i = c + 1; i < GRID_SIZE; i++) {
                if (board[r][i] === current) {
                    matchLength++;
                } else {
                    break;
                }
            }
            
            if (matchLength >= 3) {
                for (let i = c; i < c + matchLength; i++) {
                    if (!matches.some(m => m.r === r && m.c === i)) {
                        matches.push({ r, c: i, len: matchLength, dir: 'row' });
                    }
                }
            }
            c += matchLength - 1; 
        }
    }

    // 列方向のチェック 
    for (let c = 0; c < GRID_SIZE; c++) {
        for (let r = 0; r < GRID_SIZE - 2; r++) {
            const current = board[r][c];
            if (!current) continue;
            
            let matchLength = 1;
            for (let i = r + 1; i < GRID_SIZE; i++) {
                if (board[i][c] === current) {
                    matchLength++;
                } else {
                    break;
                }
            }
            
            if (matchLength >= 3) {
                for (let i = r; i < r + matchLength; i++) {
                    if (!matches.some(m => m.r === i && m.c === c)) {
                        matches.push({ r: i, c, len: matchLength, dir: 'col' });
                    }
                }
            }
            r += matchLength - 1; 
        }
    }
    return matches;
}

/**
 * マッチしたタイルをボードから削除（nullにする）し、演出を適用
 */
function removeMatches(matches) {
    matches.forEach(({ r, c }) => {
        board[r][c] = null;
        const tile = document.querySelector(`.tile[data-r="${r}"][data-c="${c}"]`);
        if (tile) {
            tile.classList.add('match');
        }
    });
}

/**
 * スコアを更新
 */
function updateScore(matches) {
    let totalScore = 0;
    const processedCrossMatches = new Set(); 

    matches.forEach(m => {
        if (m.dir === 'row' && m.len >= 3) {
            for (let c = m.c; c < m.c + m.len; c++) {
                const colMatches = matches.filter(
                    match => match.dir === 'col' && 
                             match.r <= m.r && match.r + match.len > m.r && 
                             match.c === c
                );
                if (colMatches.length > 0) {
                    const centerKey = `${m.r},${c}`;
                    if (!processedCrossMatches.has(centerKey)) {
                        totalScore += BASE_SCORE * 3; 
                        processedCrossMatches.add(centerKey);
                    }
                }
            }
        }
    });

    const processedMatchGroups = new Set(); 

    matches.forEach(m => {
        const groupID = `${m.r},${m.c},${m.dir},${m.len}`;
        if (processedMatchGroups.has(groupID)) {
            return; 
        }
        processedMatchGroups.add(groupID);

        let groupScore = m.len * BASE_SCORE;
        
        if (m.len === 4) {
            groupScore *= 1.5; 
        } else if (m.len >= 5) {
            groupScore *= 2;   
        }
        totalScore += Math.floor(groupScore);
    });

    if (currentCombo > 1) {
        totalScore *= (1 + currentCombo * 0.2); 
    }

    score += Math.floor(totalScore);
    scoreElement.textContent = score;
}

/**
 * コンボ表示を更新
 */
function updateComboDisplay(combo) {
    if (combo > 1) {
        comboDisplayElement.textContent = `${combo} COMBO!`;
        comboDisplayElement.classList.add('active'); 
    } else {
        comboDisplayElement.textContent = '';
        comboDisplayElement.classList.remove('active');
    }
}

// --- 落下と補充 (変更なし) ---

function gravity() {
    for (let c = 0; c < GRID_SIZE; c++) {
        let emptyRowCount = 0;
        for (let r = GRID_SIZE - 1; r >= 0; r--) {
            if (board[r][c] === null) {
                emptyRowCount++;
            } else if (emptyRowCount > 0) {
                board[r + emptyRowCount][c] = board[r][c];
                board[r][c] = null;
            }
        }
    }
}

function fillEmptyTiles() {
    for (let c = 0; c < GRID_SIZE; c++) {
        for (let r = 0; r < GRID_SIZE; r++) {
            if (board[r][c] === null) {
                board[r][c] = getRandomEmoji();
            }
        }
    }
}


// --- ゲーム開始 ---
initGame();