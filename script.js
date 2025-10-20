// --- ゲーム設定 ---
const GRID_SIZE = 8;
const EMOJIS = ['🍎', '🍌', '🍇', '🍓'];
const BASE_SCORE = 10;
const LOOP_THRESHOLD = 1000; // 周回に必要なスコア // ★再追加

const boardElement = document.getElementById('board');
// const scoreElement = document.getElementById('score'); // ★削除: 以前のエラー原因となったID
const totalScoreElement = document.getElementById('total-score'); // ★修正: HTMLのIDに合わせて再定義
const loopCountElement = document.getElementById('loop-count'); // ★再追加
const maxSlideScoreElement = document.getElementById('max-slide-score'); // ★再追加
const comboDisplayElement = document.getElementById('combo-display');
const gameOverOverlay = document.getElementById('game-over-overlay');
const finalScoreElement = document.getElementById('final-score');
const gameClearOverlay = document.getElementById('game-clear-overlay'); // ★再追加
const clearDetailsElement = document.getElementById('clear-details'); // ★再追加
const scoreLogElement = document.getElementById('score-log'); // ★再追加

// --- ゲーム状態 ---
let board = [];
let totalScore = 0; // ★変更: スコア変数名を totalScore に統一
let loopCount = 0; // ★再追加
let maxSlideScore = 0; // ★再追加
let currentSlideScore = 0; // ★再追加
let selectedTile = null;
let isProcessing = false;
let currentCombo = 0;
let logCounter = 0; // ★再追加

// --- スライド操作用の変数 ---
let startX = 0;
let startY = 0;
let currentTileElement = null;

// --- 効果音 (ダミー、エラー防止のため) ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();
function playSynthSound(frequency, duration, type = 'square', volume = 0.5, decay = 0.1) { /* ダミー */ }
const SE = {
    slide: () => { /* ダミー */ },
    match: (len) => { /* ダミー */ },
    combo: (combo) => { /* ダミー */ },
    loop: () => { /* ダミー */ },
    gameOver: () => { /* ダミー */ }
};


// --- 初期化 ---

function getRandomEmoji() {
    return EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
}

function initGame() {
    board = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(null).map(getRandomEmoji));

    // 初期安定化
    while (checkAllMatches(3).length > 0) {
        removeMatches(checkAllMatches(3));
        gravity();
        fillEmptyTiles();
    }

    totalScore = 0; // ★リセット
    loopCount = 0; // ★リセット
    maxSlideScore = 0; // ★リセット
    currentSlideScore = 0; // ★リセット
    logCounter = 0; // ★リセット

    updateScoreDisplay(); // ★再追加

    gameOverOverlay.classList.remove('active');
    gameClearOverlay.classList.remove('active'); // ★再追加

    // ログをリセット
    if (scoreLogElement) {
        scoreLogElement.innerHTML = '<h2>スコアログ</h2>';
    }

    drawBoard();
    updateComboDisplay(0);
}

// --- DOM/スライド操作 ---
function createTileElement(emoji, r, c) {
    const tile = document.createElement('div');
    tile.classList.add('tile');
    tile.textContent = emoji;
    tile.dataset.r = r;
    tile.dataset.c = c;

    tile.addEventListener('mousedown', handleDragStart);
    tile.addEventListener('touchstart', handleDragStart);

    return tile;
}

function drawBoard() {
    boardElement.innerHTML = '';
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const tile = createTileElement(board[r][c], r, c);
            boardElement.appendChild(tile);
        }
    }

    // ★追加: 盤面描画後にゲームオーバー判定
    if (!checkPossibleMoves()) {
        showGameOver();
    }
}

