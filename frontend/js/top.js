/* ===========================================
   top.js - トップページ（API連携版）
   =========================================== */

'use strict';

// ==========================================
// 商品一覧の読み込みと表示
// ==========================================

let currentPage = 1;
let currentCategory = null;
let currentSearch = null;
let isLoading = false;

async function loadProducts() {
    if (isLoading) return;
    isLoading = true;

    const grid = document.getElementById('products-grid');
    if (!grid) return;

    // ローディング表示
    grid.innerHTML = '<div class="loading-spinner">読み込み中...</div>';

    try {
        const data = await ProductApi.list({
            page: currentPage,
            perPage: 20,
            category: currentCategory,
            search: currentSearch,
        });

        if (!data.items || data.items.length === 0) {
            grid.innerHTML = '<p class="empty-message">商品が見つかりませんでした</p>';
            return;
        }

        grid.innerHTML = data.items.map(buildProductCardHTML).join('');

        // カードのクリックイベントを付加
        grid.querySelectorAll('[data-product-id]').forEach(function (card) {
            card.addEventListener('click', function () {
                const id = card.getAttribute('data-product-id');
                location.href = `detail.html?id=${encodeURIComponent(id)}`;
            });
            // Enterキーでも遷移
            card.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') card.click();
            });
        });

    } catch (err) {
        grid.innerHTML = `<p class="error-message">データの読み込みに失敗しました: ${escapeHtml(err.message)}</p>`;
    } finally {
        isLoading = false;
    }
}


// ==========================================
// アバター一覧の読み込みと表示
// ==========================================

async function loadAvatars() {
    const grid = document.getElementById('avatars-grid');
    if (!grid) return;

    try {
        const data = await AvatarApi.list();
        if (!data.items || data.items.length === 0) return;

        const colorClasses = ['color-purple', 'color-cyan', 'color-pink', 'color-orange'];

        grid.innerHTML = data.items.slice(0, 6).map(function (avatar, i) {
            const colorClass = colorClasses[i % colorClasses.length];
            const initial = avatar.name.charAt(0);
            const count = avatar.product_count ?? '-';
            return `
                <article class="card-base card-interactive avatar-card" data-avatar-id="${escapeHtml(avatar.id)}" role="button" tabindex="0">
                    <div class="avatar-icon ${colorClass}">${escapeHtml(initial)}</div>
                    <div>
                        <div class="avatar-card-info-name">${escapeHtml(avatar.name)}</div>
                        <div class="avatar-card-info-count">対応商品数: ${count}件</div>
                    </div>
                </article>
            `;
        }).join('');

        grid.querySelectorAll('[data-avatar-id]').forEach(function (card) {
            card.addEventListener('click', function () {
                const id = card.getAttribute('data-avatar-id');
                location.href = `avatar.html?id=${encodeURIComponent(id)}`;
            });
            card.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') card.click();
            });
        });

    } catch (err) {
        console.error('アバター読み込みエラー:', err);
    }
}


// ==========================================
// 商品URL登録モーダル
// ==========================================

async function handleRegister(e) {
    e.preventDefault();
    const input = document.getElementById('register-url-input');
    const submitBtn = document.getElementById('register-submit-btn');
    const url = input ? input.value.trim() : '';

    if (!url) {
        showToast('URLを入力してください', 'error');
        return;
    }

    if (!Auth.isLoggedIn()) {
        showToast('商品を登録するにはログインが必要です', 'error');
        openModal('auth-modal');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = '取得中...';

    try {
        const product = await ProductApi.register(url);
        showToast(`「${product.title}」を登録しました！`, 'success');
        closeModal('register-modal');
        input.value = '';
        // 一覧を再読み込み
        currentPage = 1;
        await loadProducts();
    } catch (err) {
        showToast(err.message || '登録に失敗しました', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '商品を登録する';
    }
}


// ==========================================
// 検索
// ==========================================

let searchDebounce = null;

function handleSearch(e) {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(async function () {
        currentSearch = e.target.value.trim() || null;
        currentPage = 1;
        await loadProducts();
    }, 400);
}


// ==========================================
// カテゴリチップ
// ==========================================

function initCategoryChips() {
    const chips = document.querySelectorAll('.category-chip');
    chips.forEach(function (chip) {
        chip.addEventListener('click', async function () {
            chips.forEach(function (c) { c.classList.remove('active'); });
            chip.classList.add('active');
            currentCategory = chip.getAttribute('data-category') || null;
            currentPage = 1;
            await loadProducts();
        });
    });
}


// ==========================================
// 初期化
// ==========================================

document.addEventListener('DOMContentLoaded', async function () {
    // 商品一覧・アバター一覧を並行読み込み
    await Promise.all([loadProducts(), loadAvatars()]);

    // 検索入力
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.addEventListener('input', handleSearch);

    // カテゴリチップ
    initCategoryChips();

    // 商品登録フォーム
    const registerForm = document.getElementById('register-form');
    if (registerForm) registerForm.addEventListener('submit', handleRegister);

    // 商品登録ボタン → モーダルを開く
    const registerOpenBtn = document.getElementById('open-register-btn');
    if (registerOpenBtn) {
        registerOpenBtn.addEventListener('click', function () {
            if (!Auth.isLoggedIn()) {
                showToast('商品を登録するにはログインが必要です', 'error');
                openModal('auth-modal');
                return;
            }
            openModal('register-modal');
        });
    }
});
