import { 
    collection, 
    addDoc, 
    deleteDoc,
    doc,
    query, 
    orderBy, 
    onSnapshot, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db } from "./firebase-config.js";

const COLLECTION_NAME = "wishlist";

export async function addWish(content, userId) {
    try {
        await addDoc(collection(db, COLLECTION_NAME), {
            content: content,
            userId: userId,
            timestamp: serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error("Error adding wish: ", error);
        return { success: false, error: error.message };
    }
}

export async function deleteWish(wishId) {
    try {
        await deleteDoc(doc(db, COLLECTION_NAME, wishId));
        return { success: true };
    } catch (error) {
        console.error("Error deleting wish: ", error);
        return { success: false, error: error.message };
    }
}

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
