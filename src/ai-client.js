/**
 * AI呼び出し — Spec Step 4
 * プロンプトSpec駆動: 解説禁止・転用必須・5モジュール固定・事実/解釈/価値を分ける・
 * 反対側必須・次の一手は1つ・Tone遵守
 */

import { parseAndValidate } from './schema.js';
import { qualityGate } from './quality-gate.js';
import { createFallback } from './fallback.js';

const MODE_LABELS = {
  admin: '行政・政策',
  gym: 'ジム経営・フィットネス',
  product: 'プロダクト開発',
  personal: '個人の意思決定',
};

const TONE_LABELS = [
  '超カジュアル（友達に話す感じ）',
  'カジュアル（後輩に説明する感じ）',
  '標準（ビジネス会話）',
  'フォーマル（上司への報告）',
  '超フォーマル（公式文書）',
];

const API_TIMEOUT_MS = 30000; // 30秒タイムアウト

/**
 * メインプロンプトを構築
 */
function buildPrompt(fact, mode, tone, variant = 'normal') {
  const modeLabel = MODE_LABELS[mode] || mode;
  const toneLabel = TONE_LABELS[tone] ?? TONE_LABELS[2];

  let extraInstruction = '';
  if (variant === 'alternative') {
    extraInstruction = `
【追加指示】前回と異なる角度・切り口で回答せよ。同じ結論でも、根拠や視点を変えること。`;
  } else if (variant === 'strong_counter') {
    extraInstruction = `
【追加指示】counterモジュールを特に強化せよ。反論を最も手強い相手が言いそうな内容にし、処理（潰し方）も具体的かつ詳細にすること。`;
  }

  return `あなたは「武器メモ / 次の一手メーカー」です。

【絶対ルール】
- 解説・前置き・お世辞は一切禁止。結論から入れ。
- 転用（別分野への応用）を必ず含めよ。
- 事実 / 解釈 / 価値（判断）を明確に分けよ。
- 以下のNGワードを絶対に使うな：「大事」「重要」「バランス」「総合的」「注視」「検討」「様子見」「慎重に」「引き続き」「多角的」「適切に」「一概には」「今後の動向」「見守る」「留意」「踏まえ」「鑑み」
- 「次の一手」は必ず「今日、具体的にやること1つ」にせよ。抽象的な表現は禁止。

【入力】
- Fact: ${fact}
- Mode（領域）: ${modeLabel}
- Tone: ${toneLabel}

【出力形式】
必ず以下のJSON形式のみで出力せよ。JSON以外のテキストを一切含めるな。

{
  "ichigeki": "（1文の結論。刺さる一言）",
  "branching": [
    "条件1：〇〇の場合 → △△",
    "条件2：〇〇の場合 → △△",
    "条件3：〇〇の場合 → △△"
  ],
  "onepager": [
    "第1章【状況】：...",
    "第2章【問題】：...",
    "第3章【仮説】：...",
    "第4章【検証】：...",
    "第5章【結論】：...",
    "第6章【行動】：..."
  ],
  "counter": {
    "objection": "反論：（最も手強い反論を書け）",
    "response": "処理：（その反論の潰し方を具体的に書け）"
  },
  "next_action": "今日やること：（具体的な行動1つ。数字・期限・対象を含めよ）"
}
${extraInstruction}`;
}

/**
 * AI APIを呼び出す（30秒タイムアウト付き）
 * apiKey がなければデモデータを返す（開発用）
 */
