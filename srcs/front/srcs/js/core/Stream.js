export class StreamSubscription {
    constructor(callbackId, stream) {
        this.callbackId = callbackId;
        this.stream = stream;
    }

    unsubscribe() {
        if (this.callbackId !== null && this.stream) {
            this.stream.callbacks.splice(this.callbackId - 1, 1);
            this.callbackId = null;
            this.stream = null;
        }
    }
}

export class Stream {
    constructor() {
        this.internal_value = null;
        this.callbacks = [];
    }

    get value() {
        return this.internal_value;
    }

    set value(newValue) {
        if (newValue === this.internal_value)
        {
            return ;
        }
            this.internal_value = newValue;
            this.callbacks.forEach(callback => callback(newValue));
    }

    listen(callback) {
        if (typeof callback === 'function') {
            this.callbacks.push(callback);
            callback(this.internal_value);
            return new StreamSubscription(this.callbacks.length, this);
        }
        return null;
    }
    static withDefault(initialValue) {
        const stream = new Stream();
        stream.value = initialValue;
        return stream;
    }
}
