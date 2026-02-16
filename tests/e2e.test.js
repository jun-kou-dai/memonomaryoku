/**
 * E2E Test — Spec Step 5
 * 入力 → 生成 → 5枚表示 → コピー動作（モック）
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validateSchema } from '../src/schema.js';
import { qualityGate } from '../src/quality-gate.js';
import { createFallback } from '../src/fallback.js';
import { generate } from '../src/ai-client.js';

describe('E2E: 生成フロー', () => {
  it('デモモード（APIキーなし）で5枚生成される', async () => {
    const { data, meta } = await generate(
      '高市内閣、今年中に減税できる？やらないと人気落ちる',
      'admin',
      2,
      '', // APIキーなし = デモモード
      'normal'
    );

    // 5モジュール全てが存在する
    expect(data.ichigeki).toBeTruthy();
    expect(data.branching).toHaveLength(3);
    expect(data.onepager).toHaveLength(6);
    expect(data.counter).toBeTruthy();
    expect(data.counter.objection).toBeTruthy();
    expect(data.counter.response).toBeTruthy();
    expect(data.next_action).toBeTruthy();

    // スキーマ検証を通る
    const schema = validateSchema(data);
    expect(schema.valid).toBe(true);

    // Quality Gateを通る
    const gate = qualityGate(data);
    expect(gate.pass).toBe(true);

    // メタ情報
    expect(meta.fallback).toBe(false);
    expect(meta.attempt).toBe(1);
  });

  it('別案モードでも5枚生成される', async () => {
    const { data, meta } = await generate(
      'テスト入力',
      'product',
      3,
      '',
      'alternative'
    );

    const schema = validateSchema(data);
    expect(schema.valid).toBe(true);
    expect(meta.fallback).toBe(false);
  });

  it('反対側強めモードでも5枚生成される', async () => {
    const { data, meta } = await generate(
      'テスト入力',
      'gym',
      1,
      '',
      'strong_counter'
    );

    const schema = validateSchema(data);
    expect(schema.valid).toBe(true);
    expect(meta.fallback).toBe(false);
  });
});

describe('E2E: フォールバックフロー', () => {
  it('フォールバックもスキーマを通る', () => {
    const fb = createFallback('テスト');
    const schema = validateSchema(fb);
    expect(schema.valid).toBe(true);

    // 5枚揃っている
    expect(fb.ichigeki).toBeTruthy();
    expect(fb.branching).toHaveLength(3);
    expect(fb.onepager).toHaveLength(6);
    expect(fb.counter.objection).toBeTruthy();
    expect(fb.counter.response).toBeTruthy();
    expect(fb.next_action).toBeTruthy();
  });
});

describe('E2E: コピー用テキスト生成', () => {
  it('各カードのテキストが取得できる', async () => {
    const { data } = await generate('テスト', 'admin', 2, '', 'normal');

    // コピー用テキスト生成を検証
    expect(typeof data.ichigeki).toBe('string');
    expect(data.ichigeki.length).toBeGreaterThan(0);

    expect(data.branching.join('\n').length).toBeGreaterThan(0);
    expect(data.onepager.join('\n').length).toBeGreaterThan(0);

    const counterText = `${data.counter.objection}\n${data.counter.response}`;
    expect(counterText.length).toBeGreaterThan(0);

    expect(data.next_action.length).toBeGreaterThan(0);
  });
});
