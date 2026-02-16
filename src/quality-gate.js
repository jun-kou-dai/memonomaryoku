/**
 * Quality Gate — Spec Step 2: 無難回答排除
 * NGワード/NGパターン検知 → 失格判定
 */

const NG_WORDS = [
  '大事', '重要', 'バランス', '総合的', '注視', '検討', '様子見',
  '慎重に', '引き続き', '多角的', '適切に', '一概には',
  '今後の動向', '見守る', '留意', '踏まえ', '鑑み',
];

const ABSTRACT_PATTERNS = [
  /^.{0,15}$/, // 15文字以下は短すぎて抽象
  /しましょう\s*$/,
  /ことが大切/,
  /意識する/,
  /心がける/,
  /努力する/,
  /頑張る/,
];

/**
 * テキスト内のNGワードを検出
 * @returns {string[]} 検出されたNGワード
 */
export function detectNgWords(text) {
  if (!text) return [];
  return NG_WORDS.filter((word) => text.includes(word));
}

/**
 * next_actionが抽象的かどうか判定
 * @returns {boolean} 抽象的ならtrue
 */
export function isAbstractAction(text) {
  if (!text || typeof text !== 'string') return true;
  return ABSTRACT_PATTERNS.some((pattern) => pattern.test(text.trim()));
}

/**
 * counterが弱いかどうか判定
 * 反論(objection)も処理(response)も20文字未満なら弱い
 */
export function isWeakCounter(counter) {
  if (!counter || typeof counter !== 'object') return true;
  const { objection, response } = counter;
  if (!objection || objection.trim().length < 20) return true;
  if (!response || response.trim().length < 20) return true;
  return false;
}

/**
 * 全モジュールをQuality Gate判定
 * @returns {{ pass: boolean, reasons: string[] }}
 */
export function qualityGate(data) {
  const reasons = [];

  if (!data) {
    return { pass: false, reasons: ['データなし'] };
  }

  // 全テキストからNGワード検出
  const allTexts = [
    data.ichigeki || '',
    ...(data.branching || []),
    ...(data.onepager || []),
    data.counter?.objection || '',
    data.counter?.response || '',
    data.next_action || '',
  ];

  const allText = allTexts.join(' ');
  const ngFound = detectNgWords(allText);
  if (ngFound.length > 0) {
    reasons.push(`NGワード検出: ${ngFound.join(', ')}`);
  }

  // next_actionが抽象的
  if (isAbstractAction(data.next_action)) {
    reasons.push('next_action が抽象的（具体的な行動が必要）');
  }

  // counterが弱い
  if (isWeakCounter(data.counter)) {
    reasons.push('counter が弱い（反論・処理とも20文字以上必要）');
  }

  return { pass: reasons.length === 0, reasons };
}

export { NG_WORDS };
