import CONFIG from "../config.js";
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
    // console.log("Access token found:", accessToken);
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
    }
}

export function assignAvatar() {
    const randomAvatar = getRandomAvatar();
    return randomAvatar;
}


export async function checkUniqueUsername(logValue) {
    try {
        const checkResponse = await fetch(`${CONFIG.API_URL}/check_username/?username=${encodeURIComponent(logValue)}`);
        if (!checkResponse.ok) {
            const errorText = await checkResponse.text();
            console.error('Error:', errorText);
            return false;
            // this.signalInvalid(false, this.login, "Login already exists", "Login:");

        }
        return true;
        // else {
        //     this.signalInvalid(true, this.login, "Login already exists", "Login:");
        // }
    } catch (error) {
        console.error('Error:', error);
    }
}

