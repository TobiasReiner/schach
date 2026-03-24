/*
 * Clientseitige Logik für das Hogwarts‑Zauberschach. Dieses Skript
 * implementiert sowohl lokale als auch online Partien. Für lokale
 * Spiele wird die Logik mittels Chess.js vollständig im Browser
 * ausgeführt. Für Online‑Spiele wird mittels Socket.IO eine
 * Verbindung zum Server aufgebaut, der den Spielverlauf validiert.
 */

(() => {
  // DOM‑Elemente
  const startScreen = document.getElementById('start-screen');
  const modeOptions = document.getElementById('mode-options');
  const btnLocal = document.getElementById('btn-local');
  const btnOnline = document.getElementById('btn-online');
  const btnBack = document.getElementById('btn-back');
  const btnStart = document.getElementById('btn-start');
  const timeSelect = document.getElementById('time-select');
  const houseSelectLocal = document.getElementById('house-select-local');
  const houseSelectOnline = document.getElementById('house-select-online');
  const houseASelect = document.getElementById('house-a-select');
  const houseBSelect = document.getElementById('house-b-select');
  const houseSelfSelect = document.getElementById('house-self-select');
  const onlineOptions = document.getElementById('online-options');
  const btnCreateRoom = document.getElementById('btn-create-room');
  const btnJoinRoom = document.getElementById('btn-join-room');
  const btnCancelCreate = document.getElementById('btn-cancel-create');
  const btnCancelJoin = document.getElementById('btn-cancel-join');
  const btnWait = document.getElementById('btn-wait');
  const btnSubmitJoin = document.getElementById('btn-submit-join');
  const createRoomForm = document.getElementById('create-room-form');
  const joinRoomForm = document.getElementById('join-room-form');
  const createJoinButtons = document.getElementById('create-join-buttons');
  const lobby = document.getElementById('lobby');
  const roomCodeDisplay = document.getElementById('room-code-display');
  const roomCodeInput = document.getElementById('room-code-input');
  const gameScreen = document.getElementById('game-screen');
  const boardEl = document.getElementById('board');
  const statusInfo = document.getElementById('status-info');
  const playerInfoA = document.getElementById('player-info-a');
  const playerInfoB = document.getElementById('player-info-b');
  const btnRestart = document.getElementById('btn-restart');
  const btnMenu = document.getElementById('btn-menu');
  const overlay = document.getElementById('overlay');
  const overlayContent = document.getElementById('overlay-content');
  const btnOverlayClose = document.getElementById('btn-overlay-close');

  // Spielvariablen
  let mode = null; // 'local' oder 'online'
  let game = null; // Instanz von Chess.js für lokale und Anzeigezwecke
  let mySide = null; // 'a' oder 'b' für Online oder 'local' für lokal
  let houses = { a: null, b: null }; // ausgewählte Häuser
  let socket = null; // Socket.IO Client
  let roomCode = null; // aktueller Raumcode
  let timers = { a: null, b: null }; // Zeit pro Seite (ms)
  let timerIntervals = { a: null, b: null }; // lokale Timer für Anzeige
  let selectedSquare = null; // aktuell ausgewählte Figur
  let possibleMoves = []; // mögliche Züge der ausgewählten Figur
  let isGameOver = false;

  // Hausfarben (RGB) für visuelle Darstellung
  const houseColors = {
    gryffindor: { name: 'Gryffindor', rgb: [127, 9, 9] },
    slytherin: { name: 'Slytherin', rgb: [42, 98, 61] },
    ravenclaw: { name: 'Ravenclaw', rgb: [14, 26, 64] },
    hufflepuff: { name: 'Hufflepuff', rgb: [236, 185, 57] },
  };

  /**
   * Generiert einen zufälligen Emoji‑Code mit drei Symbolen.
   */
  function generateEmojiCode() {
    const emojis = ['🧙', '🧙‍♂️', '🧙‍♀️', '🦉', '🐍', '🐺', '🦄', '🦡', '🦅', '🦁', '🎩', '📜', '✨', '🔮'];
    let code = '';
    for (let i = 0; i < 3; i++) {
      code += emojis[Math.floor(Math.random() * emojis.length)];
    }
    return code;
  }

  /**
   * Hex‑Farbwert in RGB‑Array umwandeln. Erlaubt z. B. '#ff0000'.
   */
  function hexToRgb(hex) {
    const match = hex.replace('#', '').match(/.{1,2}/g);
    if (!match) return [0, 0, 0];
    return match.map((x) => parseInt(x, 16));
  }

  /**
   * Konvertiert ein RGB‑Array in eine CSS‑Stringdarstellung "r,g,b".
   */
  function rgbToCss(rgbArr) {
    return rgbArr.join(',');
  }

  /**
   * Resete globale Variablen und DOM‑Elemente zum Startzustand.
   */
  function resetToStart() {
    mode = null;
    mySide = null;
    houses = { a: null, b: null };
    timers = { a: null, b: null };
    game = null;
    selectedSquare = null;
    possibleMoves = [];
    isGameOver = false;
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    // Stoppe lokale Timer
    if (timerIntervals.a) clearInterval(timerIntervals.a);
    if (timerIntervals.b) clearInterval(timerIntervals.b);
    timerIntervals = { a: null, b: null };
    // Oberfläche zurücksetzen
    boardEl.innerHTML = '';
    statusInfo.textContent = '';
    playerInfoA.innerHTML = '';
    playerInfoB.innerHTML = '';
    overlay.classList.add('hidden');
    startScreen.classList.remove('hidden');
    gameScreen.classList.add('hidden');
    modeOptions.classList.add('hidden');
    onlineOptions.classList.add('hidden');
    btnStart.classList.add('hidden');
    houseSelectLocal.classList.add('hidden');
    houseSelectOnline.classList.add('hidden');
    createJoinButtons.classList.remove('hidden');
    createRoomForm.classList.add('hidden');
    joinRoomForm.classList.add('hidden');
    lobby.classList.add('hidden');
    // Reset Buttons
  }

  /**
   * Erstellt das Brett mit 8×8 Feldern. Jeder Zelle wird ein Dataset
   * (square) zugewiesen, z.B. 'a1'.
   */
  function createBoard() {
    boardEl.innerHTML = '';
    const files = ['a','b','c','d','e','f','g','h'];
    for (let rank = 8; rank >= 1; rank--) {
      for (let file = 0; file < 8; file++) {
        const square = files[file] + rank;
        const cell = document.createElement('div');
        cell.classList.add('cell');
        // Hell/dunkel: (file + rank) % 2 === 0 → light
        if ((file + rank) % 2 === 0) {
          cell.classList.add('light');
        } else {
          cell.classList.add('dark');
        }
        cell.dataset.square = square;
        cell.addEventListener('click', () => onCellClick(cell));
        boardEl.appendChild(cell);
      }
    }
  }

  /**
   * Aktualisiert die Farbüberlagerungen (Häuser) des Bretts. Dazu werden
   * CSS‑Variablen (--half-top-rgb und --half-bottom-rgb) gesetzt.
   */
  function updateBoardColors() {
    const topRgb = houseColors[houses.b]?.rgb || [255,255,255];
    const bottomRgb = houseColors[houses.a]?.rgb || [255,255,255];
    boardEl.style.setProperty('--half-top-rgb', rgbToCss(topRgb));
    boardEl.style.setProperty('--half-bottom-rgb', rgbToCss(bottomRgb));
  }

  /**
   * Zeigt Informationen über Spieler (Haus und verbleibende Zeit).
   */
  function updatePlayerInfo() {
    // Spieler A (weiss)
    const houseA = houses.a;
    const houseB = houses.b;
    playerInfoA.innerHTML = '';
    playerInfoB.innerHTML = '';
    if (houseA) {
      const rgbA = houseColors[houseA].rgb;
      const nameA = houseColors[houseA].name;
      const timeA = timers.a != null ? formatTime(timers.a) : '';
      playerInfoA.innerHTML = `<span style="color: rgb(${rgbA.join(',')}); font-weight:bold">${nameA}</span><span>${timeA}</span>`;
    }
    if (houseB) {
      const rgbB = houseColors[houseB].rgb;
      const nameB = houseColors[houseB].name;
      const timeB = timers.b != null ? formatTime(timers.b) : '';
      playerInfoB.innerHTML = `<span style="color: rgb(${rgbB.join(',')}); font-weight:bold">${nameB}</span><span>${timeB}</span>`;
    }
  }

  /**
   * Formatiert Millisekunden in mm:ss Darstellung.
   */
  function formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
  }

  /**
   * Erstellt ein HTML‑Element für eine Figur. Es erhält die passende
   * Farbe (schwarz/weiß) und einen magischen Glanzeffekt basierend
   * auf dem Haus der Seite.
   */
  function createPieceElement(piece, side) {
    const iconMap = {
      p: 'fa-chess-pawn',
      r: 'fa-chess-rook',
      n: 'fa-chess-knight',
      b: 'fa-chess-bishop',
      q: 'fa-chess-queen',
      k: 'fa-chess-king',
    };
    const color = piece.color === 'w' ? '#f9f9f9' : '#1a1a1a';
    const houseColor = houses[side] ? `rgb(${houseColors[houses[side]].rgb.join(',')})` : 'rgba(255,255,255,0)';
    const shadow = `${houseColor}`;
    const i = document.createElement('i');
    i.className = `fa-solid ${iconMap[piece.type]} piece`;
    i.style.color = color;
    i.style.textShadow = `0 0 4px ${shadow}, 0 0 8px ${shadow}`;
    return i;
  }

  /**
   * Zeichnet das Brett basierend auf dem aktuellen FEN aus dem
   * Chess‑Objekt. Markiert Check und vorherige Auswahl.
   */
  function drawBoard() {
    if (!game) return;
    // Leere alle Felder
    for (const cell of boardEl.children) {
      cell.innerHTML = '';
      cell.classList.remove('highlight-move', 'highlight-check', 'selected');
    }
    // Zeige mögliche Züge falls ausgewählt
    possibleMoves.forEach((m) => {
      const target = boardEl.querySelector(`[data-square='${m.to}']`);
      if (target) target.classList.add('highlight-move');
    });
    // Durchlaufe alle Felder und füge Figuren hinzu
    const board = game.board();
    const files = ['a','b','c','d','e','f','g','h'];
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const piece = board[r][f];
        if (piece) {
          // Koordinaten: ranks 8→1, files a→h
          const rank = 8 - r;
          const file = files[f];
          const square = file + rank;
          const cell = boardEl.querySelector(`[data-square='${square}']`);
          if (cell) {
            const side = piece.color === 'w' ? 'a' : 'b';
            const pieceEl = createPieceElement(piece, side);
            cell.appendChild(pieceEl);
          }
        }
      }
    }
    // Markiere König im Schach
    if (game.in_check()) {
      const turn = game.turn();
      // turn ist der Spieler, der gerade am Zug ist und der König im Schach steht
      // Finde seine Königsposition
      const kingSquare = findKingSquare(turn);
      if (kingSquare) {
        const kingCell = boardEl.querySelector(`[data-square='${kingSquare}']`);
        if (kingCell) kingCell.classList.add('highlight-check');
      }
    }
    // Hebe ausgewähltes Feld hervor
    if (selectedSquare) {
      const selCell = boardEl.querySelector(`[data-square='${selectedSquare}']`);
      if (selCell) selCell.classList.add('selected');
    }
  }

  /**
   * Gibt das Feld (z. B. 'e1') zurück, auf dem der König der
   * angegebenen Farbe ("w" oder "b") steht.
   */
  function findKingSquare(color) {
    const board = game.board();
    const files = ['a','b','c','d','e','f','g','h'];
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const piece = board[r][f];
        if (piece && piece.type === 'k' && piece.color === color) {
          const rank = 8 - r;
          const file = files[f];
          return file + rank;
        }
      }
    }
    return null;
  }

  /**
   * Ereignisbehandlung für Klicks auf einem Feld. Je nach Modus
   * (lokal oder online) wird der Zug entweder lokal ausgeführt oder
   * an den Server gesendet. Nur gültige Züge sind erlaubt.
   */
  function onCellClick(cell) {
    if (!game || isGameOver) return;
    const square = cell.dataset.square;
    const piece = game.get(square);
    // Wenn bereits ein Feld ausgewählt ist und der Klick ein möglicher Zug ist
    const moveTarget = possibleMoves.find((m) => m.to === square);
    if (selectedSquare && moveTarget) {
      performMove(selectedSquare, square, moveTarget.promotion);
      return;
    }
    // Auswahl einer eigenen Figur
    // Im lokalen Modus kann jeder Spieler Figuren wählen; im Online‑Modus nur der eigene
    if (piece) {
      const sideOfPiece = piece.color === 'w' ? 'a' : 'b';
      // Im Online‑Modus ist nur das eigene Team wählbar
      if (mode === 'online' && mySide && sideOfPiece !== mySide) {
        return;
      }
      // Überprüfe, ob diese Figur am Zug ist
      const turn = game.turn();
      const expectedSide = turn === 'w' ? 'a' : 'b';
      if (mode === 'online' && expectedSide !== mySide) {
        // Nicht am Zug
        return;
      }
      // Ermitteln gültiger Züge für diese Figur
      const moves = game.moves({ square: square, verbose: true });
      selectedSquare = square;
      possibleMoves = moves;
      drawBoard();
    } else {
      // Kein Piece: Auswahl zurücksetzen
      selectedSquare = null;
      possibleMoves = [];
      drawBoard();
    }
  }

  /**
   * Führt einen Zug aus. Beim lokalen Spiel wird Chess.js direkt
   * aktualisiert. Beim Online‑Spiel wird der Zug an den Server
   * gesendet. Promotion wird derzeit automatisch zu einer Dame.
   */
  function performMove(from, to, promotion) {
    // Standardmäßig zur Dame befördern, wenn ein Bauer die letzte Reihe erreicht
    const moveData = { from, to };
    if (promotion) moveData.promotion = promotion;
    else {
      // Wenn die Figur ein Bauer ist und die letzte Reihe erreicht
      const piece = game.get(from);
      if (piece && piece.type === 'p') {
        const destRank = parseInt(to[1]);
        if ((piece.color === 'w' && destRank === 8) || (piece.color === 'b' && destRank === 1)) {
          moveData.promotion = 'q';
        }
      }
    }
    if (mode === 'local') {
      const moveResult = game.move(moveData);
      if (moveResult) {
        // Capture Effect anzeigen, wenn eine Figur geschlagen wird
        if (moveResult.captured) {
          playCaptureEffect(to);
        }
        updateAfterMove(moveResult);
      }
    } else if (mode === 'online') {
      if (socket && roomCode && mySide) {
        // Führe den Zug lokal aus, um den neuen FEN‑String und Status zu ermitteln.
        const moveResult = game.move(moveData);
        if (moveResult) {
          // Zeige lokale Schlaganimation sofort an
          if (moveResult.captured) {
            playCaptureEffect(moveResult.to);
          }
          const fen = game.fen();
          const isCheck = game.in_check();
          const isMate = game.in_checkmate();
          const isStalemate = game.in_stalemate();
          const isDraw = game.in_draw();
          // Schicke die aktualisierten Daten an den Server
          socket.emit('make-move', { roomCode, move: moveResult, fen, isCheck, isMate, isStalemate, isDraw });
          // Aktualisiere lokale Anzeige und Status
          updateAfterMove(moveResult);
        }
      }
    }
    // Auswahl zurücksetzen
    selectedSquare = null;
    possibleMoves = [];
  }

  /**
   * Zeigt bei einer Schlagaktion einen kurzen magischen Effekt. Auf dem
   * betroffenen Feld erscheint ein Funken, der langsam verblasst.
   */
  function playCaptureEffect(square) {
    const cell = boardEl.querySelector(`[data-square='${square}']`);
    if (!cell) return;
    const effect = document.createElement('div');
    effect.className = 'capture-effect';
    effect.innerHTML = '<i class="fa-solid fa-burst" style="color: #ffc400; font-size: 4vmin;"></i>';
    cell.appendChild(effect);
    setTimeout(() => {
      effect.remove();
    }, 3500);
  }

  /**
   * Aktualisiert Spielstatus, Anzeige und prüft auf Spielende nach einem Zug.
   */
  function updateAfterMove(moveResult) {
    drawBoard();
    // Statusanzeige
    if (game.in_checkmate()) {
      isGameOver = true;
      const winner = game.turn() === 'w' ? 'b' : 'a';
      showGameOver(winner, 'Schachmatt');
    } else if (game.in_stalemate()) {
      isGameOver = true;
      showGameOver(null, 'Patt');
    } else if (game.in_draw()) {
      isGameOver = true;
      showGameOver(null, 'Remis');
    } else if (game.in_check()) {
      statusInfo.textContent = 'Schach!';
      // Akustisches Signal beim Schach
      playCheckSound();
    } else {
      statusInfo.textContent = '';
    }
    updatePlayerInfo();
  }

  /**
   * Spielt einen kurzen Warnton ab, um ein Schach zu signalisieren.
   * Es wird ein einfacher Sinus‑Ton über die Web Audio API erzeugt.
   */
  function playCheckSound() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      // Falls AudioContext nicht unterstützt wird, wird kein Ton abgespielt.
    }
  }

  /**
   * Zeigt das Game‑Over‑Overlay an.
   */
  function showGameOver(winnerSide, reason) {
    let message;
    if (winnerSide === 'a' || winnerSide === 'b') {
      const houseName = houses[winnerSide] ? houseColors[houses[winnerSide]].name : 'Unbekannt';
      message = `${houseName} gewinnt (${reason})!`;
    } else {
      message = reason;
    }
    overlayContent.textContent = message;
    overlay.classList.remove('hidden');
  }

  /**
   * Startet eine lokale Partie basierend auf den ausgewählten Optionen.
   */
  function startLocalGame() {
    game = new Chess();
    mySide = 'local';
    houses.a = houseASelect.value;
    houses.b = houseBSelect.value;
    // Timer setzen (ms)
    const selectedTime = parseInt(timeSelect.value, 10);
    if (selectedTime > 0) {
      timers = { a: selectedTime * 1000, b: selectedTime * 1000 };
      startLocalTimers();
    } else {
      timers = { a: null, b: null };
    }
    updatePlayerInfo();
    updateBoardColors();
    createBoard();
    drawBoard();
    // Anzeigen
    startScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
  }

  /**
   * Startet lokale Timer. Jede Sekunde wird die verbleibende Zeit
   * der Seite am Zug reduziert. Bei Zeitablauf endet die Partie.
   */
  function startLocalTimers() {
    // Stoppe evtl. laufende Timer
    if (timerIntervals.a) clearInterval(timerIntervals.a);
    if (timerIntervals.b) clearInterval(timerIntervals.b);
    const tick = () => {
      if (isGameOver) return;
      const turn = game.turn();
      const side = turn === 'w' ? 'a' : 'b';
      if (timers[side] != null) {
        timers[side] -= 1000;
        if (timers[side] < 0) timers[side] = 0;
        updatePlayerInfo();
        if (timers[side] === 0) {
          // Die andere Seite gewinnt
          const winner = side === 'a' ? 'b' : 'a';
          isGameOver = true;
          showGameOver(winner, 'Zeit abgelaufen');
        }
      }
    };
    timerIntervals.a = setInterval(tick, 1000);
    timerIntervals.b = timerIntervals.a;
  }

  /**
   * Startet eine Online‑Partie durch Erstellen eines Raums. Der
   * Raumcode wird vom Benutzer vorgegeben (Emoji). Erst wenn ein
   * zweiter Spieler beitritt, beginnt die Partie.
   */
  function createOnlineGame() {
    roomCode = generateEmojiCode();
    roomCodeDisplay.textContent = roomCode;
    // Verbindung herstellen, falls noch nicht vorhanden
    if (!socket) socket = io();
    // Ereignisse registrieren
    registerSocketEvents();
    // Beim Server Raum erstellen
    const selectedTime = parseInt(timeSelect.value, 10);
    socket.emit('create-room', { roomCode, house: houseSelfSelect.value, time: selectedTime > 0 ? selectedTime : null });
  }

  /**
   * Tritt einem bestehenden Online‑Raum bei.
   */
  function joinOnlineGame(code) {
    roomCode = code;
    if (!socket) socket = io();
    registerSocketEvents();
    const selectedTime = parseInt(timeSelect.value, 10);
    socket.emit('join-room', { roomCode, house: houseSelfSelect.value });
  }

  /**
   * Registriert Listener für Socket‑Ereignisse. Diese werden nur einmal
   * eingerichtet, um doppelte Registrierung zu vermeiden.
   */
  function registerSocketEvents() {
    if (socket._hogwartsEventsRegistered) return;
    socket._hogwartsEventsRegistered = true;
    socket.on('room-error', ({ message }) => {
      alert(message);
      resetToStart();
    });
    socket.on('room-created', ({ roomCode: code, side, fen, houses: srvHouses, timers: srvTimers }) => {
      mySide = side;
      houses = srvHouses;
      timers = srvTimers;
      game = new Chess();
      game.load(fen);
      updatePlayerInfo();
      updateBoardColors();
      createBoard();
      drawBoard();
      // Warte auf Gegner
      lobby.classList.remove('hidden');
      createRoomForm.classList.add('hidden');
      createJoinButtons.classList.add('hidden');
      houseSelectOnline.classList.add('hidden');
    });
    socket.on('room-joined', ({ roomCode: code, fen, houses: srvHouses, timers: srvTimers }) => {
      houses = srvHouses;
      timers = srvTimers;
      game = new Chess();
      game.load(fen);
      updatePlayerInfo();
      updateBoardColors();
      createBoard();
      drawBoard();
      // Verberge Lobby, beginne Spiel
      lobby.classList.add('hidden');
      startScreen.classList.add('hidden');
      gameScreen.classList.remove('hidden');
    });
    socket.on('sync-state', ({ state }) => {
      // Synchronisiere FEN und Timer
      if (state && state.fen) {
        game.load(state.fen);
        drawBoard();
      }
      if (state && state.timers) {
        timers = state.timers;
        updatePlayerInfo();
      }
    });
    socket.on('move-made', ({ fen, move, isCheck, isMate, isStalemate, isDraw }) => {
      // Animation für Schlagzug
      if (move && move.captured) {
        playCaptureEffect(move.to);
      }
      game.load(fen);
      drawBoard();
      if (isMate) {
        isGameOver = true;
        const winner = game.turn() === 'w' ? 'b' : 'a';
        showGameOver(winner, 'Schachmatt');
      } else if (isStalemate) {
        isGameOver = true;
        showGameOver(null, 'Patt');
      } else if (isDraw) {
        isGameOver = true;
        showGameOver(null, 'Remis');
      } else if (isCheck) {
        statusInfo.textContent = 'Schach!';
        playCheckSound();
      } else {
        statusInfo.textContent = '';
      }
    });
    socket.on('time-update', ({ timers: srvTimers }) => {
      timers = srvTimers;
      updatePlayerInfo();
    });
    socket.on('game-over', ({ reason, winner }) => {
      isGameOver = true;
      if (reason === 'timeout') {
        showGameOver(winner, 'Zeit abgelaufen');
      }
    });
  }

  /**
   * Eventlistener‑Registrierung für die Bedienoberfläche.
   */
  function registerUIEvents() {
    btnLocal.addEventListener('click', () => {
      mode = 'local';
      modeOptions.classList.remove('hidden');
      btnStart.classList.remove('hidden');
      houseSelectLocal.classList.remove('hidden');
      houseSelectOnline.classList.add('hidden');
      onlineOptions.classList.add('hidden');
    });
    btnOnline.addEventListener('click', () => {
      mode = 'online';
      modeOptions.classList.remove('hidden');
      btnStart.classList.add('hidden');
      houseSelectLocal.classList.add('hidden');
      houseSelectOnline.classList.remove('hidden');
      onlineOptions.classList.remove('hidden');
    });
    btnBack.addEventListener('click', () => {
      // Zurück zum Startbildschirm
      resetToStart();
    });
    btnStart.addEventListener('click', () => {
      if (mode === 'local') startLocalGame();
    });
    // Online: Raum erstellen
    btnCreateRoom.addEventListener('click', () => {
      createRoomForm.classList.remove('hidden');
      createJoinButtons.classList.add('hidden');
      joinRoomForm.classList.add('hidden');
      lobby.classList.add('hidden');
      createOnlineGame();
    });
    btnCancelCreate.addEventListener('click', () => {
      // Abbrechen und zurück
      if (socket) {
        socket.disconnect();
        socket = null;
      }
      createRoomForm.classList.add('hidden');
      createJoinButtons.classList.remove('hidden');
      lobby.classList.add('hidden');
      houseSelectOnline.classList.remove('hidden');
    });
    btnWait.addEventListener('click', () => {
      // Bereits auf create-room sendet den Raumcode an den Server. Hier warten wir nur.
      startScreen.classList.add('hidden');
      gameScreen.classList.remove('hidden');
    });
    // Online: Raum beitreten
    btnJoinRoom.addEventListener('click', () => {
      joinRoomForm.classList.remove('hidden');
      createJoinButtons.classList.add('hidden');
      createRoomForm.classList.add('hidden');
      lobby.classList.add('hidden');
    });
    btnCancelJoin.addEventListener('click', () => {
      joinRoomForm.classList.add('hidden');
      createJoinButtons.classList.remove('hidden');
      if (socket) {
        socket.disconnect();
        socket = null;
      }
    });
    btnSubmitJoin.addEventListener('click', () => {
      const code = roomCodeInput.value.trim();
      if (code) {
        joinOnlineGame(code);
        joinRoomForm.classList.add('hidden');
        startScreen.classList.add('hidden');
        gameScreen.classList.remove('hidden');
      }
    });
    // Neustart (lokal oder online neu verbinden)
    btnRestart.addEventListener('click', () => {
      if (mode === 'local') {
        startLocalGame();
      } else if (mode === 'online') {
        // Sende an Server? Neu starten nicht implementiert → zurück ins Menü
        alert('Neustart im Online‑Modus derzeit nicht unterstützt. Bitte kehre zum Menü zurück.');
      }
    });
    btnMenu.addEventListener('click', () => {
      resetToStart();
    });
    btnOverlayClose.addEventListener('click', () => {
      resetToStart();
    });
  }

  // Initialisierung
  registerUIEvents();
  resetToStart();
})();