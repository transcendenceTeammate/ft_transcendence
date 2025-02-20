export default class AbstractView{
    static username = null;
    constructor() {

    }

    setTitle(title) {
        document.title = title;
    }

    async loadElement(selector) {

        return new Promise((resolve, reject) => {
            const checkExist = setInterval(() => {
                let elem = document.getElementById(selector);
                if (elem) { 
                    clearInterval(checkExist);
                    resolve(elem);
                }
                // console.log(`Element not found: ${selector}, retrying...`);
            }, 100);
           
            setTimeout(() => {
                clearInterval(checkExist);
                reject(new Error(`Element not found: ${selector}`));
            }, 5000);
        });
    }

    async loadAllElements(classSelector) {

        return new Promise((resolve, reject) => {
            const checkExist = setInterval(() => {
                let elems = document.querySelectorAll(classSelector);
                if (elems.length > 0) {
                    clearInterval(checkExist);
                    console.log('elements loaded!!!!!');
                    console.dir(elems);
                    resolve(elems);
                }
                    console.log("Didn't load elems yet...")
            }, 200);
           
            // setTimeout(attachEvent, 500);
            setTimeout(() => {
                clearInterval(checkExist);
                reject(new Error(`Elements not found: ${classSelector}`));
            }, 5000);
        });
    }

    static async isAuthenticated() {
		const accessToken = this.getCookie('access_token');
		if (!accessToken) {
			console.log("No access token found");
			return false;
		}
		console.log("Access token found:", accessToken);
		try {
			const response = await fetch("http://localhost:8000/api/token/verify/", {
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

	static async assignUsername() {     
		const accessToken = this.getCookie('access_token');
	
		try {
			const response = await fetch("http://localhost:8000/get_user_info/", {
				method: "GET",
				headers: {
					"Authorization": `Bearer ${accessToken}`,
					"Content-Type": "application/json",
				},
				credentials: 'include'
			});
	
			if (response.ok) {
				const data = await response.json();
                this.username = data.username;
                console.log(`hello from AbstractView! this.username is: ${this.username}`)
				// return data.username;
			} else {
				console.error("Failed to fetch username");
                this.username = 'Unknown'
				// return "Unknown";
			}
		} catch (error) {
			console.error("Error fetching username:", error);
            this.username = 'Unknown'
			// return "Unknown";
		}
	}

	static getCookie(name) {
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

    // async bindEvent(selector, event, callback) {
    //     console.log('bindEvent in AbstractView called');
    //     const attachEvent = async () => {
    //         try {
    //             let elem = await this.loadElement(selector);
    //             elem.addEventListener(event, callback);
    //         } catch (error) {
    //             console.log(error);
    //         }
    //     }
    //     attachEvent();
    //     document.addEventListener("DOMContentLoaded", attachEvent.bind(this));
    // }

    // async getHtml() {
    //     return "";
    // }
}