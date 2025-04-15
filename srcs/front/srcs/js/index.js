import { PresenceService } from "./services/PresenceService.js";
import { RouterService } from "./services/router/RouterService.js";
import { AuthProvider } from "./data/providers/AuthProvider.js";

const presenceService = PresenceService.getInstance();

const routerService = RouterService.getInstance();


window.takeMeThere = (url) => {
	routerService.navigateTo(url)
};

document.addEventListener("DOMContentLoaded", async () => {
	
	await AuthProvider.getInstance().init();
	routerService.init();

});
