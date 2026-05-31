/**
 * Echo: Elemental Chains — Network Manager
 * Manages WebRTC connections using PeerJS for authoritative Host-Client sync.
 */
class NetworkManager {
    constructor() {
        this.peer = null;
        this.roomId = null;
        this.connections = []; // Host: [{ peerId, conn }] | Client: single connection
        this.isHost = false;
        this.myId = null;
        this.players = []; // Sync list of players in room

        // Event Callbacks
        this.onRoomStateChange = null;
        this.onGameStart = null;
        this.onStateUpdate = null;
        this.onInteraction = null;
        this.onGameOver = null;
        this.onLog = null;
        this.onError = null;
        this.onDisconnect = null;
    }

    log(msg) {
        if (this.onLog) this.onLog(`[Network] ${msg}`);
    }

    // Generate readable room code
    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars
        let code = '';
        for (let i = 0; i < 4; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return `ECHO-${code}`;
    }

    // Host: Create a new room
    createRoom(playerName, playerAvatar, callback) {
        const code = this.generateRoomCode();
        this.log(`Oda oluşturuluyor: ${code}...`);
        
        this.peer = new Peer(code, {
            debug: 1
        });

        this.peer.on('open', (id) => {
            this.roomId = id;
            this.myId = id;
            this.isHost = true;
            this.connections = [];
            this.players = [{
                id: id,
                name: playerName,
                avatar: playerAvatar,
                isAI: false,
                isHost: true,
                status: 'Hazır'
            }];
            this.log(`Oda oluşturuldu. Kod: ${id}`);
            if (this.onRoomStateChange) this.onRoomStateChange(this.players);
            if (callback) callback(id);
        });

        this.peer.on('connection', (conn) => {
            this.log(`Yeni bağlantı isteği: ${conn.peer}`);
            conn.on('open', () => {
                // Connection opened
            });

            conn.on('data', (data) => {
                this.handleIncomingData(conn, data);
            });

            conn.on('close', () => {
                this.handleDisconnect(conn.peer);
            });

            conn.on('error', (err) => {
                this.log(`Bağlantı hatası (${conn.peer}): ${err.message}`);
            });
        });

        this.peer.on('error', (err) => {
            this.log(`Peer hatası: ${err.type} - ${err.message}`);
            if (err.type === 'unavailable-id') {
                this.log("ID kullanımda, yeni oda kodu deneniyor...");
                this.createRoom(playerName, playerAvatar, callback); // Retry
            } else {
                if (this.onError) this.onError(err.message);
            }
        });
    }

    // Client: Join an existing room
    joinRoom(roomCode, playerName, playerAvatar, callback) {
        const cleanedCode = roomCode.trim().toUpperCase();
        this.log(`Odaya bağlanılıyor: ${cleanedCode}...`);

        this.peer = new Peer(null, {
            debug: 1
        });

        this.peer.on('open', (id) => {
            this.myId = id;
            this.isHost = false;
            
            const conn = this.peer.connect(cleanedCode, {
                reliable: true
            });
            this.connections = [conn];

            conn.on('open', () => {
                this.roomId = cleanedCode;
                this.log("Sunucuya bağlanıldı. Katılım isteği gönderiliyor...");
                conn.send({
                    type: 'JOIN',
                    name: playerName,
                    avatar: playerAvatar
                });
                if (callback) callback(true);
            });

            conn.on('data', (data) => {
                this.handleIncomingData(conn, data);
            });

            conn.on('close', () => {
                this.log("Oda sahibi ile bağlantı kesildi.");
                if (this.onDisconnect) this.onDisconnect("Oda sahibi oyundan ayrıldı.");
            });

            conn.on('error', (err) => {
                this.log(`Bağlantı hatası: ${err.message}`);
                if (callback) callback(false, "Bağlantı kurulamadı.");
            });
        });

        this.peer.on('error', (err) => {
            this.log(`Peer hatası: ${err.message}`);
            if (callback) callback(false, err.message);
        });
    }

    // Host adds an AI player to the room
    addAIPlayer() {
        if (!this.isHost) return;
        if (this.players.length >= 4) {
            this.log("Oda dolu! AI eklenemez.");
            return;
        }

        const aiId = `ai-${Math.random().toString(36).substr(2, 5)}`;
        const aiIndex = this.players.length;
        const aiAvatars = ['🤖', '👾', '👽', '🦊', '🦉'];
        
        this.players.push({
            id: aiId,
            name: `AI ${aiIndex}`,
            avatar: aiAvatars[aiIndex % aiAvatars.length],
            isAI: true,
            isHost: false,
            status: 'Hazır'
        });

        this.log(`AI eklendi: AI ${aiIndex}`);
        this.broadcast({
            type: 'ROOM_STATE',
            players: this.players
        });
        if (this.onRoomStateChange) this.onRoomStateChange(this.players);
    }

