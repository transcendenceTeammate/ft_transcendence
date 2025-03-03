import AbstractView from "./AbstractView.js";
export default class extends AbstractView {
    constructor() {
        super();
        this.setTitle("Profile");
    }

    async loadElements() {
        try {
            this.navbar = await super.getNavbar();
        } catch (e) {
            console.log(e);
        }
    }

    async getHtml() {
        await this.loadElements();
       
        return `<div id="app-child-profile">` + this.navbar + 
            `
                <main class="container mt-5">
        <div class="row">
            <div class="col-6 offset-2 mt-3">
                <div class="card" style="width: 28rem;">
                    <img src="${AbstractView.avatar}" class="card-img-top" alt="Profile picture">
                    <div class="card-body">
                        <h5 class="card-title">${AbstractView.username}</h5>
                    </div>
                    <ul class="list-group list-group-flush">
                        <li class="list-group-item">Matches: 0</li>
                        <li class="list-group-item">Tournaments: 0</li>
                        <li class="list-group-item">Score: 0</li>
                    </ul>
                    <div class="card-body">

                        <a href="#" class="card-link">Edit</a>
                        <a href="#" class="card-link">Log out</a>
                    </div>
                </div>

            </div>
            <div class="col-3 offset-1 mt-3 text-center rounded-2" id="myfriends">
                <h3 class="m-4 display-5">My friends</h3>
                <div class="avatar-gallery py-4">
                    <a href="#" class="text-decoration-none d-flex flex-column align-items-center">
                        <div class="avatar-item">
                            <img src="../../public/avatars/steampunk/steampunk_peng.jpg" alt="Avatar 1">
                        </div>
                        Steamie
                    </a>
                    <a href="#" class="text-decoration-none d-flex flex-column align-items-center">
                        <div class="avatar-item">
                            <img src="../../public/avatars/gentleman/gentleman.webp" alt="Avatar 2">
                        </div>
                        Gentie
                    </a>
                        <a href="#" class="text-decoration-none d-flex flex-column align-items-center">
                            <div class="avatar-item">
                                <img src="../../public/avatars/girlie_queen/Cutie.webp" alt="Avatar 3">
                            </div>
                            Princess
                        </a>
                        <a href="#" class="text-decoration-none d-flex flex-column align-items-center">
                            <div class="avatar-item">
                                <img src="../../public/avatars/steampunk/steampunk_noframe.jpg" alt="Avatar 4">
                            </div>
                            Gogglie
                        </a>
                        <a href="#" class="text-decoration-none d-flex flex-column align-items-center">
                            <div class="avatar-item">
                                <img src="../../public/avatars/punk/punk.webp" alt="Avatar 5">
                            </div>
                            Bad Mfucker
                        </a>
                        <a href="#" class="text-decoration-none d-flex flex-column align-items-center">
                            <div class="avatar-item">
                                <img src="../../public/avatars/bro/bro.webp" alt="Avatar 6">
                            </div>
                            Tech Bro
                        </a>
                        <a href="#" class="text-decoration-none d-flex flex-column align-items-center">
                            <div class="avatar-item">
                                <img src="../../public/avatars/sk8er/sk8er_skate.webp" alt="Avatar 7">
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