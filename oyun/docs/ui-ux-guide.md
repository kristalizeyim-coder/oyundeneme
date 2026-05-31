# Echo: Elemental Chains — UI/UX Design Guide

## 1. Screen Layout

The game interface is divided into three horizontal zones with side panels:

```
┌──────────────────────────────────────────────────────┐
│ [🤖 Rakip]  Score: 24  Echo: 5     [KOLAY ORTA ZOR] │
│         [?] [?] [?] [?] [?]  (AI Hand - face down)  │
├───────┬──────────────────────────────────┬────────────┤
│       │                                  │ Rakip Echo │
│ Oyun  │        SAVAŞ ALANI              │ [🌪️][🔥]  │
│Günlüğü│     ┌──────────────┐            │            │
│       │     │  🌪️ Hava     │            │            │
│ • ... │     │     7        │            │────────────│
│ • ... │     │    HAVA      │            │ Senin Echo │
│       │     └──────────────┘            │ [💧][⛰️]  │
│       │                                  │            │
├───────┴──────────────────────────────────┴────────────┤
│  [🔥8] [💧3] [⛰️K] [🌪️5] [💧9] [⛰️2] [🔥As]     │
│              ⚔️ Sen  Score: 18  Echo: 3              │
└──────────────────────────────────────────────────────┘
```

### Zone Descriptions

| Zone | Position | Purpose |
|------|----------|---------|
| AI Area | Top | Shows AI avatar, score, echo count, and face-down cards |
| Battlefield | Center | The circular arena where cards clash. Pulsing ring animation |
| Player Area | Bottom | Player's face-up hand cards and score info |
| Game Log | Left sidebar | Scrollable list of turn-by-turn event descriptions |
| Echo Panels | Right sidebar | Mini card icons showing each player's Echo Collection |
| Status Bar | Above battlefield | Context-aware text: "Sahaya bir kart koy", "Rakip düşünüyor..." |

---

## 2. Color System

### Element Palette

| Element | Primary | Dark | Glow/Shadow |
|---------|---------|------|-------------|
| 🌪️ AIR | `#00e5ff` | `#003d47` | `rgba(0,229,255,0.35)` |
| 🔥 FIRE | `#ff6d00` | `#4a1f00` | `rgba(255,109,0,0.35)` |
| 💧 WATER | `#448aff` | `#0d2444` | `rgba(68,138,255,0.35)` |
| ⛰️ EARTH | `#76ff03` | `#1e4400` | `rgba(118,255,3,0.35)` |

### UI Palette

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#06080f` | Main page background |
| Surface | `rgba(255,255,255,0.04)` | Panels, cards-back |
| Text Primary | `#e8eaf6` | Headings, card values |
| Text Secondary | `rgba(232,234,246,0.6)` | Descriptions, labels |
| Accent Gold | `#ffd740` | Scores, active states, sinergy |

---

## 3. Card Design

Each card is a **72×100px** rectangle (90×126px on battlefield) with:

1. **Corner values** — Top-left and bottom-right (rotated)
2. **Element emoji** — Center-top, with drop-shadow glow
3. **Value** — Center, large Orbitron font
4. **Element name** — Bottom, small uppercase text
5. **Background** — Dark gradient tinted with element color
6. **Border** — 1.5px element-colored, glows on hover
7. **Sinergy badge** — Gold "S" circle on top-right when Echo Sinergy is active

### Card States

| State | Visual |
|-------|--------|
| Default | Subtle glow, element-tinted background |
| Hover | Rise up 12px, scale 1.08×, brighter glow |
| Selected | Rise 20px, scale 1.12×, full glow, golden highlight |
| Disabled | 40% opacity, grayscale, no pointer events |
| Face-down | Diamond pattern back, muted colors |

---

## 4. Interaction Overlay

When cards clash, a full-screen overlay appears with:

1. **Title** — Interaction name with emoji (e.g., "🌪️ Hava Toprağı Aşındırdı!")
2. **Card comparison** — Mini cards side by side with "VS" between
3. **Description** — What happened in plain Turkish
4. **Sinergy notice** — Gold text if 1.5× was applied
5. **Points** — Green for player wins, red for AI wins, gray for neutral
6. **Continue button** — Dismisses overlay and continues game

### Animation Sequence

1. **0ms** — Flash effect in winner's element color
2. **200ms** — Particle burst from center (16 particles)
3. **400ms** — Score pop floating number
4. **500ms** — Overlay panel scales in (spring easing)

---

## 5. Animation Guidelines

### Micro-animations
- **Card deal**: Staggered entrance, 50ms between cards, spring bounce
- **Card play**: Scale+translate from hand to battlefield (600ms spring)
- **Battlefield ring**: Slow pulse every 4s (scale 1.0→1.04)
- **Active player**: Avatar pulsing glow ring (2s loop)
- **Twinkle stars**: Background star opacity oscillation (8s)

### Interaction VFX
- **Clash flash**: Radial gradient burst in element color (600ms)
- **Particles**: 12-16 dots flying outward, randomized angles/distances
- **Score pop**: Float upward with fade (1.2s)
- **Sinergy burst**: Expanding golden ring (800ms)

---

## 6. Typography

| Usage | Font | Weight | Size |
|-------|------|--------|------|
| Game title/headings | Orbitron | 700-900 | 20-32px |
| Scores | Orbitron | 900 | 22-48px |
| Card values | Orbitron | 900 | 18px (hand), 24px (field) |
| Labels & status | Orbitron | 600 | 10-13px |
| Body text | Inter | 400-500 | 11-14px |
| Log entries | Inter | 400 | 11px |

---

## 7. Responsive Behavior

| Breakpoint | Changes |
|------------|---------|
| > 900px | Full layout with side panels |
| ≤ 900px | Side panels hidden, hand spacing reduced |
| ≤ 600px | Smaller battlefield, tighter card gaps, compact overlay |

---

## 8. Accessibility Notes

- All interactive cards are keyboard-focusable (future enhancement)
- High contrast between card elements and backgrounds
- Status text always describes current action required
- Animations can be disabled via `prefers-reduced-motion` (future)
