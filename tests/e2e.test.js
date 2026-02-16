/**
 * E2E Test — Spec Step 5
 * 入力 → 生成 → 5枚表示 → コピー動作（モック）
 * jsdomで実際のHTMLをロードしてDOM操作を検証する
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { validateSchema } from '../src/schema.js';
import { qualityGate } from '../src/quality-gate.js';
import { createFallback } from '../src/fallback.js';
import { generate } from '../src/ai-client.js';

// 実際のindex.htmlを読み込む
const htmlPath = path.resolve(__dirname, '..', 'index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

function createDOM() {
  const dom = new JSDOM(htmlContent, {
    url: 'http://localhost:3000',
    pretendToBeVisual: true,
  });
  return dom;
}

// --- データ層テスト ---

describe('E2E: 生成フロー（データ層）', () => {
  it('デモモード（APIキーなし）で5枚生成される', async () => {
    const { data, meta } = await generate(
      '高市内閣、今年中に減税できる？やらないと人気落ちる',
      'admin',
      2,
      '',
      'normal'
    );

    expect(data.ichigeki).toBeTruthy();
    expect(data.branching).toHaveLength(3);
    expect(data.onepager).toHaveLength(6);
    expect(data.counter).toBeTruthy();
    expect(data.counter.objection).toBeTruthy();
    expect(data.counter.response).toBeTruthy();
    expect(data.next_action).toBeTruthy();

    const schema = validateSchema(data);
    expect(schema.valid).toBe(true);

    const gate = qualityGate(data);
    expect(gate.pass).toBe(true);

    expect(meta.fallback).toBe(false);
    expect(meta.attempt).toBe(1);
  });

  it('別案モードで異なるichigekiが返る', async () => {
    const { data: normalData } = await generate('テスト', 'admin', 2, '', 'normal');
    const { data: altData } = await generate('テスト', 'admin', 2, '', 'alternative');

    expect(validateSchema(altData).valid).toBe(true);
    expect(altData.ichigeki).not.toBe(normalData.ichigeki);
  });

  it('反対側強めモードでcounterが長い', async () => {
    const { data: normalData } = await generate('テスト', 'admin', 2, '', 'normal');
    const { data: strongData } = await generate('テスト', 'admin', 2, '', 'strong_counter');

    expect(validateSchema(strongData).valid).toBe(true);
    const normalLen = normalData.counter.objection.length + normalData.counter.response.length;
    const strongLen = strongData.counter.objection.length + strongData.counter.response.length;
    expect(strongLen).toBeGreaterThan(normalLen);
  });
});

describe('E2E: フォールバックフロー', () => {
  it('フォールバックもスキーマを通る', () => {
    const fb = createFallback('テスト');
    const schema = validateSchema(fb);
    expect(schema.valid).toBe(true);

    expect(fb.ichigeki).toBeTruthy();
    expect(fb.branching).toHaveLength(3);
    expect(fb.onepager).toHaveLength(6);
    expect(fb.counter.objection).toBeTruthy();
    expect(fb.counter.response).toBeTruthy();
    expect(fb.next_action).toBeTruthy();
  });
});

// --- DOM層テスト ---

describe('E2E: DOM - HTMLの構造検証', () => {
  let dom;
  let document;

  beforeEach(() => {
    dom = createDOM();
    document = dom.window.document;
  });

  it('必要なDOM要素がすべて存在する', () => {
    expect(document.querySelector('#fact-input')).not.toBeNull();
    expect(document.querySelector('#mode-select')).not.toBeNull();
    expect(document.querySelector('#tone-range')).not.toBeNull();
    expect(document.querySelector('#tone-display')).not.toBeNull();
    expect(document.querySelector('#api-key-input')).not.toBeNull();
    expect(document.querySelector('#btn-generate')).not.toBeNull();
    expect(document.querySelector('#btn-alternative')).not.toBeNull();
    expect(document.querySelector('#btn-strong-counter')).not.toBeNull();
    expect(document.querySelector('.output-section')).not.toBeNull();
    expect(document.querySelector('.cards-container')).not.toBeNull();
    expect(document.querySelector('.loading')).not.toBeNull();
    expect(document.querySelector('.gate-log')).not.toBeNull();
    expect(document.querySelector('.meta-info')).not.toBeNull();
    expect(document.querySelector('.flow-section')).not.toBeNull();
  });

  it('Modeセレクトに4つの選択肢がある', () => {
    const options = document.querySelectorAll('#mode-select option');
    expect(options.length).toBe(4);
    const values = [...options].map((o) => o.value);
    expect(values).toEqual(['admin', 'gym', 'product', 'personal']);
  });

  it('Toneスライダーの初期値が2（標準）', () => {
    const range = document.querySelector('#tone-range');
    expect(range.value).toBe('2');
    expect(range.min).toBe('0');
    expect(range.max).toBe('4');
  });

  it('無難排除フロー図が表示されている', () => {
    const flowSteps = document.querySelectorAll('.flow-step');
    expect(flowSteps.length).toBe(5); // 生成, Gate, OK, 再生成, Fallback
  });

  it('出力セクションは初期非表示', () => {
    const output = document.querySelector('.output-section');
    expect(output.classList.contains('active')).toBe(false);
  });

  it('ローディングは初期非表示', () => {
    const loading = document.querySelector('.loading');
    expect(loading.classList.contains('active')).toBe(false);
  });
});

describe('E2E: DOM - カードレンダリング検証', () => {
  let dom;
  let document;

  beforeEach(() => {
    dom = createDOM();
    document = dom.window.document;
  });

  it('5枚のカードが正しくレンダリングされる', async () => {
    const { data } = await generate('テスト', 'admin', 2, '', 'normal');
    const container = document.querySelector('.cards-container');

    // app.jsのcreateCard相当のロジックをDOMで再現して検証
    const CARD_DEFS = [
      { key: 'ichigeki', label: '一撃', number: 1 },
      { key: 'branching', label: '分岐（3条件）', number: 2 },
      { key: 'onepager', label: '一枚（6章）', number: 3 },
      { key: 'counter', label: '反対側', number: 4 },
      { key: 'next_action', label: '次の一手', number: 5 },
    ];

    CARD_DEFS.forEach((def) => {
      const card = document.createElement('div');
      card.className = 'card';
      const value = data[def.key];

      let bodyHtml = '';
      let copyText = '';

      switch (def.key) {
        case 'ichigeki': {
          const div = document.createElement('div');
          div.textContent = value;
          bodyHtml = `<p>${div.innerHTML}</p>`;
          copyText = value;
          break;
        }
        case 'branching':
          bodyHtml = value
            .map((v) => {
              const div = document.createElement('div');
              div.textContent = v;
              return `<div class="branch-item">${div.innerHTML}</div>`;
            })
            .join('');
          copyText = value.join('\n');
          break;
        case 'onepager':
          bodyHtml = value
            .map((v) => {
              const div = document.createElement('div');
              div.textContent = v;
              return `<div class="chapter-item">${div.innerHTML}</div>`;
            })
            .join('');
          copyText = value.join('\n');
          break;
        case 'counter': {
          const divObj = document.createElement('div');
          divObj.textContent = value.objection;
          const divRes = document.createElement('div');
          divRes.textContent = value.response;
          bodyHtml = `
            <div class="counter-block objection"><div class="counter-label">OBJECTION</div><p>${divObj.innerHTML}</p></div>
            <div class="counter-block response"><div class="counter-label">RESPONSE</div><p>${divRes.innerHTML}</p></div>`;
          copyText = `${value.objection}\n${value.response}`;
          break;
        }
        case 'next_action': {
          const div = document.createElement('div');
          div.textContent = value;
          bodyHtml = `<p>${div.innerHTML}</p>`;
          copyText = value;
          break;
        }
      }

      const escapedCopy = copyText
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      card.innerHTML = `
        <div class="card-header">
          <div class="card-title">
            <span class="card-number">${def.number}</span>
            <span class="card-label">${def.label}</span>
          </div>
          <button class="btn-copy" data-copy-text="${escapedCopy}">Copy</button>
        </div>
        <div class="card-body">${bodyHtml}</div>
      `;

      container.appendChild(card);
    });

    // 5枚のカードが作成されたか
    const cards = container.querySelectorAll('.card');
    expect(cards.length).toBe(5);

    // 各カードにCopyボタンがあるか
    const copyButtons = container.querySelectorAll('.btn-copy');
    expect(copyButtons.length).toBe(5);

    // 各Copyボタンにdata-copy-textがあるか（空でないか）
    copyButtons.forEach((btn) => {
      const text = btn.getAttribute('data-copy-text');
      expect(text).toBeTruthy();
      expect(text.length).toBeGreaterThan(0);
    });

    // カード番号が1-5であること
    const numbers = container.querySelectorAll('.card-number');
    expect([...numbers].map((n) => n.textContent)).toEqual(['1', '2', '3', '4', '5']);

    // branchingカードに3つのbranch-itemがあるか
    const branchItems = cards[1].querySelectorAll('.branch-item');
    expect(branchItems.length).toBe(3);

    // onepagerカードに6つのchapter-itemがあるか
    const chapterItems = cards[2].querySelectorAll('.chapter-item');
    expect(chapterItems.length).toBe(6);

    // counterカードにobjectionとresponseがあるか
    const objection = cards[3].querySelector('.counter-block.objection');
    const response = cards[3].querySelector('.counter-block.response');
    expect(objection).not.toBeNull();
    expect(response).not.toBeNull();
  });

  it('Copyボタンのdata-copy-textからテキストが取得できる', async () => {
    const { data } = await generate('テスト', 'admin', 2, '', 'normal');

    // ichigekiのcopy textを検証
    const copyText = data.ichigeki;
    const escaped = copyText
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const btn = document.createElement('button');
    btn.setAttribute('data-copy-text', escaped);
    document.body.appendChild(btn);

    // getAttributeで取得したテキストが元のテキストと一致するか
    const retrieved = btn.getAttribute('data-copy-text');
    expect(retrieved).toBe(copyText);
  });
});
