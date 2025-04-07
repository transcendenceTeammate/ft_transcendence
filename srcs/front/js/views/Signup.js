import CONFIG from "../config.js";
import { checkUniqueUsername } from "../user/UserApiCalls.js";
import AbstractView from "./AbstractView.js";
export default class extends AbstractView {
    constructor() {
        super();
        this.setTitle("Signup");
    }

    async createStructs() {
        this.logStruct = {
            field: await super.loadElement('login-signup'),
            eye: null,
            check: await super.loadElement('log-check'),
            label: await super.loadElement('log-label'),
            valid: false,
            firstInput: true,
            regex: /^[a-zA-Z0-9@.+_-]{1,150}$/,
            baseLabel: "Login:",
            guidance: "only alphanumeric or @.+_-",
            fdUpFirstInputStr: "Login already exists"
        };

        this.passStruct = {
            parentDiv: await super.loadElement('passdiv'),
            field: await super.loadElement('pass'),
            eye: await super.loadElement('passEye'),
            check: await super.loadElement('passCheck'),
            label: await super.loadElement('passlabel'),
            firstInput: true,
            valid: false,
            regex: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[a-zA-Z0-9@$!%*?\&~#^()\-\_=+\[\]{};:,./\?])[A-Za-z\da-zA-Z0-9@$!%*?\&~#^()\-\_=+\[\]{};:,./\?]{8,128}$/,
            baseLabel: "Password:",
            guidance: "8 min, uppercase, lowercase, digit, special symb",
            fdUpFirstInputStr: "8 min, uppercase, lowercase, digit, special symb"
        };

        this.repPassStruct = {
            parentDiv: await super.loadElement('reppassdiv'),
            field: await super.loadElement('reppass'),
            eye: await super.loadElement('repPassEye'),
            check: await super.loadElement('repPassCheck'),
            label: await super.loadElement('reppasslabel'),
            firstInput: true,
            valid: false,
            regex: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[a-zA-Z0-9@$!%*?\&~#^()\-\_=+\[\]{};:,./\?])[A-Za-z\da-zA-Z0-9@$!%*?\&~#^()\-\_=+\[\]{};:,./\?]{8,128}$/,
            baseLabel: "Repeat password",
            guidance: "Doesn't match password",
            fdUpFirstInputStr: "Invalid"
        }
    }

    async loadElementsCreateStructs() {
        try {
            this.pageDiv = await super.loadElement('app-child-signup');
            this.form = await super.loadElement('form');
            this.submitButton = await super.loadElement('subm');
            this.errorMessageElement = await super.loadElement('error-message');
            await this.createStructs()
            this.structs = [this.logStruct, this.passStruct, this.repPassStruct]
        } catch (e) {
            console.log(e);
        }
    }

    async fdUpFirstInput(struct) {
        for (let i = 0; i < 3; i++) {
            if (this.structs[i] === struct) {
                return i === 0 ? await checkUniqueUsername(struct.field.value)
                    : i === 1 ? struct.regex.test(struct.field.value)
                        : (struct.regex.test(struct.field.value) && struct.field.value === this.passStruct.field.value)
            }
        }
    }

    async clicking(struct) {
        struct.field.addEventListener('click', async () => {
            for (let i = 0; i < 3; i++) {
                if (this.structs[i] !== struct && this.structs[i].field.value.length > 0 && this.structs[i].firstInput) {
                    this.structs[i].valid = await this.fdUpFirstInput(this.structs[i]);
                    this.structs[i].firstInput = false;
                    this.signalInvalid(this.structs[i], this.structs[i].valid ? this.structs[i].baseLabel : this.structs[i].fdUpFirstInputStr)
                }
            }
        })
    }

    clearField(struct) {
        struct.field.classList.remove('is-invalid');
        struct.label.innerText = struct.guidance;
        struct.label.style.color = '';
        struct.check.style.visibility = 'hidden';
    }

    checkAllValid() {
        const allValid = this.logStruct.valid && this.passStruct.valid && this.repPassStruct.valid;
        this.submitButton.disabled = !allValid;
    }

    async checkLogin() {
        const login = this.logStruct;

        login.field.addEventListener('input', async () => {
            this.clearField(login);
            login.label.innerText = login.guidance;
            if (!login.regex.test(login.field.value)) {
                login.valid = false;
                login.firstInput = false;
                this.signalInvalid(login, login.guidance);
            }
            else if (!login.firstInput && !(await checkUniqueUsername(login.field.value))) {
                login.valid = false;
                this.signalInvalid(login, "Login already exists");
            }
            else if (!login.firstInput && login.regex.test(login.field.value)) {
                login.valid = true;
                this.signalInvalid(login, "Login:");
            }
            else if (login.firstInput && this.passStruct.valid
                && this.repPassStruct.valid && (await checkUniqueUsername(login.field.value))) {
                login.firstInput = false;
                login.valid = true;
                this.signalInvalid(login, "Login:")
            }
            this.checkAllValid();
        })
    }

    passInput() {
        const pass = this.passStruct;
        const repPass = this.repPassStruct;
        pass.field.addEventListener('input', () => {
            this.clearField(pass);
            if (pass.regex.test(pass.field.value)) {
                pass.valid = true;
                pass.firstInput = false;
                this.signalInvalid(pass, "Password:");
                if (repPass.field.value.length > 0 && repPass.field.value === pass.field.value) {
                    repPass.firstInput = false;
                    repPass.valid = true;
                    this.signalInvalid(repPass, "Repeat password:")
                } else if (repPass.field.value.length > 0) {
                    repPass.firstInput = false;
                    repPass.valid = false;
                    this.signalInvalid(repPass, "Invalid");
                }
            }
            if (!pass.firstInput && !pass.regex.test(pass.field.value)) {
                pass.valid = false;
                this.signalInvalid(pass, pass.guidance)
            }
            this.checkAllValid();
        })
    }

    repPassInput() {
        const pass = this.passStruct;
        const repPass = this.repPassStruct;
        repPass.field.addEventListener('input', () => {
            this.clearField(repPass);
            if (repPass.regex.test(repPass.field.value) && repPass.field.value === pass.field.value) {
                repPass.valid = true;
                this.signalInvalid(repPass, "Repeat password:")
            } else if (!pass.valid) {
                repPass.valid = false;
                this.signalInvalid(repPass, "We need a valid pass first")
            }
            else if (!repPass.firstInput && repPass.field.value !== pass.field.value) {
                repPass.valid = false;
                this.signalInvalid(repPass, "Invalid")
            }
                repPass.firstInput = false;
                this.checkAllValid();
            })
    }

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
                        username: this.logStruct.field.value,
                        password: this.passStruct.field.value,
                    }),
                    credentials: "include"
                });
    
                const errorMessageElement = this.errorMessageElement;
                errorMessageElement.innerHTML = "";
                errorMessageElement.style.display = "none";
    
                if (response.ok) {
                    const data = await response.json();
                    takeMeThere(location.origin + '/start-game');
                } else {
                    const errorData = await response.json();
                    if (typeof errorData === 'object' && errorData !== null) {
                        Object.entries(errorData).forEach(([field, messages]) => {
                            if (Array.isArray(messages)) {
                                messages.forEach(message => {
                                    const errorItem = document.createElement("div");
                                    errorItem.textContent = `${field}: ${message}`;
                                    errorMessageElement.appendChild(errorItem);
                                });
                            } else {
                                const errorItem = document.createElement("div");
                                errorItem.textContent = `${field}: ${messages}`;
                                errorMessageElement.appendChild(errorItem);
                            }
                        });
                    } else {
                        errorMessageElement.textContent = "An unexpected error occurred.";
                    }
                    
                    errorMessageElement.style.display = "block";
                    this.submitButton.disabled = true;
                }
            } catch (error) {
                console.log(error);
                this.errorMessageElement.textContent = "An error occurred : " + error.message;
                this.submitButton.disabled = true;
            }
        });

    }

    signalInvalid = (struct, message) => {
        const lab = struct.label;
        const check = struct.check;
        const eye = struct.eye;
        const field = struct.field;
        const validity = struct.valid;
        if (!validity) {
            field.style.border = '';
            field.classList.add('is-invalid');
            lab.style.color = 'rgb(128, 0, 0, 0.6)';
            check.style.visibility = 'hidden'
        } else {
            field.classList.remove('is-invalid');
            lab.style.color = '';
            check.style.visibility = 'visible'
        }
        if (eye) eye.style.top = '5%'
        lab.innerText = message;
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
                    } else {
                        eye.style.visibility = 'hidden';
                    }
                });
            };
            const showHideEyes = async (div, element, eye) => {
                this.pageDiv.addEventListener('mousedown', (event) => {
                    if (!(div.contains(event.target))) {
                        eye.style.visibility = 'hidden';
                    }
                });
                this.pageDiv.addEventListener('focusin', (event) => {
                    if (!(div.contains(event.target))) {
                        eye.style.visibility = 'hidden';
                    }
                });
                listen(element, 'focus', eye);
                listen(element, 'input', eye);
            };
            showHideEyes(this.passStruct.parentDiv, this.passStruct.field, this.passStruct.eye);
            showHideEyes(this.repPassStruct.parentDiv, this.repPassStruct.field, this.repPassStruct.eye);
        } catch (error) {
            console.log(error);
        }
    }

    async attachAllJs() {
        await this.loadElementsCreateStructs();
        await this.checkLogin();
        for (let i = 0; i < 3; i++) this.clicking(this.structs[i]);
        this.passInput();
        this.repPassInput();
        this.eyes();
        this.validateForm();
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
                    <embed src="../public/green_check.svg" alt="no check" class="check" id="log-check">
                    <label for="login-signup" id="log-label">Login:</label>
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