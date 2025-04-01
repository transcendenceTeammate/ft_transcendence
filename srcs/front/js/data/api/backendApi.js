import { getCookie } from "../../utils/getCookie.js";
import CONFIG from "../../config.js"
import { HttpClient, Middleware } from "../../core/HttpClient.js";


class AuthMiddleware extends Middleware {

	_getAuthHeaders() {
		const accessToken = getCookie('access_token');
		if (accessToken == null) {
			return null;
		}
		return {
			Authorization: `Bearer ${accessToken}`,
		};
	}

	_onUnauthenticated() {
		console.error("User is unauthenticated...");
		window.location.href = "/";
	}

	async interceptRequest(endpoint, options, next = async () => { }) {
		const authHeaders = this._getAuthHeaders();
		if (authHeaders != null) {
			options.headers = { ...options.headers, ...authHeaders };
		}
		const response = await next(endpoint, options);

		if (response.status === 401) {
			this._onUnauthenticated();
			throw new Error("Unauthenticated");
		}

		return response;
	}
}

class ErrorHandelingMiddleware extends Middleware {

	async interceptRequest(endpoint, options, next = async () => { }) {

		const response = await next(endpoint, options);

		if (!response.ok) {
			const errorData = await response.json();
			throw new Error(errorData.error || 'Request failed');
		}

		return response;
	}
}



export class BackendApi {
	constructor() {
		this._baseUrl = `${CONFIG.API_URL}`;
		this._httpClient = new HttpClient(this._baseUrl);
		this._httpClient.registerMiddleware(AuthMiddleware);
		this._httpClient.registerMiddleware(ErrorHandelingMiddleware);

		
	}

	// ==== User ====
	async getUserData() {
		const response = await this._httpClient.get("api/users/me/", {});
		return response.json()
	}

	async setUsername(newUsername) {
		const response = await this._httpClient.patch("api/users/update-username/", { username: newUsername }, {});
		return response.json()
	}

	async uploadUserAvatar(image) {
		const formData = new FormData();
		formData.append('image', image);
		const response = await this._httpClient.post("api/users/upload-profile-picture/", formData, {}, false);
		return response.json()
	}

	// ==== Friends ====
	async getFriendList() {
		const response = await this._httpClient.get("api/friend/list/", {});
		return response.json()
	}

	async addFriend(friendNickname) {
		const response = await this._httpClient.post("api/friend/add/", { friend_nickname: friendNickname }, {});
		return response.json()
	}

	async removeFriend(friendNickname) {
		const response = await this._httpClient.delete("api/friend/remove/", { friend_nickname: friendNickname }, {});
		return response.json()
	}

	// ==== Game ====
	async getUserGameHistory() {
		const response = await this._httpClient.get("api/game/list/", {});
		return response.json()
	}

	async createGame(player1Id, player2Id, score1, score2) {
		const payload = {
			player_1: player1Id,
			player_2: player2Id,
			score_1: score1,
			score_2: score2,
		};
		const response = await this._httpClient.post("api/game/add/", payload, {});
		return response.json()
	}
}
