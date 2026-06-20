/* ===========================================
   api.js - バックエンドAPI通信モジュール
   =========================================== */

'use strict';

// ==========================================
// API設定
// ==========================================
const API_BASE_URL = (() => {
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        return 'http://localhost:8000';
    }
    return 'https://boothdb-api.onrender.com';
})();


// ==========================================
// 認証トークン管理（アクセストークン＋リフレッシュトークン）
// ==========================================

const Auth = {
    getToken() {
        return localStorage.getItem('boothdb_token');
    },
    getRefreshToken() {
        return localStorage.getItem('boothdb_refresh_token');
    },
    setTokens(accessToken, refreshToken) {
        localStorage.setItem('boothdb_token', accessToken);
        if (refreshToken) {
            localStorage.setItem('boothdb_refresh_token', refreshToken);
        }
    },
    removeToken() {
        localStorage.removeItem('boothdb_token');
        localStorage.removeItem('boothdb_refresh_token');
        localStorage.removeItem('boothdb_user');
    },
    getUser() {
        const raw = localStorage.getItem('boothdb_user');
        return raw ? JSON.parse(raw) : null;
    },
    setUser(user) {
        localStorage.setItem('boothdb_user', JSON.stringify(user));
    },
    isLoggedIn() {
        return !!this.getToken();
    },
};


// ==========================================
// 共通フェッチ関数（トークン自動更新つき）
// ==========================================

let isRefreshing = false;
let refreshPromise = null;

/**
 * リフレッシュトークンを使ってアクセストークンを更新する。
 * 同時に複数のリクエストが401になっても、リフレッシュ処理は1回だけ実行する。
 */
async function refreshAccessToken() {
    if (isRefreshing) {
        return refreshPromise;
    }

    const refreshTok = Auth.getRefreshToken();
    if (!refreshTok) {
        return false;
    }

    isRefreshing = true;
    refreshPromise = (async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: refreshTok }),
            });
            if (!response.ok) {
                Auth.removeToken();
                return false;
            }
            const data = await response.json();
            Auth.setTokens(data.access_token, data.refresh_token);
            return true;
        } catch (err) {
            Auth.removeToken();
            return false;
        } finally {
            isRefreshing = false;
        }
    })();

    return refreshPromise;
}

/**
 * APIリクエストを送信する共通関数。
 * 401が返ってきた場合、リフレッシュトークンで自動的に再認証して1回だけリトライする。
 */
async function apiFetch(path, options = {}, _isRetry = false) {
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
    };

    const token = Auth.getToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers,
    });

    if (response.status === 204) return null;

    // トークン期限切れ → リフレッシュして1回だけ再試行
    if (response.status === 401 && !_isRetry && Auth.getRefreshToken()) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
            return apiFetch(path, options, true);
        }
    }

    const data = await response.json();

    if (!response.ok) {
        const message = data.detail || 'エラーが発生しました';
        throw new ApiError(message, response.status);
    }

    return data;
}

class ApiError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}


// ==========================================
// カテゴリAPI
// ==========================================

const CategoryApi = {
    /** 収集対象カテゴリ一覧を取得 */
    async list() {
        return apiFetch('/api/categories');
    },
};


// ==========================================
// 商品API
// ==========================================

const ProductApi = {
    /** 商品一覧を取得 */
    async list({ page = 1, perPage = 20, category = null, search = null } = {}) {
        const params = new URLSearchParams({ page, per_page: perPage });
        if (category) params.set('category', category);
        if (search) params.set('search', search);
        return apiFetch(`/api/products?${params}`);
    },

    /** 新着商品を取得 */
    async listNew(limit = 6) {
        return apiFetch(`/api/products/new?limit=${limit}`);
    },

    /** セール中商品を取得 */
    async listSale(limit = 6) {
        return apiFetch(`/api/products/sale?limit=${limit}`);
    },

    /** 商品詳細を取得 */
    async get(productId) {
        return apiFetch(`/api/products/${productId}`);
    },

    /** BOOTHのURLを登録 */
    async register(boothUrl) {
        return apiFetch('/api/products/register', {
            method: 'POST',
            body: JSON.stringify({ booth_url: boothUrl }),
        });
    },

    /** 価格履歴を取得（後方互換用） */
    async getPriceHistory(productId, limit = 90) {
        return apiFetch(`/api/products/${productId}/prices?limit=${limit}`);
    },

    /** バリエーションごとの価格履歴を取得 */
    async getPriceHistoryByVariation(productId, limitPerVariation = 90) {
        return apiFetch(`/api/products/${productId}/prices/by-variation?limit_per_variation=${limitPerVariation}`);
    },

    /** バリエーション一覧を取得 */
    async getVariations(productId) {
        return apiFetch(`/api/products/${productId}/variations`);
    },

    /** レビュー一覧を取得 */
    async getReviews(productId, { page = 1, perPage = 20 } = {}) {
        const params = new URLSearchParams({ page, per_page: perPage });
        return apiFetch(`/api/products/${productId}/reviews?${params}`);
    },
};


// ==========================================
// レビューAPI（使用アバターなし）
// ==========================================

const ReviewApi = {
    /** レビューを投稿 */
    async post({ productId, rating, comment = null }) {
        return apiFetch('/api/reviews', {
            method: 'POST',
            body: JSON.stringify({
                product_id: productId,
                rating,
                comment,
            }),
        });
    },
};


// ==========================================
// 認証API
// ==========================================

const AuthApi = {
    /** ユーザー登録 */
    async register(email, password, username) {
        return apiFetch('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password, username }),
        });
    },

    /** ログイン → トークンをlocalStorageに保存 */
    async login(email, password) {
        const data = await apiFetch('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        Auth.setTokens(data.access_token, data.refresh_token);
        Auth.setUser({ id: data.user_id, username: data.username });
        return data;
    },

    /** ログアウト */
    logout() {
        Auth.removeToken();
    },

    /** ログイン中ユーザー情報を取得 */
    async me() {
        return apiFetch('/api/auth/me');
    },
};
