import { Stream } from "../../core/Stream.js";
import { BackendApi } from "../api/backendApi.js";
import { isJwtExpired } from "../../utils/jwt.js";
import { getCookie } from "../../utils/getCookie.js";
import { clearCookie } from "../../utils/clearCookie.js";
import { PresenceService } from "../../services/PresenceService.js";

export const AuthConnectionStatus = Object.freeze({
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    DISCONNECTING: 'disconnecting',
});

export class AuthProvider {
    constructor() {
        this._backend = new BackendApi();
        this._authConnectionStatus = Stream.withDefault(AuthConnectionStatus.DISCONNECTED);
    }

    async login(username, password) {
        let response = await this._backend.login(username, password);
        this._onUserConnected();
        return response;
    }

    async signup(username, password) {
        let response = await this._backend.signup(username, password);
        this._onUserConnected();
        return response;
    }

    async isAuthenticated() {
        const accessToken = getCookie('access_token');

        if (!accessToken || isJwtExpired(accessToken)) {
            return false;
        }

        try {
            await this._backend.checkTokenValidity(accessToken);
            this._onUserConnected();
            return true;
        } catch (error) {
            console.error("Token verification failed:", error);
            this._onUserDisconnected();
            return false;
        }
    }

    logout() {
        PresenceService.getInstance().disconnect();
        this._authConnectionStatus.value = AuthConnectionStatus.DISCONNECTING;
        clearCookie("access_token", window.location.hostname);
        this._onUserDisconnected();
    }

    async init() {
        await this._updateAuthenticationStatus();
    }

    get authConnectionStatusStream() {
        return this._authConnectionStatus;
    }

    _onUserConnected() {
        this._authConnectionStatus.value = AuthConnectionStatus.CONNECTED;
    }

    _onUserDisconnected() {
        this._authConnectionStatus.value = AuthConnectionStatus.DISCONNECTED;
    }

    async _updateAuthenticationStatus() {
        await this.isAuthenticated();
    }

    static getInstance() {
        if (AuthProvider._instance == null) {
            AuthProvider._instance = new AuthProvider();
        }
        return AuthProvider._instance;
    }
}