function handleDragStart(event) {
    if (isProcessing) return;

    const clientX = event.clientX || (event.touches ? event.touches[0].clientX : 0);
    const clientY = event.clientY || (event.touches ? event.touches[0].clientY : 0);

    startX = clientX;
    startY = clientY;

    currentTileElement = event.currentTarget;
    currentTileElement.classList.add('selected');

    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('touchmove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
    document.addEventListener('touchend', handleDragEnd);
}

function handleDragMove(event) {
    // タッチデバイスでの意図しないスクロールを防ぐ
    const isTouch = event.touches && event.touches.length > 0;
    if (isTouch && event.cancelable) {
        event.preventDefault();
    }
}

function handleDragEnd(event) {
    if (!currentTileElement) return;

    const clientX = event.clientX || (event.changedTouches && event.changedTouches[0].clientX);
    const clientY = event.clientY || (event.changedTouches && event.changedTouches[0].clientY);

    const deltaX = clientX - startX;
    const deltaY = clientY - startY;

    currentTileElement.classList.remove('selected');

    const r1 = parseInt(currentTileElement.dataset.r);
    const c1 = parseInt(currentTileElement.dataset.c);

    let r2 = r1;
    let c2 = c1;

    const threshold = 20;

    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > threshold) {
        if (deltaX > 0) {
            c2 = c1 + 1;
        } else {
            c2 = c1 - 1;
        }
    } else if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > threshold) {
        if (deltaY > 0) {
            r2 = r1 + 1;
        } else {
            r2 = r1 - 1;
        }
    } else {
        resetDragListeners();
        return;
    }

    if (isAdjacent(r1, c1, r2, c2) && r2 >= 0 && r2 < GRID_SIZE && c2 >= 0 && c2 < GRID_SIZE) {
        isProcessing = true;
        // SE.slide(); // SEは省略
        swapTiles(r1, c1, r2, c2);
    }

    resetDragListeners();
}

