import AbstractView from "./AbstractView.js";
export default class extends AbstractView {
    constructor() {
        super();
        this.setTitle("Profile");
    }

    async loadElements() {
        try {
            this.pencil = await super.loadElement('editNamePencil');
            this.usernameForm = await super.loadElement('usernameForm');
            this.usernameHeading = await super.loadElement('usernameHeading');
            this.usernameButton = await super.loadElement('usernameButton');
            this.unameInput = await super.loadElement('unameInput')
            this.uname = await super.loadElement('uname');

        } catch (e) {
            console.log(e);
        }
    }

    async attachAllJs() {
        await this.loadElements();
        this.pencil.addEventListener('click', (e) => {
            e.preventDefault();
            usernameHeading.classList.add('d-none');
            usernameForm.classList.remove('d-none');

        })

        this.usernameButton.addEventListener('click', (e) => {
            e.preventDefault();
            uname.textContent = unameInput.value;

            usernameForm.classList.add('d-none');
            usernameHeading.classList.remove('d-none');
        })
    }

    async getHtml() {
        this.navbar = await super.getNavbar();
       this.attachAllJs();

        return `<div id="app-child-profile">` + this.navbar +
            `
                <main class="container mt-5">
        <div class="row">
            <div class="col-6 offset-2 mt-3">
                <div class="card" style="width: 30rem;">
                    <img src="${AbstractView.avatar}" class="card-img-top" alt="Profile picture">
                    <div class="card-body">
                        <div class="d-none" id="usernameForm">
                            <div class="input-group mb-1">
                                <input type="text" class="form-control" 
                                    aria-label="change username" value='Tech penguin' id='unameInput' required>
                                <button class="btn btn-outline-secondary" type="button"
                                 id="usernameButton">Submit</button>
                            </div>
                        </div>
                        <div id="usernameHeading">
                            <h5 class="card-title"><span id="uname">Tech Penguin</span>
                                <a href="#" role="button" class="link-dark" id="editNamePencil">
                                    <span class="px-3">

                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
                                            fill="currentColor" class="bi bi-pencil" viewBox="0 0 16 16">
                                            <path
                                                d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325" />
                                        </svg>
                                    </span>
                                </a>
                            </h5>
                        </div>
                    </div>
                    <ul class="list-group list-group-flush">
                        <li class="list-group-item">Matches: 0</li>
                        <li class="list-group-item">Tournaments: 0</li>
                        <li class="list-group-item">Score: 0</li>
                    </ul>
                </div>
            </div>
            <div class="col-3 offset-1 mt-3 text-center rounded-2" id="myfriends">
                <h3 class="m-4 display-5 fw-bold">My friends</h3>
                <div class="avatar-gallery py-4">
                 <a href="#" class="text-decoration-none d-flex flex-column align-items-center link-dark">

                        <div class="avatar-item">
                            <img src="../public/avatars/steampunk/steampunk_peng.jpg" alt="Avatar 1">
                        </div>
                        Steamie
                    </a>
                    <a href="#" class="text-decoration-none d-flex flex-column align-items-center link-dark">
                        <div class="avatar-item">
                            <img src="../public/avatars/gentleman/gentleman.webp" alt="Avatar 2">
                        </div>
                        Gentie
                    </a>
                    <a href="#" class="text-decoration-none d-flex flex-column align-items-center link-dark">
                        <div class="avatar-item border border-success border-4">
                            <img src="../public/avatars/girlie_queen/Cutie.webp" alt="Avatar 3">
                        </div>
                        Princess
                    </a>
                    <a href="#"
                        class="text-decoration-none d-flex flex-column align-items-center link-dark position-relative">
                        <div class="avatar-item position-relative">
                            <img src="../public/avatars/steampunk/steampunk_noframe.jpg" alt="Avatar 4">
                        </div>
                        Gogglie
                    </a>
                    <a href="#" class="text-decoration-none d-flex flex-column align-items-center link-dark">
                        <div class="avatar-item">
                            <img src="../public/avatars/punk/punk.webp" alt="Avatar 5">
                        </div>
                        Bad Mfucker
                    </a>
                    <a href="#" class="text-decoration-none d-flex flex-column align-items-center link-dark">
                        <div class="avatar-item">
                            <img src="../public/avatars/bro/bro.webp" alt="Avatar 6">
                        </div>
                        Tech Bro
                    </a>
                    <a href="#" class="text-decoration-none d-flex flex-column align-items-center link-dark">
                        <div class="avatar-item">
                            <img src="../public/avatars/sk8er/sk8er_skate.webp" alt="Avatar 7">
                        </div>
                        Sk8er
                    </a>
                    </div>
                </div>
            </div>
            </main>
            </div>
        `;
    }
}