/**
 * Echo: Elemental Chains — Core Game Engine (4-Player Version)
 * Card model, deck, interaction resolution, scoring with Echo Sinergy.
 */

// ============= CONSTANTS =============
const ELEMENTS = { AIR: 'AIR', FIRE: 'FIRE', WATER: 'WATER', EARTH: 'EARTH', JOKER: 'JOKER' };

const JOKER_POINTS = 15;

const ELEMENT_META = {
    AIR:   { name: 'Hava',   emoji: '🌪️', color: '#00e5ff', dark: '#004d5a', glow: 'rgba(0,229,255,0.4)' },
    FIRE:  { name: 'Ateş',   emoji: '🔥', color: '#ff6d00', dark: '#5a2600', glow: 'rgba(255,109,0,0.4)' },
    WATER: { name: 'Su',     emoji: '💧', color: '#448aff', dark: '#0d2f6b', glow: 'rgba(68,138,255,0.4)' },
    EARTH: { name: 'Toprak', emoji: '⛰️', color: '#76ff03', dark: '#2a5a00', glow: 'rgba(118,255,3,0.4)' },
    JOKER: { name: 'Joker',  emoji: '🃏', color: '#e040fb', dark: '#4a0072', glow: 'rgba(224,64,251,0.4)' }
};

const VALUE_NAMES = {
    1:'As', 2:'2', 3:'3', 4:'4', 5:'5', 6:'6', 7:'7',
    8:'8', 9:'9', 10:'10', 11:'Vale', 12:'Kız', 13:'Şah',
    15:'Joker'
};

// ============= INTERACTION TABLE =============
const INTERACTIONS = {
    AIR_EARTH:   { type:'PREDATOR', winner:'attacker', title:'🌪️ Hava Toprağı Aşındırdı!',   desc:'Hava, Toprağı aşındırarak ele geçirdi.',                     pts:(a,t)=>a+t, capture:true,  waterStays:false },
    AIR_FIRE:    { type:'PREY',     winner:'target',   title:'🔥 Ateş Havayı Yuttu!',         desc:'Hava, Ateşi besledi! Ateş kazandı.',
                     pts:(a,t)=>a+t, capture:true,  waterStays:false },
    AIR_WATER:   { type:'NEUTRAL',  winner:null,       title:'💧 Su Dayanıyor!',               desc:'Hava, Suyun üzerinden geçiyor. Su sahada kalıyor.',
                     pts:()=>0,     capture:false, waterStays:true },

    FIRE_AIR:    { type:'PREDATOR', winner:'attacker', title:'🔥 Ateş Havayı Tüketti!',        desc:'Ateş, Havayı yutarak kazandı.',
                     pts:(a,t)=>a+t, capture:true,  waterStays:false },
    FIRE_WATER:  { type:'PREY',     winner:null,       title:'💧 Su Ateşi Söndürdü!',          desc:'Ateş söndürüldü! Su sahada kalmaya devam ediyor.',
                     pts:()=>0,     capture:false, waterStays:true },
    FIRE_EARTH:  { type:'NEUTRAL',  winner:null,       title:'⚡ Etkisiz Çarpışma!',            desc:'Ateş, Toprağı yakamaz. Kartlar etkisizleşti.',
                     pts:()=>0,     capture:false, waterStays:false },

    WATER_FIRE:  { type:'PREDATOR', winner:'attacker', title:'💧 Su Ateşi Söndürdü!',          desc:'Su, Ateşi söndürerek zaferi kazandı!',
                     pts:(a,t)=>a+t,   capture:true,  waterStays:false },
    WATER_EARTH: { type:'PREY',     winner:'target',   title:'⛰️ Toprak Suyu Emdi!',           desc:'Su, Toprak tarafından emildi. Puanlar Toprağa gidiyor.',
                     pts:(a,t)=>a+t, capture:true,  waterStays:false },
    WATER_AIR:   { type:'NEUTRAL',  winner:null,       title:'⚡ Etkisiz Çarpışma!',            desc:'Su ve Hava birbirini etkileyemedi.',
                     pts:()=>0,     capture:false, waterStays:false },

    EARTH_WATER: { type:'PREDATOR', winner:'attacker', title:'⛰️ Toprak Suyu Emdi!',           desc:'Toprak, Suyu emerek puanlarını ele geçirdi.',
                     pts:(a,t)=>a+t, capture:true,  waterStays:false },
    EARTH_AIR:   { type:'PREY',     winner:'target',   title:'🌪️ Hava Toprağı Aşındırdı!',    desc:'Toprak, Hava tarafından aşındırılarak ele geçirildi.',
                     pts:(a,t)=>a+t, capture:true,  waterStays:false },
    EARTH_FIRE:  { type:'NEUTRAL',  winner:null,       title:'⚡ Etkisiz Çarpışma!',            desc:'Toprak, Ateşe karşı dayanıyor. Kartlar etkisizleşti.',
                     pts:()=>0,     capture:false, waterStays:false }
};

