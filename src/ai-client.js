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

const JSON_FORMAT = `
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
}`;

const NG_WORDS = '「大事」「重要」「バランス」「総合的」「注視」「検討」「様子見」「慎重に」「引き続き」「多角的」「適切に」「一概には」「今後の動向」「見守る」「留意」「踏まえ」「鑑み」';

/**
 * variant ごとの temperature
 */
function getTemperature(variant) {
  if (variant === 'alternative') return 1.2;
  if (variant === 'strong_counter') return 0.9;
  return 0.8;
}

/**
 * メインプロンプトを構築（variant ごとに全体を書き分け）
 */
function buildPrompt(fact, mode, tone, variant = 'normal') {
  const modeLabel = MODE_LABELS[mode] || mode;
  const toneLabel = TONE_LABELS[tone] ?? TONE_LABELS[2];

  if (variant === 'alternative') {
    return buildAlternativePrompt(fact, modeLabel, toneLabel);
  }
  if (variant === 'strong_counter') {
    return buildStrongCounterPrompt(fact, modeLabel, toneLabel);
  }
  return buildNormalPrompt(fact, modeLabel, toneLabel);
}

function buildNormalPrompt(fact, modeLabel, toneLabel) {
  return `あなたは「武器メモ / 次の一手メーカー」です。

【絶対ルール】
- 解説・前置き・お世辞は一切禁止。結論から入れ。
- 転用（別分野への応用）を必ず含めよ。
- 事実 / 解釈 / 価値（判断）を明確に分けよ。
- 以下のNGワードを絶対に使うな：${NG_WORDS}
- 「次の一手」は必ず「今日、具体的にやること1つ」にせよ。抽象的な表現は禁止。

【入力】
- Fact: ${fact}
- Mode（領域）: ${modeLabel}
- Tone: ${toneLabel}

【出力形式】
必ず以下のJSON形式のみで出力せよ。JSON以外のテキストを一切含めるな。
${JSON_FORMAT}`;
}

function buildAlternativePrompt(fact, modeLabel, toneLabel) {
  return `あなたは「武器メモ / 次の一手メーカー【逆張りモード】」です。

【このモードの目的】
通常の分析とは「真逆の立場」「少数派の視点」「一般的でない切り口」から武器カードを作れ。
多数派が見落としている盲点を突く内容にせよ。

【思考の方向】
- 通常なら「A」と結論づけるところを、あえて「Aではない」理由を探せ
- 一般的に正しいとされる意見の裏側を掘れ
- 「そもそもこの問い自体が間違っている」という可能性を検討せよ
- 他の分野・時代・国の事例から意外な類似パターンを持ってこい

【絶対ルール】
- 解説・前置き・お世辞は一切禁止。結論から入れ。
- 転用（別分野への応用）を必ず含めよ。
- 事実 / 解釈 / 価値（判断）を明確に分けよ。
- 以下のNGワードを絶対に使うな：${NG_WORDS}
- 「次の一手」は必ず「今日、具体的にやること1つ」にせよ。抽象的な表現は禁止。
- 「一撃」は通常の分析では出てこない、意外性のある結論にせよ。

【入力】
- Fact: ${fact}
- Mode（領域）: ${modeLabel}
- Tone: ${toneLabel}

【出力形式】
必ず以下のJSON形式のみで出力せよ。JSON以外のテキストを一切含めるな。
${JSON_FORMAT}`;
}