function resetDragListeners() {
    currentTileElement = null;
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('touchmove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
    document.removeEventListener('touchend', handleDragEnd);
}

function isAdjacent(r1, c1, r2, c2) {
    const dr = Math.abs(r1 - r2);
    const dc = Math.abs(c1 - c2);
    return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
}

/**
 * タイルを交換し、マッチングチェックと処理を行う
 */
function swapTiles(r1, c1, r2, c2) {

    const tile1 = document.querySelector(`.tile[data-r="${r1}"][data-c="${c1}"]`);
    const tile2 = document.querySelector(`.tile[data-r="${r2}"][data-c="${c2}"]`);

    if (!tile1 || !tile2) return;

    const TILE_SIZE = tile1.offsetWidth;

    [board[r1][c1], board[r2][c2]] = [board[r2][c2], board[r1][c1]];

    const dx = c2 - c1;
    const dy = r2 - r1;

    tile1.style.transform = `translate(${dx * TILE_SIZE}px, ${dy * TILE_SIZE}px)`;
    tile2.style.transform = `translate(${-dx * TILE_SIZE}px, ${-dy * TILE_SIZE}px)`;


    setTimeout(() => {
        [tile1.textContent, tile2.textContent] = [tile2.textContent, tile1.textContent];

        tile1.style.transform = '';
        tile2.style.transform = '';

        currentCombo = 0;
        currentSlideScore = 0; // ★再追加
        swapMatchCycle(r1, c1, r2, c2);
    }, 200);
}

/**
 * 交換後のマッチング、消去、落下、補充のサイクル
 */
function swapMatchCycle(originalR1 = -1, originalC1 = -1, originalR2 = -1, originalC2 = -1) {
    const minMatch = 3;
    const matches = checkAllMatches(minMatch);

    if (matches.length > 0) {
        currentCombo++;

        updateComboDisplay(currentCombo);

        // if (currentCombo > 1) { SE.combo(currentCombo); } else { SE.match(matches.length); } // SEは省略

        const { score: scoreForThisStep, reason: baseReason } = updateScore(matches); // ★戻り値を受け取る

        currentSlideScore += scoreForThisStep; // ★連鎖スコアに加算

        removeMatches(matches);

        // スコアログ書き出し
        let finalReason = baseReason;
        if (currentCombo > 1) {
            finalReason += ` | ${currentCombo} COMBO (+${Math.round((currentCombo * 0.2) * 100)}%)`;
        }
        logScoreEntry(scoreForThisStep, finalReason); // ★ログ出力

        setTimeout(() => {
            gravity();
            fillEmptyTiles();
            drawBoard();

            // スコアループチェック
            checkLoop(); // ★ループチェックの呼び出し

            setTimeout(() => {
                swapMatchCycle();
            }, 300);

        }, 300);

    } else {
        // マッチが存在しない場合
        if (currentCombo === 0 && originalR1 !== -1) {
            // タイルを元に戻す
            const r1 = originalR1;
            const c1 = originalC1;
            const r2 = originalR2;
            const c2 = originalC2;
            [board[r1][c1], board[r2][c2]] = [board[r2][c2], board[r1][c1]];
            drawBoard();
        }
        isProcessing = false;
        updateComboDisplay(0);

        if (currentSlideScore > maxSlideScore) {
            maxSlideScore = currentSlideScore;
            updateScoreDisplay();
        }
        currentSlideScore = 0; // ★リセット

        // ターン終了時にゲームオーバー判定
        if (!checkPossibleMoves()) {
            showGameOver();
        }
    }
}

/**
 * スコアログにエントリーを追加する関数
 */
function logScoreEntry(score, reason) { // ★再追加
    if (!scoreLogElement) return;

    logCounter++;
    const logEntry = document.createElement('div');
    logEntry.classList.add('log-entry');
    logEntry.innerHTML = `#${logCounter} <span class="log-score">+${score}</span> (${reason})`;

    // ログを先頭に追加
    scoreLogElement.insertBefore(logEntry, scoreLogElement.children[1]);

    // 古いログを一定数で削除 (例: 50エントリーまで)
    while (scoreLogElement.children.length > 51) {
        scoreLogElement.removeChild(scoreLogElement.lastElementChild);
    }
}

/**
 * スコアが閾値を超えたかチェックし、ループ処理を行う
 */
function checkLoop() { // ★再追加
    if (totalScore >= LOOP_THRESHOLD) {

        const nextTotalScore = totalScore % LOOP_THRESHOLD;
        const loopsGained = Math.floor(totalScore / LOOP_THRESHOLD);

        // クリア判定: ぴったり 0 点になった場合
        if (nextTotalScore === 0) {
            totalScore = 0;
            loopCount += loopsGained;
            updateScoreDisplay();
            // SE.loop(); // SEは省略
            showGameClear();
            return;
        }

        totalScore = nextTotalScore;
        loopCount += loopsGained;

        // SE.loop(); // SEは省略
    }
    updateScoreDisplay();
}

/**
 * スコア表示を一元的に更新する関数
 */
function updateScoreDisplay() { // ★再追加
    if (totalScoreElement) totalScoreElement.textContent = `${totalScore}`;
    if (loopCountElement) loopCountElement.textContent = loopCount;
    if (maxSlideScoreElement) maxSlideScoreElement.textContent = maxSlideScore;
}


// --- マッチングロジック ---

/**
 * ボード全体の全てのマッチをチェックし、一致したタイルの座標リストを返す
 */
function checkAllMatches(minLen = 3) {
    const matches = [];

    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const current = board[r][c];
            if (!current) continue;

            // 行チェック
            if (c <= GRID_SIZE - minLen) {
                let matchLength = 1;
                for (let i = c + 1; i < GRID_SIZE; i++) {
                    if (board[r][i] === current) {
                        matchLength++;
                    } else {
                        break;
                    }
                }
                if (matchLength >= minLen) {
                    for (let i = c; i < c + matchLength; i++) {
                        if (!matches.some(m => m.r === r && m.c === i)) {
                            matches.push({ r, c: i, len: matchLength, dir: 'row' });
                        }
                    }
                }
            }

            // 列チェック
            if (r <= GRID_SIZE - minLen) {
                let matchLength = 1;
                for (let i = r + 1; i < GRID_SIZE; i++) {
                    if (board[i][c] === current) {
                        matchLength++;
                    } else {
                        break;
                    }
                }
                if (matchLength >= minLen) {
                    for (let i = r; i < r + matchLength; i++) {
                        if (!matches.some(m => m.r === i && m.c === c)) {
                            matches.push({ r: i, c, len: matchLength, dir: 'col' });
                        }
                    }
                }
            }
        }
    }
    return matches;
}

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
 * スコアを更新し、この連鎖ステップで獲得したスコアと理由を返す
 * @returns {object} { score: number, reason: string }
 */
