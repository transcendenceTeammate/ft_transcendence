import AbstractView from "./AbstractView.js";
export default class extends AbstractView {
    constructor() {
        super();
        this.setTitle("Accueil");
    }

    async pengCursor() {
        this.pageDiv = await super.loadElement('app-child-accueil');
        this.pageDiv.classList.toggle('penguin-cursor')
    }

    async auth42() {
        try {
            this.auth42_btn = await super.loadElement('auth42_btn');
            this.auth42_btn.addEventListener('click', async () => {
            const code = new URLSearchParams(window.location.search).get('code');

                if (!code) {
                    console.log('No authorization code found. Redirecting to authorization endpoint...');

                    // Construire l'URL d'autorisation
                    const authUrl = 'https://api.intra.42.fr/oauth/authorize?' +
                        new URLSearchParams({
                            client_id: 'u-s4t2ud-7ae040ee0824ffe8ba2a3661b6798a480ca7ab1c7cfd07ff7f6e8f4d50ead5b3',
                            redirect_uri: 'http://127.0.0.1:8000/auth42/',
                            response_type: 'code',
                        }).toString();

                    window.location.href = authUrl;
                }
            })

        } catch (e) {
            console.log(e);
        }
    }

    async getHtml() {
        this.auth42();
        this.pengCursor();
        return `
        <div id="app-child-accueil">
        <div id="container-accueil">
        <div id="login">
            <div>
                <button id="auth42_btn"><span>Log in with </span>
                    <img src="../public/logo_42-_svg.svg" alt="oops no logo" id="logo">
                </button>
            </div>
            <div style="margin-top: 0.3em">
                <a href="login" class="nav__link" data-link>Log in</a> |
                <a href="signup" class="nav__link" data-link>Sign up</a>
            </div>
        </div>

        <div id="penguins">
            <div class="pengdiv">
                <img src="../public/penguin-left-cut-radically.png" alt="oops" id="penguinleft" class="penguin animated">
            </div>
            <div id='ballcontainer'>
                <div id="ball" class="rounded-circle animated"></div>
            </div>
            <div class="pengdiv">
                <img src="../public/penguin-right-cut-radically.png" alt="no penguin" id="penguinright"
                    class="penguin animated">
            </div>
        </div>
        <div id="welcome">
            <h1 id="welcomeheading">Welcome to <span id="pengpong">
                    <span id="pengemoji" class="emojis">🐧</span>
                    <span id="peng" class="pengpong">Peng</span><span id="pong" class="pengpong">Pong</span>
                    <span id="pongemoji" class="emojis">🏓</span>
                </span> Game
            </h1>
        </div>
    </div>
    </div>
        `;
    }
}