// ============= CARD CLASS =============
class Card {
    constructor(id, element, value) {
        this.id = id;
        this.element = element;
        this.value = value;
    }
    get meta()        { return ELEMENT_META[this.element]; }
    get emoji()       { return this.meta.emoji; }
    get elemName()    { return this.meta.name; }
    get valueName()   { return VALUE_NAMES[this.value]; }
    get displayName() { return `${this.emoji} ${this.elemName} ${this.valueName}`; }

    // Ensure JSON serialization preserves necessary data
    toJSON() {
        return { id: this.id, element: this.element, value: this.value };
    }

    // Re-create a Card instance from a plain object (used after WebRTC deserialization)
    static fromPlain(obj) {
        if (!obj) return null;
        if (obj instanceof Card) return obj;
        return new Card(obj.id, obj.element, obj.value);
    }
}

// ============= GAME ENGINE =============
class GameEngine {
    constructor() {
        this.state = null;
        this.listeners = { stateChange: [], interaction: [], gameOver: [], log: [] };
    }

    on(event, fn) { this.listeners[event].push(fn); }
    emit(event, data) { this.listeners[event].forEach(fn => fn(data)); }
    log(msg) { if (this.state) this.state.gameLog.push(msg); this.emit('log', msg); }

    /**
     * Rehydrate game state received over network.
     * Converts all plain card objects back to Card class instances.
     */
    static rehydrateState(state) {
        if (!state) return state;

        // Rehydrate player hands and echo collections
        if (state.players) {
            state.players.forEach(p => {
                if (p.hand) p.hand = p.hand.map(c => Card.fromPlain(c));
                if (p.echo) p.echo = p.echo.map(c => Card.fromPlain(c));
            });
        }

        // Rehydrate battlefield card
        if (state.battlefield && state.battlefield.card) {
            state.battlefield.card = Card.fromPlain(state.battlefield.card);
        }

        // Rehydrate discard pile
        if (state.discardPile) {
            state.discardPile = state.discardPile.map(c => Card.fromPlain(c));
        }

        // Rehydrate lastResult cards
        if (state.lastResult) {
            state.lastResult = GameEngine.rehydrateResult(state.lastResult);
        }

        return state;
    }

    /**
     * Rehydrate an interaction result received over network.
     */
    static rehydrateResult(result) {
        if (!result) return result;
        if (result.attackerCard) result.attackerCard = Card.fromPlain(result.attackerCard);
        if (result.targetCard) result.targetCard = Card.fromPlain(result.targetCard);
        return result;
    }

    // Create and shuffle deck (52 element cards + 2 Jokers = 54 cards)
    createDeck() {
        const deck = [];
        let id = 0;
        for (const el of Object.values(ELEMENTS)) {
            if (el === 'JOKER') continue; // Jokers added separately
            for (let v = 1; v <= 13; v++) deck.push(new Card(id++, el, v));
        }
        // Add 2 Joker cards with fixed value of 15
        deck.push(new Card(id++, 'JOKER', JOKER_POINTS));
        deck.push(new Card(id++, 'JOKER', JOKER_POINTS));
        // Fisher-Yates shuffle
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }

