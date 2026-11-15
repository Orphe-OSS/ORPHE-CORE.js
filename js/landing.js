// Landing page behaviour: language toggle and copy buttons.
// The initial language is applied by the inline script in <head> (before first paint).
(function () {
  'use strict';

  var STORAGE_KEY = 'orphe-core-js-language';
  var root = document.documentElement;

  function applyLanguage(next, persist) {
    var lang = next === 'ja' ? 'ja' : 'en';
    root.lang = lang;
    root.dataset.lang = lang;
    if (!persist) return;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Ignore storage failures in private or restricted browser contexts.
    }
  }

  function toggleLanguage() {
    applyLanguage(root.dataset.lang === 'ja' ? 'en' : 'ja', true);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(area);
      if (ok) resolve();
      else reject(new Error('copy failed'));
    });
  }

  document.querySelectorAll('[data-lang-toggle]').forEach(function (button) {
    button.addEventListener('click', toggleLanguage);
  });

  document.querySelectorAll('[data-copy-target]').forEach(function (button) {
    var label = button.textContent;
    button.addEventListener('click', function () {
      var target = document.getElementById(button.dataset.copyTarget);
      if (!target) return;
      // Code comments carry both languages; copy only the visible one.
      var clone = target.cloneNode(true);
      var hidden = root.dataset.lang === 'ja' ? '.en' : '.ja';
      clone.querySelectorAll(hidden).forEach(function (node) { node.remove(); });
      copyText(clone.textContent).then(function () {
        button.textContent = 'COPIED';
        setTimeout(function () { button.textContent = label; }, 1200);
      }).catch(function () {
        button.textContent = 'FAILED';
        setTimeout(function () { button.textContent = label; }, 1200);
      });
    });
  });

  // Kept for links or bookmarks that call the old global.
  window.toggleLanguage = toggleLanguage;
})();
