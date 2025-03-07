// document.getElementById('auth42_btn').addEventListener('click', async function() {
    
//     const code = new URLSearchParams(window.location.search).get('code');

//     if (!code) {
//         console.log('No authorization code found. Redirecting to authorization endpoint...');
        
//         // Construire l'URL d'autorisation
//         const authUrl = 'https://api.intra.42.fr/oauth/authorize?' +
//             new URLSearchParams({
//                 client_id: 'u-s4t2ud-7ae040ee0824ffe8ba2a3661b6798a480ca7ab1c7cfd07ff7f6e8f4d50ead5b3',
//                 redirect_uri: '${CONFIG.API_URL}/auth42/',
//                 response_type: 'code',
//             }).toString();

//         window.location.href = authUrl;
//     }
// });
import AbstractView from "./AbstractView.js";
export default class extends AbstractView {

    async loadElements() {
        try {
            this.login = await super.loadElement('auth42_btn');
        } catch (e) {
            console.log(e);
        }
    }

    async validateForm() {
     

}
}