function updateScore(matches) {
    let scoreForThisStep = 0;
    const processedCrossMatches = new Set();

    // ★修正のため削除: let highestMatchLength = 0;
    // ★修正のため削除: let hasCrossBonus = false;

    // マッチグループの種類を追跡するための配列
    const matchReasons = []; // ★追加: 発生したマッチの理由を格納

    // 1. クロスボーナスの計算
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
                        scoreForThisStep += BASE_SCORE * 3;
                        processedCrossMatches.add(centerKey);
                        // hasCrossBonus = true; // ★削除
                    }
                }
            }
        }
    });

    if (processedCrossMatches.size > 0) { // ★修正: クロスボーナスが発生した場合、理由に追加
        matchReasons.push('クロスボーナス');
    }

    const processedMatchGroups = new Set();
    const matchLengthCounts = { 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 }; // ★追加: マッチの長さをカウント

    // 2. 独立したマッチグループの計算
    matches.forEach(m => {
        // マッチの開始座標、方向、長さを組み合わせたIDで、独立したマッチグループを識別
        const groupID = `${m.r},${m.c},${m.dir},${m.len}`;
        if (processedMatchGroups.has(groupID)) {
            return;
        }
        processedMatchGroups.add(groupID);

        // highestMatchLength = Math.max(highestMatchLength, m.len); // ★削除

        let groupScore = m.len * BASE_SCORE;

        if (m.len === 4) {
            groupScore *= 1.5;
            matchLengthCounts[4]++; // ★カウント
        } else if (m.len >= 5) {
            groupScore *= 2;
            matchLengthCounts[Math.min(m.len, 8)]++; // ★カウント (5以上をまとめても良いが、今回は正確に)
        } else if (m.len === 3) {
            matchLengthCounts[3]++; // ★カウント
        }

        scoreForThisStep += Math.floor(groupScore);
    });

    // 3. 理由文字列の生成（すべてのマッチグループを含める）
    let baseReasonParts = [];

    // マッチ3の理由 (他のマッチがある場合は省略するが、今回は全て追跡)
    if (matchLengthCounts[3] > 0) {
        // クロスボーナスに含まれない、純粋なマッチ3のみをカウント。
        // しかし、matches配列から計算した方が正確だが複雑になるため、今回はシンプルにカウントしたものを理由に含める。
        baseReasonParts.push(`マッチ3(x${matchLengthCounts[3]})`);
    }

    // マッチ4以上の理由 (ボーナス倍率を含む)
    if (matchLengthCounts[4] > 0) {
        baseReasonParts.push(`マッチ4(x${matchLengthCounts[4]}, 1.5x)`);
    }
    if (matchLengthCounts[5] > 0) {
        baseReasonParts.push(`マッチ5(x${matchLengthCounts[5]}, 2x)`);
    }
    if (matchLengthCounts[6] > 0) {
        baseReasonParts.push(`マッチ6(x${matchLengthCounts[6]}, 2x)`);
    }
    if (matchLengthCounts[7] > 0) {
        baseReasonParts.push(`マッチ7(x${matchLengthCounts[7]}, 2x)`);
    }
    if (matchLengthCounts[8] > 0) {
        baseReasonParts.push(`マッチ8(x${matchLengthCounts[8]}, 2x)`);
    }

    // クロスボーナスとマッチ理由を結合
    const baseReason = [...matchReasons, ...baseReasonParts].join(' + ');

    // コンボボーナス
    const comboMultiplier = (currentCombo > 1) ? (1 + currentCombo * 0.2) : 1;
    const finalScoreForThisStep = Math.floor(scoreForThisStep * comboMultiplier);

    // 合計スコア（周回内スコア）を更新
    totalScore += finalScoreForThisStep;
    updateScoreDisplay(); // スコアを更新

    return { score: finalScoreForThisStep, reason: baseReason || '不明なマッチ' }; // 理由がない場合は「不明なマッチ」
}

