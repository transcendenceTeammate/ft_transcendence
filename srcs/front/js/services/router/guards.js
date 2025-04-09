import { showToast } from "../../core/toast.js";
import { AuthProvider, AuthConnectionStatus } from "../../data/providers/AuthProvider.js";

export const requireAuth = () => {
  const authProvider = AuthProvider.getInstance();
  const isAuth = authProvider.authConnectionStatusStream.value;

  switch (isAuth) {
    case AuthConnectionStatus.CONNECTED:
      return null;

    case AuthConnectionStatus.DISCONNECTING:
      return '/';

    default:
      showToast({
        title: "Unauthorized",
        message: "Please log in or sign up first.",
        type: "error",
        duration: 4000
      });
      return '/';
  }
};

export const redirectIfAuth =  () => {
  const authProvider = AuthProvider.getInstance();
  const isAuth = authProvider.authConnectionStatusStream.value === AuthConnectionStatus.CONNECTED;
  return isAuth ? '/start-game' : null;
};
