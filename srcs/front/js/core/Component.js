export class Component {
    static idCounter = 0;

    constructor() {
        this.componentId = `component-${Component.idCounter++}`;
        this.needRefresh = false;
        this._watchDomLoad()
    }

    _watchDomLoad()
    {
        const checkIsInDom = () => document.getElementById(this.componentId);

        if (checkIsInDom()) {
            this._onLoaded();
            return;
        }
        
        let timeoutId;

        const observer = new MutationObserver((mutations, obs) => {
            if (checkIsInDom()) {
                obs.disconnect();
                clearTimeout(timeoutId);
                this._onLoaded();
            }
        });

        timeoutId = setTimeout(() => {
            observer.disconnect();
        }, 20000);

        observer.observe(document.getElementById("app"), {
            childList: true,
            subtree: true,
        });
    }

    _onLoaded()
    {
        if (this.needRefresh)
        {
            this.updateComponent();
        }
        console.debug(`${this.componentId} loaded !`);
    }

    updateComponent() {
        
        const element = document.getElementById(this.componentId);
        if (element) {
            console.debug(`${this.componentId} refresh`);
            this.needRefresh = false;
            element.outerHTML = this.render();
        }
        else
        {
            this.needRefresh = true;
        }
    }

    render() {
        return `<section id="${this.componentId}" style="display: contents;">${this._getComponentHtml()}</section>`;
    }

    _getComponentHtml() {
        throw new Error("_getComponentHtml() must be implemented in child classes");
    }
}

