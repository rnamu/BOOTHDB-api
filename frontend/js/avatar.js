/* ===========================================
   avatar.js - アバター別ページ（API連携版）
   =========================================== */

'use strict';

let currentAvatarId = null;
let currentPage     = 1;
let currentCategory = null;
let currentSort     = 'popular';
let currentSearch   = null;
let isLoading       = false;

// ==========================================
// アバター情報の読み込みと表示
// ==========================================

async function loadAvatarInfo() {
    if (!currentAvatarId) return;

    try {
        const avatar = await AvatarApi.get(currentAvatarId);

        const nameEl = document.getElementById('avatar-name');
        if (nameEl) nameEl.textContent = avatar.name;

        const iconEl = document.getElementById('avatar-icon');
        if (iconEl) iconEl.textContent = avatar.name.charAt(0);

        const subEl = document.getElementById('avatar-subtitle');
        if (subEl) subEl.textContent = avatar.creator ? `制作: ${avatar.creator}` : '';

        document.title = `${avatar.name} 対応商品一覧 | BOOTHDB`;

    } catch (err) {
        console.error('アバター情報取得エラー:', err);
        showToast('アバター情報の読み込みに失敗しました', 'error');
    }
}


// ==========================================
// アバター対応商品一覧の読み込みと表示
// ==========================================

async function loadAvatarProducts() {
    if (!currentAvatarId || isLoading) return;
    isLoading = true;

    const grid = document.getElementById('avatar-products-grid');
    if (!grid) return;

    grid.innerHTML = '<div class="loading-spinner">読み込み中...</div>';

    try {
        const data = await AvatarApi.getProducts(currentAvatarId, {
            page: currentPage,
            perPage: 20,
            category: currentCategory,
            sort: currentSort,
        });

        // ステータスピルを更新
        const costumeEl = document.getElementById('stat-costume');
        if (costumeEl) costumeEl.textContent = data.total.toLocaleString();

        if (!data.items || data.items.length === 0) {
            grid.innerHTML = '<p class="empty-message">対応商品が見つかりませんでした</p>';
            return;
        }

        grid.innerHTML = data.items.map(buildProductCardHTML).join('');

        grid.querySelectorAll('[data-product-id]').forEach(function (card) {
            card.addEventListener('click', function () {
                location.href = `detail.html?id=${encodeURIComponent(card.getAttribute('data-product-id'))}`;
            });
            card.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') card.click();
            });
        });

    } catch (err) {
        grid.innerHTML = `<p class="error-message">読み込みに失敗しました: ${escapeHtml(err.message)}</p>`;
    } finally {
        isLoading = false;
    }
}


// ==========================================
// フィルター・検索
// ==========================================

function initFilters() {
    const categorySelect = document.getElementById('filter-category');
    const sortSelect     = document.getElementById('filter-sort');
    const searchInput    = document.getElementById('avatar-search');

    if (categorySelect) {
        categorySelect.addEventListener('change', async function () {
            currentCategory = categorySelect.value || null;
            currentPage = 1;
            await loadAvatarProducts();
        });
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', async function () {
            currentSort = sortSelect.value || 'popular';
            currentPage = 1;
            await loadAvatarProducts();
        });
    }

    let searchDebounce = null;
    if (searchInput) {
        searchInput.addEventListener('input', function () {
            clearTimeout(searchDebounce);
            searchDebounce = setTimeout(async function () {
                currentSearch = searchInput.value.trim() || null;
                currentPage = 1;
                await loadAvatarProducts();
            }, 400);
        });
    }
}


// ==========================================
// 初期化
// ==========================================

document.addEventListener('DOMContentLoaded', async function () {
    const params = new URLSearchParams(location.search);
    currentAvatarId = params.get('id');

    if (!currentAvatarId) {
        // IDがない場合はアバター一覧を表示
        try {
            const grid = document.getElementById('avatar-products-grid');
            const data = await AvatarApi.list();
            if (grid && data.items) {
                const colorClasses = ['color-purple', 'color-cyan', 'color-pink', 'color-orange'];
                grid.innerHTML = data.items.map(function (avatar, i) {
                    const colorClass = colorClasses[i % colorClasses.length];
                    return `
                        <article class="card-base card-interactive avatar-card" data-avatar-id="${escapeHtml(avatar.id)}" role="button" tabindex="0">
                            <div class="avatar-icon ${colorClass}">${escapeHtml(avatar.name.charAt(0))}</div>
                            <div>
                                <div class="avatar-card-info-name">${escapeHtml(avatar.name)}</div>
                                <div class="avatar-card-info-count">対応商品数: ${avatar.product_count ?? '-'}件</div>
                            </div>
                        </article>
                    `;
                }).join('');
                grid.querySelectorAll('[data-avatar-id]').forEach(function (card) {
                    card.addEventListener('click', function () {
                        location.href = `avatar.html?id=${encodeURIComponent(card.getAttribute('data-avatar-id'))}`;
                    });
                });
            }
        } catch (err) {
            console.error(err);
        }
        return;
    }

    // アバター情報と商品一覧を並行取得
    await Promise.all([loadAvatarInfo(), loadAvatarProducts()]);
    initFilters();
});