    // Initialize a new 4-player game
    initGame(playerConfigs) {
        const deck = this.createDeck();
        const SPECIAL_VALUES = [1, 11, 12, 13]; // As, Vale, Kız, Şah
        const MAX_SPECIALS = 3;

        // Default configs if none provided (Single player vs 3 AIs)
        if (!playerConfigs || playerConfigs.length < 4) {
            playerConfigs = [
                { id: 'p1', name: 'Sen', avatar: '⚔️', isAI: false },
                { id: 'p2', name: 'AI 1', avatar: '🤖', isAI: true },
                { id: 'p3', name: 'AI 2', avatar: '👾', isAI: true },
                { id: 'p4', name: 'AI 3', avatar: '👽', isAI: true }
            ];
        }

        // Initialize player structures
        const players = playerConfigs.map(config => ({
            id: config.id,
            name: config.name,
            avatar: config.avatar,
            isAI: config.isAI,
            hand: [],
            echo: [],
            score: 0,
            specialsCount: 0
        }));

        // Separate deck into specials and normals
        const specials = deck.filter(c => SPECIAL_VALUES.includes(c.value));
        const normals = deck.filter(c => !SPECIAL_VALUES.includes(c.value));

        // Shuffle arrays helper
        const shuffle = (arr) => {
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
        };
        shuffle(specials);
        shuffle(normals);

        // Deal specials first (max MAX_SPECIALS per player)
        while (specials.length > 0) {
            const candidates = players.filter(p => p.hand.length < 7 && p.specialsCount < MAX_SPECIALS);
            if (candidates.length === 0) break;

            const card = specials.shift();
            // Assign card to a random eligible player
            const p = candidates[Math.floor(Math.random() * candidates.length)];
            p.hand.push(card);
            p.specialsCount++;
        }

        // Push leftover specials back to normals pool and shuffle
        normals.push(...specials);
        shuffle(normals);

        // Fill remaining hand slots to exactly 7 cards
        for (const p of players) {
            while (p.hand.length < 7 && normals.length > 0) {
                p.hand.push(normals.shift());
            }
            shuffle(p.hand);
        }

        // Choose a random starting player index
        const activePlayerIndex = Math.floor(Math.random() * 4);

        this.state = {
            players,
            activePlayerIndex,
            battlefield: null,       // { card: Card, ownerId: string }
            phase: 'LEAD',           // LEAD | ATTACK | GAME_OVER
            round: 1,
            lastResult: null,
            discardPile: [],
            gameLog: []
        };

        const who = this.state.players[activePlayerIndex].name;
        this.log(`Oyun başladı! İlk oynayan: ${who}`);
        this.emit('stateChange', this.state);
        return this.state;
    }

    // Helper: Get active player object
    getActivePlayer() {
        return this.state.players[this.state.activePlayerIndex];
    }

    // Helper: Get active player ID
    getActivePlayerId() {
        return this.getActivePlayer().id;
    }

    // Helper: Find player by ID
    getPlayerById(id) {
        return this.state.players.find(p => p.id === id);
    }

    // Get player hand
    getHand(playerId) {
        const p = this.getPlayerById(playerId);
        return p ? p.hand : [];
    }

    // Get player echo collection
    getEcho(playerId) {
        const p = this.getPlayerById(playerId);
        return p ? p.echo : [];
    }

    // Check if player has Echo Sinergy for an element
    hasSinergy(playerId, element) {
        return this.getEcho(playerId).some(c => c.element === element);
    }

