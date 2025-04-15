export class Component {
    static idCounter = 0;

    constructor() {
        this.componentId = `component-${Component.idCounter++}`;
        this.needRefresh = false;
    }

    _watchDomLoad()
    {
        const checkIsInDom = () => document.getElementById(this.componentId);

        if (checkIsInDom()) {
            this._onDomReady();
        }
        
        let timeoutId;

        const observer = new MutationObserver((mutations, obs) => {
            if (checkIsInDom()) {
                obs.disconnect();
                clearTimeout(timeoutId);
                this._onDomReady();
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


    _onDomReady() {
		if (!this._isInitialized) {
			this._onLoaded()
			this._isInitialized = true;
		}
		this._onRefresh();

		if (this.needRefresh) {
			this.updateComponent();
		}
		console.debug(`${this.componentId} is ready`);
	}


    _onRefresh()
    {

    }

    _onLoaded()
    {
        
    }

    updateComponent() {
        
        const element = document.getElementById(this.componentId);
        if (element) {
            console.debug(`${this.componentId} refresh`);
            this.needRefresh = false;
            element.innerHTML = this._getComponentHtml();
			this._onRefresh(); 
        }
        else
        {
            this.needRefresh = true;
        }
    }

    render() {
        this._watchDomLoad();
        return `<section id="${this.componentId}" style="display: contents;">${this._getComponentHtml()}</section>`;
    }

    _getComponentHtml() {
        throw new Error("_getComponentHtml() must be implemented in child classes");
    }
}

