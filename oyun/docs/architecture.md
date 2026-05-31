# Echo: Elemental Chains — System Architecture

## 1. Overview

Echo: Elemental Chains is a turn-based strategic card game with elemental rock-paper-scissors mechanics. This document outlines the technical architecture for both the **web prototype** (current) and a recommended **mobile production** path.

---

## 2. Web Prototype Architecture (Current)

### Stack
- **HTML5** — Semantic game layout
- **Vanilla CSS3** — Design system with CSS custom properties, glassmorphism, keyframe animations
- **Vanilla JavaScript (ES6+)** — No frameworks, no build tools
- **Google Fonts** — Orbitron (display) + Inter (body)

### Module Structure

```
┌─────────────────────────────────────────────┐
│                index.html                    │
│        (Layout + DOM structure)              │
├─────────────────────────────────────────────┤
│  CSS Layer                                   │
│  ├── style.css      (Design system + layout)│
│  ├── cards.css      (Card components)        │
│  └── animations.css (Keyframes + transitions)│
├─────────────────────────────────────────────┤
│  JS Layer                                    │
│  ├── game-engine.js  (State + logic)         │
│  ├── ai-opponent.js  (AI decision engine)    │
│  ├── animations.js   (Particle VFX)          │
│  └── ui-controller.js(Rendering + events)    │
└─────────────────────────────────────────────┘
```

### Data Flow

```
User Click → UIController.onPlayerCardClick()
    → GameEngine.playCard()
        → GameEngine.resolve() (interaction table lookup)
        → GameEngine.applyResult() (state mutation)
        → emit('interaction') + emit('stateChange')
    → UIController.showInteraction() (overlay)
    → VFX.playInteractionVFX() (particles + flash)
    → User clicks "Continue"
    → UIController.dismissInteraction()
        → If AI's turn: scheduleAITurn()
            → AIOpponent.chooseCard()
            → GameEngine.playCard() → ... (same flow)
```

---

## 3. Mobile Production Architecture (Recommended)

### Option A: Unity + C# (Recommended)

**Why Unity:**
- Native 2D card game support with built-in animation system
- Cross-platform (iOS + Android) from single codebase
- DOTween for smooth card animations
- Particle system for elemental VFX
- Built-in UI system (uGUI or UI Toolkit)

**Architecture:**

```
┌─ Scripts/
│  ├── Core/
│  │   ├── Card.cs              (Card data model)
│  │   ├── Deck.cs              (Deck creation + shuffle)
│  │   ├── GameState.cs         (Immutable state snapshots)
│  │   └── InteractionTable.cs  (Static lookup dictionary)
│  ├── Engine/
│  │   ├── GameEngine.cs        (State machine + turn logic)
│  │   ├── InteractionResolver.cs (Calculates outcomes)
│  │   └── ScoringEngine.cs     (Points + Echo Sinergy)
│  ├── AI/
│  │   ├── AIOpponent.cs        (Strategy interface)
│  │   ├── EasyAI.cs            (Random play)
│  │   ├── MediumAI.cs          (Greedy matchup)
│  │   └── HardAI.cs            (Minimax / heuristic)
│  ├── UI/
│  │   ├── CardView.cs          (Card prefab controller)
│  │   ├── HandView.cs          (Fan layout manager)
│  │   ├── BattlefieldView.cs   (Center area)
│  │   ├── ScoreView.cs         (Score display)
│  │   └── InteractionPopup.cs  (Result overlay)
│  └── VFX/
│      ├── ElementalParticles.cs
│      └── CardAnimator.cs
```

### Option B: Flutter + Dart

Good for rapid cross-platform delivery with custom UI:
- `flame` package for game rendering
- Custom `Card` widgets with Hero animations
- Provider/Riverpod for state management

---

## 4. Core Interaction Code (C# Port)