async function callAI(prompt, apiKey, variant) {
  if (!apiKey) {
    return getDemoResponse(variant);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const text = result.content?.[0]?.text || '';

    // JSON部分を抽出（余計なテキストがあっても対応）
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AIの応答にJSONが含まれていない');
    }
    return jsonMatch[0];
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * デモ用レスポンス（variant別に異なるデータを返す）
 */
function getDemoResponse(variant) {
  if (variant === 'alternative') {
    return JSON.stringify({
      ichigeki: '減税の中身より「発表の順番」で勝敗が決まる。',
      branching: [
        '条件1：財源とセットで発表した場合 → メディアが「実行力」と報じ、支持率が上昇する',
        '条件2：減税額だけ先に出した場合 → 「バラマキ」と叩かれ、野党が財源追及に集中する',
        '条件3：党内調整を優先した場合 → 「決められない内閣」の烙印が押される',
      ],
      onepager: [
        '第1章【状況】：高市内閣は年内減税を公約したが、発表の順番を決めていない',
        '第2章【問題】：何を言うかより、どの順番で出すかが世論を左右する',
        '第3章【仮説】：「財源→減税額→施行日」の順番で出せば、反対派の攻撃余地がなくなる',
        '第4章【検証】：安倍政権の消費税延期は「先に経済指標を出し、延期を後出し」で成功した',
        '第5章【結論】：発表の順番を「根拠→結論→行動」に設計することが最優先',
        '第6章【行動】：発表スケジュールを3段階で設計し、各段階のメディア想定反応を書き出す',
      ],
      counter: {
        objection: '反論：「順番なんか関係ない。中身が良ければ支持される。演出より政策の実質で勝負すべきだ」',
        response: '処理：過去10年の主要政策発表を分析すると、同じ内容でも発表順序で報道のトーンが180度変わった事例が6件ある。実質と演出は二者択一ではなく、実質を活かすために順番が必要。',
      },
      next_action: '今日やること：過去1年の閣議決定の報道を3件選び、「発表順序」と「報道トーン」の対応を15分で表にまとめる。',
    });
  }

  if (variant === 'strong_counter') {
    return JSON.stringify({
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
        objection: '反論：「財源がない。社会保障費が毎年1兆円膨張する中で減税は不可能。仮にやれば国債格付けが下がり、金利上昇で住宅ローン破綻者が続出する。減税で浮く年3万円のために、金利上昇で年12万円の負担増になる。国民は差し引きマイナスだ」',
        response: '処理：(1)減税規模を「GDP比0.3%以内」に限定し格付け機関の閾値に収める。(2)社会保障費は別会計で手当済みであることを歳出内訳で証明する。(3)金利上昇シナリオの前提（日銀利上げ幅）を明示し、0.25%利上げでは住宅ローン月額増が2,100円にとどまることを試算で示す。(4)「GDP成長率2%未満で自動停止」のサンセット条項を法案に組み込む。',
      },
      next_action: '今日やること：財務省の「国債残高と金利の関係」資料を1つ特定し、減税規模0.3%でのシミュレーション結果を数字で確認する（20分以内）。',
    });
  }

  // normal
  return JSON.stringify({
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
  });
}

/**
 * メイン生成フロー
 * スキーマ検証 → Quality Gate → 再生成(最大2回) → フォールバック
 * @returns {{ data: object, meta: { attempt: number, fallback: boolean, gateLog: string[] } }}
 */
export async function generate(fact, mode, tone, apiKey, variant = 'normal') {
  const MAX_RETRY = 2;
  const gateLog = [];

  for (let attempt = 1; attempt <= MAX_RETRY + 1; attempt++) {
    gateLog.push(`--- 試行 ${attempt} ---`);

    try {
      const prompt = buildPrompt(fact, mode, tone, variant);
      const raw = await callAI(prompt, apiKey, variant);
      const { data, valid, errors } = parseAndValidate(raw);

      if (!valid) {
        gateLog.push(`スキーマ違反: ${errors.join('; ')}`);
        continue;
      }

      gateLog.push('スキーマ検証: OK');

      const gate = qualityGate(data);
      if (!gate.pass) {
        gateLog.push(`Quality Gate失格: ${gate.reasons.join('; ')}`);
        continue;
      }

      gateLog.push('Quality Gate: PASS');
      return { data, meta: { attempt, fallback: false, gateLog } };
    } catch (e) {
      gateLog.push(`エラー: ${e.message}`);
    }
  }

  // フォールバック
  gateLog.push('--- フォールバック発動 ---');
  const data = createFallback(fact);
  return { data, meta: { attempt: MAX_RETRY + 1, fallback: true, gateLog } };
}

export { buildPrompt, MODE_LABELS, TONE_LABELS };
