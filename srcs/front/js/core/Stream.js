export class StreamSubscription
{

}

export class Stream
{
	constructor ()
	{
		this.internal_value = null;
		this.callbacks = []
	}

	get value() {
		return this.internal_value;
	}

	set value(newValue) {
		this.internal_value = newValue;
		this.callbacks.forEach(callback => callback(newValue));
	}

	listen(callback) {
		if (typeof callback === 'function') {
			this.callbacks.push(callback);
		}
	}
	unsubscribe()
	{
		
	}
}