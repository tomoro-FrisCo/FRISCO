import { 
    collection, 
    doc, 
    setDoc, 
    getDocs, 
    query, 
    where, 
    deleteDoc,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db } from "./firebase-config.js";

/**
 * 出欠登録（保存）
 * @param {string} userId - ユーザーID
 * @param {string} userName - 表示名
 * @param {string} date - 日付 (YYYY-MM-DD)
 * @param {string} status - 出欠 ('going' or 'absent')
 */
export async function setAttendance(userId, userName, date, status) {
    try {
        const attendanceId = `${userId}_${date}`;
        await setDoc(doc(db, "attendance", attendanceId), {
            userId: userId,
            userName: userName,
            date: date,
            status: status,
            timestamp: new Date()
        });
        return { success: true };
    } catch (error) {
        console.error("Attendance save error:", error);
        return { success: false, error: error.message };
    }
}

/**
 * 出欠取消
 */
export async function removeAttendance(userId, date) {
    try {
        const attendanceId = `${userId}_${date}`;
        await deleteDoc(doc(db, "attendance", attendanceId));
        return { success: true };
    } catch (error) {
        console.error("Attendance delete error:", error);
        return { success: false, error: error.message };
    }
}

/**
 * 特定の月の出欠データをリアルタイム取得
 */
export function subscribeToAttendance(monthStr, callback) {
    // monthStr: "2026-05"
    const q = query(collection(db, "attendance"), 
              where("date", ">=", `${monthStr}-01`),
              where("date", "<=", `${monthStr}-31`));

    return onSnapshot(q, (querySnapshot) => {
        const data = {};
        querySnapshot.forEach((doc) => {
            const item = doc.data();
            if (!data[item.date]) data[item.date] = [];
            data[item.date].push(item);
        });
        callback(data);
    });
}
