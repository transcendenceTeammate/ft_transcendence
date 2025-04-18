import { AuthProvider } from "../data/providers/AuthProvider.js";

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
            this.pageDiv = await super.loadElement('app-child-login');
            this.form = await super.loadElement('form');
            this.login = await super.loadElement('login-login');
            this.form = await super.loadElement('form');
            this.pass = await super.loadElement('pass');
            this.passEye = await super.loadElement('passEye');
            this.passdiv = await super.loadElement('passdiv');
            this.errorMessageElement = await super.loadElement('error-message');
            this.submitButton = await super.loadElement('subm');
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
                        this.submitButton.disabled = false;
                        eye.style = 'visibility: visible';
                        if (field === this.pass && !this.validPass) eye.style.top = '5%';
                        else if (field === this.repPass && !this.validRep) eye.style.top = '5%';
                        eye.addEventListener('mousedown', () => {
                            eye.src = '../public/eye_closed.png';
                            field.type = 'text';
                        });
                        eye.addEventListener('mouseup', () => {
                            eye.src = '../public/eye_open.png';
                            field.type = 'password';
                        });
                        eye.addEventListener('touchstart', () => {
                            eye.src = '../public/eye_closed.png';
                            field.type = 'text';
                        });
                        eye.addEventListener('touchend', () => {
                            eye.src = '../public/eye_open.png';
                            field.type = 'password';
                        });
                    } else {
                        eye.style.visibility = 'hidden';
                    }
                });
            };
            const showHideEyes = async (div, element, eye) => {
             
                this.pageDiv.addEventListener('mousedown', (event) => {
                    if (!(div.contains(event.target))) eye.style.visibility = 'hidden';
                });
                this.pageDiv.addEventListener('focusin', (event) => {
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
            const username = this.login.value.trim();
            const password = this.pass.value.trim();

            
            
            try {
                await AuthProvider.getInstance().login(username, password);
                // const response = await fetch(`${CONFIG.API_URL}/api/auth/login/`, {
                //     method: "POST",
                //     headers: {
                //         "Content-Type": "application/json"
                //     },
                //     credentials: "include",
                //     body: JSON.stringify({ username: name, password: password })
                // });
        
                // if (response.ok) {
                //     const data = await response.json();
                //     takeMeThere(location.origin + '/start-game');
                // } else {
                //     const errorData = await response.json();
                //     this.errorMessageElement.textContent = errorData.error || "An error occurred";
                //     this.errorMessageElement.style.display = "block";
                //     this.submitButton.disabled  = true;
                // }
            } catch (error) {
                this.errorMessageElement.textContent = "An error occurred : " + error.message;
                this.submitButton.disabled = true;
            }
        })
    }

    clickLoginEnableButton(){
        this.login.addEventListener('click', () => {
            this.submitButton.disabled = false;
        })
    }
    
    async attachAllJs() {
        await this.loadElements();
        this.validateForm();
        this.eyes();
        this.clickLoginEnableButton();
    }


    async getHtml(){
        this.attachAllJs();
        return `
            <div id="app-child-login">
            <div id="container-login" class="container-s">
			<h1 class="p-4">Have an account? Log in here</h1>
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
                    <img src="../public/eye_open.png" alt="oops" class="eye" id="passEye">
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