import AbstractView from "./AbstractView.js";
export default class extends AbstractView {
    constructor() {
        super();
        this.setTitle("Avatar");
    }

    async loadElements() {
        try {
            this.avatars = await super.loadAllElements('.avatar-item');
            this.dropZone = await super.loadElement('circle');
            this.upload = await super.loadElement('upload');
            this.usernameHeading = await super.loadElement('username-h')
            this.avatarBtn = await super.loadElement('avatar-btn');
            this.pageDiv = await super.loadElement('app-child-avatar');
        } catch (e) {
            console.log(e);
        }
    }

    allowDrop(event) {
        event.preventDefault();
    }

    drag(event) {
        event.dataTransfer.setData("text", event.target.src);
    }

    drop() {
        // console.log(`hello from drop function. Has dropZone been loaded? ${this.dropZone}`);
        this.dropZone.addEventListener('drop', (event) => {
            event.preventDefault();
            const dropZone = event.target.closest('.drop-zone');
            const data = event.dataTransfer.getData("text");
            console.log(`image data: ${data}`);

            if (data) {
                dropZone.innerHTML = `<img src="${data}" alt="Selected Avatar">`;
                this.avatarBtn.innerText = "Let's go!";
                AbstractView.avatar = data;
                this.pageDiv.classList.toggle('penguin-cursor')
                this.avatarBtn.classList.toggle('penguin-cursor')
    
            }
        });
    }



    uploadAvatar() {
        this.upload.addEventListener('change', (event) => {
            const file = event.target.files[0];
            // console.log('hello from upload.eventListener')
            // console.dir(event.target)
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    console.log(`uploaded avatars url: ${e.target.result}`)
                    this.dropZone.innerHTML = `<img src="${e.target.result}" alt="Uploaded Avatar">`;
                };
                reader.readAsDataURL(file);
            }

        })

    }

    async attachAllJs() {
        // await AbstractView.isAuthenticated();
        await AbstractView.assignUsername();
       
        await this.loadElements();
        this.usernameHeading.innerText = `Welcome ${AbstractView.username}!`
        this.avatars.forEach(element => {
            element.addEventListener('dragstart', (event) => {
                event.dataTransfer.setData("text", event.target.src);
            });
        });
        this.avatarBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // console.log('hello from button event listener!!!')
            takeMeThere(location.origin + '/start_game')
        })
        this.drop();
        this.dropZone.addEventListener('dragover', (event) => {
            event.preventDefault();
        });
        this.uploadAvatar();
       

    }

    async getHtml() {
        this.attachAllJs();
        return `
        <div id="app-child-avatar">
        <div class="container text-center mt-xxl-3 pt-xxl-3 me-xxl-5">
        <div id="gallerydiv" class="row p-4 rounded ">
            <div class="col-xxl-6 col">
                <h3 id="username-h">Welcome blabla!</h3>
                <h2 class="mb-4 display-5" id="avatar-heading">Which penguin are you?</h2>
                <div class="avatar-gallery">
                    <div class="avatar-item" draggable="true">
                        <img src="../public/avatars/steampunk/steampunk_peng.jpg" alt="Avatar 1">
                    </div>
                    <div class="avatar-item" draggable="true">
                        <img src="../public/avatars/gentleman/gentleman.webp" alt="Avatar 2">
                    </div>
                    <div class="avatar-item" draggable="true">
                        <img src="../public/avatars/girlie_queen/Cutie.webp" alt="Avatar 3">
                    </div>
                    <div class="avatar-item" draggable="true">
                        <img src="../public/avatars/steampunk/steampunk_noframe.jpg" alt="Avatar 4">
                    </div>
                    <div class="avatar-item" draggable="true">
                        <img src="../public/avatars/punk/punk.webp" alt="Avatar 4">
                    </div>
                    <div class="avatar-item" draggable="true">
                        <img src="../public/avatars/Heine/peng_Heine.webp" alt="Avatar 6">
                    </div>
                </div>
            </div>   
        </div>
        <div class="row pb-2" id="dropzone_col">
            <div class="col-xxl-4 offset-xxl-1 col-3 offset-4">
                <div class="drop-zone m-xl-5 rounded-circle w-50  d-flex" id="circle" >
                    <p>Drop Here</p>
                </div>
            </div>
        </div>
        <div class="row pb-xl-4" id='invisible-div'></div>
        <div class="row">
            <div class="col-xxl-6 col pt-xxl-5 d-flex flex-column justify-content-end align-items-center">
                <button class="btn btn-lg btn-light border border-black mt-5" id="avatar-btn">Continue without choosing</button>
            </div>
            <div class="col-4 offset-1 pt-xxl-5">
                <div id="own-avatar" class="m-0 p-0 rounded-3">
                    <h3 class="mt-5 py-3 fw-xxl-bold" id='own-avatar-h'>Or Upload Your Own Avatar</h3>
                    <input type="file" id="upload" accept="image/*" class="form-control mt-2">
                </div>
            </div>
        </div>
    </div>
                    </div>
                        `;


    }
}
