(function () {
  'use strict';

  var ua = navigator.userAgent || '';
  var isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  var navigatorStandalone = window.navigator.standalone === true;

  if (!isIOS || isStandalone || navigatorStandalone) return;

  var isSafari = /Safari/i.test(ua) && !/(CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo)/i.test(ua);
  var storageKey = 'moldatk-ios-install-dismissed-at-v1';
  var dismissedAt = 0;
  try { dismissedAt = Number(localStorage.getItem(storageKey) || 0); } catch (_) {}
  if (dismissedAt && Date.now() - dismissedAt < 12 * 60 * 60 * 1000) return;

  function addStyles() {
    if (document.getElementById('moldatk-ios-install-style')) return;
    var style = document.createElement('style');
    style.id = 'moldatk-ios-install-style';
    style.textContent = [
      '#moldatk-ios-install-banner{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:2147483000;background:#fff;color:#0B1F3B;border:1px solid #d9e2ea;border-radius:20px;box-shadow:0 18px 50px rgba(11,31,59,.22);padding:14px;font-family:Cairo,Tajawal,-apple-system,BlinkMacSystemFont,Arial,sans-serif;direction:rtl}',
      '#moldatk-ios-install-banner *{box-sizing:border-box}',
      '.moldatk-ios-install-row{display:flex;align-items:center;gap:12px}',
      '.moldatk-ios-install-icon{width:48px;height:48px;border-radius:14px;background:#0B1F3B;display:flex;align-items:center;justify-content:center;flex:0 0 auto;overflow:hidden}',
      '.moldatk-ios-install-icon img{width:38px;height:38px;object-fit:contain}',
      '.moldatk-ios-install-copy{min-width:0;flex:1}',
      '.moldatk-ios-install-title{font-size:15px;font-weight:900;line-height:1.4}',
      '.moldatk-ios-install-sub{font-size:11px;font-weight:700;color:#667689;margin-top:3px;line-height:1.55}',
      '.moldatk-ios-install-actions{display:flex;gap:8px;margin-top:12px}',
      '.moldatk-ios-install-primary,.moldatk-ios-install-later{border:0;border-radius:13px;padding:11px 14px;font-family:inherit;font-weight:900;font-size:13px;cursor:pointer}',
      '.moldatk-ios-install-primary{background:#0B1F3B;color:#fff;flex:1}',
      '.moldatk-ios-install-later{background:#f1f5f9;color:#506174}',
      '#moldatk-ios-install-overlay{position:fixed;inset:0;z-index:2147483001;background:rgba(5,17,35,.58);backdrop-filter:blur(3px);display:flex;align-items:flex-end;justify-content:center;direction:rtl;font-family:Cairo,Tajawal,-apple-system,BlinkMacSystemFont,Arial,sans-serif}',
      '.moldatk-ios-install-sheet{width:min(100%,520px);background:#fff;color:#0B1F3B;border-radius:26px 26px 0 0;padding:22px 18px calc(22px + env(safe-area-inset-bottom));box-shadow:0 -18px 60px rgba(5,17,35,.3)}',
      '.moldatk-ios-install-sheet h2{margin:0;font-size:21px;font-weight:900}',
      '.moldatk-ios-install-sheet p{margin:7px 0 0;color:#667689;font-size:12px;font-weight:700;line-height:1.8}',
      '.moldatk-ios-step{display:flex;align-items:center;gap:12px;margin-top:12px;padding:13px;border:1px solid #e1e8ef;border-radius:16px;background:#f8fafc}',
      '.moldatk-ios-step-num{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#0B1F3B;color:#fff;font-weight:900;flex:0 0 auto}',
      '.moldatk-ios-step-text{font-size:13px;font-weight:900;line-height:1.7}',
      '.moldatk-ios-share-mark{font-size:19px;vertical-align:middle}',
      '.moldatk-ios-install-done,.moldatk-ios-install-copylink{width:100%;margin-top:14px;border:0;border-radius:15px;padding:13px 14px;font-family:inherit;font-size:14px;font-weight:900;cursor:pointer}',
      '.moldatk-ios-install-done{background:#0B1F3B;color:#fff}',
      '.moldatk-ios-install-copylink{background:#eaf1f7;color:#0B1F3B}',
      '.moldatk-ios-install-note{margin-top:12px!important;text-align:center;color:#718096!important;font-size:11px!important}',
      '@media(min-width:600px){#moldatk-ios-install-banner{left:50%;right:auto;width:430px;transform:translateX(-50%)}}'
    ].join('');
    document.head.appendChild(style);
  }

  function removeBanner() {
    var banner = document.getElementById('moldatk-ios-install-banner');
    if (banner) banner.remove();
  }

  function closeOverlay() {
    var overlay = document.getElementById('moldatk-ios-install-overlay');
    if (overlay) overlay.remove();
  }

  function copyCurrentUrl(button) {
    var url = window.location.origin + '/';
    var done = function () {
      if (!button) return;
      var old = button.textContent;
      button.textContent = 'تم نسخ الرابط';
      setTimeout(function () { button.textContent = old; }, 1800);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(function () {});
    }
  }

  function openInstructions() {
    if (document.getElementById('moldatk-ios-install-overlay')) return;

    var overlay = document.createElement('div');
    overlay.id = 'moldatk-ios-install-overlay';

    var sheet = document.createElement('div');
    sheet.className = 'moldatk-ios-install-sheet';

    if (isSafari) {
      sheet.innerHTML = '' +
        '<h2>تثبيت مولدتك على الآيفون</h2>' +
        '<p>ما يحتاج متجر ولا حساب مطور. من Safari سوّي هالثلاث خطوات مرة وحدة فقط:</p>' +
        '<div class="moldatk-ios-step"><span class="moldatk-ios-step-num">1</span><div class="moldatk-ios-step-text">اضغط زر المشاركة <span class="moldatk-ios-share-mark">⬆️</span> بأسفل أو أعلى Safari.</div></div>' +
        '<div class="moldatk-ios-step"><span class="moldatk-ios-step-num">2</span><div class="moldatk-ios-step-text">اختار «إضافة إلى الشاشة الرئيسية».</div></div>' +
        '<div class="moldatk-ios-step"><span class="moldatk-ios-step-num">3</span><div class="moldatk-ios-step-text">اضغط «إضافة». بعدها راح تظهر أيقونة مولدتك ويا التطبيقات.</div></div>' +
        '<button type="button" class="moldatk-ios-install-done">تمام، فهمت</button>' +
        '<p class="moldatk-ios-install-note">بعد التثبيت يفتح مولدتك بواجهة مستقلة بدون شريط Safari.</p>';
    } else {
      sheet.innerHTML = '' +
        '<h2>افتح مولدتك في Safari</h2>' +
        '<p>حتى تضيفه كتطبيق على الآيفون، افتح نفس الرابط في Safari وبعدها راح تظهر إرشادات التثبيت مباشرة.</p>' +
        '<button type="button" class="moldatk-ios-install-copylink">نسخ رابط مولدتك</button>' +
        '<button type="button" class="moldatk-ios-install-done">إغلاق</button>';
    }

    overlay.appendChild(sheet);
    document.body.appendChild(overlay);

    var doneButton = sheet.querySelector('.moldatk-ios-install-done');
    if (doneButton) doneButton.addEventListener('click', closeOverlay);
    var copyButton = sheet.querySelector('.moldatk-ios-install-copylink');
    if (copyButton) copyButton.addEventListener('click', function () { copyCurrentUrl(copyButton); });
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) closeOverlay();
    });
  }

  function showBanner() {
    if (!document.body || document.getElementById('moldatk-ios-install-banner')) return;
    addStyles();

    var banner = document.createElement('div');
    banner.id = 'moldatk-ios-install-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'تثبيت مولدتك على الآيفون');
    banner.innerHTML = '' +
      '<div class="moldatk-ios-install-row">' +
        '<div class="moldatk-ios-install-icon"><img src="/brand/moldatk-mark.svg" alt=""></div>' +
        '<div class="moldatk-ios-install-copy"><div class="moldatk-ios-install-title">ثبّت مولدتك على الآيفون</div><div class="moldatk-ios-install-sub">بدون App Store — يظهر ويا تطبيقاتك ويفتح مباشرة.</div></div>' +
      '</div>' +
      '<div class="moldatk-ios-install-actions">' +
        '<button type="button" class="moldatk-ios-install-primary">طريقة التثبيت</button>' +
        '<button type="button" class="moldatk-ios-install-later">لاحقاً</button>' +
      '</div>';

    document.body.appendChild(banner);

    var primary = banner.querySelector('.moldatk-ios-install-primary');
    var later = banner.querySelector('.moldatk-ios-install-later');
    if (primary) primary.addEventListener('click', openInstructions);
    if (later) later.addEventListener('click', function () {
      try { localStorage.setItem(storageKey, String(Date.now())); } catch (_) {}
      removeBanner();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(showBanner, 700); }, { once: true });
  } else {
    setTimeout(showBanner, 700);
  }
})();
