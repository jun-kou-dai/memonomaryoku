/**
 * 統合テスト — 「ユーザーが実際にやる操作」をそのまま検証する
 *
 * 既存テストの穴:
 *   - contract.test.js → データ層だけ（スキーマ、QG）
 *   - e2e.test.js → DOM構造だけ、またはデータ層だけ
 *   - どちらも「initApp() → ボタンクリック → カード表示」を通しで検証していない
 *
 * このテストの目的:
 *   initApp()でイベントを接続 → ボタンを押す → 5枚カードが出る
 *   これが落ちれば、落ちた場所がバグの場所
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

// 実際のHTMLをそのまま読む（テスト用HTMLを作らない＝嘘をつかない）
const htmlPath = path.resolve(__dirname, '..', 'index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

/**
 * jsdom上でアプリを起動するヘルパー
 * ブラウザの代わりにjsdomを使って、initApp()を呼ぶ
 */
async function bootApp() {
  const dom = new JSDOM(htmlContent, {
    url: 'http://localhost:3000',
    pretendToBeVisual: true,
    runScripts: 'dangerously',
  });

  const { document, window } = dom.window;

  // app.js を動的にインポートして initApp() を実行
  // （jsdomは <script type="module"> を実行できないので、手動で呼ぶ）
  const { initApp } = await import('../src/app.js');

  // initApp() は document.querySelector を使う
  // jsdom の document を globalThis にセットして、initApp() が見つけられるようにする
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const originalLocalStorage = globalThis.localStorage;
  globalThis.document = document;
  globalThis.window = window;
  globalThis.localStorage = window.localStorage;

  initApp();

  return {
    document,
    window,
    cleanup: () => {
      globalThis.document = originalDocument;
      globalThis.window = originalWindow;
      globalThis.localStorage = originalLocalStorage;
    },
  };
}

// ================================================================
// テスト本体
// ================================================================

describe('統合テスト: ユーザー操作の再現', () => {
  let doc;
  let cleanup;

  beforeEach(async () => {
    const app = await bootApp();
    doc = app.document;
    cleanup = app.cleanup;
  });

  afterEach(() => {
    cleanup?.();
  });

  // --------------------------------------------------
  // Step 1: initApp() でイベントが接続されているか
  // --------------------------------------------------
  it('initApp()後、Toneスライダーが動作する', () => {
    const range = doc.querySelector('#tone-range');
    const display = doc.querySelector('#tone-display');

    // 初期値は2 → 「標準」
    expect(display.textContent).toBe('標準');

    // スライダーを0に変更 → 「超カジュアル」になるはず
    range.value = '0';
    range.dispatchEvent(new doc.defaultView.Event('input'));
    expect(display.textContent).toBe('超カジュアル');
  });

  // --------------------------------------------------
  // Step 2: Fact空で「生成」→ alertが出る（カードは出ない）
  // --------------------------------------------------
  it('Fact空で生成ボタンを押すとalertが出る', async () => {
    let alertMessage = null;
    // app.js はグローバルの alert() を呼ぶので、globalThis にモックをセット
    globalThis.alert = (msg) => { alertMessage = msg; };

    const btn = doc.querySelector('#btn-generate');
    btn.click();

    await new Promise((r) => setTimeout(r, 50));

    expect(alertMessage).toContain('Fact');

    delete globalThis.alert;
  });

  // --------------------------------------------------
  // Step 3: これが本命。
  // Factを入力 → 「生成」→ カード5枚が出るか
  // --------------------------------------------------
  it('Fact入力 → 生成ボタン → カード5枚が表示される', async () => {
    // alertをモック（エラー時に何が出たか見るため）
    let alertMessage = null;
    doc.defaultView.alert = (msg) => { alertMessage = msg; };

    // 1. Factを入力
    const textarea = doc.querySelector('#fact-input');
    textarea.value = '高市内閣、今年中に減税できる？やらないと人気落ちる';

    // 2. APIキーは空（デモモード）
    const apiKeyInput = doc.querySelector('#api-key-input');
    apiKeyInput.value = '';

    // 3. 「生成」ボタンを押す
    const btn = doc.querySelector('#btn-generate');
    btn.click();

    // 4. 非同期処理を待つ（generate()はasync）
    //    デモモードはfetch不要なので即完了するはず
    await new Promise((r) => setTimeout(r, 200));

    // 5. 結果を検証
    //    もしalertが出ていたら、エラーが起きている
    if (alertMessage) {
      // テスト失敗させてエラー内容を表示
      expect.fail(`エラー発生: ${alertMessage}`);
    }

    // 6. カードが5枚あるか
    const cards = doc.querySelectorAll('.cards-container .card');
    expect(cards.length).toBe(5);

    // 7. 出力セクションが表示されているか
    const output = doc.querySelector('.output-section');
    expect(output.classList.contains('active')).toBe(true);

    // 8. Quality Gateログが表示されているか
    const gateLog = doc.querySelector('.gate-log');
    expect(gateLog.classList.contains('active')).toBe(true);

    // 9. メタ情報が表示されているか
    const meta = doc.querySelector('.meta-info');
    expect(meta.classList.contains('active')).toBe(true);

    // 10. ローディングが消えているか
    const loading = doc.querySelector('.loading');
    expect(loading.classList.contains('active')).toBe(false);
  });

  // --------------------------------------------------
  // Step 4: 別案ボタンも同様に動くか
  // --------------------------------------------------
  it('Fact入力 → 別案ボタン → カード5枚が表示される', async () => {
    let alertMessage = null;
    doc.defaultView.alert = (msg) => { alertMessage = msg; };

    doc.querySelector('#fact-input').value = 'テスト入力';
    doc.querySelector('#api-key-input').value = '';

    doc.querySelector('#btn-alternative').click();
    await new Promise((r) => setTimeout(r, 200));

    if (alertMessage) {
      expect.fail(`エラー発生: ${alertMessage}`);
    }

    const cards = doc.querySelectorAll('.cards-container .card');
    expect(cards.length).toBe(5);
  });

  // --------------------------------------------------
  // Step 5: 反対側強めボタンも動くか
  // --------------------------------------------------
  it('Fact入力 → 反対側強めボタン → カード5枚が表示される', async () => {
    let alertMessage = null;
    doc.defaultView.alert = (msg) => { alertMessage = msg; };

    doc.querySelector('#fact-input').value = 'テスト入力';
    doc.querySelector('#api-key-input').value = '';

    doc.querySelector('#btn-strong-counter').click();
    await new Promise((r) => setTimeout(r, 200));

    if (alertMessage) {
      expect.fail(`エラー発生: ${alertMessage}`);
    }

    const cards = doc.querySelectorAll('.cards-container .card');
    expect(cards.length).toBe(5);
  });

  // --------------------------------------------------
  // Step 6: 二重クリック防止（isGenerating フラグ）
  // --------------------------------------------------
  it('生成中にもう一度押してもカードが二重にならない', async () => {
    doc.querySelector('#fact-input').value = 'テスト';
    doc.querySelector('#api-key-input').value = '';

    const btn = doc.querySelector('#btn-generate');

    // 2回連続クリック
    btn.click();
    btn.click();

    await new Promise((r) => setTimeout(r, 200));

    const cards = doc.querySelectorAll('.cards-container .card');
    // 5枚だけ（10枚にならない）
    expect(cards.length).toBe(5);
  });
});