function buildStrongCounterPrompt(fact, modeLabel, toneLabel) {
  return `あなたは「武器メモ / 次の一手メーカー【最強反論モード】」です。

【このモードの目的】
このFactに対して、最も手強い敵・反対派・批判者の立場から分析せよ。
まず「一番痛い反論」を考え、それを軸に全カードを構成しろ。

【思考の順序（通常と逆）】
1. まずcounterを考えろ：この主張を潰しにくる最強の反論者は誰か？その人は何と言うか？
2. 次にbranchingを考えろ：反論者が突いてくる「条件」は何か？
3. そしてonepagerを考えろ：反論を受けた上で、それでも成立する論理構成にせよ
4. ichigekiは「反論を踏まえた上での最終結論」にせよ
5. next_actionは「反論に備えるための今日の行動」にせよ

【counterの特別ルール】
- objection: 反論は3文以上、具体的な数字・事例・論理を含めよ。「〜かもしれない」は禁止。断言調で書け。
- response: 潰し方も3文以上。(1)(2)(3)で番号付きの反撃を書け。

【絶対ルール】
- 解説・前置き・お世辞は一切禁止。結論から入れ。
- 転用（別分野への応用）を必ず含めよ。
- 事実 / 解釈 / 価値（判断）を明確に分けよ。
- 以下のNGワードを絶対に使うな：${NG_WORDS}
- 「次の一手」は必ず「今日、具体的にやること1つ」にせよ。抽象的な表現は禁止。

【入力】
- Fact: ${fact}
- Mode（領域）: ${modeLabel}
- Tone: ${toneLabel}

【出力形式】
必ず以下のJSON形式のみで出力せよ。JSON以外のテキストを一切含めるな。
${JSON_FORMAT}`;
}

/**
 * AI呼び出し — Gemini API
 * apiKey がなければデモデータを返す
 * モデルフォールバック: gemini-2.5-flash → gemini-2.0-flash
 */
const MODEL_CHAIN = ['gemini-2.5-flash', 'gemini-2.0-flash'];

async function callAI(prompt, apiKey, variant, mode) {
  if (!apiKey) {
    return getDemoResponse(variant, mode);
  }

  let lastError = null;

  for (const model of MODEL_CHAIN) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: getTemperature(variant),
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const msg = err.error?.message || `${response.status} ${response.statusText}`;
        lastError = new Error(`[${model}] ${msg}`);
        continue; // 次のモデルを試す
      }

      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // JSON部分を抽出（余計なテキストがあっても対応）
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        lastError = new Error(`[${model}] AIの応答にJSONが含まれていない`);
        continue;
      }
      return jsonMatch[0];
    } catch (e) {
      lastError = new Error(`[${model}] ${e.message}`);
      continue;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError || new Error('全モデルで失敗');
}

/**
 * デモ用レスポンス（variant × mode で異なるデータを返す）
 */
function getDemoResponse(variant, mode) {
  const demos = getDemoDataByMode(mode);
  if (variant === 'alternative') return JSON.stringify(demos.alternative);
  if (variant === 'strong_counter') return JSON.stringify(demos.strong_counter);
  return JSON.stringify(demos.normal);
}

