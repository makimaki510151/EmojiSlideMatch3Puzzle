// --- ゲーム設定 ---
const GRID_SIZE = 8;
const TILE_SIZE = 62; 
const EMOJIS = ['🍎', '🍌', '🍇', '🍓']; 
const BASE_SCORE = 10;

// --- DOM要素 ---
const boardElement = document.getElementById('board');
const scoreElement = document.getElementById('score');
const comboDisplayElement = document.getElementById('combo-display'); 
const gameOverOverlay = document.getElementById('game-over-overlay');
const finalScoreElement = document.getElementById('final-score');

// --- ゲーム状態 ---
let board = [];
let score = 0;
let isProcessing = false; 
let currentCombo = 0; 
let isGameOver = false; // ゲームオーバーステータスを追加

// --- スライド操作用の変数 ---
let startX = 0;
let startY = 0;
let currentTileElement = null;

// --- 効果音 (Web Audio API) ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

/**
 * コードでSEを生成・再生する汎用関数
 * @param {number} frequency - 周波数 (Hz)
 * @param {number} duration - 再生時間 (秒)
 * @param {string} type - 波形 ('sine', 'square', 'sawtooth', 'triangle')
 * @param {number} volume - 音量 (0.0 to 1.0)
 * @param {number} decay - 減衰時間 (秒)
 */
function playSynthSound(frequency, duration, type = 'square', volume = 0.5, decay = 0.1) {
    if (isGameOver) return; // ゲームオーバー中は再生しない

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    
    gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
    // 減衰
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + decay);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
}

// --- SEプリセット ---
const SE = {
    slide: () => playSynthSound(300, 0.05, 'sine', 0.2, 0.05),
    match: (len) => {
        let freq = 440 + len * 100; // マッチ数に応じて音程を上げる
        playSynthSound(freq, 0.1, 'square', 0.4, 0.15);
    },
    combo: (combo) => {
        let freq = 550 + combo * 80;
        playSynthSound(freq, 0.1, 'triangle', 0.5, 0.2);
    },
    gameOver: () => {
        playSynthSound(100, 0.8, 'sawtooth', 0.6, 0.7);
        playSynthSound(75, 0.8, 'sawtooth', 0.6, 0.7);
    }
};


// --- 初期化 ---

function getRandomEmoji() {
    return EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
}

function initGame() {
    boardElement.style.gridTemplateColumns = `repeat(${GRID_SIZE}, ${TILE_SIZE - 2}px)`; 

    board = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(null).map(getRandomEmoji));
    
    // 初期安定化
    while (checkAllMatches(3).length > 0) { 
        removeMatches(checkAllMatches(3));
        gravity();
        fillEmptyTiles();
    }
    
    drawBoard();
    checkGameOver(); // 初期状態でゲームオーバー判定
}

function drawBoard() {
    boardElement.innerHTML = '';
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const tile = createTileElement(board[r][c], r, c);
            boardElement.appendChild(tile);
        }
    }
}

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

// --- スライド操作 ---

