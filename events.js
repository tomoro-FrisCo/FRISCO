import { db } from "./firebase-config.js";
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-devtools-firestore.js";

// 全ての予定を取得（購読）
export function subscribeToEvents(callback) {
    const q = query(collection(db, "events"), orderBy("date", "asc"));
    return onSnapshot(q, (snapshot) => {
        const events = {};
        snapshot.forEach((doc) => {
            const data = doc.data();
            events[data.date] = data.title;
        });
        callback(events);
    });
}

// 予定を追加・更新
export async function saveEvent(date, title) {
    try {
        await setDoc(doc(db, "events", date), { date, title });
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// 予定を削除
export async function deleteEvent(date) {
    try {
        await deleteDoc(doc(db, "events", date));
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
}
