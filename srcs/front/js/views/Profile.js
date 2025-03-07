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
            this.upload = await super.loadElement('upload');
            this.userpic = await super.loadElement('userpic')
            this.change_avatar_modal = await super.loadElement('change_avatar_div');
            // this.backdrops = await super.loadAllElements('modal-backdrop')

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

        // this.change_avatar_modal.addEventListener('shown.bs.modal', () => {
        //     // myInput.focus()
        //   })

        this.upload.addEventListener('change', (event) => {
            event.preventDefault();
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                 
                    this.userpic.src = e.target.result;
                    document.activeElement.blur();

                    // const modalElement = document.querySelector(".modal.show");
                    // if (modalElement) {
                    //     modalElement.classList.remove("show");
                    //     modalElement.style.display = "none";
                    //     document.body.classList.remove("modal-open");
                    
                    //     // Remove any existing modal backdrop
                    //     const backdrop = document.querySelector(".modal-backdrop");
                    //     if (backdrop) {
                    //         backdrop.remove();
                    //     }
                    // }

                    // bootstrap.Modal.remove()
                    // setTimeout(() => {
                    // }, 50);
                    console.dir(bootstrap.Modal)
                    const modalInstance = bootstrap.Modal.getOrCreateInstance(this.change_avatar_modal);
                    console.dir(modalInstance);
                    modalInstance.hide();

                    // bootstrap.Modal.prototype._hideModal()
                    // const modalInstance = new bootstrap.Modal(this.change_avatar_modal);
                    // if (modalInstance) {
                    //     // document.body.classList.remove('modal-open');
                    //     console.log('modal instance there!!!')
                    //     modalInstance.hide();
                    //     modalInstance.dispose();
                      
                    // } else {
                    //     console.warn("Modal instance not found!");
                    // }   
                };
                reader.readAsDataURL(file);

            }

        })
    }

    async getHtml() {
        this.navbar = await super.getNavbar();
       this.attachAllJs();

        return `<div id="app-child-profile">` 
        + `
        <div class="modal" tabindex="-1" id="change_avatar_div">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title fw-bold">Upload new avatar</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div>
                        <input class="form-control form-control-lg" id="upload" type="file">
                    </div>
                </div>
            </div>
        </div>
    </div>
        ` 
        + this.navbar +
            `
                <main class="container mt-5">
        <div class="row">
            <div class="col-6 offset-2 mt-3">
                <div class="card" style="width: 30rem;">
                    <div class="position-relative">
                        <span class="position-absolute bottom-0 end-0 p-2 bg-light border border-light rounded-pill"
                            id="editPhotoSpan">
                            <a class="icon-link link-dark px-1" role="button" data-bs-toggle="modal"
                                data-bs-target="#change_avatar_div" data-bs-title="Edit profile pic">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor"
                                    class="bi bi-camera" viewBox="0 0 16 16">
                                    <path
                                        d="M15 12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h1.172a3 3 0 0 0 2.12-.879l.83-.828A1 1 0 0 1 6.827 3h2.344a1 1 0 0 1 .707.293l.828.828A3 3 0 0 0 12.828 5H14a1 1 0 0 1 1 1zM2 4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1.172a2 2 0 0 1-1.414-.586l-.828-.828A2 2 0 0 0 9.172 2H6.828a2 2 0 0 0-1.414.586l-.828.828A2 2 0 0 1 3.172 4z" />
                                    <path
                                        d="M8 11a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5m0 1a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M3 6.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0" />
                                </svg>
                            </a>
                        </span>
                        <img src="../public/avatars/Heine/Heine_playing.webp" class="card-img-top" alt="..."
                            id="userpic">
                    </div>
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