/**
 * Echo: Elemental Chains — Visual Effects (4-Player Version)
 * Particle system and interaction animations.
 */
class VFX {
    static createParticles(x, y, color, count = 12, targetX = null, targetY = null) {
        for (let i = 0; i < count; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            
            let dx, dy;
            if (targetX !== null && targetY !== null) {
                // Shoot towards target with some spread
                const angle = Math.atan2(targetY - y, targetX - x) + (Math.random() * 0.4 - 0.2);
                const speed = 120 + Math.random() * 100;
                dx = Math.cos(angle) * speed;
                dy = Math.sin(angle) * speed;
            } else {
                // Circular explosion spread
                const angle = (Math.PI * 2 * i) / count + (Math.random() * 0.5);
                const dist = 60 + Math.random() * 80;
                dx = Math.cos(angle) * dist;
                dy = Math.sin(angle) * dist;
            }

            particle.style.cssText = `
                left: ${x}px; top: ${y}px;
                background: ${color};
                box-shadow: 0 0 6px ${color};
                --px: ${dx}px;
                --py: ${dy}px;
                --duration: ${0.6 + Math.random() * 0.6}s;
                width: ${4 + Math.random() * 4}px;
                height: ${4 + Math.random() * 4}px;
            `;
            document.body.appendChild(particle);
            setTimeout(() => particle.remove(), 1500);
        }
    }

    static clashFlash(element) {
        const flash = document.createElement('div');
        flash.className = `clash-flash ${element.toLowerCase()}`;
        document.body.appendChild(flash);
        setTimeout(() => flash.remove(), 700);
    }

    static sinergyBurst() {
        const burst = document.createElement('div');
        burst.className = 'sinergy-burst';
        document.body.appendChild(burst);
        setTimeout(() => burst.remove(), 900);
    }

    static scorePop(x, y, points, positive = true) {
        const pop = document.createElement('div');
        pop.className = 'score-pop';
        pop.textContent = positive ? `+${points}` : `${points}`;
        pop.style.cssText = `
            left: ${x}px; top: ${y}px;
            color: ${positive ? 'var(--accent-green)' : 'var(--accent-red)'};
        `;
        document.body.appendChild(pop);
        setTimeout(() => pop.remove(), 1300);
    }

    static playInteractionVFX(result, relativeSeat = 'top') {
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;

        // Flash in winner's element color
        const winnerElement = result.winnerPlayer
            ? (result.winnerPlayer === result.attackerOwner ? result.attackerCard.element : result.targetCard.element)
            : result.attackerCard.element;
        VFX.clashFlash(winnerElement);

        // Find target coordinates for winning seat to direct score/particle pops
        let tx = cx;
        let ty = cy;
        
        if (result.winnerPlayer) {
            if (relativeSeat === 'bottom') {
                tx = cx;
                ty = window.innerHeight - 100;
            } else if (relativeSeat === 'top') {
                tx = cx;
                ty = 100;
            } else if (relativeSeat === 'left') {
                tx = 160;
                ty = cy;
            } else if (relativeSeat === 'right') {
                tx = window.innerWidth - 160;
                ty = cy;
            }
        }

        const color = ELEMENT_META[winnerElement] ? ELEMENT_META[winnerElement].color : '#ffd740';
        
        // Spawn explosion particles in center
        setTimeout(() => VFX.createParticles(cx, cy, color, 12), 200);

        // Spawn stream particles shooting to the winner's seat
        if (result.winnerPlayer) {
            setTimeout(() => VFX.createParticles(cx, cy, color, 8, tx, ty), 350);
        }

        // Spawn score pop at the winning seat
        if (result.points > 0 && result.winnerPlayer) {
            setTimeout(() => VFX.scorePop(tx - 30, ty - 20, result.points, true), 500);
        }

        // Sinergy burst
        if (result.atkSinergy || result.tgtSinergy) {
            setTimeout(() => VFX.sinergyBurst(), 100);
        }
    }
}
