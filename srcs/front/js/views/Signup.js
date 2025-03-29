import CONFIG from "../config.js";
import { checkUniqueUsername } from "../user/UserApiCalls.js";


import AbstractView from "./AbstractView.js";
export default class extends AbstractView {
    constructor() {
        super();
        this.setTitle("Signup");
        this.logFirstInput = true;
        this.passFirstInput = true;
        this.repPassFirstInput = true;
        this.validPass = false;
        this.validRep = false;
        this.validLog = false;
        this.gottaHideRepEye = false;
        this.loginRegex = /^[a-zA-Z0-9@.+_-]{1,150}$/;
        this.passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,20}$/;
    }

    async loadElements() {
        try {
            this.login = await super.loadElement('login-signup');
            this.form = await super.loadElement('form');
            this.pass = await super.loadElement('pass');
            this.repPass = await super.loadElement('reppass');
            this.passEye = await super.loadElement('passEye');
            this.repEye = await super.loadElement('repPassEye');
            this.passdiv = await super.loadElement('passdiv');
            this.repPassDiv = await super.loadElement('reppassdiv');
            this.submitButton = await super.loadElement('subm');
            this.errorMessageElement = await super.loadElement('error-message');

        } catch (e) {
            console.log(e);
        }
    }

    async loginLabel() {
        this.login.addEventListener('input', () => {
            const lab = this.findLabel(this.login);
            this.login.classList.remove('is-invalid');
            lab.innerText = "Login: ";
            lab.style.color = '';
            // if (this.login.value.length > 0) this.pass.disabled = false;
        })
    }

    checkAllValid() {
        if (this.validLog && this.validPass && this.validRep) this.submitButton.disabled = false;
        else this.submitButton.disabled = true;
    }

    async checkLogin() {

        this.login.addEventListener('input', async () => {
            //would also like to change the label to show permitted characters
            const logLabel = this.findLabel(this.login);
            logLabel.innerText = "letters, digits, or @.+_-"
            if (!this.loginRegex.test(this.login.value)) {
                this.signalInvalid(false, this.login, "No XSS please", "Login:");
                this.validLog = false;
                this.logFirstInput = false;
                this.checkAllValid();
                return;
            }

            if (!this.logFirstInput && !checkUniqueUsername(this.login.value)) { //if it's not the first attempt, feedbacking on uniqueness with every letter
                this.signalInvalid(false, this.login, "Login already exists", "Login:");
                this.validLog = false;
                this.checkAllValid();
                return;
            }//then check uniqueness because imagine pass and reppass already validated
            if (!this.logFirstInput && this.loginRegex.test(this.login.value)) {
                this.signalInvalid(true, this.login, "blabla", "Login:");
                this.validLog = true;
                this.checkAllValid();
                //and guess gotta unblock the submit button if all is valid
                //but then, will be needing to block it back if not all is valid
            }
        })
        // return loginRegex.test(this.logValue) 
    }

    // async validateLogin() {

    //     this.pass.addEventListener('click', async () => {
    //         let logValue = this.login.value.trim();
    //         if (logValue.length > 0 && this.logFirstInput) {
    //             try {
    //                 const checkResponse = await fetch(`${CONFIG.API_URL}/check_username/?username=${encodeURIComponent(logValue)}`);
    //                 if (!checkResponse.ok) {
    //                     const errorText = await checkResponse.text();
    //                     console.error('Error:', errorText);
    //                     this.signalInvalid(false, this.login, "Login already exists", "Login:");

    //                 }
    //                 else {  
    //                     this.signalInvalid(true, this.login, "Login already exists", "Login:");
    //                 }
    //             } catch (error) {
    //                 console.error('Error:', error);
    //             }
    //         } else this.pass.disabled = true;
    //     })
    // }

    async passClickAndInput() {

        this.pass.addEventListener('click', async () => {
            this.repEye.style.top = '5%'
            if (this.logFirstInput) {
                if (this.loginRegex.test(this.login.value) && checkUniqueUsername(this.login.value)) {
                    this.validLog = true;
                    this.signalInvalid(true, this.login, "blabla", "Login:")
                    this.checkAllValid();
                }
                this.logFirstInput = false;
            } //doing smth abt the login only if it was the first input otherwise it's gettin checked in the login thing
        })

        this.pass.addEventListener('input', () => {
            console.log('checking how often the input event listener gets called')
            if (this.passwordRegex.test(this.pass.value)) {
                this.signalInvalid(true, this.pass, "blabla", "Password:");
                this.validPass = true;
                if(this.repPass.value.length > 0 && this.repPass.value === this.pass.value){
                    this.repPass = true; 
                    this.signalInvalid(true, this.repPass, "blabla", "Repeat password:")
                }
                this.checkAllValid();
            }
            else if (!this.passFirstInput && !this.passwordRegex.test(this.pass.value)) {
                this.signalInvalid(false, this.pass, "8 min, uppercase, lowercase, digit, special character", "blabla");
                this.validPass = false;
                this.checkAllValid();
            }
            //now what if it's not the first input and it didn't match the rep before and now it matches it
            this.passFirstInput = false;
        })
    }

    repPassClickAndInput() {
        this.repPass.addEventListener('click', () => {
            if (this.pass.value.length > 0) this.passFirstInput = false;
            this.passEye.style.top = '5%'
            if (!this.validPasss) {
                this.validRep = false;
                this.signalInvalid(false, this.pass, "8 min, uppercase, lowercase, digit, special character", "Password")
                this.checkAllValid();
            }
        })

        this.repPass.addEventListener('input', () => {
            //if not first input, signal regex incompliance and the fact it doesnt match password
            if (!this.repPassFirstInput && this.repPass.value !== this.pass.value) {
                this.signalInvalid(false, this.repPass, "Doesn't match password", 'blabla');
                this.validRep = false;
                this.checkAllValid()
            }
            //if first input, check if same as pass and regex compliand and check if all valid
            else if (this.validPass && this.repPass.value === this.pass.value) {
                this.signalInvalid(true, this.repPass, "blabla", "Repeat password:");
                this.repEye.style.top = '5%'
                this.validRep = true;
                this.checkAllValid();
            }
            this.repPassFirstInput = false;

        })
    }

    // validatePass() {
    //     const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,20}$/;
    //     this.pass.addEventListener('input', () => {
    //         const passLabel = this.findLabel(this.pass);
    //         passLabel.innerText = "8 min, uppercase, lowercase, digit, special character"
    //         if (passwordRegex.test(this.pass.value)) {
    //             this.validPass = true;
    //             this.signalInvalid(true, this.pass, "blabla", "Password:");
    //         }
    //         if (!this.passFirstInput && !passwordRegex.test(this.pass.value)) { //if the user got back to the field and started changing password, remove the green check
    //             this.hideCheck(this.pass)
    //             this.hideCheck(this.repPass)
    //             this.validPass = false;
    //             this.validRep = false;
    //         }

    //     })
    //     this.repPass.addEventListener('click', () => {

    //     }

    //what if like had already typed the reppass before and now it's actually the same as the password
    //        else if (this.validLog && this.validPass && this.validRep) {
    //         this.validRep = true;
    //         this.signalInvalid(true, this.repPass, "blabla", "Repeat password");
    //         this.repEye.style.top = '5%'
    //         this.submitButton.disabled = false;
    //     }
    //     else if (this.validPass) this.signalInvalid(true, this.pass, "blabla", "Password");
    // })
    //     this.repPass.addEventListener('input', () => {

    //     if (this.validPass && this.repPass.value.trim() === this.pass.value.trim()) {
    //         this.validRep = true;
    //         this.signalInvalid(true, this.repPass, "blabla", "Repeat password");
    //         this.repEye.style.top = '5%'

    //         if (this.validLog) this.submitButton.disabled = false;
    //     }
    // })
    // }

    async validateForm() {
        this.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {

                const response = await fetch(`${CONFIG.API_URL}/api/auth/signup/`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    body: JSON.stringify({
                        username: this.login.value,
                        password: this.pass.value,
                    }),
                    credentials: "include"
                });

                if (response.ok) {
                    const data = await response.json();
                    console.dir(data);
                    takeMeThere(location.origin + '/start-game');
                } else {
                    const errorData = await response.json();
                    this.errorMessageElement.textContent = errorData.error || "An error occurred";
                    this.errorMessageElement.style.display = "block";
                }
            } catch (error) {
                console.log(error);
                this.errorMessageElement.textContent = "An error occurred : " + error.message;
            }
            this.submitButton.disabled = true;
        });

    }

    findLabel = (element) => {
        let sibl = element.nextElementSibling;
        while (sibl && sibl.tagName.toLowerCase() !== 'label') sibl = sibl.nextElementSibling;
        return sibl;
    }

    findCheck = (element) => {
        let sibl = element.nextElementSibling;
        while (sibl && !sibl.classList.contains('check')) sibl = sibl.nextElementSibling;
        return sibl;
    }

    findEye = (element) => {
        let sibl = element.nextElementSibling;
        while (sibl && !sibl.classList.contains('eye')) sibl = sibl.nextElementSibling;
        return sibl;
    }

    hideCheck = (element) => {
        const check = this.findCheck(element);
        check.style.visibility = 'hidden'
    }

    signalInvalid = (validity, element, warning, orig) => {
        const lab = this.findLabel(element);
        const check = this.findCheck(element);
        const eye = this.findEye(element);
        if (!validity) {
            element.style.border = '';
            element.classList.add('is-invalid');
            if (element.value.length === 0) lab.innerText = "Shouldn't be empty";
            else lab.innerText = warning;
            lab.style.color = 'rgb(128, 0, 0, 0.6)';
            check.style.visibility = 'hidden'
        } else {
            element.classList.remove('is-invalid');
            lab.innerText = orig;
            lab.style.color = '';
            check.style.visibility = 'visible'
            if (eye) eye.style.top = '5%'
        }
    }

    async eyes() {
        try {
            const listen = async (field, whatsgoinon, eye) => {
                field.addEventListener(whatsgoinon, () => {
                    if (field.value.length > 0) {
                        eye.style.visibility = 'visible';
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
                document.addEventListener('mousedown', (event) => {
                    if (!(div.contains(event.target))) {
                        eye.style.visibility = 'hidden';
                    }
                });
                document.addEventListener('focusin', (event) => {
                    if (!(div.contains(event.target))) {
                        eye.style.visibility = 'hidden';
                    }


                });
                document.addEventListener('touchstart', (event) => {
                    if (!(div.contains(event.target))) {
                        eye.style.visibility = 'hidden';
                    }
                });

                listen(element, 'focus', eye);
                listen(element, 'input', eye);
            };

            showHideEyes(this.passdiv, this.pass, this.passEye);
            showHideEyes(this.repPassDiv, this.repPass, this.repEye);


        } catch (error) {
            console.log(error);
        }

    }

    async attachAllJs() {
        await this.loadElements();
        this.loginLabel();
        this.checkLogin();
        this.passClickAndInput();
        this.repPassClickAndInput();
        // this.validateLogin();
        // this.validatePass();
        // this.validateForm();
        this.eyes();
    }


    async getHtml() {
        this.attachAllJs();
        return `
        <div id="app-child-signup">
            <div id="container-signup" class="container-s">
        <h1 class="p-5">Sign up to <span id="su-peng">Peng</span><span id="su-pong">Pong</span>App</h1>
        <div id="formdiv">
            <form action="avatar" id="form" class="form-floating">

                <div class="form-floating mb-4">
                    <input type="text" class="form-control" name="login" placeholder="think of a nice login" id="login-signup" required>
                    <embed src="../public/green_check.svg" alt="no check" class="check" id="passCheck">
                    <label for="login-signup">Login:</label>
                </div>
                <div id="passdiv" style="position:relative" class="form-floating mb-4">
                    <input type="password" class="form-control" name="password" id="pass" class="pass"
                        placeholder="8 symbols, uppercase, lowercase, digit, special character" required>
                    <img src="../public/eye_open.png" alt="oops" class="eye" id="passEye">
                    <img src="../public/green_check.svg" alt="no check" class="check" id="passCheck">
                    <label for="pass" id="passlabel">Password:</label>
                </div>
                <div id="reppassdiv" style="position:relative" class="form-floating mb-4">
                    <input type="password" class="form-control" name="password" id="reppass" class="pass"
                        placeholder="8 symbols, uppercase, lowercase, digit, special character" required>
                    <img src="../public/eye_open.png" alt="oops" class="eye" id="repPassEye">
                    <img src="../public/green_check.svg" alt="no check" class="check" id="repPassCheck">
                    <label for="reppass" id="reppasslabel" class="object-fit-contain">Repeat password:</label>
                </div>
                <div style="text-align: center;">
                    <div id="error-message" style="color: red;"></div>
                </div>
                <button type="submit" id="subm" class="btn btn-primary bg-gradient form-control" disabled>Submit</button>
            </form>
        </div>
    </div>
    </div>
        `;
    }
}