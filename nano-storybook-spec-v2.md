# nano-storybook-spec v2

## Overview

A zero-dependency, single-page Storybook for the **memonomaryoku** (武器メモ / 次の一手メーカー) PWA.
No React, no framework, no build step. One `index.html` that imports the app's CSS and renders every UI component in isolation.

Repository: `jun-kou-dai/storybook`

---

## Goals

1. **Visual catalog** — Every UI component visible on one page, grouped by category
2. **State variants** — Each component shown in all meaningful states (default, active, disabled, error, etc.)
3. **Zero build** — Open `index.html` directly or serve with any static server
4. **Copy-paste CSS** — Import `style.css` from memonomaryoku as-is; no duplication
5. **Lightweight** — < 500 lines total (HTML + inline JS)

---

## Component Inventory

### Category: Layout
| # | Component | States |
|---|-----------|--------|
| 1 | Header | default |
| 2 | Container | default |

### Category: Input
| # | Component | States |
|---|-----------|--------|
| 3 | Fact Textarea | empty, filled, focused |
| 4 | Mode Select | default options, custom selected (shows text input) |
| 5 | Tone Slider | min(0), mid(2), max(4) |
| 6 | API Key Input | empty, filled, with test button |

### Category: Buttons
| # | Component | States |
|---|-----------|--------|
| 7 | Primary Button (生成) | default, hover, disabled |
| 8 | Secondary Button (別案) | default, hover, disabled |
| 9 | Danger Button (反対側強め) | default, hover, disabled |
| 10 | Clear Button (クリア) | default, hover, disabled |
| 11 | API Test Button (接続テスト) | default, testing |

### Category: Feedback
| # | Component | States |
|---|-----------|--------|
| 12 | Loading Spinner | active |
| 13 | Error Message | active |
| 14 | Demo Banner | normal, alternative, strong_counter |
| 15 | Fallback Warning | active |

### Category: Flow Diagram
| # | Component | States |
|---|-----------|--------|
| 16 | Flow Diagram | default, OK highlight, retry highlight, fallback highlight |

