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
            this.onLoaded();
            return;
        }
        
        let timeoutId;

        const observer = new MutationObserver((mutations, obs) => {
            if (checkIsInDom()) {
                this.onLoaded();
                obs.disconnect();
                clearTimeout(timeoutId);
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

    onLoaded()
    {
        if (this.needRefresh)
        {
            this.updateComponent();
        }
        console.debug(`${this.componentId} loaded !`);
    }

    updateComponent() {
        console.debug(`${this.componentId} refresh`);

        const element = document.getElementById(this.componentId);
        if (element) {
            this.needRefresh = false;
            element.outerHTML = this.render();
        }
        else
        {
            this.needRefresh = true;
        }
    }

    render() {
        return `<section id="${this.componentId}">${this._getComponentHtml()}</section>`;
    }

    _getComponentHtml() {
        throw new Error("_getComponentHtml() must be implemented in child classes");
    }
}

