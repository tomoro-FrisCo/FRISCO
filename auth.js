import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { auth } from "./firebase-config.js";

// --- 会員登録 ---
export async function registerUser(email, password, displayName) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        // プロフィールに表示名を設定
        await updateProfile(user, { displayName: displayName });
        return { success: true, user: user };
    } catch (error) {
        console.error("Registration error:", error);
        return { success: false, error: error.message };
    }
}

// --- ログイン ---
export async function loginUser(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return { success: true, user: userCredential.user };
    } catch (error) {
        console.error("Login error:", error);
        return { success: false, error: error.message };
    }
}

// --- ログアウト ---
export async function logoutUser() {
    try {
        await signOut(auth);
        return { success: true };
    } catch (error) {
        console.error("Logout error:", error);
        return { success: false, error: error.message };
    }
}

// --- ログイン状態の監視 ---
export function observeAuthState(callback) {
    onAuthStateChanged(auth, (user) => {
        callback(user);
    });
}