    // Play a card: handles both LEAD and ATTACK phases
    playCard(cardId, playerId) {
        if (this.state.phase === 'GAME_OVER') return null;
        if (this.getActivePlayerId() !== playerId) return null;

        const player = this.getPlayerById(playerId);
        const hand = player.hand;
        const idx = hand.findIndex(c => c.id === cardId);
        if (idx === -1) return null;
        const card = hand.splice(idx, 1)[0];
        const pName = player.name;

        // LEAD: place card on empty battlefield
        if (this.state.phase === 'LEAD' && !this.state.battlefield) {
            this.state.battlefield = { card, ownerId: playerId };
            this.state.phase = 'ATTACK';
            this.state.activePlayerIndex = (this.state.activePlayerIndex + 1) % 4;
            this.log(`${pName}, ${card.displayName} kartını sahaya koydu.`);
            
            // Check if game is over (no cards in hands, etc.)
            if (this.checkGameOver()) {
                this.emit('stateChange', this.state);
                return { action: 'lead', card, gameOver: true };
            }
            this.emit('stateChange', this.state);
            return { action: 'lead', card };
        }

        // ATTACK: resolve interaction with battlefield card
        if (this.state.phase === 'ATTACK' && this.state.battlefield) {
            this.log(`${pName}, ${card.displayName} ile saldırıyor!`);
            const result = this.resolve(card, playerId);
            this.state.lastResult = result;
            this.applyResult(result);
            this.checkGameOver();
            this.emit('interaction', result);
            this.emit('stateChange', this.state);
            return { action: 'attack', card, result };
        }

        // If we get here, put card back
        hand.push(card);
        return null;
    }

    // Core interaction resolution
    resolve(attackerCard, attackerId) {
        const targetCard = this.state.battlefield.card;
        const targetOwnerId = this.state.battlefield.ownerId;

        // Calculate Echo Synergy multiplier (value * 1.5, rounded up)
        const atkSinergy = this.hasSinergy(attackerId, attackerCard.element);
        const tgtSinergy = this.hasSinergy(targetOwnerId, targetCard.element);
        const atkVal = atkSinergy ? Math.ceil(attackerCard.value * 1.5) : attackerCard.value;
        const tgtVal = tgtSinergy ? Math.ceil(targetCard.value * 1.5) : targetCard.value;

        // ── Joker resolution ──
        const atkIsJoker = attackerCard.element === 'JOKER';
        const tgtIsJoker = targetCard.element === 'JOKER';

        if (atkIsJoker && tgtIsJoker) {
            // Joker vs Joker → draw, both discarded
            return {
                type: 'JOKER_DRAW',
                title: '🃏 Joker Çarpışması!',
                description: 'İki Joker birbirini yok etti! Puan kazanılmadı.',
                attackerCard, targetCard,
                attackerOwner: attackerId, targetOwner: targetOwnerId,
                atkVal: JOKER_POINTS, tgtVal: JOKER_POINTS,
                atkSinergy: false, tgtSinergy: false,
                points: 0,
                winnerPlayer: null,
                capture: false,
                waterStays: false
            };
        }

        if (atkIsJoker) {
            // Attacker's Joker beats any card → sum of values
            const totalPts = JOKER_POINTS + tgtVal;
            return {
                type: 'JOKER_WIN',
                title: '🃏 Joker Her Şeyi Yener!',
                description: `Joker, ${this.getPlayerById(targetOwnerId).name}'in ${targetCard.displayName} kartını yendi! +${totalPts} puan.`,
                attackerCard, targetCard,
                attackerOwner: attackerId, targetOwner: targetOwnerId,
                atkVal: JOKER_POINTS, tgtVal,
                atkSinergy: false, tgtSinergy: false,
                points: totalPts,
                winnerPlayer: attackerId,
                capture: true,
                waterStays: false
            };
        }

        if (tgtIsJoker) {
            // Target's Joker beats the attacker → sum of values
            const totalPts = atkVal + JOKER_POINTS;
            return {
                type: 'JOKER_WIN',
                title: '🃏 Joker Her Şeyi Yener!',
                description: `Joker, ${this.getPlayerById(attackerId).name}'in ${attackerCard.displayName} kartını yendi! +${totalPts} puan.`,
                attackerCard, targetCard,
                attackerOwner: attackerId, targetOwner: targetOwnerId,
                atkVal, tgtVal: JOKER_POINTS,
                atkSinergy: false, tgtSinergy: false,
                points: totalPts,
                winnerPlayer: targetOwnerId,
                capture: true,
                waterStays: false
            };
        }

        // ── Same element — mirror match ──
        if (attackerCard.element === targetCard.element) {
            return this.resolveMirror(attackerCard, targetCard, attackerId, targetOwnerId, atkVal, tgtVal, atkSinergy, tgtSinergy);
        }

        const key = `${attackerCard.element}_${targetCard.element}`;
        const inter = INTERACTIONS[key];
        const points = inter.pts(atkVal, tgtVal);

        let winnerPlayer = null;
        if (inter.winner === 'attacker') winnerPlayer = attackerId;
        else if (inter.winner === 'target') winnerPlayer = targetOwnerId;

        const atkName = this.getPlayerById(attackerId).name;
        const tgtName = this.getPlayerById(targetOwnerId).name;

        let titleStr = inter.title;
        let descStr = inter.desc;

        // Customise names in descriptions
        descStr = descStr.replace('Hava, Toprağı', `${atkName}'in Havası, ${tgtName}'in Toprağını`);
        descStr = descStr.replace('Hava, Ateşi', `${atkName}'in Havası, ${tgtName}'in Ateşini`);
        descStr = descStr.replace('Ateş, Havayı', `${atkName}'in Ateşi, ${tgtName}'in Havasını`);
        descStr = descStr.replace('Su, Ateşi', `${atkName}'in Suyu, ${tgtName}'in Ateşini`);
        descStr = descStr.replace('Su, Toprak', `${atkName}'in Suyu, ${tgtName}'in Toprağı`);
        descStr = descStr.replace('Toprak, Suyu', `${atkName}'in Toprağı, ${tgtName}'in Suyunu`);
        descStr = descStr.replace('Toprak, Hava', `${atkName}'in Toprağı, ${tgtName}'in Havası`);

        return {
            type: inter.type,
            title: titleStr,
            description: descStr,
            attackerCard, targetCard,
            attackerOwner: attackerId, targetOwner: targetOwnerId,
            atkVal, tgtVal,
            atkSinergy, tgtSinergy,
            points,
            winnerPlayer,
            capture: inter.capture,
            waterStays: inter.waterStays
        };
    }