    // Host removes a player/AI from the room
    removePlayer(playerId) {
        if (!this.isHost) return;
        
        const idx = this.players.findIndex(p => p.id === playerId);
        if (idx === -1) return;

        const p = this.players[idx];
        this.players.splice(idx, 1);
        this.log(`${p.name} odadan çıkarıldı.`);

        // If it was a human player, disconnect them
        if (!p.isAI) {
            const connObj = this.connections.find(c => c.peerId === playerId);
            if (connObj) {
                connObj.conn.send({ type: 'REJECT', reason: 'Odadan çıkarıldınız.' });
                connObj.conn.close();
                this.connections = this.connections.filter(c => c.peerId !== playerId);
            }
        }

        this.broadcast({
            type: 'ROOM_STATE',
            players: this.players
        });
        if (this.onRoomStateChange) this.onRoomStateChange(this.players);
    }

    // Host: Broadcast message to all clients
    broadcast(data) {
        if (!this.isHost) return;
        this.connections.forEach(c => {
            if (c.conn && c.conn.open) {
                c.conn.send(data);
            }
        });
    }

    // Send message to host
    sendToHost(data) {
        if (this.isHost) return;
        if (this.connections[0] && this.connections[0].open) {
            this.connections[0].send(data);
        }
    }

    // Disconnect and clean up
    disconnect() {
        this.log("Bağlantı kesiliyor...");
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        this.connections = [];
        this.players = [];
        this.roomId = null;
        this.isHost = false;
    }

    // Handle incoming WebRTC packets
    handleIncomingData(conn, data) {
        if (this.isHost) {
            // AUTHORITATIVE HOST HANDLERS
            switch (data.type) {
                case 'JOIN':
                    if (this.players.length >= 4) {
                        conn.send({ type: 'REJECT', reason: 'Oda dolu!' });
                        conn.close();
                        return;
                    }
                    // Register player
                    const newPlayer = {
                        id: conn.peer,
                        name: data.name || `Oyuncu ${this.players.length}`,
                        avatar: data.avatar || '⚔️',
                        isAI: false,
                        isHost: false,
                        status: 'Hazır'
                    };
                    this.players.push(newPlayer);
                    this.connections.push({ peerId: conn.peer, conn });
                    this.log(`${newPlayer.name} odaya katıldı.`);

                    // Send Welcome back to joiner
                    conn.send({
                        type: 'WELCOME',
                        myId: conn.peer,
                        players: this.players
                    });

                    // Broadcast new room state to everyone
                    this.broadcast({
                        type: 'ROOM_STATE',
                        players: this.players
                    });
                    
                    if (this.onRoomStateChange) this.onRoomStateChange(this.players);
                    break;

                case 'PLAY_CARD':
                    // Client requests to play a card
                    if (this.onPlayCardRequested) {
                        this.onPlayCardRequested(data.cardId, conn.peer);
                    }
                    break;
            }
        } else {
            // CLIENT HANDLERS (Receives updates from Host)
            switch (data.type) {
                case 'WELCOME':
                    this.myId = data.myId;
                    this.players = data.players;
                    this.log(`Odaya kabul edildiniz. ID'niz: ${this.myId}`);
                    if (this.onRoomStateChange) this.onRoomStateChange(this.players);
                    break;

                case 'ROOM_STATE':
                    this.players = data.players;
                    if (this.onRoomStateChange) this.onRoomStateChange(this.players);
                    break;

                case 'REJECT':
                    this.log(`Odaya katılım reddedildi: ${data.reason}`);
                    if (this.onDisconnect) this.onDisconnect(data.reason);
                    this.disconnect();
                    break;

                case 'START_GAME':
                    this.log("Oyun başlıyor!");
                    if (this.onGameStart) this.onGameStart(data.gameState);
                    break;

                case 'STATE_UPDATE':
                    if (this.onStateUpdate) this.onStateUpdate(data.gameState);
                    break;

                case 'INTERACTION':
                    if (this.onInteraction) this.onInteraction(data.result);
                    break;

                case 'GAME_OVER':
                    if (this.onGameOver) this.onGameOver(data.data);
                    break;
            }
        }
    }

    // Handle client disconnects on the Host
    handleDisconnect(peerId) {
        if (!this.isHost) return;
        
        const idx = this.players.findIndex(p => p.id === peerId);
        if (idx !== -1) {
            const p = this.players[idx];
            this.log(`${p.name} oyundan ayrıldı.`);
            this.players.splice(idx, 1);
            this.connections = this.connections.filter(c => c.peerId !== peerId);
            
            // Broadcast room state
            this.broadcast({
                type: 'ROOM_STATE',
                players: this.players
            });
            if (this.onRoomStateChange) this.onRoomStateChange(this.players);

            // If game is in progress and a human player leaves, we should notify
            if (this.onPlayerLeftDuringGame) {
                this.onPlayerLeftDuringGame(p);
            }
        }
    }
}