### Category: Cards
| # | Component | States |
|---|-----------|--------|
| 17 | Card: Ichigeki (#1) | with demo data |
| 18 | Card: Branching (#2) | with 3 branch items |
| 19 | Card: Onepager (#3) | with 6 chapter items |
| 20 | Card: Counter (#4) | with objection + response |
| 21 | Card: Next Action (#5) | with demo data |
| 22 | Copy Button | default, copied |

### Category: Meta
| # | Component | States |
|---|-----------|--------|
| 23 | Meta Info | attempt 1, fallback badge |
| 24 | Gate Log | with sample log entries |
| 25 | API Test Result | testing, success, failure |

---

## Page Structure

```
┌─────────────────────────────────────────┐
│  nano-storybook: 武器メモ               │  ← Storybook header
├─────────────────────────────────────────┤
│  [sidebar]          │  [main area]      │
│  ├ Layout           │  ┌─────────────┐  │
│  │  Header          │  │ Story title  │  │
│  │  Container       │  │ ─────────── │  │
│  ├ Input            │  │ Component   │  │
│  │  Fact Textarea   │  │ rendered    │  │
│  │  Mode Select     │  │ here        │  │
│  │  ...             │  └─────────────┘  │
│  ├ Buttons          │  ┌─────────────┐  │
│  │  ...             │  │ Next story  │  │
│  ├ Feedback         │  │ ...         │  │
│  ├ Flow Diagram     │  └─────────────┘  │
│  ├ Cards            │                   │
│  └ Meta             │                   │
└─────────────────────────────────────────┘
```

- **Sidebar**: Clickable nav links grouped by category. Click scrolls to that story.
- **Main area**: Each story is a `<section>` with a title, description, and the rendered component.

---

## File Structure (storybook repo)

```
storybook/
├── index.html          # The nano-storybook page
├── stories.js          # Story definitions (data + render functions)
├── nano-storybook.js   # Sidebar nav, scroll, story rendering engine
├── nano-storybook.css  # Storybook-specific layout (sidebar, story containers)
└── README.md           # Not created by default; optional
```

### CSS Loading

The storybook page loads **two** stylesheets:
1. `nano-storybook.css` — Layout for sidebar + story containers (storybook chrome)
2. The app's `style.css` — Loaded via `<link>` from a relative path or CDN

Since the storybook repo is separate from memonomaryoku, the app CSS is embedded inline (copied at build time or inlined in the HTML) to keep it zero-dependency.

---

## Story Definition Format

Each story in `stories.js` is an object:

```js
export const stories = [
  {
    id: 'header',
    title: 'Header',
    category: 'Layout',
    description: 'App header with gradient title and subtitle',
    render: (container) => {
      container.innerHTML = `
        <div class="header">
          <h1>武器メモ / 次の一手メーカー</h1>
          <p>事実を1文入力するだけで、議論に使える5枚の「武器カード」を自動生成します</p>
        </div>
      `;
    },
  },
  // ...
];
```

- `id`: URL-friendly identifier (used for scroll target)
- `title`: Display name
- `category`: Grouping key for sidebar
- `description`: What this story demonstrates
- `render(container)`: Function that populates the container DOM element

---

## Rendering Engine (nano-storybook.js)

1. Import `stories` from `stories.js`
2. Group stories by `category`
3. Build sidebar nav from grouped stories
4. For each story, create a `<section>` in main area:
   ```html
   <section id="story-{id}" class="story">
     <h2 class="story-title">{title}</h2>
     <p class="story-desc">{description}</p>
     <div class="story-canvas"></div>
   </section>
   ```
5. Call `story.render(canvas)` for each story
6. Sidebar click → `scrollIntoView({ behavior: 'smooth' })`

---

## Demo Data

Stories use hardcoded demo data from the app's fallback/demo system. Example for cards:

```js
const DEMO_DATA = {
  ichigeki: '勝負は「やるか」じゃなく「工程を先に見せるか」で決まる。',
  branching: [
    '条件1：施行日＋財源が明示された場合 → 支持率は維持される',
    '条件2：「先送り」発言が増えた場合 → 信頼が急落し野党に攻撃材料を与える',
    '条件3：給付が主語になった場合 → 減税の本質から逸れて迷走する',
  ],
  onepager: [
    '第1章【状況】：高市内閣は「年内減税」を掲げたが、具体的工程が未公表',
    '第2章【問題】：「やるかやらないか」の議論に終始し、「いつ・いくら・財源は」が欠落',
    '第3章【仮説】：有権者は「減税の有無」より「計画の具体性」で政権を評価する',
    '第4章【検証】：過去3政権の支持率推移を見ると、具体的数字を出した直後に支持率が上昇している',
    '第5章【結論】：施行日と財源を同時に出すことが唯一の勝ち筋',
    '第6章【行動】：今週中に「施行日＋財源＋中止条件」の3点セットを発表する',
  ],
  counter: {
    objection: '反論：「財源がないなら絵空事。赤字国債を増やすだけなら無責任だ」',
    response: '処理：出口条件と中止条件を工程に入れる。「GDP成長率がX%を下回ったら自動停止」のトリガーを設計し、財政規律との両立を示す。',
  },
  next_action: '今日やること：高市内閣の減税発言を3つの一次ソースで確認し、「施行日＋財源」が出ているかだけチェックする（15分以内）。',
};
```

---

## Design Constraints

- **Dark theme only** — Matches the app's dark theme (`--bg-primary: #0f0f1a`)
- **No framework** — Vanilla JS, no imports beyond the two local modules
- **No npm / no node_modules** — Everything is `<script type="module">` with relative imports
- **Mobile responsive** — Sidebar collapses to horizontal tabs on narrow screens
- **Self-contained** — Works offline after initial load

---

## v2 Changes (from v1)

- Sidebar navigation with category grouping (v1 was a flat list)
- Each story has a description field
- Flow diagram shown in all 4 states (v1 only showed default)
- Card stories use real demo data from the app (v1 used placeholder text)
- API test result component added
- Custom mode input story added
- Storybook CSS is separated from story render logic
