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
        
    }

    async createStructs(){
        this.logStruct = {
            field: await super.loadElement('login-signup'),
            eye: null,
            check: await super.loadElement('log-check'), //what if I also await and load it all
            label: await super.loadElement('log-label'),
            valid: false,
            firstInput: true,
            regex: /^[a-zA-Z0-9@.+_-]{1, 150}$/,
            baseLabel: "Login:",
            guidance: "only alphanumeric or @.+_-",
        };
        console.log('lets check if logStruct was created correctly')
        console.dir(this.logStruct)

        this.passStruct = {
            parentDiv: await super.loadElement('passdiv'),
            field: await super.loadElement('pass'),
            eye: await super.loadElement('passEye'),
            check: await super.loadElement('passCheck'),
            label: await super.loadElement('passlabel'),
            // value: this.field.value,
            firstInput: true,
            valid: false,
            regex: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,128}$/,
            baseLabel: "Password:",
            guidance: "8 min, uppercase, lowercase, digit, special symb"
        };
        console.log('lets check if passStruct was created correctly')
        console.dir(this.passStruct)

        this.repPassStruct = {
            parentDiv: await super.loadElement('reppassdiv'),
            field: await super.loadElement('reppass'),
            eye: await super.loadElement('repPassEye'),
            check: await super.loadElement('repPassCheck'),
            label: await super.loadElement('reppasslabel'),
            // value: this.field.value,
            firstInput: true,
            valid: false,
            regex: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,128}$/,
            baseLabel: "Repeat password",
            guidance: "Doesn't match password"
        }
        console.log('lets check if reppassStruct was created correctly')
        console.dir(this.repPassStruct) //ok guess now we can update the validate stuff right?
    }

    async loadElementsCreateStructs() {
        try {
            // this.login = ;
            this.form = await super.loadElement('form');
            // this.pass = ;
            // this.repPass = await super.loadElement('reppass');
            // this.passEye = ;
            // this.repEye = await super.loadElement('repPassEye');
            // this.passdiv = await super.loadElement('passdiv');
            // this.repPassDiv = await super.loadElement('reppassdiv');
            this.submitButton = await super.loadElement('subm');
            this.errorMessageElement = await super.loadElement('error-message');
            await this.createStructs()
        } catch (e) {
            console.log(e);
        }
    }

    clearField(struct){
        struct.field.classList.remove('is-invalid');
        struct.label.innerText = struct.guidance;
        struct.label.style.color = '';
        struct.check.style.visibility = 'hidden';
    }

    checkAllValid() {
        const allValid = this.logStruct.valid && this.passStruct.valid && this.repPassStruct.valid;
        this.submitButton.disabled = !allValid;
    }

    async checkLogin(){
        const login = this.logStruct;
        console.log('wtf is with this.logStruct?')
        console.dir(login)
        login.field.addEventListener('input', async () => {
            this.clearField(login);
            login.label.innerText = login.guidance;
            if (!login.regex.test(login.field.value)){
                login.valid = false;
                this.signalInvalid(login, login.guidance);
                login.firstInput = false;
                this.checkAllValid();
                return;
            }
            if(!login.firstInput && !checkUniqueUsername(login.field.value)){
                login.valid = false;
                this.signalInvalid(login, "Login already exists");
                this.checkAllValid();
                return;
            }
            if (!login.firstInput && login.regex.test(login.field.value)){
                login.valid = true;
                this.signalInvalid(login, "Login:");
                this.checkAllValid();
            }
        })
    }

    async clickingFields(struct){
        const log = this.logStruct;
       
        struct.field.addEventListener('click', async () => { //for the moment, it's not meant for the login
            struct.eye.style.top = '5%';
            if(log.firstInput){
                if (log.regex.test(log.field.value)){
                    const uniqueLog =  await checkUniqueUsername(log.field.value);
                    log.valid = uniqueLog;
                    uniqueLog ? this.signalInvalid(log, "Login:") : this.signalInvalid(log, "Login already exists");
                }
                log.firstInput = false;
            }

            if (struct === this.repPassStruct && this.passStruct.firstInput 
                && !this.passStruct.regex.test(this.passStruct.field.value)){
                    this.passStruct.firstInput = false;
                    this.passStruct.valid = false;
                    this.signalInvalid(this.passStruct, this.passStruct.guidance);
                    
            }
            this.checkAllValid();
        })
    }

    passInput(){
        const pass = this.passStruct;
        const repPass = this.repPassStruct;
        pass.field.addEventListener('input', () => {
            this.clearField(pass);
            if (pass.regex.test(pass.field.value)){
                pass.valid = true;
                pass.firstInput = false;
                this.signalInvalid(pass, "Password:");
                if(repPass.field.value.length > 0 && repPass.field.value === pass.field.value){
                    repPass.valid = true;
                    this.signalInvalid(repPass, "Repeat password:")
                }
            }
            if (!pass.firstInput && !pass.regex.test(pass.field.value)){
                pass.valid = false;
                this.signalInvalid(pass, pass.guidance)
            }
            this.checkAllValid();
        })
    }

    repPassInput(){
        const pass = this.passStruct;
        const repPass = this.repPassStruct;
        repPass.field.addEventListener('input', () => {
            this.clearField(repPass);
            if(repPass.regex.test(repPass.field.value) && repPass.field.value === pass.field.value){
                repPass.valid = true;
                this.signalInvalid(repPass, "Repeat password:")
            } else if (!repPass.firstInput && (!pass.valid || repPass.field.value !== pass.field.value)){
                repPass.valid = false;
                this.signalInvalid(repPass, "Invalid")
            }
            this.checkAllValid();
        })
        
    }


    // async loginLabel() {
    //     this.login.addEventListener('input', () => {
    //         const lab = this.findLabel(this.login);
    //         this.login.classList.remove('is-invalid');
    //         lab.innerText = "Login: ";
    //         lab.style.color = '';
    //         if (this.login.value.length > 0) this.pass.disabled = false;
    //     })
    // }

    // async validateLogin() {

    //     this.pass.addEventListener('click', async () => {
    //         let logValue = this.login.value.trim();
    //         if (logValue.length > 0) {
    //             try {
    //                 const checkResponse = await fetch(`${CONFIG.API_URL}/check_username/?username=${encodeURIComponent(logValue)}`);
    //                 if (!checkResponse.ok) {
    //                     const errorText = await checkResponse.text();
    //                     console.error('Error:', errorText);
    //                     this.signalInvalid(false, this.login, "Login already exists", "Login:");
    //                     this.validatedLogin = false;
    //                     if(this.pass.value.length === 0) this.pass.disabled = true;
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

    validatePass() {
        
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

    signalInvalid = (struct, message) => {
        const lab = struct.label;
        const check = struct.check;
        const eye = struct.eye;
        const field = struct.field;
        const validity = struct.valid;
        if (!validity) {
            field.style.border = '';
            field.classList.add('is-invalid');
            // if (field.value.length === 0) lab.innerText = "Shouldn't be empty";
            
            lab.style.color = 'rgb(128, 0, 0, 0.6)';
            check.style.visibility = 'hidden'
        } else {
            field.classList.remove('is-invalid');
            // lab.innerText = message;
            lab.style.color = '';
            check.style.visibility = 'visible'
            if (eye) eye.style.top = '5%'
        }
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
                        // eye.addEventListener('touchstart', () => {  //because we don't give a fk about touchable devices
                        //     eye.src = '../public/eye_closed.png';
                        //     field.type = 'text';
                        // });
                        // eye.addEventListener('touchend', () => {
                        //     eye.src = '../public/eye_open.png';
                        //     field.type = 'password';
                        // });
                    } else {
                        eye.style.visibility = 'hidden';
                    }
                });
            };

            const showHideEyes = async (div, element, eye) => {
                document.addEventListener('mousedown', (event) => {//am I completely sure abt the 'document' part?
                    if (!(div.contains(event.target))) { //maybe I'll better add it to this page's div
                        eye.style.visibility = 'hidden';
                    }
                });
                document.addEventListener('focusin', (event) => {
                    if (!(div.contains(event.target))) {
                        eye.style.visibility = 'hidden';
                    }
                });
                // document.addEventListener('touchstart', (event) => {
                //     if (!(div.contains(event.target))) {
                //         eye.style.visibility = 'hidden';
                //     }
                // });

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
        await this.clickingFields(this.passStruct);
        await this.clickingFields(this.repPassStruct);
        this.passInput();
        this.repPassInput();
        this.eyes();
        // this.loginLabel();
        // this.validateLogin();
        // this.validatePass();
        // this.validateForm();
        // this.eyes();
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