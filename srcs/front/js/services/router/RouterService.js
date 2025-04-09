import { routes } from './routes.js';
import { AuthProvider } from "../../data/providers/AuthProvider.js";
import { showToast } from "../../core/toast.js";

function cleanupModals() {
  // Close any open Bootstrap modals
  if (typeof bootstrap !== 'undefined') {
    document.querySelectorAll('.modal').forEach(modal => {
      try {
        const modalInstance = bootstrap.Modal.getInstance(modal);
        if (modalInstance) {
          modalInstance.hide();
        }
      } catch (e) {
        console.error("Error closing modal via Bootstrap API:", e);
      }
    });
  }
  
  // Manually remove backdrop elements
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    if (backdrop.parentNode) {
      backdrop.parentNode.removeChild(backdrop);
    }
  });
  
  // Reset body styles
  document.body.classList.remove('modal-open');
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
}


export class RouterService {
  constructor() {
    this._authProvider = AuthProvider.getInstance();
    this._routes = routes;
  }

  init() {
    window.addEventListener("popstate", () => this.handleRouteChange());

    document.body.addEventListener("click", e => {
      if (e.target.matches("[data-link]")) {
        e.preventDefault();
        const href = e.target.closest("a")?.href;
        if (href) this.navigateTo(href);
      }
    });

    this._authProvider.authConnectionStatusStream.listen(() => this.handleRouteChange());
  }

  navigateTo(url) {
    history.pushState(null, null, url);
    this.handleRouteChange();
  }

  async handleRouteChange() {
    cleanupModals();
    const path = location.pathname;
    const route = this._routes.find(r => r.path === path) || this._routes.find(r => r.path === '/notfound');
    const redirect = route.guard ? route.guard() : null;

    if (redirect) {
      return this.navigateTo(redirect);
    }

    const view = new route.view();
    document.querySelector("#app").innerHTML = await view.getHtml();
    view.onLoaded?.();
  }

  static getInstance() {
    if (!RouterService._instance) {
      RouterService._instance = new RouterService();
    }
    return RouterService._instance;
  }
}
