/**
 * Quality Gate Test — Spec Step 5
 * NGワード入りが再生成されること、抽象的なnext_actionが失格すること
 */

import { describe, it, expect } from 'vitest';
import { detectNgWords, isAbstractAction, isWeakCounter, qualityGate } from '../src/quality-gate.js';

describe('NGワード検出', () => {
  it('NGワードを含むテキストから検出する', () => {
    const found = detectNgWords('これは重要なバランスを検討すべき');
    expect(found).toContain('重要');
    expect(found).toContain('バランス');
    expect(found).toContain('検討');
  });

  it('NGワードなしなら空配列', () => {
    const found = detectNgWords('施行日と財源を明日までに確定させる');
    expect(found).toHaveLength(0);
  });

  it('null/undefinedでも安全', () => {
    expect(detectNgWords(null)).toHaveLength(0);
    expect(detectNgWords(undefined)).toHaveLength(0);
  });

  it('全NGワードを個別にテスト', () => {
    const ngWords = ['大事', '重要', 'バランス', '総合的', '注視', '検討', '様子見'];
    ngWords.forEach((word) => {
      const found = detectNgWords(`これは${word}です`);
      expect(found).toContain(word);
    });
  });
});

describe('抽象的next_action判定', () => {
  it('短すぎる（15文字以下）は抽象', () => {
    expect(isAbstractAction('頑張る')).toBe(true);
    expect(isAbstractAction('検討する')).toBe(true);
  });

  it('「しましょう」で終わるは抽象', () => {
    expect(isAbstractAction('みんなで一緒に頑張りましょう')).toBe(true);
  });

  it('具体的な行動はOK', () => {
    expect(isAbstractAction('高市内閣の減税発言を3つの一次ソースで確認し、施行日＋財源が出ているかチェックする')).toBe(false);
  });

  it('null/undefinedは抽象', () => {
    expect(isAbstractAction(null)).toBe(true);
    expect(isAbstractAction(undefined)).toBe(true);
  });
});

describe('弱いcounter判定', () => {
  it('objectionが短すぎると弱い', () => {
    expect(isWeakCounter({ objection: '短い', response: 'これは十分に長い反論の処理方法を含む文章です' })).toBe(true);
  });

  it('responseが短すぎると弱い', () => {
    expect(isWeakCounter({ objection: 'これは十分に長い反論を含む文章です。かなり具体的です', response: '短い' })).toBe(true);
  });

  it('両方十分なら弱くない', () => {
    expect(isWeakCounter({
      objection: '反論：財源がないなら絵空事。赤字国債を増やすだけなら無責任だ',
      response: '処理：出口条件と中止条件を工程に入れる。GDP成長率トリガーを設計する',
    })).toBe(false);
  });

  it('nullは弱い', () => {
    expect(isWeakCounter(null)).toBe(true);
  });
});

describe('Quality Gate 総合判定', () => {
  const GOOD_DATA = {
    ichigeki: '勝負は「やるか」じゃなく「工程を先に見せるか」で決まる。',
    branching: ['条件1：施行日＋財源が明示された場合 → 支持率は維持される', '条件2：先送り発言が増えた場合 → 信頼が急落', '条件3：給付が主語になった場合 → 迷走する'],
    onepager: ['第1章【状況】：高市内閣は減税を掲げた', '第2章【問題】：具体的工程が欠落している', '第3章【仮説】：有権者は計画の具体性で評価する', '第4章【検証】：過去3政権の支持率推移を確認', '第5章【結論】：施行日と財源を同時に出す', '第6章【行動】：3点セットを今週中に発表する'],
    counter: {
      objection: '反論：「財源がないなら絵空事。赤字国債を増やすだけなら無責任だ」',
      response: '処理：出口条件と中止条件を工程に入れる。GDP成長率トリガーを設計する',
    },
    next_action: '今日やること：高市内閣の減税発言を3つの一次ソースで確認し、施行日＋財源が出ているかチェックする（15分以内）。',
  };

  it('クリーンなデータはパスする', () => {
    const result = qualityGate(GOOD_DATA);
    expect(result.pass).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it('NGワード1〜2個はパスする（閾値3）', () => {
    const data = { ...GOOD_DATA, ichigeki: 'バランスが重要だ' };
    const result = qualityGate(data);
    expect(result.pass).toBe(true);
  });

  it('NGワード3個以上で失格', () => {
    const data = {
      ...GOOD_DATA,
      ichigeki: 'バランスが重要だ。総合的に検討し、慎重に注視すべきだ',
    };
    const result = qualityGate(data);
    expect(result.pass).toBe(false);
    expect(result.reasons.some((r) => r.includes('NGワード'))).toBe(true);
  });

  it('抽象的なnext_actionは失格', () => {
    const data = { ...GOOD_DATA, next_action: '頑張る' };
    const result = qualityGate(data);
    expect(result.pass).toBe(false);
    expect(result.reasons.some((r) => r.includes('next_action'))).toBe(true);
  });

  it('弱いcounterは失格', () => {
    const data = {
      ...GOOD_DATA,
      counter: { objection: '短い', response: '短い' },
    };
    const result = qualityGate(data);
    expect(result.pass).toBe(false);
    expect(result.reasons.some((r) => r.includes('counter'))).toBe(true);
  });

  it('複数の失格理由が同時に返る', () => {
    const data = {
      ...GOOD_DATA,
      ichigeki: 'バランスが大事で総合的に検討し慎重に注視すべき',
      next_action: '頑張る',
      counter: { objection: '短い', response: '短い' },
    };
    const result = qualityGate(data);
    expect(result.pass).toBe(false);
    expect(result.reasons.length).toBeGreaterThanOrEqual(3);
  });

  it('nullデータは失格', () => {
    const result = qualityGate(null);
    expect(result.pass).toBe(false);
  });
});