```csharp
public enum Element { Air, Fire, Water, Earth }
public enum InteractionType { Predator, Prey, Neutral, Mirror }

public class Card {
    public int Id;
    public Element Element;
    public int Value;
}

public class InteractionResult {
    public InteractionType Type;
    public string Title;
    public string Description;
    public Card AttackerCard, TargetCard;
    public string WinnerPlayer; // "player", "ai", or null
    public int Points;
    public bool Capture;
    public bool WaterStays;
}

public static class InteractionTable {
    private static readonly Dictionary<(Element, Element), InteractionDef> Table = new() {
        { (Element.Air,   Element.Earth), new("PREDATOR", "attacker", (a,t) => a+t, true,  false) },
        { (Element.Air,   Element.Fire),  new("PREY",     "target",  (a,t) => t*2, true,  false) },
        { (Element.Air,   Element.Water), new("NEUTRAL",  null,      (a,t) => 0,   false, true)  },
        { (Element.Fire,  Element.Air),   new("PREDATOR", "attacker", (a,t) => a+t, true,  false) },
        { (Element.Fire,  Element.Water), new("PREY",     null,      (a,t) => 0,   false, true)  },
        { (Element.Fire,  Element.Earth), new("NEUTRAL",  null,      (a,t) => 0,   false, false) },
        { (Element.Water, Element.Fire),  new("PREDATOR", "attacker", (a,t) => a,   true,  false) },
        { (Element.Water, Element.Earth), new("PREY",     "target",  (a,t) => a+t, true,  false) },
        { (Element.Water, Element.Air),   new("NEUTRAL",  null,      (a,t) => 0,   false, false) },
        { (Element.Earth, Element.Water), new("PREDATOR", "attacker", (a,t) => a+t, true,  false) },
        { (Element.Earth, Element.Air),   new("PREY",     "target",  (a,t) => a+t, true,  false) },
        { (Element.Earth, Element.Fire),  new("NEUTRAL",  null,      (a,t) => 0,   false, false) },
    };

    public static InteractionResult Resolve(Card attacker, Card target,
        string attackerOwner, string targetOwner,
        List<Card> attackerEcho, List<Card> targetEcho) {

        // Echo Sinergy calculation
        int atkVal = attackerEcho.Any(c => c.Element == attacker.Element)
            ? (int)Math.Ceiling(attacker.Value * 1.5) : attacker.Value;
        int tgtVal = targetEcho.Any(c => c.Element == target.Element)
            ? (int)Math.Ceiling(target.Value * 1.5) : target.Value;

        // Mirror match
        if (attacker.Element == target.Element) {
            return ResolveMirror(attacker, target, attackerOwner, targetOwner, atkVal, tgtVal);
        }

        var def = Table[(attacker.Element, target.Element)];
        var winner = def.Winner == "attacker" ? attackerOwner
                   : def.Winner == "target"   ? targetOwner : null;
        return new InteractionResult {
            Type = Enum.Parse<InteractionType>(def.Type),
            WinnerPlayer = winner,
            Points = def.CalcPoints(atkVal, tgtVal),
            Capture = def.Capture,
            WaterStays = def.WaterStays
        };
    }
}
```

---

## 5. Scoring Logic

### Per-Turn Scoring Formula:

```
EffectiveValue = HasEchoSinergy ? ⌈BaseValue × 1.5⌉ : BaseValue

PREDATOR win:  Points = EffAttacker + EffTarget  (or special per element)
PREY loss:     Points go to target owner (varies per matchup)
NEUTRAL:       Points = 0
MIRROR win:    Points = EffWinner + EffLoser
MIRROR tie:    Points = 0
```

### Echo Sinergy Trigger:
- **Condition:** Player's Echo Collection contains ≥1 card of the same element as the card being played
- **Effect:** Card's value × 1.5 (ceiling) for that turn's scoring calculation
- **Stacks:** No — it's a flat 1.5× regardless of how many matching cards exist

### Final Score:
`Total Score = Σ(all turn points won by player)`

Winner = player with higher total score when all cards are played.
