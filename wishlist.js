import { db } from "./firebase-config.js";
import { 
    collection, 
    addDoc, 
    query, 
    orderBy, 
    onSnapshot, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const COLLECTION_NAME = "wishlist";

/**
 * 意見（Wish）を投稿する
 * @param {string} content 投稿内容
 */
export async function addWish(content) {
    try {
        await addDoc(collection(db, COLLECTION_NAME), {
            content: content,
            timestamp: serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error("Error adding wish: ", error);
        return { success: false, error: error.message };
    }
}

/**
 * 意見一覧をリアルタイムで購読する
 * @param {function} callback データ更新時に呼ばれる関数
 */
export function subscribeToWishes(callback) {
    const q = query(collection(db, COLLECTION_NAME), orderBy("timestamp", "desc"));
    return onSnapshot(q, (snapshot) => {
        const wishes = [];
        snapshot.forEach((doc) => {
            wishes.push({ id: doc.id, ...doc.data() });
        });
        callback(wishes);
    });
}
