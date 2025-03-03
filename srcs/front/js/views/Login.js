import CONFIG from "../config.js";

import AbstractView from "./AbstractView.js";
export default class extends AbstractView {
    constructor() {
        super();
        this.setTitle("Login");
        this.validPass = true;
        this.validLog = true;
    }

    async loadElements() {
        try {
            this.form = await super.loadElement('form');
            this.login = await super.loadElement('login-login');
            this.form = await super.loadElement('form');
            this.pass = await super.loadElement('pass');
            this.passEye = await super.loadElement('passEye');
            this.passdiv = await super.loadElement('passdiv');
            this.errorMessageElement = await super.loadElement('error-message');
        } catch (e) {
            console.log(e);
        }
    }

    findLabel = (element) => {
        let sibl = element.nextElementSibling;
        while (sibl && sibl.tagName.toLowerCase() !== 'label') sibl = sibl.nextElementSibling;
        return sibl;
    };

    async eyes() {
       
        try {
            const listen = async (field, whatsgoinon, eye) => {
                field.addEventListener(whatsgoinon, () => {
                    if (field.value.length > 0) {
                        eye.style = 'visibility: visible';
                        if (field === this.pass && !this.validPass) eye.style.top = '5%';
                        else if (field === this.repPass && !this.validRep) eye.style.top = '5%';
                        eye.addEventListener('mousedown', () => {
                            eye.src = 'public/eye_closed.png';
                            field.type = 'text';
                        });
                        eye.addEventListener('mouseup', () => {
                            eye.src = 'public/eye_open.png';
                            field.type = 'password';
                        });
                        eye.addEventListener('touchstart', () => {
                            eye.src = 'public/eye_closed.png';
                            field.type = 'text';
                        });
                        eye.addEventListener('touchend', () => {
                            eye.src = 'public/eye_open.png';
                            field.type = 'password';
                        });
                    } else {
                        eye.style.visibility = 'hidden';
                    }
                });
            };

            const showHideEyes = async (div, element, eye) => {
             
                document.addEventListener('mousedown', (event) => {
                    if (!(div.contains(event.target))) eye.style.visibility = 'hidden';
                });
                document.addEventListener('focusin', (event) => {
                    if (!(div.contains(event.target))) eye.style.visibility = 'hidden';
                });
                document.addEventListener('touchstart', (event) => {
                    if (!(div.contains(event.target))) eye.style.visibility = 'hidden';
                });

                listen(element, 'focus', eye);
                listen(element, 'input', eye);
            };

            showHideEyes(this.passdiv, this.pass, this.passEye);

        } catch (error) {
            console.log(error);
        }

    }

    async validateForm(){
        this.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = this.login.value.trim();
            const password = this.pass.value.trim();
            try {
                const response = await fetch(`${CONFIG.BASE_URL}/api/auth/login/`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    credentials: "include",
                    body: JSON.stringify({ username: name, password: password })
                });
        
                if (response.ok) {
                    const data = await response.json();
                    console.log(data.user.username);
                    AbstractView.username = data.user.username;
                    takeMeThere(location.origin + '/start_game');
                    // window.location.href = "/success";
                } else {
                    const errorData = await response.json();
                    this.errorMessageElement.textContent = errorData.error || "An error occurred";
                    this.errorMessageElement.style.display = "block";
                }
            } catch (error) {
                this.errorMessageElement.textContent = "An error occurred : " + error.message;
            }
        })
    }


    // getCookie(name) {
    //     let cookieValue = null;
    //     if (document.cookie && document.cookie !== '') {
    //         const cookies = document.cookie.split(';');
    //         for (let i = 0; i < cookies.length; i++) {
    //             const cookie = cookies[i].trim();
    //             if (cookie.substring(0, name.length + 1) === (name + '=')) {
    //                 cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
    //                 break;
    //             }
    //         }
    //     }
    //     return cookieValue;
    // }
    
    async attachAllJs() {
        await this.loadElements();
        this.validateForm();
        this.eyes();
    }


    async getHtml(){
        this.attachAllJs();
        return `
            <div id="app-child-login">
            <div id="container-login" class="container-s">
			<h1>Have an account? Log in here</h1>
			<div id="formdiv">
				<form action="success" id="form" class="form-floating">
					
					<div class="form-floating mb-4">
						<input type="text" class="form-control" name="login"
                        placeholder="think of a nice login" id="login-login" required>
						<label for="login-login">Login:</label>
					</div>
					
                <div id="passdiv" style="position:relative" class="form-floating mb-4">
                    <input type="password" class="form-control" name="password" id="pass" class="pass"
                        placeholder="8 symbols, uppercase, lowercase, digit, special character" required>
                    <img src="public/eye_open.png" alt="oops" class="eye" id="passEye">
                    <label for="pass" id="passlabel">Password:</label>
                </div>
                <div style="text-align: center;">
                    <div id="error-message" style="color: red;"></div>
                </div>
                <button type="submit" id="subm" class="btn btn-primary bg-gradient form-control">Submit</button>
            </form>
        </div>
    </div>
    </div>
        `;
    }
}