/* ===========================================
   api.js - バックエンドAPI通信モジュール
   =========================================== */

'use strict';

// ==========================================
// API設定（デプロイ後にRenderのURLに変更）
// ==========================================
const API_BASE_URL = (() => {
    // ローカル開発時は localhost:8000 を使用
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        return 'http://localhost:8000';
    }
    // 本番（GitHub Pages）では Render のURLを使用
    // デプロイ後に自分のRenderのURLに変更してください
    return 'https://boothdb-api.onrender.com';
})();


// ==========================================
// 認証トークン管理
// ==========================================

const Auth = {
    getToken() {
        return localStorage.getItem('boothdb_token');
    },
    setToken(token) {
        localStorage.setItem('boothdb_token', token);
    },
    removeToken() {
        localStorage.removeItem('boothdb_token');
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
// 共通フェッチ関数
// ==========================================

/**
 * APIリクエストを送信する共通関数
 * @param {string} path - APIパス（例: /api/products）
 * @param {object} options - fetchのオプション
 * @returns {Promise<any>} レスポンスデータ
 */
async function apiFetch(path, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
    };

    // 認証トークンがあればヘッダーに付加
    const token = Auth.getToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers,
    });

    // 204 No Content
    if (response.status === 204) return null;

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

    /** 価格履歴を取得 */
    async getPriceHistory(productId, limit = 90) {
        return apiFetch(`/api/products/${productId}/prices?limit=${limit}`);
    },

    /** レビュー一覧を取得 */
    async getReviews(productId, { page = 1, perPage = 20 } = {}) {
        const params = new URLSearchParams({ page, per_page: perPage });
        return apiFetch(`/api/products/${productId}/reviews?${params}`);
    },

    /** アバター別評価を取得 */
    async getAvatarRatings(productId) {
        return apiFetch(`/api/products/${productId}/reviews/avatars`);
    },
};


// ==========================================
// アバターAPI
// ==========================================

const AvatarApi = {
    /** アバター一覧を取得 */
    async list(search = null) {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        return apiFetch(`/api/avatars?${params}`);
    },

    /** アバター詳細を取得 */
    async get(avatarId) {
        return apiFetch(`/api/avatars/${avatarId}`);
    },

    /** アバター対応商品一覧を取得 */
    async getProducts(avatarId, { page = 1, perPage = 20, category = null, sort = 'popular' } = {}) {
        const params = new URLSearchParams({ page, per_page: perPage, sort });
        if (category) params.set('category', category);
        return apiFetch(`/api/avatars/${avatarId}/products?${params}`);
    },
};


// ==========================================
// レビューAPI
// ==========================================

const ReviewApi = {
    /** レビューを投稿 */
    async post({ productId, avatarId, rating, comment = null }) {
        return apiFetch('/api/reviews', {
            method: 'POST',
            body: JSON.stringify({
                product_id: productId,
                avatar_id: avatarId,
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
        Auth.setToken(data.access_token);
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
