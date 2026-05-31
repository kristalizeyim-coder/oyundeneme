/**
 * Echo: Elemental Chains — AI Opponent (4-Player Version)
 * Three difficulty levels: Easy, Medium, Hard
 */
class AIOpponent {
    constructor(difficulty = 'medium') {
        this.difficulty = difficulty; // 'easy' | 'medium' | 'hard'
    }

    // Choose a card to play based on difficulty
    chooseCard(gameState, aiPlayerId) {
        const player = gameState.players.find(p => p.id === aiPlayerId);
        if (!player) return null;

        const hand = player.hand;
        if (hand.length === 0) return null;

        switch (this.difficulty) {
            case 'easy':   return this.easyPlay(hand, gameState);
            case 'hard':   return this.hardPlay(hand, gameState, aiPlayerId);
            default:       return this.mediumPlay(hand, gameState, aiPlayerId);
        }
    }

    // EASY: Random card
    easyPlay(hand) {
        return hand[Math.floor(Math.random() * hand.length)];
    }

    // MEDIUM: Tries to pick winning matchups
    mediumPlay(hand, state, aiPlayerId) {
        if (state.phase === 'LEAD' || !state.battlefield) {
            // Lead with highest value card
            return hand.reduce((best, c) => c.value > best.value ? c : best, hand[0]);
        }

        const target = state.battlefield.card;
        const scored = this.scoreCards(hand, target, state, aiPlayerId);
        // Pick the best scoring card
        scored.sort((a, b) => b.score - a.score);
        return scored[0].card;
    }

    // HARD: Considers synergy, future turns, and minimizes opponent options
    hardPlay(hand, state, aiPlayerId) {
        const player = state.players.find(p => p.id === aiPlayerId);
        const echo = player ? player.echo : [];

        if (state.phase === 'LEAD' || !state.battlefield) {
            // Lead with a card that has synergy bonus if possible
            const sinergyCards = hand.filter(c => echo.some(e => e.element === c.element));
            if (sinergyCards.length > 0) {
                return sinergyCards.reduce((best, c) => c.value > best.value ? c : best, sinergyCards[0]);
            }
            // Otherwise lead with medium-value card (save high cards for attacks)
            const sorted = [...hand].sort((a, b) => a.value - b.value);
            return sorted[Math.floor(sorted.length / 2)];
        }

        const target = state.battlefield.card;
        const scored = this.scoreCards(hand, target, state, aiPlayerId);

        // Hard AI also considers synergy potential
        for (const s of scored) {
            if (echo.some(e => e.element === s.card.element)) {
                s.score += 5; // Bonus for synergy
            }
        }

        scored.sort((a, b) => b.score - a.score);
        return scored[0].card;
    }

    // Score each card against the target
    scoreCards(hand, targetCard, state, aiPlayerId) {
        const aiPlayer = state.players.find(p => p.id === aiPlayerId);
        const targetPlayer = state.players.find(p => p.id === state.battlefield.ownerId);

        const aiEcho = aiPlayer ? aiPlayer.echo : [];
        const tgtEcho = targetPlayer ? targetPlayer.echo : [];

        return hand.map(card => {
            let score = 0;

            // Compute effective values including synergy
            const cardSinergy = aiEcho.some(e => e.element === card.element);
            const targetSinergy = tgtEcho.some(e => e.element === targetCard.element);

            const atkVal = cardSinergy ? Math.ceil(card.value * 1.5) : card.value;
            const tgtVal = targetSinergy ? Math.ceil(targetCard.value * 1.5) : targetCard.value;

            // Joker logic
            if (card.element === 'JOKER') {
                if (targetCard.element === 'JOKER') {
                    score = -5; // Joker vs Joker is a waste (both discarded, no points)
                } else {
                    score = JOKER_POINTS + 10; // High priority to play Joker to win
                }
                return { card, score };
            }

            if (targetCard.element === 'JOKER') {
                // Attacking into a Joker is a guaranteed loss
                score = -20;
                return { card, score };
            }

            if (card.element === targetCard.element) {
                // Mirror: higher effective value wins, score = sum of both
                score = atkVal > tgtVal ? atkVal + tgtVal : -atkVal;
            } else {
                const key = `${card.element}_${targetCard.element}`;
                const inter = INTERACTIONS[key];
                if (inter) {
                    if (inter.type === 'PREDATOR') {
                        // We win! Score is the points we gain
                        score = inter.pts(atkVal, tgtVal) + 10;
                    } else if (inter.type === 'PREY' && inter.winner === 'target') {
                        // Target wins (we lose). Negative score
                        score = -inter.pts(atkVal, tgtVal);
                    } else if (inter.type === 'PREY') {
                        // Water stays cases — not terrible but no capture
                        score = -2;
                    } else {
                        // Neutral (both discarded) — slight negative
                        score = -1;
                    }
                }
            }
            return { card, score };
        });
    }
}
