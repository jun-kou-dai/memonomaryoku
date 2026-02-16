/**
 * JSONスキーマ検証 — Spec Step 1
 * 5モジュール: ichigeki, branching(3条件), onepager(6章), counter, next_action(具体1つ)
 */

/**
 * 出力スキーマ定義
 * ichigeki: string (1文の結論)
 * branching: string[] (必ず3条件)
 * onepager: string[] (6章固定)
 * counter: { objection: string, response: string }
 * next_action: string (今日やること1つ)
 */
export function validateSchema(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['データがオブジェクトではない'] };
  }

  // 1) ichigeki: 非空文字列
  if (typeof data.ichigeki !== 'string' || data.ichigeki.trim() === '') {
    errors.push('ichigeki: 非空文字列が必要');
  }

  // 2) branching: 要素3の文字列配列
  if (!Array.isArray(data.branching) || data.branching.length !== 3) {
    errors.push('branching: 要素数3の配列が必要');
  } else {
    data.branching.forEach((item, i) => {
      if (typeof item !== 'string' || item.trim() === '') {
        errors.push(`branching[${i}]: 非空文字列が必要`);
      }
    });
  }

  // 3) onepager: 要素6の文字列配列
  if (!Array.isArray(data.onepager) || data.onepager.length !== 6) {
    errors.push('onepager: 要素数6の配列が必要');
  } else {
    data.onepager.forEach((item, i) => {
      if (typeof item !== 'string' || item.trim() === '') {
        errors.push(`onepager[${i}]: 非空文字列が必要`);
      }
    });
  }

  // 4) counter: objection + response
  if (!data.counter || typeof data.counter !== 'object') {
    errors.push('counter: オブジェクトが必要');
  } else {
    if (typeof data.counter.objection !== 'string' || data.counter.objection.trim() === '') {
      errors.push('counter.objection: 非空文字列が必要');
    }
    if (typeof data.counter.response !== 'string' || data.counter.response.trim() === '') {
      errors.push('counter.response: 非空文字列が必要');
    }
  }

  // 5) next_action: 非空文字列
  if (typeof data.next_action !== 'string' || data.next_action.trim() === '') {
    errors.push('next_action: 非空文字列が必要');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * JSON文字列をパースし、スキーマ検証する
 */
export function parseAndValidate(jsonString) {
  try {
    const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    return { data, ...validateSchema(data) };
  } catch (e) {
    return { data: null, valid: false, errors: [`JSONパース失敗: ${e.message}`] };
  }
}