    resolveMirror(atk, tgt, atkOwnerId, tgtOwnerId, atkVal, tgtVal, atkSin, tgtSin) {
        let winnerPlayer = null, points = 0;
        let title, desc;
        const atkName = this.getPlayerById(atkOwnerId).name;
        const tgtName = this.getPlayerById(tgtOwnerId).name;

        if (atkVal > tgtVal) {
            winnerPlayer = atkOwnerId;
            points = atkVal + tgtVal;
            title = `⚔️ ${atk.meta.emoji} Ayna Düellosu!`;
            desc = `Aynı element! ${atkName}'in daha güçlü kartı kazandı. (${atkVal} > ${tgtVal})`;
        } else if (tgtVal > atkVal) {
            winnerPlayer = tgtOwnerId;
            points = atkVal + tgtVal;
            title = `⚔️ ${atk.meta.emoji} Ayna Düellosu!`;
            desc = `Aynı element! ${tgtName}'in daha güçlü kartı kazandı. (${tgtVal} > ${atkVal})`;
        } else {
            title = `💫 Mükemmel Denge!`;
            desc = `Aynı element ve aynı güç! İki kart da etkisizleşti.`;
        }

        return {
            type: 'MIRROR',
            title, description: desc,
            attackerCard: atk, targetCard: tgt,
            attackerOwner: atkOwnerId, targetOwner: tgtOwnerId,
            atkVal, tgtVal,
            atkSinergy: atkSin, tgtSinergy: tgtSin,
            points, winnerPlayer,
            capture: winnerPlayer !== null,
            waterStays: false
        };
    }