function getDemoDataByMode(mode) {
  if (mode === 'gym') {
    return {
      normal: {
        ichigeki: '会員が辞めるのは「飽きた」からじゃない。「成果が見えない」からだ。',
        branching: [
          '条件1：入会3ヶ月以内に体組成の変化を数字で見せた場合 → 継続率が2倍になる',
          '条件2：トレーナーが月1回もフィードバックしない場合 → 半年以内に80%が退会する',
          '条件3：SNSで会員の成果を発信した場合 → 紹介入会が月3件増える',
        ],
        onepager: [
          '第1章【状況】：月間退会率が5%を超えている',
          '第2章【問題】：入会時の目標設定が曖昧で、達成感を感じるポイントがない',
          '第3章【仮説】：「4週間で変わる」短期ゴールを設定すれば退会率が下がる',
          '第4章【検証】：4週間チャレンジを試した店舗では退会率が3%→1.5%に改善',
          '第5章【結論】：短期の成功体験を仕組み化することが最優先',
          '第6章【行動】：来月から「4週間チャレンジ」を全会員に提案する',
        ],
        counter: {
          objection: '反論：「うちはパーソナルじゃないから個別対応は無理。スタッフも足りない」',
          response: '処理：全員に個別対応する必要はない。入会時に体組成を計測し、4週間後に再計測するだけ。1人5分で済む。計測結果をLINEで送れば自動化できる。',
        },
        next_action: '今日やること：今月の退会者リスト10名の「入会からの経過月数」と「最後の来店日」を15分で集計する。',
      },
      alternative: {
        ichigeki: '「立地が悪い」は言い訳。SNSの投稿1本で商圏は3倍になる。',
        branching: [
          '条件1：会員のビフォーアフター写真を週1で投稿した場合 → フォロワーが月200人増える',
          '条件2：設備の写真だけ投稿した場合 → 誰も反応しない',
          '条件3：トレーナーの日常を投稿した場合 → 親近感は出るが入会には繋がらない',
        ],
        onepager: [
          '第1章【状況】：月間新規入会が10件を下回っている',
          '第2章【問題】：広告費をかけてもチラシの反応率が0.1%以下',
          '第3章【仮説】：「実際の成果」を見せる投稿だけが入会に直結する',
          '第4章【検証】：ビフォーアフター投稿を始めたジムは3ヶ月で問い合わせ3倍',
          '第5章【結論】：成果が見える投稿だけに集中すべき',
          '第6章【行動】：今週中に許可をもらった会員3名のビフォーアフター写真を撮影する',
        ],
        counter: {
          objection: '反論：「会員の写真を出すのはプライバシーの問題がある。トラブルになったら責任取れるのか」',
          response: '処理：書面で許可を取れば法的問題はない。同意書のテンプレートは5分で作れる。顔を出さず体のラインだけでも効果は十分。実際にやっているジムでクレームはゼロ。',
        },
        next_action: '今日やること：常連会員3人に「成果写真を使わせてください」と声をかけ、1人でもOKをもらう。',
      },
      strong_counter: {
        ichigeki: 'プロテインを売るな。「結果が出る仕組み」を売れ。',
        branching: [
          '条件1：月額プランに栄養指導をセットにした場合 → 客単価が40%上がる',
          '条件2：物販（プロテイン等）に頼った場合 → 利益率は高いが信頼を失う',
          '条件3：オンラインコースを追加した場合 → 来店しない日も課金される仕組みになる',
        ],
        onepager: [
          '第1章【状況】：客単価が月8,000円で頭打ち',
          '第2章【問題】：価格競争に巻き込まれ、値下げ以外の差別化ができていない',
          '第3章【仮説】：「月額+成果保証」モデルなら単価1.5万円でも選ばれる',
          '第4章【検証】：成果保証プラン（3ヶ月で変わらなければ返金）を導入した店舗は解約率ゼロ',
          '第5章【結論】：成果にコミットする姿勢を料金体系で示すことが差別化の本質',
          '第6章【行動】：来週までに「3ヶ月集中コース＋成果保証」のプラン案と原価計算を作る',
        ],
        counter: {
          objection: '反論：「成果保証なんて無理。会員がサボったら結果は出ない。返金リスクが大きすぎる。人件費を考えたら赤字になる。現実的じゃない」',
          response: '処理：(1)成果保証の条件に「週2回以上来店」「食事記録を週5日提出」を入れ、努力しない人は対象外にする。(2)過去データを分析すると、週2回来店する会員の90%は3ヶ月で体脂肪率が2%以上減少している。返金リスクは実質10%以下。(3)保証プランは通常の1.8倍の価格設定なので、返金が10%発生しても利益は通常プランより高い。',
        },
        next_action: '今日やること：過去6ヶ月の会員データから「週2回以上来店した人」の体組成変化を20分で集計し、成果保証の返金リスクを数字で出す。',
      },
    };
  }

  if (mode === 'product') {
    return {
      normal: {
        ichigeki: 'ユーザーが使わない機能を作るな。使われている機能を磨け。',
        branching: [
          '条件1：リリース前にユーザー5人でテストした場合 → 手戻りが70%減る',
          '条件2：社内レビューだけで進めた場合 → 「誰も使わない機能」が量産される',
          '条件3：競合の機能をコピーした場合 → 差別化できず価格競争に巻き込まれる',
        ],
        onepager: [
          '第1章【状況】：直近3ヶ月のリリースで、利用率10%未満の機能が4つある',
          '第2章【問題】：「あったら便利」で機能を追加し、実際の利用データを見ていない',
          '第3章【仮説】：利用率上位3機能の改善に集中すればNPSが上がる',
          '第4章【検証】：利用率1位の検索機能を改善した結果、NPSが15pt上昇した',
          '第5章【結論】：新機能より既存機能の改善がROI最大',
          '第6章【行動】：今週のスプリントから新機能開発を凍結し、改善チケットに切り替える',
        ],
        counter: {
          objection: '反論：「新機能を出さないと競合に負ける。営業からも機能追加の要望が山積みだ」',
          response: '処理：営業要望の上位10件を利用データと照合すると、既存機能の改善で7件は解決する。残り3件だけ新規開発すれば工数は1/3になる。',
        },
        next_action: '今日やること：プロダクトの機能一覧と過去30日の利用率を出し、利用率ワースト3と上位3を特定する（30分以内）。',
      },
      alternative: {
        ichigeki: 'スプリントの速度を上げるな。「何を作らないか」を決めろ。',
        branching: [
          '条件1：バックログの50%を削除した場合 → チームの集中力が上がり、リリース速度が2倍になる',
          '条件2：要望を全て受け入れた場合 → 全部中途半端になり、どれも完成しない',
          '条件3：四半期ごとに方針を変えた場合 → エンジニアが疲弊して離職率が上がる',
        ],
        onepager: [
          '第1章【状況】：バックログに200件以上のチケットが溜まっている',
          '第2章【問題】：優先度の基準が曖昧で、声の大きい人の要望が優先される',
          '第3章【仮説】：「売上への影響額」で優先度を数値化すれば判断基準が統一される',
          '第4章【検証】：影響額ベースで並べ替えた結果、上位20%で売上の80%をカバーできた',
          '第5章【結論】：バックログの80%は捨てていい',
          '第6章【行動】：今週中にバックログ全件に売上影響額を記入し、下位80%をアーカイブする',
        ],
        counter: {
          objection: '反論：「チケットを捨てたら要望を出した顧客が怒る。CSチームが対応できなくなる」',
          response: '処理：捨てるのではなく「アーカイブ」する。顧客には「優先度を見直し中」と伝える。実際、6ヶ月放置されたチケットの90%は、顧客自身がもう気にしていない。',
        },
        next_action: '今日やること：バックログの最終更新日を確認し、6ヶ月以上未着手のチケット数を数える（15分以内）。',
      },
      strong_counter: {
        ichigeki: 'PMが全部決めるな。ユーザーに「選ばせて」データで決めろ。',
        branching: [
          '条件1：A/Bテストで判断した場合 → 社内政治が消え、最適な選択ができる',
          '条件2：HiPPO（最も偉い人の意見）で決めた場合 → 失敗しても誰も責任を取らない',
          '条件3：ユーザーアンケートだけで決めた場合 → 「欲しい」と「使う」は別物なので外れる',
        ],
        onepager: [
          '第1章【状況】：機能の優先順位が経営会議で決まり、データが活用されていない',
          '第2章【問題】：意思決定が属人的で再現性がなく、成功しても理由がわからない',
          '第3章【仮説】：全ての機能判断にA/Bテストを導入すれば成功率が上がる',
          '第4章【検証】：直近のA/Bテスト3件はすべて事前予測と逆の結果が出た',
          '第5章【結論】：直感は当てにならない。テストで検証できる文化を作ることが先',
          '第6章【行動】：来月のリリース候補3件すべてにA/Bテスト計画を付ける',
        ],
        counter: {
          objection: '反論：「A/Bテストには時間がかかる。スタートアップはスピードが命だ。いちいちテストしていたら競合に先を越される。直感で素早く出して市場で検証すればいい」',
          response: '処理：(1)A/Bテストの最短期間は1週間。1週間待てないスピード感なら、そもそも何を出しても検証できない。(2)「市場で検証」のコストは、A/Bテストの10倍。失敗リリースの巻き戻し工数・ユーザー離脱・ブランド毀損を含めると、テストの方が圧倒的に安い。(3)競合に先を越されるリスクより、間違った機能をリリースするリスクの方が致命的。',
        },
        next_action: '今日やること：直近リリースした機能3つの利用率データを出し、事前の期待値とのズレを1ページでまとめる（20分以内）。',
      },
    };
  }

  if (mode === 'personal') {
    return {
      normal: {
        ichigeki: '迷っている時間が一番高い。決断のコストは「先送りのコスト」より常に安い。',
        branching: [
          '条件1：48時間以内に決断した場合 → 間違っていても修正が効く',
          '条件2：1ヶ月悩み続けた場合 → 選択肢が減り、最良の機会を逃す',
          '条件3：他人に判断を委ねた場合 → 結果がどうあれ後悔する',
        ],
        onepager: [
          '第1章【状況】：選択肢が複数あり、どれを選ぶべきか決められない',
          '第2章【問題】：情報を集めれば集めるほど迷いが深くなっている',
          '第3章【仮説】：「最悪のケースが許容可能か」だけで判断すれば決められる',
          '第4章【検証】：過去の人生の転機を振り返ると、悩んだ末の選択より即断の方が満足度が高い',
          '第5章【結論】：最悪ケースが致命的でなければ、今日決めていい',
          '第6章【行動】：この決断を1週間先送りした場合の具体的デメリットを書き出す',
        ],
        counter: {
          objection: '反論：「もっと情報を集めてから判断すべきだ。急いで決めて失敗したら取り返しがつかない」',
          response: '処理：取り返しがつかない判断は人生で数回だけ。今回がそれに該当するか確認する。該当しないなら、追加情報のリターンは限りなく小さい。',
        },
        next_action: '今日やること：今迷っている選択肢それぞれの「最悪のケース」を1行ずつ書き出し、許容できるかだけ判定する（10分以内）。',
      },
      alternative: {
        ichigeki: '自分の頭で考えるな。すでに同じ問題を解決した人を3人探せ。',
        branching: [
          '条件1：経験者に直接聞いた場合 → 自分では思いつかない盲点がわかる',
          '条件2：本やネットだけで調べた場合 → 一般論しか得られない',
          '条件3：誰にも相談しなかった場合 → 自分のバイアスに気づけない',
        ],
        onepager: [
          '第1章【状況】：自分だけで考え続けて堂々巡りになっている',
          '第2章【問題】：自分の経験の範囲内でしか選択肢を出せていない',
          '第3章【仮説】：同じ問題を経験済みの人に聞けば、判断基準が明確になる',
          '第4章【検証】：転職経験者3人に聞いた結果、自分が見落としていた条件が2つ見つかった',
          '第5章【結論】：まず経験者を探し、30分話を聞くことが最短ルート',
          '第6章【行動】：今週中に経験者3人にコンタクトを取り、1人と30分話す約束を取り付ける',
        ],
        counter: {
          objection: '反論：「他人の経験は参考にならない。状況は人それぞれ違うのだから、自分で考えるしかない」',
          response: '処理：状況が100%同じ人はいないが、判断の「軸」は共通する。経験者から得るべきは答えではなく「何を基準に判断したか」という軸。軸を3つ聞けば、自分の判断精度が格段に上がる。',
        },
        next_action: '今日やること：自分が迷っているテーマについて、経験者を1人特定し、連絡手段を確認する（15分以内）。',
      },
      strong_counter: {
        ichigeki: '「やりたいこと」で選ぶな。「やめたら後悔すること」で選べ。',
        branching: [
          '条件1：「10年後に後悔するか」で判断した場合 → 短期の不安に負けずに動ける',
          '条件2：年収や条件だけで選んだ場合 → 3年以内に同じ悩みが再発する',
          '条件3：現状維持を選んだ場合 → 5年後「あの時動いていれば」と必ず思う',
        ],
        onepager: [
          '第1章【状況】：現状に不満があるが、変化のリスクが怖くて動けない',
          '第2章【問題】：「失敗したらどうしよう」が判断を支配している',
          '第3章【仮説】：人は「やった後悔」より「やらなかった後悔」を5倍強く感じる',
          '第4章【検証】：コーネル大学の研究で、人生最大の後悔の76%は「行動しなかったこと」',
          '第5章【結論】：「やらない後悔」が「やる後悔」より大きいなら、やる一択',
          '第6章【行動】：10年後の自分から見て、今動かないリスクを3行で書き出す',
        ],
        counter: {
          objection: '反論：「後悔の理論なんて結果論だ。実際にはリスクを取って失敗し、取り返しがつかなくなった人もいる。生存者バイアスで成功例だけ見ているだけだ」',
          response: '処理：(1)「取り返しがつかない」の定義を具体化する。命・健康・信用のどれかが不可逆的に毀損されるかチェック。(2)該当しないなら、失敗しても1〜2年で復旧可能。(3)生存者バイアスの指摘は正しいが、「動かなかった人のデータ」は取れない。唯一取れるのは自分の過去。自分が過去に「やらなくて後悔したこと」を3つ書けば、バイアスではなく実体験で判断できる。',
        },
        next_action: '今日やること：過去に「やらなくて後悔したこと」を3つ書き出し、今回の選択と共通点があるかチェックする（10分以内）。',
      },
    };
  }

  // admin（デフォルト）
  return {
    normal: {
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
    },
    alternative: {
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
    },
    strong_counter: {
      ichigeki: '「国民のため」は禁句。「誰の、いくらの、いつまでの」で語れ。',
      branching: [
        '条件1：対象者と金額を明示した場合 → 当事者意識が生まれ支持が固まる',
        '条件2：「国民のため」と抽象表現を使った場合 → 誰にも刺さらず支持が広がらない',
        '条件3：反対派の論点を先に潰した場合 → 野党の攻め手がなくなり国会審議が短縮される',
      ],
      onepager: [
        '第1章【状況】：減税法案を準備中だが、野党と世論の反発を想定する必要がある',
        '第2章【問題】：想定される反論への回答が用意できていない',
        '第3章【仮説】：反論を先回りして潰せば、審議を有利に進められる',
        '第4章【検証】：消費税導入時、竹下内閣は反論対策を準備せず支持率が急落した',
        '第5章【結論】：反論を10個リストアップし、全てに数字付きの回答を用意することが先決',
        '第6章【行動】：想定反論トップ10リストを作成し、各反論に定量データ付きの回答を準備する',
      ],
      counter: {
        objection: '反論：「財源がない。社会保障費が毎年1兆円膨張する中で減税は不可能。仮にやれば国債格付けが下がり、金利上昇で住宅ローン破綻者が続出する。減税で浮く年3万円のために、金利上昇で年12万円の負担増になる。国民は差し引きマイナスだ」',
        response: '処理：(1)減税規模を「GDP比0.3%以内」に限定し格付け機関の閾値に収める。(2)社会保障費は別会計で手当済みであることを歳出内訳で証明する。(3)金利上昇シナリオの前提（日銀利上げ幅）を明示し、0.25%利上げでは住宅ローン月額増が2,100円にとどまることを試算で示す。(4)「GDP成長率2%未満で自動停止」のサンセット条項を法案に組み込む。',
      },
      next_action: '今日やること：財務省の「国債残高と金利の関係」資料を1つ特定し、減税規模0.3%でのシミュレーション結果を数字で確認する（20分以内）。',
    },
  };
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
      const raw = await callAI(prompt, apiKey, variant, mode);
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
  gateLog.push('原因: 上記エラーにより全試行失敗。API Keyとモデルの利用可否を確認してください。');
  const data = createFallback(fact, variant);
  return { data, meta: { attempt: MAX_RETRY + 1, fallback: true, gateLog } };
}

/**
 * API接続テスト — 最小限のリクエストを各モデルに送り結果を返す
 */
export async function testApiConnection(apiKey) {
  if (!apiKey) {
    return { ok: false, message: 'API Keyが未入力です。' };
  }

  const results = [];

  for (const model of MODEL_CHAIN) {
    try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'テスト。「OK」とだけ返してください。' }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '(応答なし)';
        results.push({ model, status: 'OK', detail: text.slice(0, 50) });
      } else {
        const err = await response.json().catch(() => null);
        const msg = err?.error?.message || `${response.status} ${response.statusText}`;
        results.push({ model, status: 'NG', detail: msg });
      }
    } catch (e) {
      results.push({ model, status: 'NG', detail: e.message });
    }
  }

  const anyOk = results.some((r) => r.status === 'OK');
  const lines = results.map((r) => `${r.model}: ${r.status} — ${r.detail}`);
  return { ok: anyOk, message: lines.join('\n'), results };
}

export { buildPrompt, MODE_LABELS, TONE_LABELS };
