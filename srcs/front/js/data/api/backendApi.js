import { getCookie } from "../../utils/getCookie.js";
import CONFIG from "../../config.js"

class HttpClient {
	constructor(baseUrl) {
		this.baseUrl = baseUrl;
	}

	_buildOptions(method, data = null, headers = {}, isJson = true) {
		const options = {
			method,
			headers: {
				...(isJson ? { 'Content-Type': 'application/json' } : {}),
				...headers,
			},
			credentials: 'include',
		};

		if (data && isJson) {
			options.body = JSON.stringify(data);
		} else if (data && !isJson) {
			options.body = data;
		}

		return options;
	}

	async _fetch(endpoint, options) {
		const response = await fetch(`${this.baseUrl}/${endpoint}`, options);
		if (!response.ok) {
			const errorData = await response.json();
			throw new Error(errorData.error || 'Request failed');
		}
		return response.json();
	}

	async get(endpoint, headers = {}) {
		const options = this._buildOptions('GET', null, headers);
		return this._fetch(endpoint, options);
	}

	async post(endpoint, data, headers = {}, isJson = true) {
		const options = this._buildOptions('POST', data, headers, isJson);
		return this._fetch(endpoint, options);
	}

	async patch(endpoint, data, headers = {}) {
		const options = this._buildOptions('PATCH', data, headers);
		return this._fetch(endpoint, options);
	}

	async delete(endpoint, data, headers = {}) {
		const options = this._buildOptions('DELETE', data, headers);
		return this._fetch(endpoint, options);
	}
}

export class BackendApi {
	constructor() {
		this._baseUrl = `${CONFIG.API_URL}`;
		this._httpClient = new HttpClient(this._baseUrl);
	}

	// ==== Helpers ====
	_getAuthHeaders() {
		const accessToken = getCookie('access_token');
		return {
			Authorization: `Bearer ${accessToken}`,
		};
	}

	// ==== User ====
	getUserData() {
		return this._httpClient.get("api/users/me/", this._getAuthHeaders());
	}

	setUsername(newUsername) {
		return this._httpClient.patch("api/users/update-username/", { username: newUsername }, this._getAuthHeaders());
	}

	uploadUserAvatar(image) {
		const formData = new FormData();
		formData.append('image', image);
		return this._httpClient.post("api/users/upload-profile-picture/", formData, this._getAuthHeaders(), false);
	}

	// ==== Friends ====
	getFriendList() {
		return this._httpClient.get("api/friend/list/", this._getAuthHeaders());
	}

	addFriend(friendNickname) {
		return this._httpClient.post("api/friend/add/", { friend_nickname: friendNickname }, this._getAuthHeaders());
	}

	removeFriend(friendNickname) {
		return this._httpClient.delete("api/friend/remove/", { friend_nickname: friendNickname }, this._getAuthHeaders());
	}

	// ==== Game ====
	getUserGameHistory() {
		return this._httpClient.get("api/game/list/", this._getAuthHeaders());
	}

	createGame(player1Id, player2Id, score1, score2) {
		const payload = {
			player_1: player1Id,
			player_2: player2Id,
			score_1: score1,
			score_2: score2,
		};
		return this._httpClient.post("api/game/add/", payload, this._getAuthHeaders());
	}
}
