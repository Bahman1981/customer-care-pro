// ══════════════════════════════════════════════════════════════
//  Customer Care System — PWA Mobile Enhancements
//  أضف هذا الملف في index.html قبل إغلاق </body>
//  <script src="pwa.js"></script>
// ══════════════════════════════════════════════════════════════

(function() {
  'use strict';

  // ── 1. تسجيل Service Worker ──────────────────────────────
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' })
        .then(reg => {
          console.log('[PWA] Service Worker registered:', reg.scope);

          // تحقق من وجود تحديث
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                showUpdateBanner();
              }
            });
          });
        })
        .catch(err => console.warn('[PWA] SW registration failed:', err));

      // إعادة تحميل عند تفعيل SW جديد
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) { refreshing = true; location.reload(); }
      });
    });
  }

  // ── 2. زر "إضافة للشاشة الرئيسية" ──────────────────────
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallButton();
  });

  function showInstallButton() {
    // تحقق أنه ليس مثبتاً بالفعل
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const btn = document.createElement('div');
    btn.id = '_pwaInstallBtn';
    btn.innerHTML = `
      <div style="
        position:fixed;bottom:calc(20px + env(safe-area-inset-bottom));left:50%;
        transform:translateX(-50%);
        background:linear-gradient(135deg,#1d4ed8,#3b82f6);
        color:#fff;border-radius:16px;padding:12px 22px;
        font-family:Cairo,sans-serif;font-size:13px;font-weight:700;
        box-shadow:0 8px 32px rgba(37,99,235,.45);
        display:flex;align-items:center;gap:10px;cursor:pointer;
        z-index:99999;border:1px solid rgba(255,255,255,.2);
        backdrop-filter:blur(8px);white-space:nowrap;
        animation:_pwaSlideUp .4s cubic-bezier(.34,1.56,.64,1);
      " onclick="window._pwaInstall()">
        <span style="font-size:20px;">📲</span>
        <div>
          <div>أضف للشاشة الرئيسية</div>
          <div style="font-size:10px;opacity:.8;font-weight:400;">للوصول السريع بدون متصفح</div>
        </div>
        <span onclick="event.stopPropagation();document.getElementById('_pwaInstallBtn').remove()" 
          style="margin-right:4px;opacity:.6;font-size:18px;line-height:1;">✕</span>
      </div>`;
    
    const style = document.createElement('style');
    style.textContent = `@keyframes _pwaSlideUp{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`;
    document.head.appendChild(style);
    document.body.appendChild(btn);

    // إخفاء بعد 8 ثوانٍ
    setTimeout(() => btn.remove(), 8000);
  }

  window._pwaInstall = async function() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[PWA] Install outcome:', outcome);
    deferredPrompt = null;
    document.getElementById('_pwaInstallBtn')?.remove();
  };

  // إخفاء زر التثبيت بعد التثبيت
  window.addEventListener('appinstalled', () => {
    document.getElementById('_pwaInstallBtn')?.remove();
    deferredPrompt = null;
    showPWAToast('✅ تم تثبيت التطبيق بنجاح!', '#10b981');
  });

  // ── 3. بانر التحديث ──────────────────────────────────────
  function showUpdateBanner() {
    const banner = document.createElement('div');
    banner.innerHTML = `
      <div style="
        position:fixed;top:0;left:0;right:0;z-index:99999;
        background:linear-gradient(90deg,#059669,#10b981);
        color:#fff;padding:12px 20px;
        font-family:Cairo,sans-serif;font-size:13px;font-weight:700;
        display:flex;align-items:center;justify-content:space-between;
        padding-top:calc(12px + env(safe-area-inset-top));
        box-shadow:0 4px 20px rgba(16,185,129,.4);
      ">
        <span>🆕 يوجد تحديث جديد للتطبيق</span>
        <button onclick="location.reload()" style="
          background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.3);
          color:#fff;padding:6px 14px;border-radius:8px;cursor:pointer;
          font-family:Cairo,sans-serif;font-size:12px;font-weight:700;
        ">تحديث الآن</button>
      </div>`;
    document.body.prepend(banner);
  }

  // ── 4. مؤشر الاتصال (Online/Offline) ────────────────────
  function initNetworkIndicator() {
    const bar = document.createElement('div');
    bar.id = '_pwaNetBar';
    bar.style.cssText = `
      position:fixed;top:0;left:0;right:0;z-index:99998;
      height:3px;background:transparent;transition:all .3s;
      display:none;
    `;
    document.body.appendChild(bar);

    function updateNet() {
      const bar = document.getElementById('_pwaNetBar');
      if (!bar) return;
      if (!navigator.onLine) {
        bar.style.background = '#ef4444';
        bar.style.display = 'block';
        bar.style.height = '3px';
        showPWAToast('🔴 انقطع الاتصال — البيانات المحلية متاحة', '#ef4444');
      } else {
        bar.style.background = '#10b981';
        bar.style.height = '3px';
        bar.style.display = 'block';
        showPWAToast('🟢 عاد الاتصال بالإنترنت', '#10b981');
        setTimeout(() => { bar.style.display = 'none'; }, 3000);
      }
    }

    window.addEventListener('online', updateNet);
    window.addEventListener('offline', updateNet);
  }

  // ── 5. Toast خاص بـ PWA ──────────────────────────────────
  function showPWAToast(msg, color = '#3b82f6') {
    const t = document.createElement('div');
    t.style.cssText = `
      position:fixed;top:calc(20px + env(safe-area-inset-top));
      left:50%;transform:translateX(-50%);
      background:${color};color:#fff;
      padding:10px 20px;border-radius:12px;
      font-family:Cairo,sans-serif;font-size:13px;font-weight:700;
      box-shadow:0 6px 24px rgba(0,0,0,.3);z-index:99999;
      animation:_pwaSlideDown .3s ease;white-space:nowrap;
    `;
    t.textContent = msg;
    const s = document.createElement('style');
    s.textContent = `@keyframes _pwaSlideDown{from{opacity:0;transform:translateX(-50%) translateY(-10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`;
    document.head.appendChild(s);
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  // ── 6. تحسينات iOS Safari ────────────────────────────────
  function initIOSEnhancements() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.navigator.standalone;

    if (isIOS && !isStandalone) {
      // إظهار تعليمات iOS إضافة للشاشة الرئيسية
      const shown = sessionStorage.getItem('_pwaIOSShown');
      if (!shown) {
        setTimeout(() => showIOSInstallHint(), 3000);
        sessionStorage.setItem('_pwaIOSShown', '1');
      }
    }

    if (isIOS && isStandalone) {
      // ✅ CSS فقط بدون منع touchmove لضمان عمل التمرير
      document.documentElement.style.overscrollBehavior = 'none';
      document.body.style.overscrollBehavior = 'none';
    }
  }

  function showIOSInstallHint() {
    const hint = document.createElement('div');
    hint.style.cssText = `
      position:fixed;bottom:0;left:0;right:0;z-index:99999;
      background:linear-gradient(0deg,rgba(15,23,42,.98),rgba(30,58,138,.95));
      color:#fff;padding:20px 24px calc(20px + env(safe-area-inset-bottom));
      font-family:Cairo,sans-serif;border-top:1px solid rgba(255,255,255,.1);
      backdrop-filter:blur(12px);animation:_pwaSlideUp .4s ease;
      box-shadow:0 -8px 32px rgba(0,0,0,.4);
    `;
    hint.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:14px;">
        <span style="font-size:32px;flex-shrink:0;">📱</span>
        <div style="flex:1">
          <div style="font-weight:800;font-size:15px;margin-bottom:6px;">أضف للشاشة الرئيسية</div>
          <div style="font-size:13px;color:rgba(147,197,253,.9);line-height:1.7;">
            اضغط على <strong style="color:#60a5fa;">مشاركة ↑</strong> ثم<br>
            اختر <strong style="color:#60a5fa;">"أضف إلى الشاشة الرئيسية"</strong>
          </div>
        </div>
        <button onclick="this.closest('div').parentElement.remove()" style="
          background:rgba(255,255,255,.1);border:none;color:rgba(255,255,255,.6);
          font-size:20px;width:32px;height:32px;border-radius:50%;cursor:pointer;
          display:flex;align-items:center;justify-content:center;flex-shrink:0;
        ">✕</button>
      </div>
      <div style="margin-top:14px;display:flex;align-items:center;gap:6px;
        padding:10px 14px;background:rgba(255,255,255,.06);border-radius:10px;
        border:1px solid rgba(255,255,255,.1);">
        <span style="font-size:18px;">⬆️</span>
        <span style="font-size:12px;color:rgba(147,197,253,.8);">شريط الأدوات → مشاركة → أضف إلى الشاشة الرئيسية</span>
      </div>
    `;
    document.body.appendChild(hint);
    setTimeout(() => hint.remove(), 10000);
  }

  // ── 7. تحسينات الأداء على الجوال ────────────────────────
  function initMobilePerformance() {
    // تحسين التمرير للعناصر القابلة للتمرير فقط
    document.querySelectorAll('.sidebar, .page-body, .sb-nav, .inbox-scrl').forEach(el => {
      el.style.webkitOverflowScrolling = 'touch';
      el.style.overscrollBehavior = 'contain';
    });

    // ✅ إضافة passive:true لمنع تعطيل التمرير الأفقي والعمودي
    document.addEventListener('touchstart', () => {}, { passive: true });
    document.addEventListener('touchmove', () => {}, { passive: true });

    // Haptic Feedback للأزرار (إن توفّر)
    document.addEventListener('click', e => {
      if (e.target.closest('.btn, .nav-item, .wa-btn, button')) {
        if (navigator.vibrate) navigator.vibrate(10);
      }
    }, { passive: true });
  }

  // ── 8. إدارة الـ Status Bar ──────────────────────────────
  function initStatusBarColor() {
    // تغيير لون شريط الحالة حسب الثيم
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;

    const observer = new MutationObserver(() => {
      const isDark = document.body.classList.contains('dark');
      meta.content = isDark ? '#0f172a' : '#3b82f6';
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  // ── 9. Back Button Android ────────────────────────────────
  function initAndroidBack() {
    if (!window.history || !window.history.pushState) return;
    
    // أضف entry في history لالتقاط زر الرجوع
    window.history.pushState({ pwa: true }, '');
    
    window.addEventListener('popstate', e => {
      if (document.querySelector('.modal-ov.show, .inbox-ov.show, #helpGuideModal.show')) {
        // أغلق أي مودال مفتوح
        document.querySelectorAll('.modal-ov.show, .inbox-ov.show, #helpGuideModal.show').forEach(m => {
          m.classList.remove('show');
        });
        window.history.pushState({ pwa: true }, '');
        return;
      }
      // أعد الـ entry لمنع الخروج من التطبيق
      if (e.state?.pwa) {
        window.history.pushState({ pwa: true }, '');
      }
    });
  }

  // ── 10. تشغيل كل شيء ─────────────────────────────────────
  window.addEventListener('DOMContentLoaded', () => {
    initNetworkIndicator();
    initIOSEnhancements();
    initMobilePerformance();
    initStatusBarColor();
    initAndroidBack();

    // تحديث لون الثيم فور التحميل
    const metaTheme = document.createElement('meta');
    metaTheme.name = 'theme-color';
    metaTheme.content = '#3b82f6';
    document.head.appendChild(metaTheme);

    console.log('[PWA] Mobile enhancements initialized ✅');
  });

  // كشف وضع Standalone (مثبّت كـ PWA)
  if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
    document.documentElement.setAttribute('data-pwa', 'true');
    console.log('[PWA] Running as installed app ✅');
  }

})();
