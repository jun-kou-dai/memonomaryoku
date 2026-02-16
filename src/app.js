/**
 * メインアプリケーション — Spec Step 3 + 4
 * 「Spec正」「修正前にSpec回収」
 */

import { generate } from './ai-client.js';

const TONE_LABELS = [
  '超カジュアル',
  'カジュアル',
  '標準',
  'フォーマル',
  '超フォーマル',
];

const CARD_DEFS = [
  { key: 'ichigeki', label: '一撃', number: 1 },
  { key: 'branching', label: '分岐（3条件）', number: 2 },
  { key: 'onepager', label: '一枚（6章）', number: 3 },
  { key: 'counter', label: '反対側', number: 4 },
  { key: 'next_action', label: '次の一手', number: 5 },
];

let isGenerating = false;

const API_KEY_STORAGE_KEY = 'buki-memo-api-key';

export function initApp() {
  const $ = (sel) => document.querySelector(sel);
  const toneRange = $('#tone-range');
  const toneDisplay = $('#tone-display');

  // Tone slider
  toneRange.addEventListener('input', () => {
    toneDisplay.textContent = TONE_LABELS[toneRange.value];
  });
  toneDisplay.textContent = TONE_LABELS[toneRange.value];

  // API KeyをlocalStorageから復元
  const savedKey = localStorage.getItem(API_KEY_STORAGE_KEY);
  if (savedKey) {
    $('#api-key-input').value = savedKey;
  }

  // API Key変更時に自動保存
  $('#api-key-input').addEventListener('input', () => {
    const key = $('#api-key-input').value.trim();
    if (key) {
      localStorage.setItem(API_KEY_STORAGE_KEY, key);
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
  });

  // Buttons
  $('#btn-generate').addEventListener('click', () => handleGenerate($, 'normal'));
  $('#btn-alternative').addEventListener('click', () => handleGenerate($, 'alternative'));
  $('#btn-strong-counter').addEventListener('click', () => handleGenerate($, 'strong_counter'));

  // クリアボタン
  $('#btn-clear').addEventListener('click', () => handleClear($));
}

function handleClear($) {
  $('#fact-input').value = '';
  // API Keyは消さない（毎回入力し直すのは面倒なので）
  $('#mode-select').value = 'admin';
  $('#tone-range').value = '2';
  $('#tone-display').textContent = TONE_LABELS[2];
  hideOutput();
  // 念のためボタンを有効化
  isGenerating = false;
  setButtonsDisabled(false);
}

async function handleGenerate($, variant) {
  if (isGenerating) return;

  const fact = $('#fact-input').value.trim();
  if (!fact) {
    alert('Fact（事実）を入力してください');
    return;
  }

  const mode = $('#mode-select').value;
  const tone = parseInt($('#tone-range').value, 10);
  const apiKey = $('#api-key-input').value.trim();
  const isDemo = !apiKey;

  isGenerating = true;
  setButtonsDisabled(true);
  showLoading(true);
  hideOutput();

  try {
    const { data, meta } = await generate(fact, mode, tone, apiKey, variant);
    renderOutput(data, meta, isDemo, variant);
    document.querySelector('.output-section').scrollIntoView({ behavior: 'smooth' });
  } catch (e) {
    showError(e.message);
  } finally {
    isGenerating = false;
    setButtonsDisabled(false);
    showLoading(false);
  }
}

function setButtonsDisabled(disabled) {
  document.querySelectorAll('.btn').forEach((btn) => {
    btn.disabled = disabled;
  });
}

function showLoading(show) {
  const el = document.querySelector('.loading');
  el.classList.toggle('active', show);
}

function hideOutput() {
  document.querySelector('.output-section').classList.remove('active');
  document.querySelector('.gate-log').classList.remove('active');
  document.querySelector('.meta-info').classList.remove('active');
  const errorEl = document.querySelector('.error-message');
  if (errorEl) errorEl.classList.remove('active');
}

function showError(message) {
  const errorEl = document.querySelector('.error-message');
  errorEl.textContent = `エラー: ${message}`;
  errorEl.classList.add('active');
}

function renderOutput(data, meta, isDemo, variant) {
  const outputSection = document.querySelector('.output-section');
  const cardsContainer = document.querySelector('.cards-container');
  cardsContainer.innerHTML = '';

  // デモモード表示
  if (isDemo) {
    const variantLabel = variant === 'alternative' ? '【別案】' : variant === 'strong_counter' ? '【反対側強め】' : '';
    const demoBanner = document.createElement('div');
    demoBanner.className = 'demo-banner';
    demoBanner.innerHTML = `${variantLabel} デモモード — API Keyを入力すると、あなたの入力内容に合わせたAI回答が生成されます`;
    cardsContainer.appendChild(demoBanner);
  }

  CARD_DEFS.forEach((def) => {
    const card = createCard(def, data[def.key]);
    cardsContainer.appendChild(card);
  });

  outputSection.classList.add('active');

  // Meta info
  const metaEl = document.querySelector('.meta-info');
  let metaText = `試行回数: ${meta.attempt}`;
  if (meta.fallback) {
    metaText += ' <span class="fallback-badge">FALLBACK</span>';
  }
  metaEl.innerHTML = metaText;
  metaEl.classList.add('active');

  // Gate log
  const gateLogEl = document.querySelector('.gate-log');
  gateLogEl.querySelector('pre').textContent = meta.gateLog.join('\n');
  gateLogEl.classList.add('active');

  // Highlight flow diagram steps
  updateFlowDiagram(meta);
}

function createCard(def, value) {
  const card = document.createElement('div');
  card.className = 'card';

  const bodyHtml = renderCardBody(def.key, value);
  const copyText = getCardCopyText(def.key, value);

  card.innerHTML = `
    <div class="card-header">
      <div class="card-title">
        <span class="card-number">${def.number}</span>
        <span class="card-label">${def.label}</span>
      </div>
      <button class="btn-copy" data-copy-text="${escapeAttr(copyText)}">Copy</button>
    </div>
    <div class="card-body">${bodyHtml}</div>
  `;

  card.querySelector('.btn-copy').addEventListener('click', handleCopy);
  return card;
}

function renderCardBody(key, value) {
  switch (key) {
    case 'ichigeki':
      return `<p>${escapeHtml(value)}</p>`;
    case 'branching':
      return value.map((v) => `<div class="branch-item">${escapeHtml(v)}</div>`).join('');
    case 'onepager':
      return value.map((v) => `<div class="chapter-item">${escapeHtml(v)}</div>`).join('');
    case 'counter':
      return `
        <div class="counter-block objection">
          <div class="counter-label">OBJECTION</div>
          <p>${escapeHtml(value.objection)}</p>
        </div>
        <div class="counter-block response">
          <div class="counter-label">RESPONSE</div>
          <p>${escapeHtml(value.response)}</p>
        </div>`;
    case 'next_action':
      return `<p>${escapeHtml(value)}</p>`;
    default:
      return `<p>${escapeHtml(String(value))}</p>`;
  }
}

function getCardCopyText(key, value) {
  switch (key) {
    case 'ichigeki':
    case 'next_action':
      return value;
    case 'branching':
    case 'onepager':
      return value.join('\n');
    case 'counter':
      return `${value.objection}\n${value.response}`;
    default:
      return String(value);
  }
}

function handleCopy(e) {
  const btn = e.currentTarget;
  const text = btn.getAttribute('data-copy-text');
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = 'Copy';
      btn.classList.remove('copied');
    }, 1500);
  }).catch(() => {
    // Fallback: textarea copy
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = 'Copy';
      btn.classList.remove('copied');
    }, 1500);
  });
}

function updateFlowDiagram(meta) {
  document.querySelectorAll('.flow-step').forEach((el) => el.classList.remove('active'));
  if (meta.fallback) {
    document.querySelector('.flow-step.fallback')?.classList.add('active');
  } else if (meta.attempt === 1) {
    document.querySelector('.flow-step.ok')?.classList.add('active');
  } else {
    document.querySelector('.flow-step.retry')?.classList.add('active');
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
