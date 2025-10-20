// --- ゲーム設定 ---
const GRID_SIZE = 8;
const EMOJIS = ['🍎', '🍌', '🍇', '🍓'];
const BASE_SCORE = 10;
const MAX_COMBO = 15; // クリア目標

const boardElement = document.getElementById('board');
const scoreElement = document.getElementById('score');
const comboDisplayElement = document.getElementById('combo-display');
const gameOverOverlay = document.getElementById('game-over-overlay');
const finalScoreElement = document.getElementById('final-score');
const gameClearOverlay = document.getElementById('game-clear-overlay');
const clearFinalScoreElement = document.getElementById('clear-final-score');

// --- ゲーム状態 ---
let board = [];
let score = 0;
let selectedTile = null;
let isProcessing = false;
let currentCombo = 0;
let isGameClear = false;

// ★追加/修正: AudioContext関連と選択された音
let audioCtx = null;
let isAudioContextInitialized = false;
let selectedComboSound = 'happy'; // ★デフォルトのコンボ音を設定

// --- スライド操作用の変数 ---
let startX = 0;
let startY = 0;
let currentTileElement = null;


// ★追加: ユーザーがコンボ音を選択する関数
function setComboSound(soundKey) {
    selectedComboSound = soundKey;
    // 選択をローカルストレージに保存
    localStorage.setItem('selectedComboSound', soundKey); 
}

// --- 初期化 ---

function getRandomEmoji() {
    return EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
}

function initializeAudioContext() {
    if (isAudioContextInitialized) return;
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        isAudioContextInitialized = true;
        console.log("AudioContext initialized.");
    } catch (e) {
        console.warn("Web Audio API not supported or failed to initialize.", e);
    }
}


function initGame() {
    // ★追加: ローカルストレージから選択された音を読み込む
    const savedSound = localStorage.getItem('selectedComboSound');
    if (savedSound) {
        selectedComboSound = savedSound;
        document.getElementById('combo-sound-select').value = savedSound;
    }
    
    board = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(null).map(getRandomEmoji));

    // 初期安定化
    while (checkAllMatches(3).length > 0) {
        removeMatches(checkAllMatches(3));
        gravity();
        fillEmptyTiles();
    }

    gameOverOverlay.classList.remove('active');
    gameClearOverlay.classList.remove('active');
    isGameClear = false;

    drawBoard();
    registerTileListeners(); 

    updateComboDisplay(0);

    document.addEventListener('mousedown', initializeAudioContext, { once: true });
    document.addEventListener('touchstart', initializeAudioContext, { once: true });
}

// --- DOM/スライド操作 (変更なし) ---
function createTileElement(emoji, r, c) {
    const tile = document.createElement('div');
    tile.classList.add('tile');
    tile.textContent = emoji;
    tile.dataset.r = r;
    tile.dataset.c = c;
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

    registerTileListeners(); 

    if (!isGameClear && !checkPossibleMoves()) {
        showGameOver();
    }
}

function registerTileListeners() {
    if (isGameClear) return;
    document.querySelectorAll('.tile').forEach(tile => {
        tile.addEventListener('mousedown', handleDragStart);
        tile.addEventListener('touchstart', handleDragStart);
    });
}


function handleDragStart(event) {
    if (isProcessing || isGameClear) return;

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
    let didSlide = false; 

    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > threshold) {
        if (deltaX > 0) {
            c2 = c1 + 1;
        } else {
            c2 = c1 - 1;
        }
        didSlide = true;
    } else if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > threshold) {
        if (deltaY > 0) {
            r2 = r1 + 1;
        } else {
            r2 = r1 - 1;
        }
        didSlide = true;
    } else {
        resetDragListeners();
        return;
    }

    if (isAdjacent(r1, c1, r2, c2) && r2 >= 0 && r2 < GRID_SIZE && c2 >= 0 && c2 < GRID_SIZE) {
        isProcessing = true;
        
        if (didSlide) {
            playSlideSound();
        }

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
 * タイルを交換し、マッチングチェックと処理を行う (変更なし)
 */
function swapTiles(r1, c1, r2, c2) {
    if (isGameClear) return;

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
        swapMatchCycle(r1, c1, r2, c2);
    }, 200);
}

/**
 * 交換後のマッチング、消去、落下、補充のサイクル
 */