    // Apply the result of an interaction to the game state
    applyResult(result) {
        const { attackerCard, targetCard, winnerPlayer, points, capture, waterStays, attackerOwner, targetOwner } = result;

        const attacker = this.getPlayerById(attackerOwner);
        const attackerIndex = this.state.players.findIndex(p => p.id === attackerOwner);

        if (capture && winnerPlayer) {
            // Winner captures both cards into their Echo Collection
            const winner = this.getPlayerById(winnerPlayer);
            winner.echo.push(attackerCard, targetCard);
            winner.score += points;
            this.state.battlefield = null;
            this.state.phase = 'LEAD';
            // In a 4-player game, winner leading causes a 1v1 infinite loop.
            // Pass the lead to the attacker to rotate turns fairly.
            this.state.activePlayerIndex = attackerIndex;
            this.log(`${winner.name} çarpışmayı kazandı ve +${points} puan elde etti!`);
        } else if (waterStays) {
            // Water card persists on battlefield
            const waterCard = targetCard.element === 'WATER' ? targetCard : attackerCard;
            const waterOwnerId = targetCard.element === 'WATER' ? targetOwner : attackerOwner;
            const otherCard = waterCard === targetCard ? attackerCard : targetCard;
            this.state.discardPile.push(otherCard);

            // Move to next player clockwise
            const nextIdx = (attackerIndex + 1) % 4;
            const nextPlayer = this.state.players[nextIdx];

            if (nextPlayer.id === waterOwnerId) {
                // The water card survived a full loop and returned to the owner!
                // Successful defense!
                const defender = nextPlayer;
                defender.echo.push(waterCard);
                const scorePts = waterCard.value;
                defender.score += scorePts;
                this.state.battlefield = null;
                this.state.phase = 'LEAD';
                this.state.activePlayerIndex = nextIdx;
                this.log(`${defender.name} kendi ${waterCard.displayName} kartını başarıyla savundu ve +${scorePts} puan kazandı!`);
            } else {
                // Otherwise, the water card stays and the next player must attack it
                this.state.battlefield = { card: waterCard, ownerId: waterOwnerId };
                this.state.activePlayerIndex = nextIdx;
                this.state.phase = 'ATTACK';
                this.log(`${this.getPlayerById(waterOwnerId).name}'in ${waterCard.displayName} kartı sahada kalmaya devam ediyor.`);
            }
        } else {
            // Neutral — both discarded
            this.state.discardPile.push(attackerCard, targetCard);
            this.state.battlefield = null;
            this.state.phase = 'LEAD';
            // Pass the lead to the attacker to rotate turns fairly
            this.state.activePlayerIndex = attackerIndex;
            this.log('Kartlar etkisizleşti ve atıldı.');
        }
        this.state.round++;
    }

    checkGameOver() {
        // Game ends if ANY player has no cards left in their hand
        const anyEmpty = this.state.players.some(p => p.hand.length === 0);

        if (anyEmpty) {
            // Discard any card left on the battlefield
            if (this.state.battlefield) {
                this.state.discardPile.push(this.state.battlefield.card);
                this.state.battlefield = null;
            }

            // Penalize remaining cards for all players
            this.state.players.forEach(p => {
                if (p.hand.length > 0) {
                    const penalty = p.hand.reduce((sum, c) => sum + c.value, 0);
                    p.score = Math.max(0, p.score - penalty);
                    this.log(`${p.name} elinde ${p.hand.length} kartla yakalandı. -${penalty} ceza puanı.`);
                    this.state.discardPile.push(...p.hand);
                    p.hand = [];
                }
            });

            this.state.phase = 'GAME_OVER';
            this.determineWinner();
            return true;
        }

        return false;
    }

    determineWinner() {
        // Rank players by score (descending)
        const ranked = [...this.state.players].sort((a, b) => b.score - a.score);
        
        let msg = 'Oyun Bitti! Sıralama:\n';
        ranked.forEach((p, idx) => {
            msg += `${idx + 1}. ${p.name}: ${p.score} Puan\n`;
        });
        
        this.log(msg.trim());
        
        // Find if there is a tie or clear winner
        const highestScore = ranked[0].score;
        const winners = ranked.filter(p => p.score === highestScore);
        
        let winMsg = "";
        if (winners.length === 1) {
            winMsg = `🏆 Kazanan: ${winners[0].name} (${highestScore} Puan)`;
        } else {
            winMsg = `🤝 Beraberlik! Kazananlar: ${winners.map(w => w.name).join(', ')} (${highestScore} Puan)`;
        }

        this.emit('gameOver', {
            rankings: ranked,
            winners,
            msg: winMsg
        });
    }
}
