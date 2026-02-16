import './style.css';
import { initApp } from './app.js';

// PWA: Service Worker登録
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // SW登録失敗は致命的でないため無視
    });
  });
}

// アプリ初期化
document.addEventListener('DOMContentLoaded', initApp);
