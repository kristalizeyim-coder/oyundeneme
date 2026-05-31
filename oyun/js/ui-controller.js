/**
 * Echo: Elemental Chains — UI Controller (4-Player Version)
 * Renders circular game board, binds user controls, handles local/WebRTC networks.
 */
class UIController {
    constructor() {
        this.engine = new GameEngine();
        this.ai = new AIOpponent('medium');
        this.network = new NetworkManager();
        
        this.mode = 'local'; // 'local' | 'online'
        this.selectedCardId = null;
        this.isAnimating = false;
        this.selectedAvatar = '⚔️';
        this.interactionInterval = null;
        this.autoRestartTimer = null;

        // DOM references
        this.dom = {
            landingOverlay:     document.getElementById('landing-overlay'),
            playerNameInput:    document.getElementById('player-name-input'),
            avatarSelector:     document.getElementById('avatar-selector'),
            playAiBtn:          document.getElementById('play-ai-btn'),
            lobbyMenuBtn:       document.getElementById('lobby-menu-btn'),
            
            lobbyOverlay:       document.getElementById('lobby-overlay'),
            lobbyInitialActions:document.getElementById('lobby-initial-actions'),
            createRoomBtn:      document.getElementById('create-room-btn'),
            roomCodeInput:      document.getElementById('room-code-input'),
            joinRoomBtn:        document.getElementById('join-room-btn'),
            
            roomLobbyPanel:     document.getElementById('room-lobby-panel'),
            lobbyRoomCode:      document.getElementById('lobby-room-code'),
            copyCodeBtn:        document.getElementById('copy-code-btn'),
            roomLobbyStatus:    document.getElementById('room-lobby-status'),
            addAiBtn:           document.getElementById('add-ai-btn'),
            startGameBtn:       document.getElementById('start-game-btn'),
            leaveLobbyBtn:      document.getElementById('leave-lobby-btn'),
            
            mainGameUi:         document.getElementById('main-game-ui'),
            gameDiffSelector:   document.getElementById('game-diff-selector'),
            roundDisplay:       document.getElementById('round-display'),
            statusBar:          document.getElementById('status-bar'),
            battlefieldSlot:    document.getElementById('battlefield-slot'),
            playerHand:         document.getElementById('player-hand'),
            logList:            document.getElementById('game-log-list'),
            leaveGameBtn:       document.getElementById('leave-game-btn'),
            infoBtn:            document.getElementById('info-btn'),
            infoOverlay:        document.getElementById('info-overlay'),
            infoCloseBtn:       document.getElementById('info-close-btn'),
            
            interOverlay:       document.getElementById('interaction-overlay'),
            interTimerProgress: document.getElementById('inter-timer-progress'),
            interTitle:         document.getElementById('inter-title'),
            interCards:         document.getElementById('inter-cards'),
            interDesc:          document.getElementById('inter-desc'),
            interPoints:        document.getElementById('inter-points'),
            interContinue:      document.getElementById('inter-continue-btn'),
            
            gameOverOverlay:    document.getElementById('game-over-overlay'),
            goTitle:            document.getElementById('go-title'),
            goRankings:         document.getElementById('go-rankings'),
            goMsg:              document.getElementById('go-msg'),
            goCountdown:        document.getElementById('go-countdown'),
            restartBtn:         document.getElementById('restart-btn')
        };

        this.bindEvents();
        this.setupAvatarSelector();
    }

    // ============= OVERLAY SHOW/HIDE HELPERS =============
    // Use a single consistent method to show/hide overlays
    showOverlay(el) {
        el.style.display = 'flex';
        el.style.opacity = '1';
        el.style.pointerEvents = 'auto';
    }

    hideOverlay(el) {
        el.style.display = 'none';
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
    }

    setupAvatarSelector() {
        const options = this.dom.avatarSelector.querySelectorAll('.avatar-option');
        options.forEach(opt => {
            opt.addEventListener('click', () => {
                options.forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                this.selectedAvatar = opt.dataset.emoji;
            });
        });
    }

