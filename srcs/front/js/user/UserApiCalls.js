import CONFIG from "../config.js";
// import AbstractView from "../views/AbstractView.js";
// import User from "./User.js";
import { getRandomAvatar } from "./user_utils.js";

function getCookie(name) {
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

export async function isAuthenticated() {
    const accessToken = getCookie('access_token');
    if (!accessToken) {
        console.log("No access token found");
        return false;
    }
    console.log("Access token found:", accessToken);
    try {
        const response = await fetch(`${CONFIG.API_URL}/api/token/verify/`, {
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

export async function assignUsername() {
    const accessToken = getCookie('access_token');

    try {
        const response = await fetch(`${CONFIG.API_URL}/api/users/me/`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            return data.username;
        } else {
            console.error("Failed to fetch username");
            return 'failedFetchingUsername'
        }
    } catch (error) {
        console.error("Error fetching username:", error);
        return 'errorFetchingUsername'
        // this.username = 'ErrorName'
    }
}

export function assignAvatar() {
    const randomAvatar = getRandomAvatar();
    //let's put it into the database... oh I think the function is not on my branch yet
    return randomAvatar;
}



