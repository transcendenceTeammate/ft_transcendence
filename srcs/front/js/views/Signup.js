import AbstractView from "./AbstractView.js";
export default class extends AbstractView {
    constructor() {
        super();
        this.setTitle("Signup_alt");
        this.validPass = true;
        this.validRep = true;
        this.validLog = true;
        this.gottaHideRepEye = false;
        this.validatedLogin = false;
        // this.passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
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
            if (this.login.value.length > 0) this.pass.disabled = false;
        })
    }

    async validateLogin() {
        
        console.log('calling validateLogin!')

        this.pass.addEventListener('click', async () => {
            if (this.validatedLogin) return;
            let logValue = this.login.value.trim();
            if (logValue.length > 0) {
                try {
                    const checkResponse = await fetch(`http://localhost:8000/check_username/?username=${encodeURIComponent(logValue)}`);
                    if (!checkResponse.ok) {
                        const errorText = await checkResponse.text();
                        console.error('Error:', errorText);
                        this.signalInvalid(false, this.login, "Login already exists", "Login:");
                        this.validatedLogin = false;
                        this.pass.disabled = true;
                    }
                    else {
                        if (window.confirm(`Login: \n\n${logValue}\n\nYou won't be able to change it if you continue`)) {
                            this.signalInvalid(true, this.login, "Login already exists", "Login:");
                            this.validatedLogin = true;
                            this.login.disabled = true;
                        }
                        else this.pass.disabled = true;
                    }
                } catch (error) {
                    console.error('Error:', error);
                }
            } else this.pass.disabled = true;
        })
    }

    validatePass() {
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        this.pass.addEventListener('input', () => {
            const passLabel = this.findLabel(this.pass);
            passLabel.innerText = "8 characters, uppercase, lowercase, digit, special character"
            if (passwordRegex.test(this.pass.value)) {
                // alert("Make sure you remembered your password! Now you'll have to repeat it");
                //  this.signalInvalid(true, this.pass, "blabla", "Password");

                this.repPass.disabled = false;
            }
        })
        this.repPass.addEventListener('click', () => {
            this.signalInvalid(true, this.pass, "blabla", "Password");

            // this.passEye.style.visibility = 'visible';
            this.passEye.style.top = '5%'
        })
        this.repPass.addEventListener('input', () => {

            if (this.repPass.value.trim() === this.pass.value.trim()) {
                this.signalInvalid(true, this.repPass, "blabla", "Repeat password");
                console.log(`wtf is the eye in rep pass not goin up? ${this.validatedLogin}`)
                this.repEye.style.top = '5%'
                console.dir(this.repEye.style.top);
                //    this.passEye.style.visibility = 'hidden';
                //    this.gottaHideRepEye = true;
                //    this.repEye.style.visibility = 'hidden';
                this.submitButton.disabled = false;
            }
        })
    }

    async validateForm() {
        this.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const response = await fetch("http://localhost:8000/signup/", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    body: JSON.stringify({ 
                        username: this.login.value, 
                        password: this.pass.value 
                    }),
                    credentials: "include"
                });

                if (response.ok) {
                    const data = await response.json();

                    if (data.user) {
                        AbstractView.username = data.user.username;
                    }
                    
                    takeMeThere(location.origin + '/avatar');
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
        console.dir(sibl)
        return sibl;
    }

    findEye = (element) => {
        let sibl = element.nextElementSibling;
        while (sibl && !sibl.classList.contains('eye')) sibl = sibl.nextElementSibling;
        console.dir(sibl)
        return sibl;
    } 

    signalInvalid = (validity, element, warning, orig) => {
        const lab = this.findLabel(element);
        const check = this.findCheck(element);
        const eye = this.findEye(element);
        if (!validity) {
            element.style.border = '';
            element.classList.add('is-invalid');
            console.log(`element: ${element.id}. value: ${element.value}`);
            if (element.value.length === 0) lab.innerText = "Shouldn't be empty";
            else lab.innerText = warning;
            lab.style.color = 'rgb(128, 0, 0, 0.6)';
        } else {
            element.classList.remove('is-invalid');
            lab.innerText = orig;
            lab.style.color = '';
            check.style.visibility = 'visible'
            if(eye) eye.style.top = '5%'
        }
    }

    async eyes() {
        try {
            const listen = async (field, whatsgoinon, eye) => {
                field.addEventListener(whatsgoinon, () => {
                    if (field.value.length > 0 ) {
                        eye.style.visibility = 'visible';
                        // console.log(`are validPass and validRep true? ${this.validPass} and ${this.validRep}`)
                        // if (field === this.pass && !this.validPass) eye.style.top = '5%';
                        // else if (field === this.repPass && !this.validRep) eye.style.top = '5%';
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
                    if (!(div.contains(event.target))) {
                        eye.style.visibility = 'hidden';
                        console.log(`hello from showHideEyes. just added the hidden thingie. what's the top of the eye now? ${eye.style.top}`)
                    }
                });
                document.addEventListener('focusin', (event) => {
                    if (!(div.contains(event.target))) {
                        eye.style.visibility = 'hidden';
                        console.log(`hello from showHideEyes. just added the hidden thingie. what's the top of the eye now? ${eye.style.top}`)
                    }

                    
                });
                document.addEventListener('touchstart', (event) => {
                    if (!(div.contains(event.target))) {
                        eye.style.visibility = 'hidden';
                        console.log(`hello from showHideEyes. just added the hidden thingie. what's the top of the eye now? ${eye.style.top}`)
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
        this.validateLogin();
        this.validatePass();
        this.validateForm();
        this.eyes();
    }


    async getHtml() {
        this.attachAllJs();
        return `
        <div id="app-child-signup">
            <div id="container-signup" class="container-s">
        <h1>Sign up to PengPongApp</h1>
        <div id="formdiv">
            <form action="avatar" id="form" class="form-floating">

                <div class="form-floating mb-4">
                    <input type="text" class="form-control" name="login" placeholder="think of a nice login" id="login-signup" required>
                    <embed src="public/green_check.svg" alt="no check" class="check" id="passCheck">
                    <label for="login-signup">Login:</label>
                </div>
                <div id="passdiv" style="position:relative" class="form-floating mb-4">
                    <input type="password" class="form-control" name="password" id="pass" class="pass"
                        placeholder="8 symbols, uppercase, lowercase, digit, special character" required disabled>
                    <img src="public/eye_open.png" alt="oops" class="eye" id="passEye">
                    <img src="public/green_check.svg" alt="no check" class="check" id="passCheck">
                    <label for="pass" id="passlabel">Password:</label>
                </div>
                <div id="reppassdiv" style="position:relative" class="form-floating mb-4">
                    <input type="password" class="form-control" name="password" id="reppass" class="pass"
                        placeholder="8 symbols, uppercase, lowercase, digit, special character" required disabled>
                    <img src="public/eye_open.png" alt="oops" class="eye" id="repPassEye">
                    <img src="public/green_check.svg" alt="no check" class="check" id="repPassCheck">
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