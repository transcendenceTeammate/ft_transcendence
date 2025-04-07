import { Stream } from "../../core/Stream.js";
import { BackendApi } from "../api/backendApi.js";
import { MockedBackendApi } from "../api/mockedBackendApi.js";



function createProfile({ username = null, avatarUrl = null, friendList = [] } = {}) {
	return {
		username,
		avatarUrl,
		friendList,
		copyWith: function (updates) {
			return createProfile({
				username: updates.username ?? this.username,
				avatarUrl: updates.avatarUrl ?? this.avatarUrl,
				friendList: updates.friendList ?? this.friendList,
			});
		},
	};
}


export class MyProfileProvider {
	static _instance = null;
	
	constructor() {
		this._backend = new BackendApi();
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

	async setAvatar(image) {

		let response = await this._backend.uploadUserAvatar(image);

		const currentUserProfile = this._userProfile.value;
		const newImageUrl = response.avatar_url

		this._userProfile.value = currentUserProfile.copyWith({
			avatarUrl: newImageUrl
		});
	}

	async setUsername(newUsername)
	{
		let response = await this._backend.setUsername(newUsername);

		const currentUserProfile = this._userProfile.value;
		const responseNewUsername = response.nickname

		this._userProfile.value = currentUserProfile.copyWith({
			username: responseNewUsername
		});
	}

	async addFriend(friendUsername)
	{
		let response = await this._backend.addFriend(friendUsername);

		
		const currentUserProfile = this._userProfile.value;
		const rawFriendList = response.friends;
		

		this._userProfile.value = currentUserProfile.copyWith({
			friendList : rawFriendList.map((friend) => {
				return {
					username: friend.nickname,
					avatarUrl: friend.avatar_url ?? "/public/avatars/default/peng_head_def.webp",
					isConnected: friend.is_online
				};
			}),
		});
		return response;
	}

	async removeFriend(friendUsername)
	{
		let response = await this._backend.removeFriend(friendUsername);

		
		const currentUserProfile = this._userProfile.value;
		const rawFriendList = response.friends;
		

		this._userProfile.value = currentUserProfile.copyWith({
			friendList : rawFriendList.map((friend) => {
				return {
					username: friend.nickname,
					avatarUrl: friend.avatar_url ?? "/public/avatars/default/peng_head_def.webp",
					isConnected: friend.is_online
				};
			}),
		});
		return response;
	}


	async updateProfile() {
		let rawUserData = await this._backend.getUserData();
		let rawFriendList = await this._backend.getFriendList();

		let userData = {
			username: rawUserData.nickname,
			avatarUrl: rawUserData.avatar_url ?? "/public/avatars/default/peng_head_def.webp",
			friendList: rawFriendList.friends.map((friend) => {
				return {
					username: friend.nickname,
					avatarUrl: friend.avatar_url ?? "/public/avatars/default/peng_head_def.webp",
					isConnected: friend.is_online
				}
			})
		};
		this._userProfile.value = createProfile({
			username: userData.username,
			avatarUrl: userData.avatarUrl,
			friendList: userData.friendList
		});

		return this._userProfile.value;
	}

	static getInstance() {
		if (MyProfileProvider._instance == null) {
			MyProfileProvider._instance = new MyProfileProvider();
		}
		return MyProfileProvider._instance;
	}
}
