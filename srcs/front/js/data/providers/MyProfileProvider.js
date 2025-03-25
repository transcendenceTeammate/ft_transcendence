import { Stream } from "../../core/Stream.js";
import { MockedBackendApi } from "../api/mockedBackendApi.js";



function createProfile({ username = null,
	avatarUrl = null, friendList = [] } = {}) {
	return {
		username,
		avatarUrl,
		friendList,
	};
}


export class MyProfileProvider {
	static _instance = null;
	static _backend = MockedBackendApi;

	constructor() {
		this._userProfile = Stream.withDefault(createProfile());
		this._userAvatar = new Stream();
		this._username = Stream.withDefault("username");
		this._friendList = Stream.withDefault([]);

		this._userProfile.listen((newProfile) => {
			this._userAvatar.value = newProfile.avatarUrl;
			this._username.value = newProfile.username;
			this._friendList.value = newProfile.friendList;
		});
	}


	async init() {
		this.updateProfile();
	}

	async getUserProfile(forceRemoteFetch = false) {
		if (this._userProfile.value === null || forceRemoteFetch) {
			return this.updateProfile();
		}
		return this._userProfile.value;
	}

	get userProfileStream() {
		return this._userProfile;
	}

	get friendListStream() {
		return this._friendList;
	}

	get usernameStream() {
		return this._username;
	}

	get userAvatarStream() {
		return this._userAvatar;
	}

	async setAvatar() {

	}

	async updateProfile() {
		let rawUserData = await MyProfileProvider._backend.getUserData();

		let userData = {
			username: rawUserData.username,
			avatarUrl: rawUserData.avatar_url,
			friendList: rawUserData.friend_list
		};
		this._userProfile.value = createProfile({
			username: userData.username,
			avatarUrl: userData.avatarUrl,
			friendList: userData.friendList.map((friend) => {
				return {
					username: friend.username,
					avatarUrl: friend.avatar_url,
					isConnected: friend.is_online
				}
			})
		});

		return this._userProfile;
	}

	static getInstance() {
		if (MyProfileProvider._instance == null) {
			MyProfileProvider._instance = new MyProfileProvider();
		}
		return MyProfileProvider._instance;
	}
}
