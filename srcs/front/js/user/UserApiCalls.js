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

export async function getUserInfo() {
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
            console.log("user's data from getUserInfo:")
            console.dir(data)
            return data;
        } else {
            console.error("Failed to fetch username");
            return 'failedFetchingUsername'
        }
    } catch (error) {
        console.error("Error fetching username:", error);
        return 'errorFetchingUsername'
    }
}

export async function uploadProfilePictureFromPath(imagePath) {
    const accessToken = getCookie('access_token');
    try {
        const response = await fetch(imagePath); // Load the image
        const blob = await response.blob(); // Convert to Blob
        const filename = imagePath.split('/').pop();
        const file = new File([blob], filename, { type: blob.type }); // Create File
        console.log('and the file is:')
        console.dir(file)
        const formData = new FormData();
        formData.append('image', file);

        const uploadResponse = await fetch(`${CONFIG.API_URL}/api/users/upload-profile-picture/`, {
            method: 'POST',
            body: formData,
            headers: {
                'Authorization': `Bearer ${accessToken}`
            },
            credentials: 'include'
        });

        const data = await uploadResponse.json();
        if (!uploadResponse.ok) {
            throw new Error(data.error || 'Failed to upload image');
        }

        console.log('Uploaded image URL:', data.image);
        return data.image;
    } catch (error) {
        console.error('Error uploading image:', error);
    }
}

export async function updateUsername(newUsername) {
    const accessToken = getCookie('access_token');
    try {
        const response = await fetch(`${CONFIG.API_URL}` + '/api/users/update-username/', {  // Adjust the endpoint URL if necessary
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + accessToken  // Assuming the JWT is stored in cookies
            },
            body: JSON.stringify({ username: newUsername })
        })

        const data = await response.json();

        if (data.error) {
            throw new Error(`Error: ${data.error}`);
        } else {
            console.log("Username updated successfully to: " + data.nickname);
        }
    } catch (error) {
        console.error('Error:', error);
        alert("An error occurred while updating the username.");
        throw error;  // Rethrow the error to be handled by the caller
    }
    // .then(response => response.json())
    // .then(data => {
    //     if (data.error) {
    //         alert("Error: " + data.error);
    //     } else {
    //         console.log("Username updated successfully to: " + data.nickname);
    //     }
    // })
    // .catch(error => {
    //     console.error('Error:', error);
    //     alert("An error occurred while updating the username.");
    // });

}

export async function uploadProfilePicture(file) {
    const accessToken = getCookie('access_token');
    const formData = new FormData();
    formData.append('image', file);

    try {
        const response = await fetch(`${CONFIG.API_URL}/api/users/upload-profile-picture/`, {
            method: 'POST',
            body: formData,
            headers: {
                'Authorization': `Bearer ${accessToken}` // Function to retrieve JWT token from cookies
            },
            credentials: 'include' // Ensures cookies are sent with the request
        });

        const data = await response.json();
        console.log("printing from uploadProfilePicture!!!")
        console.dir(data)

        if (!response.ok) {
            throw new Error(data.error || 'Failed to upload image');
        }

        console.log('Uploaded image URL:', data.image);
        return data.image;
    } catch (error) {
        console.error('Error uploading image:', error);
    }
}

// Function to extract JWT token from cookies
// function getJwtToken() {
//     const cookies = document.cookie.split('; ');
//     for (let cookie of cookies) {
//         const [name, value] = cookie.split('=');
//         if (name === 'jwt_token') { // Adjust according to your cookie name
//             return value;
//         }
//     }
//     return null;
// }

// Example usage: Assume there’s an <input type="file" id="fileInput">
// document.getElementById('fileInput').addEventListener('change', function (event) {
//     const file = event.target.files[0];
//     if (file) {
//         uploadProfilePicture(file);
//     }
// });



export function assignAvatar() {
    const randomAvatar = getRandomAvatar();
    return randomAvatar;
}



