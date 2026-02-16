/**
 * Contract Test — Spec Step 5
 * スキーマ通過/違反 → 再生成 → 違反 → フォールバック まで確認
 */

import { describe, it, expect } from 'vitest';
import { validateSchema, parseAndValidate } from '../src/schema.js';
import { createFallback } from '../src/fallback.js';

// 正常データ
const VALID_DATA = {
  ichigeki: '勝負は「やるか」じゃなく「工程を先に見せるか」で決まる。',
  branching: [
    '条件1：施行日＋財源が明示された場合 → 支持率は維持される',
    '条件2：「検討」が増えた場合 → 信頼が急落',
    '条件3：給付が主語になった場合 → 迷走する',
  ],
  onepager: [
    '第1章【状況】：高市内閣は減税を掲げた',
    '第2章【問題】：具体的工程が欠落',
    '第3章【仮説】：有権者は計画の具体性で評価する',
    '第4章【検証】：過去3政権の支持率推移',
    '第5章【結論】：施行日と財源を同時に出す',
    '第6章【行動】：3点セットを今週中に発表する',
  ],
  counter: {
    objection: '反論：「財源がないなら絵空事。赤字国債を増やすだけなら無責任だ」',
    response: '処理：出口条件と中止条件を工程に入れる。GDP成長率トリガーを設計する。',
  },
  next_action: '今日やること：高市内閣の減税発言を3つの一次ソースで確認し、施行日＋財源が出ているかチェックする（15分以内）。',
};

describe('スキーマ検証', () => {
  it('正常データはパスする', () => {
    const result = validateSchema(VALID_DATA);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('ichigeki が空ならエラー', () => {
    const data = { ...VALID_DATA, ichigeki: '' };
    const result = validateSchema(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('ichigeki'))).toBe(true);
  });

  it('branching が2要素ならエラー', () => {
    const data = { ...VALID_DATA, branching: ['a', 'b'] };
    const result = validateSchema(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('branching'))).toBe(true);
  });

  it('branching が4要素ならエラー', () => {
    const data = { ...VALID_DATA, branching: ['a', 'b', 'c', 'd'] };
    const result = validateSchema(data);
    expect(result.valid).toBe(false);
  });

  it('onepager が5要素ならエラー', () => {
    const data = { ...VALID_DATA, onepager: ['a', 'b', 'c', 'd', 'e'] };
    const result = validateSchema(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('onepager'))).toBe(true);
  });

  it('onepager が7要素ならエラー', () => {
    const data = { ...VALID_DATA, onepager: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] };
    const result = validateSchema(data);
    expect(result.valid).toBe(false);
  });

  it('counter が欠落ならエラー', () => {
    const data = { ...VALID_DATA, counter: null };
    const result = validateSchema(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('counter'))).toBe(true);
  });

  it('counter.objection が空ならエラー', () => {
    const data = { ...VALID_DATA, counter: { objection: '', response: 'valid response text here' } };
    const result = validateSchema(data);
    expect(result.valid).toBe(false);
  });

  it('next_action が欠落ならエラー', () => {
    const data = { ...VALID_DATA, next_action: undefined };
    const result = validateSchema(data);
    expect(result.valid).toBe(false);
  });

  it('データがnullならエラー', () => {
    const result = validateSchema(null);
    expect(result.valid).toBe(false);
  });
});

describe('parseAndValidate', () => {
  it('正しいJSON文字列をパース&検証する', () => {
    const json = JSON.stringify(VALID_DATA);
    const result = parseAndValidate(json);
    expect(result.valid).toBe(true);
    expect(result.data).toEqual(VALID_DATA);
  });

  it('壊れたJSONはパース失敗', () => {
    const result = parseAndValidate('{ broken json');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('JSONパース失敗');
  });

  it('オブジェクトを直接渡しても動作する', () => {
    const result = parseAndValidate(VALID_DATA);
    expect(result.valid).toBe(true);
  });
});

describe('フォールバック', () => {
  it('フォールバックは必ず5モジュール揃う', () => {
    const fb = createFallback('テスト入力');
    const result = validateSchema(fb);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('空入力でもフォールバックは正常', () => {
    const fb = createFallback('');
    const result = validateSchema(fb);
    expect(result.valid).toBe(true);
  });

  it('null入力でもフォールバックは正常', () => {
    const fb = createFallback(null);
    const result = validateSchema(fb);
    expect(result.valid).toBe(true);
  });

  it('フォールバックのbranching は3要素', () => {
    const fb = createFallback('test');
    expect(fb.branching).toHaveLength(3);
  });

  it('フォールバックのonepager は6要素', () => {
    const fb = createFallback('test');
    expect(fb.onepager).toHaveLength(6);
  });
});
