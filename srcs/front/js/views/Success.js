import CONFIG from "../config.js";

import AbstractView from "./AbstractView.js";
export default class extends AbstractView {
	constructor() {
		super();
		this.setTitle("Success");
	}
	async getHtml() {
		try {
			await this.isAuthenticated();
			const username = await this.getUsername();
			return `
			<div id="app-child-success">
			<h1 id='success-h1'>SUCCESS!</h1>
			<p>Welcome, ${username}!</p>
			<p>Now you can <a href="/pong-bootstrap/">PLAY</a></p>
			</div>
			`;
		} catch (error) {
			console.error(error.message);
			window.location.href = "/";
			return;
		}
	}
	async isAuthenticated() {
		const accessToken = this.getCookie('access_token');
		if (!accessToken) {
			console.log("No access token found");
			return false;
		}
		console.log("Access token found:", accessToken);
		try {
			const response = await fetch(`${CONFIG.BASE_URL}/api/token/verify/`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${accessToken}`
				},
				body: JSON.stringify({ token: accessToken })
			});

			if (response.ok) {
				return true;
			} else {
				return false;
			}
		} catch (error) {
			console.error("Token verification failed:", error);
			return false;
		}
	}

	async getUsername() {
		const accessToken = this.getCookie('access_token');
	
		try {
			const response = await fetch("${CONFIG.BASE_URL}/api/users/me/", {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${accessToken}`
				}
			});
	
			if (response.ok) {
				const data = await response.json();
				return data.username;
			} else {
				throw new Error("Failed to fetch username");
			}
		} catch (error) {
			console.error("Error fetching username:", error.message);
			throw error; 
		}
	}

	getCookie(name) {
		let cookieValue = null;
		if (document.cookie && document.cookie !== '') {
			const cookies = document.cookie.split(';');
			for (let i = 0; i < cookies.length; i++) {
				const cookie = cookies[i].trim();
				if (cookie.substring(0, name.length + 1) === (name + '=')) {
					cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
					break;
				}
			}
		}
		return cookieValue;
	}

}