/* ===========================================
   common.js - テーマ切替・ナビ・認証UI共通処理
   =========================================== */

'use strict';

// ==========================================
// テーマ管理
// ==========================================
const THEME_KEY = 'boothdb-theme';

function getCurrentTheme() {
    return localStorage.getItem(THEME_KEY) || 'dark';
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) {
        btn.textContent = theme === 'dark' ? '☀️' : '🌙';
        btn.title = theme === 'dark' ? 'ライトモードに切替' : 'ダークモードに切替';
    }
}

function toggleTheme() {
    applyTheme(getCurrentTheme() === 'dark' ? 'light' : 'dark');
}


// ==========================================
// ナビゲーション アクティブ制御
// ==========================================
function setActiveNav() {
    const filename = location.pathname.split('/').pop() || 'index.html';
    const map = {
        'index.html': 'nav-top',
        '':           'nav-top',
        'detail.html': 'nav-detail',
        'avatar.html': 'nav-avatar',
    };
    const id = map[filename];
    if (id) {
        const el = document.getElementById(id);
        if (el) el.classList.add('active');
    }
}


// ==========================================
// 認証UI（ヘッダーのログイン表示）
// ==========================================
function updateAuthUI() {
    const loginBtn  = document.getElementById('nav-login-btn');
    const logoutBtn = document.getElementById('nav-logout-btn');
    const userLabel = document.getElementById('nav-username');

    if (!loginBtn) return;

    if (Auth.isLoggedIn()) {
        const user = Auth.getUser();
        loginBtn.style.display  = 'none';
        logoutBtn.style.display = 'inline-flex';
        if (userLabel && user) userLabel.textContent = user.username;
    } else {
        loginBtn.style.display  = 'inline-flex';
        logoutBtn.style.display = 'none';
    }
}


// ==========================================
// モーダル共通ユーティリティ
// ==========================================

/**
 * モーダルを開く
 * @param {string} modalId - モーダル要素のID
 */
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('modal-open');
        document.body.style.overflow = 'hidden';
    }
}

/**
 * モーダルを閉じる
 * @param {string} modalId - モーダル要素のID
 */
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('modal-open');
        document.body.style.overflow = '';
    }
}


// ==========================================
// トースト通知
// ==========================================

let toastTimer = null;

/**
 * トースト通知を表示する
 * @param {string} message - メッセージ
 * @param {'success'|'error'|'info'} type - 種類
 */
function showToast(message, type = 'info') {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = `toast toast-${type} toast-show`;

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove('toast-show');
    }, 3500);
}


// ==========================================
// 商品カードHTMLを生成するユーティリティ
// ==========================================

/**
 * 商品データからカードのHTML文字列を生成する
 * @param {object} product - 商品データ
 * @returns {string} HTML文字列
 */
function buildProductCardHTML(product) {
    const hasDiscount = product.original_price && product.original_price > product.current_price;
    const discountPct = hasDiscount
        ? Math.round((1 - product.current_price / product.original_price) * 100)
        : 0;

    const priceHTML = hasDiscount
        ? `<span class="p-card-orig-price">¥${product.original_price.toLocaleString()}</span>
           <span class="p-card-current-price is-discount">¥${product.current_price.toLocaleString()}</span>`
        : `<span class="p-card-current-price">¥${(product.current_price || 0).toLocaleString()}</span>`;

    const thumbHTML = product.thumbnail_url
        ? `<img class="p-card-thumb-img" src="${escapeHtml(product.thumbnail_url)}" alt="${escapeHtml(product.title)}" loading="lazy">`
        : `<div class="p-card-thumb-placeholder">${escapeHtml(product.title)}</div>`;

    const labelHTML = hasDiscount
        ? `<span class="p-card-label">-${discountPct}% OFF</span>`
        : '';

    return `
        <article class="card-base card-interactive" data-product-id="${escapeHtml(product.id)}" role="button" tabindex="0">
            <div class="p-card-thumb">
                ${thumbHTML}
                ${labelHTML}
            </div>
            <div class="p-card-body">
                <h3 class="p-card-title">${escapeHtml(product.title)}</h3>
                <p class="p-card-creator">${escapeHtml(product.creator_name || '')}</p>
                <div class="p-card-footer">
                    <div class="p-card-price-stack">${priceHTML}</div>
                </div>
            </div>
        </article>
    `;
}

/**
 * XSS対策：文字列をHTMLエスケープする
 */
function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}


// ==========================================
// ページ初期化
// ==========================================
document.addEventListener('DOMContentLoaded', function () {
    applyTheme(getCurrentTheme());
    setActiveNav();
    updateAuthUI();

    // テーマトグルボタン
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    // ログアウトボタン
    const logoutBtn = document.getElementById('nav-logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function () {
            AuthApi.logout();
            showToast('ログアウトしました', 'info');
            updateAuthUI();
        });
    }

    // ログインボタン → モーダルを開く
    const loginBtn = document.getElementById('nav-login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', function () {
            openModal('auth-modal');
        });
    }

    // モーダル外クリックで閉じる
    document.querySelectorAll('.modal-overlay').forEach(function (overlay) {
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) {
                overlay.classList.remove('modal-open');
                document.body.style.overflow = '';
            }
        });
    });

    // モーダル閉じるボタン
    document.querySelectorAll('.modal-close-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const modal = btn.closest('.modal-overlay');
            if (modal) {
                modal.classList.remove('modal-open');
                document.body.style.overflow = '';
            }
        });
    });

    // ログイン / 登録タブ切替
    const tabLogin    = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const formLogin   = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');

    if (tabLogin && tabRegister) {
        tabLogin.addEventListener('click', function () {
            tabLogin.classList.add('active');
            tabRegister.classList.remove('active');
            formLogin.style.display = 'block';
            formRegister.style.display = 'none';
        });
        tabRegister.addEventListener('click', function () {
            tabRegister.classList.add('active');
            tabLogin.classList.remove('active');
            formRegister.style.display = 'block';
            formLogin.style.display = 'none';
        });
    }

    // ログインフォーム送信
    if (formLogin) {
        formLogin.addEventListener('submit', async function (e) {
            e.preventDefault();
            const email    = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;
            const submitBtn = formLogin.querySelector('button[type="submit"]');

            submitBtn.disabled = true;
            submitBtn.textContent = 'ログイン中...';

            try {
                await AuthApi.login(email, password);
                closeModal('auth-modal');
                showToast('ログインしました', 'success');
                updateAuthUI();
            } catch (err) {
                showToast(err.message || 'ログインに失敗しました', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'ログイン';
            }
        });
    }

    // 登録フォーム送信
    if (formRegister) {
        formRegister.addEventListener('submit', async function (e) {
            e.preventDefault();
            const email     = document.getElementById('register-email').value.trim();
            const password  = document.getElementById('register-password').value;
            const username  = document.getElementById('register-username').value.trim();
            const submitBtn = formRegister.querySelector('button[type="submit"]');

            submitBtn.disabled = true;
            submitBtn.textContent = '登録中...';

            try {
                await AuthApi.register(email, password, username);
                showToast('登録しました！確認メールをご確認ください', 'success');
                closeModal('auth-modal');
            } catch (err) {
                showToast(err.message || '登録に失敗しました', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = '登録する';
            }
        });
    }
});