function updateComboDisplay(combo) {
    if (!comboDisplayElement) return;

    if (combo > 1) {
        comboDisplayElement.textContent = `${combo} COMBO!`;
        comboDisplayElement.classList.add('active');
    } else {
        comboDisplayElement.textContent = '';
        comboDisplayElement.classList.remove('active');
    }
}

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


/**
 * ゲームオーバー判定 (動かせる手があるかチェック)
 */
function checkPossibleMoves() {
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const tempBoard = JSON.parse(JSON.stringify(board));

            // 右隣と交換
            if (c < GRID_SIZE - 1) {
                [tempBoard[r][c], tempBoard[r][c + 1]] = [tempBoard[r][c + 1], tempBoard[r][c]];
                if (checkTempMatches(tempBoard).length > 0) return true;
                [tempBoard[r][c], tempBoard[r][c + 1]] = [tempBoard[r][c + 1], tempBoard[r][c]];
            }

            // 下隣と交換
            if (r < GRID_SIZE - 1) {
                [tempBoard[r][c], tempBoard[r + 1][c]] = [tempBoard[r + 1][c], tempBoard[r][c]];
                if (checkTempMatches(tempBoard).length > 0) return true;
                [tempBoard[r][c], tempBoard[r + 1][c]] = [tempBoard[r + 1][c], tempBoard[r][c]];
            }
        }
    }
    return false;
}

/**
 * 仮ボードでマッチをチェック
 */
function checkTempMatches(tempBoard) {
    const minLen = 3;
    const matches = [];

    // 行方向のチェック
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const current = tempBoard[r][c];
            if (!current) continue;

            // 行チェック
            if (c <= GRID_SIZE - minLen) {
                let matchLength = 1;
                for (let i = c + 1; i < GRID_SIZE; i++) {
                    if (tempBoard[r][i] === current) matchLength++;
                    else break;
                }
                if (matchLength >= minLen) {
                    for (let i = c; i < c + matchLength; i++) {
                        matches.push({ r, c: i });
                    }
                }
            }

            // 列チェック
            if (r <= GRID_SIZE - minLen) {
                let matchLength = 1;
                for (let i = r + 1; i < GRID_SIZE; i++) {
                    if (tempBoard[i][c] === current) matchLength++;
                    else break;
                }
                if (matchLength >= minLen) {
                    for (let i = r; i < r + matchLength; i++) {
                        matches.push({ r: i, c });
                    }
                }
            }
        }
    }
    const uniqueMatches = [];
    matches.forEach(m => {
        if (!uniqueMatches.some(um => um.r === m.r && um.c === m.c)) {
            uniqueMatches.push(m);
        }
    });
    return uniqueMatches;
}

/**
 * ゲームオーバー画面を表示
 */
function showGameOver() {
    // SE.gameOver(); // SEは省略

    // 最終スコアは「ループ数 * 1000 + 周回スコア」
    const finalCalculatedScore = loopCount * LOOP_THRESHOLD + totalScore;
    if (finalScoreElement) {
        finalScoreElement.textContent = `最終スコア: ${finalCalculatedScore}点 (周回数: ${loopCount})`;
    }
    gameOverOverlay.classList.add('active');
}

/**
 * ゲームクリア画面を表示
 */
function showGameClear() { // ★再追加
    // 他のオーバーレイを非表示にする
    gameOverOverlay.classList.remove('active');

    isProcessing = true; // ゲーム操作を停止

    if (clearDetailsElement) {
        clearDetailsElement.textContent = `ぴったり ${loopCount} 周でクリアを達成しました！`;
    }
    gameClearOverlay.classList.add('active');
}


// --- ゲーム開始 ---
initGame();