    bindEvents() {
        // Landing Page
        this.dom.playAiBtn.addEventListener('click', () => this.startLocalGame());
        this.dom.lobbyMenuBtn.addEventListener('click', () => this.showLobbyMenu());

        // Lobby Actions
        this.dom.createRoomBtn.addEventListener('click', () => this.hostMultiplayerRoom());
        this.dom.joinRoomBtn.addEventListener('click', () => this.joinMultiplayerRoom());
        this.dom.copyCodeBtn.addEventListener('click', () => this.copyRoomCode());
        this.dom.addAiBtn.addEventListener('click', () => this.network.addAIPlayer());
        this.dom.leaveLobbyBtn.addEventListener('click', () => this.leaveLobby());
        this.dom.startGameBtn.addEventListener('click', () => this.startMultiplayerGame());

        // Game Interactions
        this.dom.leaveGameBtn.addEventListener('click', () => this.leaveGame());
        this.dom.interContinue.addEventListener('click', () => this.dismissInteraction());
        this.dom.restartBtn.addEventListener('click', () => this.triggerNewRound());

        // Info Overlay (remains class-toggle since it is just utility)
        this.dom.infoBtn.addEventListener('click', () => this.dom.infoOverlay.classList.add('active'));
        this.dom.infoCloseBtn.addEventListener('click', () => this.dom.infoOverlay.classList.remove('active'));
        this.dom.infoOverlay.addEventListener('click', (e) => {
            if (e.target === this.dom.infoOverlay) this.dom.infoOverlay.classList.remove('active');
        });

        // Offline Difficulty selection
        document.querySelectorAll('.diff-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.ai.difficulty = btn.dataset.diff;
                this.addLog(`AI zorluğu ayarlandı: ${btn.textContent}`);
            });
        });

        // Engine events (for local or host updates)
        this.engine.on('log', msg => this.addLog(msg));
        this.engine.on('gameOver', data => {
            // If we are the host in online mode, broadcast game over to all clients
            if (this.mode === 'online' && this.network.isHost) {
                this.network.broadcast({
                    type: 'GAME_OVER',
                    data: data
                });
            }
            this.showGameOver(data);
        });

        // Network event mapping
        this.network.onRoomStateChange = (players) => this.renderLobby(players);
        this.network.onGameStart = (gameState) => this.onNetworkGameStart(gameState);
        this.network.onStateUpdate = (gameState) => this.onNetworkStateUpdate(gameState);
        this.network.onInteraction = (result) => this.onNetworkInteraction(result);
        this.network.onGameOver = (data) => this.onNetworkGameOver(data);
        this.network.onDisconnect = (reason) => this.onNetworkDisconnect(reason);
        
        // Host-only move listener
        this.network.onPlayCardRequested = (cardId, senderId) => {
            if (this.network.isHost && this.mode === 'online') {
                const activePlayer = this.engine.getActivePlayer();
                if (activePlayer.id === senderId) {
                    const result = this.engine.playCard(cardId, senderId);
                    if (result) {
                        this.syncStateAndInteractions(result);
                    }
                }
            }
        };

        // Disconnect during game listener
        this.network.onPlayerLeftDuringGame = (player) => {
            if (this.engine.state && this.engine.state.phase !== 'GAME_OVER') {
                this.addLog(`[Ağ] ${player.name} oyundan çıktı! Kalan slotlar AI ile dolduruluyor...`);
                const statePlayer = this.engine.getPlayerById(player.id);
                if (statePlayer) {
                    statePlayer.isAI = true;
                    statePlayer.name += " (AI)";
                }
                this.engine.log(`${player.name} odadan ayrıldı. Yerine Yapay Zeka geçti.`);
                
                this.network.broadcast({
                    type: 'STATE_UPDATE',
                    gameState: this.engine.state
                });
                
                this.render();
                
                if (this.engine.getActivePlayerId() === player.id) {
                    this.scheduleAITurn(1200);
                }
            }
        };
    }

    // ============= GAME MODES TRIGGER =============

    startLocalGame() {
        this.mode = 'local';
        const name = this.dom.playerNameInput.value.trim() || 'Oyuncu';
        const avatar = this.selectedAvatar;

        const configs = [
            { id: 'p1', name: name, avatar: avatar, isAI: false },
            { id: 'p2', name: 'AI 1', avatar: '🤖', isAI: true },
            { id: 'p3', name: 'AI 2', avatar: '👾', isAI: true },
            { id: 'p4', name: 'AI 3', avatar: '👽', isAI: true }
        ];

        this.hideOverlay(this.dom.landingOverlay);
        this.dom.mainGameUi.style.display = 'block';
        this.dom.gameDiffSelector.style.display = 'flex';

        this.engine.initGame(configs);
        this.render();

        if (this.engine.getActivePlayer().isAI) {
            this.scheduleAITurn(1200);
        }
    }

    showLobbyMenu() {
        this.hideOverlay(this.dom.landingOverlay);
        this.showOverlay(this.dom.lobbyOverlay);
        this.dom.lobbyInitialActions.style.display = 'flex';
        this.dom.roomLobbyPanel.style.display = 'none';
    }

    // ============= NETWORK LOBBY MANAGEMENTS =============

    hostMultiplayerRoom() {
        const name = this.dom.playerNameInput.value.trim() || 'Oda Sahibi';
        const avatar = this.selectedAvatar;

        this.dom.lobbyInitialActions.style.display = 'none';
        this.dom.roomLobbyPanel.style.display = 'block';
        this.dom.roomLobbyStatus.textContent = 'Oda oluşturuluyor...';
        
        this.dom.addAiBtn.style.display = 'block';
        this.dom.startGameBtn.style.display = 'block';

        this.network.createRoom(name, avatar, (roomId) => {
            this.dom.lobbyRoomCode.textContent = roomId;
            this.dom.roomLobbyStatus.textContent = 'Bağlantı açık. Diğer oyuncular bekleniyor...';
        });
    }

    joinMultiplayerRoom() {
        const code = this.dom.roomCodeInput.value.trim().toUpperCase();
        if (!code) {
            alert('Lütfen geçerli bir Oda Kodu girin!');
            return;
        }

        const name = this.dom.playerNameInput.value.trim() || 'Misafir';
        const avatar = this.selectedAvatar;

        this.dom.lobbyInitialActions.style.display = 'none';
        this.dom.roomLobbyPanel.style.display = 'block';
        this.dom.roomLobbyStatus.textContent = 'Odaya bağlanılıyor...';

        this.dom.addAiBtn.style.display = 'none';
        this.dom.startGameBtn.style.display = 'none';

        this.network.joinRoom(code, name, avatar, (success, errorMsg) => {
            if (success) {
                this.dom.lobbyRoomCode.textContent = code;
                this.dom.roomLobbyStatus.textContent = 'Bağlanıldı, Oda Liderinin oyunu başlatması bekleniyor...';
            } else {
                alert(`Bağlantı hatası: ${errorMsg || 'Oda bulunamadı.'}`);
                this.showLobbyMenu();
            }
        });
    }

    copyRoomCode() {
        const code = this.dom.lobbyRoomCode.textContent;
        navigator.clipboard.writeText(code).then(() => {
            this.dom.copyCodeBtn.textContent = 'Kopyalandı! ✔️';
            setTimeout(() => {
                this.dom.copyCodeBtn.textContent = 'Kopyala 📋';
            }, 2000);
        });
    }

    leaveLobby() {
        this.network.disconnect();
        this.hideOverlay(this.dom.lobbyOverlay);
        this.showOverlay(this.dom.landingOverlay);
    }

    renderLobby(players) {
        const slots = [
            document.getElementById('slot-0'),
            document.getElementById('slot-1'),
            document.getElementById('slot-2'),
            document.getElementById('slot-3')
        ];

        slots.forEach((slot, idx) => {
            slot.innerHTML = '';
            slot.className = 'lobby-slot empty';

            if (players[idx]) {
                const p = players[idx];
                slot.className = 'lobby-slot occupied';
                
                const isMe = p.id === this.network.myId;
                const statusBadge = p.isHost ? '<span class="slot-badge">Lider</span>' : '';
                const aiBadge = p.isAI ? '<span class="slot-badge" style="background:#ff6d00;">AI</span>' : '';
                
                let removeBtn = '';
                if (this.network.isHost && !isMe) {
                    removeBtn = `<button class="slot-remove-btn" onclick="window.game.network.removePlayer('${p.id}')">✕</button>`;
                }

                slot.innerHTML = `
                    <div class="slot-player">
                        <span class="avatar">${p.avatar}</span>
                        <div class="player-details">
                            <span class="slot-name">${p.name} ${isMe ? '(Sen)' : ''}</span>
                            <div style="display:flex; gap: 4px; margin-top:2px;">
                                ${statusBadge} ${aiBadge}
                            </div>
                        </div>
                    </div>
                    ${removeBtn}
                `;
            } else {
                slot.innerHTML = `
                    <span class="slot-num">${idx + 1}</span>
                    <div class="slot-info">Oyuncu bekleniyor...</div>
                `;
            }
        });

        if (this.network.isHost) {
            this.dom.startGameBtn.disabled = players.length < 4;
        }
    }

    startMultiplayerGame() {
        if (!this.network.isHost) return;
        
        this.mode = 'online';
        const state = this.engine.initGame(this.network.players);

        // Broadcast game start to all clients
        this.network.broadcast({
            type: 'START_GAME',
            gameState: state
        });

        this.hideOverlay(this.dom.lobbyOverlay);
        this.dom.mainGameUi.style.display = 'block';
        this.dom.gameDiffSelector.style.display = 'none';

        this.render();

        if (this.engine.getActivePlayer().isAI) {
            this.scheduleAITurn(1200);
        }
    }

    // ============= WEBRTC RECEIVER CALLBACKS =============

    onNetworkGameStart(gameState) {
        this.mode = 'online';
        // CRITICAL: Rehydrate the game state to restore Card class instances
        this.engine.state = GameEngine.rehydrateState(gameState);
        
        this.hideOverlay(this.dom.lobbyOverlay);
        this.hideOverlay(this.dom.gameOverOverlay);
        this.hideOverlay(this.dom.interOverlay);
        this.dom.mainGameUi.style.display = 'block';
        this.dom.gameDiffSelector.style.display = 'none';

        this.render();
    }

    onNetworkStateUpdate(gameState) {
        // CRITICAL: Rehydrate the game state to restore Card class instances
        this.engine.state = GameEngine.rehydrateState(gameState);
        this.render();
    }

    onNetworkInteraction(result) {
        // CRITICAL: Rehydrate the interaction result to restore Card class instances
        const rehydrated = GameEngine.rehydrateResult(result);
        this.showInteraction(rehydrated);
    }

    onNetworkGameOver(data) {
        this.showGameOver(data);
    }

    onNetworkDisconnect(reason) {
        alert(reason || "Bağlantı koptu.");
        this.leaveGame();
    }

    leaveGame() {
        this.network.disconnect();
        
        if (this.interactionInterval) clearInterval(this.interactionInterval);
        if (this.autoRestartTimer) clearInterval(this.autoRestartTimer);
        this.autoRestartTimer = null;
        this.interactionInterval = null;

        this.dom.mainGameUi.style.display = 'none';
        this.hideOverlay(this.dom.lobbyOverlay);
        this.hideOverlay(this.dom.gameOverOverlay);
        this.hideOverlay(this.dom.interOverlay);
        
        this.showOverlay(this.dom.landingOverlay);
        this.engine.state = null;
        this.dom.logList.innerHTML = '';
    }

    // ============= GAMEPLAY & TURN DRIVERS =============

    triggerNewRound() {
        this.hideOverlay(this.dom.gameOverOverlay);
        this.hideOverlay(this.dom.interOverlay);
        if (this.interactionInterval) clearInterval(this.interactionInterval);
        if (this.autoRestartTimer) clearInterval(this.autoRestartTimer);
        this.autoRestartTimer = null;
        this.interactionInterval = null;
        
        this.selectedCardId = null;
        this.isAnimating = false;

        if (this.mode === 'local') {
            this.startLocalGame();
        } else if (this.mode === 'online' && this.network.isHost) {
            const state = this.engine.initGame(this.network.players);
            this.network.broadcast({
                type: 'START_GAME',
                gameState: state
            });
            this.render();
            if (this.engine.getActivePlayer().isAI) {
                this.scheduleAITurn(1200);
            }
        }
    }

    syncStateAndInteractions(result) {
        if (result.action === 'lead') {
            this.network.broadcast({
                type: 'STATE_UPDATE',
                gameState: this.engine.state
            });
            this.render();

            if (!result.gameOver && this.engine.getActivePlayer().isAI) {
                this.scheduleAITurn(1200);
            }
        } else if (result.action === 'attack') {
            this.network.broadcast({
                type: 'INTERACTION',
                result: result.result
            });
            this.network.broadcast({
                type: 'STATE_UPDATE',
                gameState: this.engine.state
            });
            
            this.showInteraction(result.result);
        }
    }

    onPlayerCardClick(card) {
        if (this.isAnimating) return;
        
        const myPlayerId = this.mode === 'online' ? this.network.myId : 'p1';
        if (this.engine.getActivePlayerId() !== myPlayerId) return;
        if (this.engine.state.phase === 'GAME_OVER') return;

        if (this.selectedCardId === card.id) {
            this.selectedCardId = null;
            this.render();
            return;
        }

        this.selectedCardId = card.id;
        this.render();

        setTimeout(() => {
            this.selectedCardId = null;
            
            if (this.mode === 'local') {
                const result = this.engine.playCard(card.id, 'p1');
                if (!result) return;

                if (result.action === 'lead') {
                    this.render();
                    if (!result.gameOver && this.engine.getActivePlayer().isAI) {
                        this.scheduleAITurn(1200);
                    }
                } else if (result.action === 'attack') {
                    this.showInteraction(result.result);
                }
            } else {
                if (this.network.isHost) {
                    const result = this.engine.playCard(card.id, this.network.myId);
                    if (result) this.syncStateAndInteractions(result);
                } else {
                    this.network.sendToHost({
                        type: 'PLAY_CARD',
                        cardId: card.id
                    });
                }
            }
        }, 220);
    }

    scheduleAITurn(delay = 1200) {
        this.isAnimating = true;
        this.render();

        setTimeout(() => {
            const state = this.engine.state;
            if (!state || state.phase === 'GAME_OVER') {
                this.isAnimating = false;
                this.render();
                return;
            }

            const activePlayer = this.engine.getActivePlayer();
            if (!activePlayer || !activePlayer.isAI) {
                this.isAnimating = false;
                this.render();
                return;
            }

            const chosenCard = this.ai.chooseCard(state, activePlayer.id);
            if (!chosenCard) {
                this.isAnimating = false;
                this.render();
                return;
            }

            if (this.mode === 'local') {
                const result = this.engine.playCard(chosenCard.id, activePlayer.id);
                this.isAnimating = false;
                this.render();

                if (!result) return;
                if (result.action === 'lead') {
                    if (!result.gameOver && this.engine.getActivePlayer().isAI) {
                        this.scheduleAITurn(1200);
                    }
                } else if (result.action === 'attack') {
                    this.showInteraction(result.result);
                }
            } else if (this.mode === 'online' && this.network.isHost) {
                const result = this.engine.playCard(chosenCard.id, activePlayer.id);
                this.isAnimating = false;
                this.render();

                if (result) {
                    this.syncStateAndInteractions(result);
                }
            }
        }, delay);
    }

    // ============= RENDERING GAME BOARD =============

    /**
     * Helper to safely get card emoji - works with both Card instances and plain objects
     */
    getCardEmoji(card) {
        if (card instanceof Card) return card.emoji;
        return ELEMENT_META[card.element] ? ELEMENT_META[card.element].emoji : '?';
    }

    getCardElemName(card) {
        if (card instanceof Card) return card.elemName;
        return ELEMENT_META[card.element] ? ELEMENT_META[card.element].name : '?';
    }

    getCardDisplayName(card) {
        if (card instanceof Card) return card.displayName;
        const emoji = this.getCardEmoji(card);
        const elemName = this.getCardElemName(card);
        const valueName = VALUE_NAMES[card.value] || card.value;
        return `${emoji} ${elemName} ${valueName}`;
    }

    render() {
        if (!this.engine.state) return;

        const state = this.engine.state;
        const myId = this.mode === 'online' ? this.network.myId : 'p1';
        
        let myIndex = state.players.findIndex(p => p.id === myId);
        if (myIndex === -1) myIndex = 0;

        const seatMappings = ['bottom', 'left', 'top', 'right'];

        state.players.forEach((p, index) => {
            const relativeOffset = (index - myIndex + 4) % 4;
            const seatName = seatMappings[relativeOffset];
            const prefix = this.getSeatPrefix(seatName);

            const nameEl = document.getElementById(`name-${prefix}`);
            const scoreEl = document.getElementById(`score-${prefix}`);
            const avatarEl = document.getElementById(`avatar-${prefix}`);
            const echoCountEl = document.getElementById(`echo-count-${prefix}`);
            const handEl = document.getElementById(seatName === 'bottom' ? 'player-hand' : `hand-${prefix}`);

            if (nameEl) nameEl.textContent = p.name;
            if (scoreEl) scoreEl.textContent = p.score;
            if (avatarEl) {
                avatarEl.textContent = p.avatar;
                
                avatarEl.classList.remove('active-indicator');
                if (state.activePlayerIndex === index && state.phase !== 'GAME_OVER') {
                    avatarEl.classList.add('active-indicator');
                }
            }
            if (echoCountEl) echoCountEl.textContent = `Echo: ${p.echo.length}`;

            if (handEl) {
                handEl.innerHTML = '';
                if (seatName === 'bottom') {
                    const canAct = state.activePlayerIndex === index && !this.isAnimating && state.phase !== 'GAME_OVER';
                    p.hand.forEach(card => {
                        const el = this.createCardElement(card, true, canAct);
                        if (!canAct) el.classList.add('disabled');
                        if (this.selectedCardId === card.id) el.classList.add('selected');
                        handEl.appendChild(el);
                    });
                } else {
                    p.hand.forEach(() => {
                        const cardBack = document.createElement('div');
                        cardBack.className = 'card';
                        cardBack.innerHTML = `<div class="card-back"><span class="card-back-icon">✦</span></div>`;
                        handEl.appendChild(cardBack);
                    });
                }
            }

            const echoCardsEl = document.getElementById(`echo-cards-${prefix}`);
            const echoTitleEl = document.getElementById(`echo-title-${prefix}`);
            
            if (echoTitleEl) echoTitleEl.textContent = `${p.name} Echo`;
            if (echoCardsEl) {
                echoCardsEl.innerHTML = '';
                const show = p.echo.slice(-6);
                show.forEach(card => {
                    const meta = ELEMENT_META[card.element];
                    const mini = document.createElement('div');
                    mini.className = 'echo-mini-card';
                    mini.style.borderColor = meta.color + '40';
                    mini.style.color = meta.color;
                    mini.textContent = meta.emoji;
                    mini.title = this.getCardDisplayName(card);
                    echoCardsEl.appendChild(mini);
                });
            }
        });

        this.renderBattlefield();
        this.updateStatus();
    }

    getSeatPrefix(seatName) {
        if (seatName === 'bottom') return 'p1';
        if (seatName === 'left') return 'p2';
        if (seatName === 'top') return 'p3';
        if (seatName === 'right') return 'p4';
        return 'p1';
    }

    createCardElement(card, faceUp = true, clickable = false) {
        const div = document.createElement('div');
        div.className = `card ${card.element.toLowerCase()} card-deal-in`;
        div.dataset.cardId = card.id;

        if (faceUp) {
            const emoji = this.getCardEmoji(card);
            const elemName = this.getCardElemName(card);
            
            div.innerHTML = `
                <div class="card-face">
                    <span class="card-corner top-left">${card.value}</span>
                    <span class="card-emoji">${emoji}</span>
                    <span class="card-value">${card.value}</span>
                    <span class="card-element-name">${elemName}</span>
                    <span class="card-corner bottom-right">${card.value}</span>
                </div>
            `;
            if (clickable) {
                div.addEventListener('click', () => this.onPlayerCardClick(card));
            }
        } else {
            div.innerHTML = `<div class="card-back"><span class="card-back-icon">✦</span></div>`;
            div.style.cursor = 'default';
        }

        return div;
    }

    renderBattlefield() {
        this.dom.battlefieldSlot.innerHTML = '';
        const bf = this.engine.state.battlefield;
        if (bf) {
            const wrapper = document.createElement('div');
            wrapper.className = 'battlefield-card card-to-field';
            const cardEl = this.createCardElement(bf.card, true, false);
            cardEl.classList.remove('card-deal-in');
            
            const owner = this.engine.getPlayerById(bf.ownerId);
            if (owner) {
                wrapper.title = `Sahibi: ${owner.name}`;
            }

            wrapper.appendChild(cardEl);
            this.dom.battlefieldSlot.appendChild(wrapper);
        }
    }

    updateStatus() {
        const s = this.engine.state;
        const myId = this.mode === 'online' ? this.network.myId : 'p1';
        const active = this.engine.getActivePlayer();

        let text = '';
        if (s.phase === 'GAME_OVER') {
            text = 'Oyun Bitti!';
        } else if (active.id === myId) {
            if (s.phase === 'LEAD') text = 'Senin sıran! Sahaya bir kart sür.';
            else text = 'Senin sıran! Savaş alanındaki karta saldır.';
        } else {
            text = `${active.name} oynuyor...`;
        }
        this.dom.statusBar.textContent = text;
        this.dom.roundDisplay.textContent = `Tur ${s.round}`;
    }

    addLog(msg) {
        const li = document.createElement('li');
        li.textContent = msg;
        li.classList.add('fade-in');
        this.dom.logList.appendChild(li);
        
        while (this.dom.logList.children.length > 20) {
            this.dom.logList.removeChild(this.dom.logList.firstChild);
        }
        this.dom.logList.parentElement.scrollTop = this.dom.logList.parentElement.scrollHeight;
    }

    // ============= INTERACTION DISPLAY OVERLAY =============

    showInteraction(result) {
        this.isAnimating = true;

        const myId = this.mode === 'online' ? this.network.myId : 'p1';
        const state = this.engine.state;
        let relativeSeat = 'top';
        
        if (state && result.winnerPlayer) {
            const winnerIdx = state.players.findIndex(p => p.id === result.winnerPlayer);
            const myIdx = state.players.findIndex(p => p.id === myId);
            const relativeOffset = (winnerIdx - myIdx + 4) % 4;
            const seatMappings = ['bottom', 'left', 'top', 'right'];
            relativeSeat = seatMappings[relativeOffset];
        }

        VFX.playInteractionVFX(result, relativeSeat);

        const attackerPlayer = this.engine.getPlayerById(result.attackerOwner);
        const targetPlayer = this.engine.getPlayerById(result.targetOwner);
        const attackerName = attackerPlayer ? attackerPlayer.name : 'Saldırgan';
        const targetName = targetPlayer ? targetPlayer.name : 'Hedef';

        this.dom.interTitle.textContent = result.title;
        this.dom.interDesc.textContent = result.description;

        this.dom.interCards.innerHTML = '';
        const atkMini = this.createMiniCard(result.attackerCard, attackerName);
        const vs = document.createElement('span');
        vs.className = 'interaction-vs';
        vs.textContent = 'VS';
        const tgtMini = this.createMiniCard(result.targetCard, targetName);
        this.dom.interCards.append(atkMini, vs, tgtMini);

        if (result.points > 0 && result.winnerPlayer) {
            const wPlayer = this.engine.getPlayerById(result.winnerPlayer);
            const wName = wPlayer ? wPlayer.name : 'Kazanan';
            this.dom.interPoints.textContent = `${wName}: +${result.points} Puan`;
            this.dom.interPoints.className = `interaction-points positive`;
        } else {
            this.dom.interPoints.textContent = 'Puan kazanılmadı';
            this.dom.interPoints.className = 'interaction-points neutral';
        }

        this.showOverlay(this.dom.interOverlay);

        const DURATION = 3500;
        let elapsed = 0;
        const STEP = 50;

        if (this.interactionInterval) clearInterval(this.interactionInterval);
        this.dom.interTimerProgress.style.width = '100%';

        this.interactionInterval = setInterval(() => {
            elapsed += STEP;
            let percent = Math.max(0, 100 - (elapsed / DURATION) * 100);
            this.dom.interTimerProgress.style.width = `${percent}%`;

            if (elapsed >= DURATION) {
                clearInterval(this.interactionInterval);
                this.interactionInterval = null;
                this.dismissInteraction();
            }
        }, STEP);
    }

    createMiniCard(card, ownerName) {
        const wrapper = document.createElement('div');
        wrapper.className = 'mini-card-wrapper';
        wrapper.style.textAlign = 'center';

        const cardEl = this.createCardElement(card, true, false);
        cardEl.classList.remove('card-deal-in');
        cardEl.classList.add('mini-card');
        cardEl.style.cursor = 'default';

        const label = document.createElement('div');
        label.style.cssText = 'font-size:10px; margin-top:6px; color: var(--text-muted);';
        label.textContent = ownerName;

        wrapper.append(cardEl, label);
        return wrapper;
    }

    dismissInteraction() {
        if (this.interactionInterval) {
            clearInterval(this.interactionInterval);
            this.interactionInterval = null;
        }
        
        this.hideOverlay(this.dom.interOverlay);
        this.isAnimating = false;
        this.render();

        const state = this.engine.state;
        if (!state || state.phase === 'GAME_OVER') return;

        if (this.mode === 'local' && this.engine.getActivePlayer().isAI) {
            this.scheduleAITurn(1200);
        } else if (this.mode === 'online' && this.network.isHost) {
            if (this.engine.getActivePlayer().isAI) {
                this.scheduleAITurn(1200);
            }
        }
    }

    // ============= GAME OVER STATE =============

    showGameOver(data) {
        if (this.interactionInterval) clearInterval(this.interactionInterval);
        this.interactionInterval = null;
        this.hideOverlay(this.dom.interOverlay);
        
        setTimeout(() => {
            const myId = this.mode === 'online' ? this.network.myId : 'p1';
            
            const ranked = data.rankings;
            const myRankIdx = ranked.findIndex(p => p.id === myId);
            const myRank = myRankIdx + 1;

            if (myRank === 1) {
                this.dom.goTitle.textContent = '🏆 Zafer! (1.lik)';
            } else {
                this.dom.goTitle.textContent = `🥈 Oyun Bitti (${myRank}.lik)`;
            }

            this.dom.goRankings.innerHTML = '';
            ranked.forEach((p, idx) => {
                const row = document.createElement('div');
                row.className = `rank-row ${idx === 0 ? 'winner-row' : ''}`;
                
                const isMe = p.id === myId;
                
                row.innerHTML = `
                    <div class="rank-player-info">
                        <span class="rank-number">${idx + 1}</span>
                        <span class="rank-avatar">${p.avatar}</span>
                        <span class="rank-name">${p.name} ${isMe ? '(Sen)' : ''}</span>
                    </div>
                    <span class="rank-score">${p.score} Pts</span>
                `;
                this.dom.goRankings.appendChild(row);
            });

            this.dom.goMsg.textContent = data.msg;
            this.showOverlay(this.dom.gameOverOverlay);

            if (this.mode === 'local' || (this.mode === 'online' && this.network.isHost)) {
                this.startAutoRestartCountdown();
            } else {
                this.dom.restartBtn.style.display = 'none';
                this.dom.goCountdown.textContent = 'Yeniden başlatılması için Lider bekleniyor...';
            }
        }, 800);
    }

    startAutoRestartCountdown() {
        const SECONDS = 7;
        let remaining = SECONDS;

        this.dom.restartBtn.style.display = 'inline-block';

        const updateBtn = () => {
            this.dom.restartBtn.textContent = `Yeniden Başlat (${remaining}s)`;
            this.dom.goCountdown.textContent = `Yeni tur ${remaining} saniye içinde başlıyor...`;
        };
        updateBtn();

        if (this.autoRestartTimer) clearInterval(this.autoRestartTimer);

        this.autoRestartTimer = setInterval(() => {
            remaining--;
            if (remaining <= 0) {
                clearInterval(this.autoRestartTimer);
                this.autoRestartTimer = null;
                this.triggerNewRound();
            } else {
                updateBtn();
            }
        }, 1000);
    }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    window.game = new UIController();
});