function handleDragStart(event) {
    if (isProcessing || isGameOver) return; // ゲームオーバー中は操作不可

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
    if (event.cancelable) {
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
        SE.slide(); // スライドSE
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

function swapTiles(r1, c1, r2, c2) {
    
    const tile1 = document.querySelector(`.tile[data-r="${r1}"][data-c="${c1}"]`);
    const tile2 = document.querySelector(`.tile[data-r="${r2}"][data-c="${c2}"]`);

    [board[r1][c1], board[r2][c2]] = [board[r2][c2], board[r1][c1]];

    const dx = c2 - c1;
    const dy = r2 - r1;
    
    tile1.style.transform = `translate(${dx * TILE_SIZE}px, ${dy * TILE_SIZE}px)`;
    tile2.style.transform = `translate(${-dx * TILE_SIZE}px, ${-dy * TILE_SIZE}px)`;
    
    
    setTimeout(() => {
        // アニメーション完了後、DOM要素のテキスト内容を交換
        [tile1.textContent, tile2.textContent] = [tile2.textContent, tile1.textContent];
        
        // transformをリセット
        tile1.style.transform = '';
        tile2.style.transform = '';

        currentCombo = 0; 
        swapMatchCycle(r1, c1, r2, c2);
    }, 200); 
}

// --- ゲームロジック ---

/**
 * 交換後のマッチング、消去、落下、補充のサイクル
 */
function swapMatchCycle(originalR1 = -1, originalC1 = -1, originalR2 = -1, originalC2 = -1) {
    const minMatch = 3; 
    const matches = checkAllMatches(minMatch);

    if (matches.length > 0) {
        currentCombo++; 
        
        updateComboDisplay(currentCombo);

        if (currentCombo > 1) {
            SE.combo(currentCombo); // コンボSE
        } else {
            SE.match(matches.length); // マッチSE
        }
        
        removeMatches(matches); 
        updateScore(matches, minMatch); 
        
        setTimeout(() => {
            gravity();              
            fillEmptyTiles();       
            drawBoard();            
            
            setTimeout(() => {
                swapMatchCycle(); // 連鎖を続ける
            }, 300); 
            
        }, 300); 
        
    } else {
        // マッチが存在しない場合
        if (currentCombo === 0 && originalR1 !== -1) {
            // 最初のスワップでマッチしなかった場合、元に戻す
            const r1 = originalR1;
            const c1 = originalC1;
            const r2 = originalR2;
            const c2 = originalC2;
            
            [board[r1][c1], board[r2][c2]] = [board[r2][c2], board[r1][c1]];
            drawBoard(); 
        }
        isProcessing = false; 
        updateComboDisplay(0); 
        checkGameOver(); // 処理完了後、ゲームオーバー判定を行う
    }
}

/**
 * どこをスライドしてもマッチできない状態かチェック
 */
function canMove() {
    const minMatch = 3;
    // 全ての隣接するタイルペアを試す
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            // 右隣とのスワップをシミュレート
            if (c < GRID_SIZE - 1) {
                // 配列の一時的なスワップ
                [board[r][c], board[r][c + 1]] = [board[r][c + 1], board[r][c]];
                if (checkAllMatches(minMatch).length > 0) {
                    // 元に戻す
                    [board[r][c], board[r][c + 1]] = [board[r][c + 1], board[r][c]];
                    return true; // マッチ可能なスワップが見つかった
                }
                // 元に戻す
                [board[r][c], board[r][c + 1]] = [board[r][c + 1], board[r][c]];
            }

            // 下隣とのスワップをシミュレート
            if (r < GRID_SIZE - 1) {
                // 配列の一時的なスワップ
                [board[r][c], board[r + 1][c]] = [board[r + 1][c], board[r][c]];
                if (checkAllMatches(minMatch).length > 0) {
                    // 元に戻す
                    [board[r][c], board[r + 1][c]] = [board[r + 1][c], board[r][c]];
                    return true; // マッチ可能なスワップが見つかった
                }
                // 元に戻す
                [board[r][c], board[r + 1][c]] = [board[r + 1][c], board[r][c]];
            }
        }
    }
    return false; // マッチ可能なスワップがない
}

/**
 * ゲームオーバー処理
 */
function checkGameOver() {
    if (isGameOver) return;

    if (!canMove()) {
        isGameOver = true;
        SE.gameOver(); // ゲームオーバーSE
        
        // オーバーレイを表示
        gameOverOverlay.style.display = 'flex';
        finalScoreElement.textContent = score;

        // ボード上の操作を無効化 (isProcessing / isGameOver フラグで既に制御)
    }
}

/**
 * ボード全体の全てのマッチをチェックし、一致したタイルの座標リストを返す
 * @param {number} minLen - 最小マッチ長 (常に3)
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

function updateScore(matches, minMatch) {
    let totalScore = 0;
    const processedCrossMatches = new Set(); 

    // クロスボーナス
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
        
        let base = BASE_SCORE;

        let groupScore = m.len * base;
        
        if (m.len === 4) {
            groupScore *= 1.5; 
        } else if (m.len >= 5) {
            groupScore *= 2;   
        }
        totalScore += Math.floor(groupScore);
    });

    // コンボボーナス
    if (currentCombo > 1) {
        totalScore *= (1 + currentCombo * 0.2); 
    }

    score += Math.floor(totalScore);
    scoreElement.textContent = score;
}

function updateComboDisplay(combo) {
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


// --- ゲーム開始 ---
initGame();