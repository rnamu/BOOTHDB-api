/* ===========================================
   top.js - トップページ（API連携版）
   =========================================== */

'use strict';

let currentPage = 1;
let currentCategory = null;
let currentSearch = null;
let isLoading = false;

// ==========================================
// 商品一覧の読み込みと表示
// ==========================================

async function loadProducts() {
    if (isLoading) return;
    isLoading = true;

    const grid = document.getElementById('products-grid');
    if (!grid) return;

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

        grid.querySelectorAll('[data-product-id]').forEach(function (card) {
            card.addEventListener('click', function () {
                const id = card.getAttribute('data-product-id');
                location.href = `detail.html?id=${encodeURIComponent(id)}`;
            });
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
// 新着商品の読み込みと表示
// ==========================================

async function loadNewProducts() {
    const grid = document.getElementById('new-products-grid');
    if (!grid) return;

    try {
        const data = await ProductApi.listNew(6);
        if (!data.items || data.items.length === 0) {
            grid.innerHTML = '<p class="empty-message">まだ新着商品がありません</p>';
            return;
        }

        grid.innerHTML = data.items.map(buildProductCardHTML).join('');

        grid.querySelectorAll('[data-product-id]').forEach(function (card) {
            card.addEventListener('click', function () {
                location.href = `detail.html?id=${encodeURIComponent(card.getAttribute('data-product-id'))}`;
            });
        });
    } catch (err) {
        console.error('新着商品読み込みエラー:', err);
    }
}


// ==========================================
// セール中商品の読み込みと表示
// ==========================================

async function loadSaleProducts() {
    const grid = document.getElementById('sale-products-grid');
    if (!grid) return;

    try {
        const data = await ProductApi.listSale(6);
        if (!data.items || data.items.length === 0) {
            grid.innerHTML = '<p class="empty-message">現在セール中の商品はありません</p>';
            return;
        }

        grid.innerHTML = data.items.map(function (p) {
            // セール中商品はoriginal_priceを使ってカードに割引表示する
            return buildProductCardHTML({ ...p, original_price: p.original_price });
        }).join('');

        grid.querySelectorAll('[data-product-id]').forEach(function (card) {
            card.addEventListener('click', function () {
                location.href = `detail.html?id=${encodeURIComponent(card.getAttribute('data-product-id'))}`;
            });
        });
    } catch (err) {
        console.error('セール商品読み込みエラー:', err);
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
        currentPage = 1;
        await loadProducts();
    } catch (err) {
        if (err.status === 401) {
            showToast('ログインの有効期限が切れました。再度ログインしてください', 'error');
            Auth.removeToken();
            updateAuthUI();
            openModal('auth-modal');
        } else {
            showToast(err.message || '登録に失敗しました', 'error');
        }
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
// カテゴリチップ（BOOTHの実際のカテゴリ）
// ==========================================

async function loadCategoryChips() {
    const container = document.getElementById('category-chips');
    if (!container) return;

    try {
        const data = await CategoryApi.list();
        const categories = data.items || [];

        const allChip = `<button class="category-chip active" data-category="">🔥 すべて表示</button>`;
        const chips = categories.map(function (cat) {
            return `<button class="category-chip" data-category="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`;
        }).join('');

        container.innerHTML = allChip + chips;
        initCategoryChips();
    } catch (err) {
        console.error('カテゴリ読み込みエラー:', err);
    }
}

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
    await Promise.all([
        loadProducts(),
        loadNewProducts(),
        loadSaleProducts(),
        loadCategoryChips(),
    ]);

    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.addEventListener('input', handleSearch);

    const registerForm = document.getElementById('register-form');
    if (registerForm) registerForm.addEventListener('submit', handleRegister);

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
