
export class Middleware {
	async interceptRequest(endpoint, options, next = async () => { }) {
		const response = await next();
		return response;
	}
}

export class HttpClient {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this._middlewares = [];
    }

    _buildOptions(method, data = null, headers = {}, isJson = true) {
        const options = {
            method,
            headers: {
                ...(isJson ? { 'Content-Type': 'application/json' } : {}),
                ...headers,
            },
            credentials: 'include',
        };

        if (data && isJson) {
            options.body = JSON.stringify(data);
        } else if (data && !isJson) {
            options.body = data;
        }

        return options;
    }

    async _fetch(endpoint, options) {
        console.info(options);
        const response = await fetch(`${this.baseUrl}/${endpoint}`, options);
        return response;

    }


    registerMiddleware(middleware) {
        if (middleware.prototype instanceof Middleware) {
            this._middlewares.push(new middleware());
        } else {
            throw new Error(`${middleware.prototype} must be an instance of Middleware`);
        }
    }

    async _requestWithMiddlewares(endpoint, options) {
        const processMiddlewares = async (index, middlewareEntryEndpoint, middlewareEntryOptions) => {
            if (index >= this._middlewares.length) {
                return this._fetch(middlewareEntryEndpoint, middlewareEntryOptions);
            }
            return this._middlewares[index].interceptRequest(
                middlewareEntryEndpoint,
                middlewareEntryOptions,
                async (processedEndpoint, processedOptions) => {
                    return await processMiddlewares(index + 1, processedEndpoint, processedOptions)
                }
            );
        };

        return await processMiddlewares(0, endpoint, options);
    }

    async get(endpoint, headers = {}) {
        const options = this._buildOptions('GET', null, headers);
        return this._requestWithMiddlewares(endpoint, options);
    }

    async post(endpoint, data, headers = {}, isJson = true) {
        const options = this._buildOptions('POST', data, headers, isJson);
        return this._requestWithMiddlewares(endpoint, options);
    }

    async patch(endpoint, data, headers = {}) {
        const options = this._buildOptions('PATCH', data, headers);
        return this._requestWithMiddlewares(endpoint, options);
    }

    async delete(endpoint, data, headers = {}) {
        const options = this._buildOptions('DELETE', data, headers);
        return this._requestWithMiddlewares(endpoint, options);
    }

}