function swapMatchCycle(originalR1 = -1, originalC1 = -1, originalR2 = -1, originalC2 = -1) {
    if (isGameClear) {
        isProcessing = false;
        updateComboDisplay(0);
        return;
    }

    const minMatch = 3;
    const matches = checkAllMatches(minMatch);

    if (matches.length > 0) {
        currentCombo++;
        updateComboDisplay(currentCombo);

        // ★修正: 選択されたコンボ音を再生
        playMatchSound(currentCombo, selectedComboSound);

        if (currentCombo >= MAX_COMBO) {
            isGameClear = true;
            playFanfare();
            showGameClear();
            return; 
        }

        removeMatches(matches);
        updateScore(matches);

        setTimeout(() => {
            gravity();
            fillEmptyTiles();
            drawBoard(); 

            setTimeout(() => {
                swapMatchCycle();
            }, 300);

        }, 300);

    } else {
        if (currentCombo === 0 && originalR1 !== -1) {
            const r1 = originalR1;
            const c1 = originalC1;
            const r2 = originalR2;
            const c2 = originalC2;

            [board[r1][c1], board[r2][c2]] = [board[r2][c2], board[r1][c1]];
            drawBoard();
        }
        isProcessing = false;
        updateComboDisplay(0);

        if (!isGameClear && !checkPossibleMoves()) {
            showGameOver();
        }
    }
}

// --- その他のロジック関数 (変更なし) ---
function checkAllMatches(minLen = 3) {
    const matches = [];

    // 行方向のチェック
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

function showGameOver() {
    isProcessing = false;
    finalScoreElement.textContent = `最終スコア: ${score}`;
    gameOverOverlay.classList.add('active');
}

function showGameClear() {
    isProcessing = false; 
    clearFinalScoreElement.textContent = `最終スコア: ${score}`;
    gameClearOverlay.classList.add('active');
}


// --- SE 関数 (★ここを主に修正) ---

/**
 * スライド音を生成・再生 (変更なし)
 */
function playSlideSound() {
    if (!isAudioContextInitialized || !audioCtx) return;

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sine'; 
    oscillator.frequency.setValueAtTime(300, audioCtx.currentTime); 
    oscillator.frequency.linearRampToValueAtTime(250, audioCtx.currentTime + 0.1); 

    gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime); 
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.15); 

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.15);
}

// ★追加: 複数のコンボ音パターンを処理するロジック
function playMatchSound(combo, soundKey) {
    if (!isAudioContextInitialized || !audioCtx) return;

    const effectiveCombo = Math.min(combo, MAX_COMBO); 
    const comboStep = effectiveCombo - 1;

    let baseFreq, pitchIncreasePerCombo, waveType, duration;

    // --- 各サウンドパターンの設定 ---
    switch (soundKey) {
        case 'retro':
            baseFreq = 300;
            pitchIncreasePerCombo = 20; 
            waveType = 'square'; // レトロなピコピコ音
            duration = 0.15;
            break;
        case 'perc':
            baseFreq = 600;
            pitchIncreasePerCombo = 25;
            waveType = 'sawtooth'; // 短いノコギリ波で打楽器的な鋭さを出す
            duration = 0.1;
            break;
        case 'deep':
            baseFreq = 200;
            pitchIncreasePerCombo = 15;
            waveType = 'sine'; // 低いサイン波で重厚に
            duration = 0.3;
            break;
        case 'happy': // デフォルト
        default:
            baseFreq = 500;
            pitchIncreasePerCombo = 17.5;
            waveType = 'sine'; // 明るいサイン波
            duration = 0.2;
            break;
    }
    
    // 周波数計算
    const freq = baseFreq + pitchIncreasePerCombo * comboStep; 

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = waveType; 
    oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);

    // エンベロープ（音の形状）
    const peakGain = (soundKey === 'perc') ? 0.4 : 0.25; // パーカッシブは少し大きく
    const fadeTime = duration * 0.5;

    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(peakGain, audioCtx.currentTime + fadeTime); 
    gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + duration); 

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + duration);
}


/**
 * ファンファーレ音を生成・再生 (変更なし)
 */
function playFanfare() {
    if (!isAudioContextInitialized || !audioCtx) {
        console.warn("AudioContext not initialized. Cannot play fanfare.");
        return;
    }

    const notes = [392, 523.25, 659.25, 783.99, 1046.5]; 
    const duration = 0.25; 

    notes.forEach((freq, index) => {
        const oscillator1 = audioCtx.createOscillator();
        oscillator1.type = 'sine'; 
        oscillator1.frequency.setValueAtTime(freq, audioCtx.currentTime);

        const oscillator2 = audioCtx.createOscillator();
        oscillator2.type = 'sawtooth'; 
        oscillator2.frequency.setValueAtTime(freq, audioCtx.currentTime);

        const gainNode = audioCtx.createGain();

        const startTime = audioCtx.currentTime + index * duration;
        const endTime = startTime + duration; 

        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.4, startTime + 0.05); 
        gainNode.gain.linearRampToValueAtTime(0, endTime);

        oscillator1.connect(gainNode);
        oscillator2.connect(gainNode); 
        gainNode.connect(audioCtx.destination);

        oscillator1.start(startTime);
        oscillator2.start(startTime);
        oscillator1.stop(endTime);
        oscillator2.stop(endTime);
    });
}


// --- ゲーム開始 ---
initGame();