/**
 * FrisCo Official Site - Core Script (Consolidated & Stable Version)
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, 
    signOut, onAuthStateChanged, updateProfile 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { 
    getFirestore, collection, doc, setDoc, addDoc, deleteDoc, 
    onSnapshot, query, where, orderBy, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

console.log("FrisCo Script Loading...");

/**
 * --- Global Functions (Explicitly attached to window) ---
 */
window.openAuthModal = () => {
    console.log("Global: Opening Auth Modal");
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.style.display = 'flex';
        const emailInput = document.getElementById('auth-email');
        if (emailInput) setTimeout(() => emailInput.focus(), 100);
    }
};

window.handleDeleteEvent = async (date) => {
    if (!confirm(`${date} の予定を削除しますか？`)) return;
    try {
        await deleteDoc(doc(db, "events", date));
    } catch (e) { alert("削除エラー: " + e.message); }
};

window.handleAddEvent = async () => {
    const dIn = document.getElementById('admin-event-date');
    const tIn = document.getElementById('admin-event-title');
    if (!dIn.value || !tIn.value) return alert("入力してください");
    try {
        await setDoc(doc(db, "events", dIn.value), { date: dIn.value, title: tIn.value });
        tIn.value = '';
    } catch (e) { alert("保存エラー: " + e.message); }
};

window.handleDeleteWish = async (id) => {
    if (!confirm("削除しますか？")) return;
    try { await deleteDoc(doc(db, "wishlist", id)); } catch (e) { alert("エラー: " + e.message); }
};

window.clearAllWishes = async () => {
    if (!confirm("全削除しますか？")) return;
    const q = query(collection(db, "wishlist"));
    onSnapshot(q, (s) => s.forEach(d => deleteDoc(d.ref)));
};

// --- DOM Loaded Core ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Ready");
    let currentUser = null;
    let dynamicEvents = {};
    let currentAttendanceData = {};
    let unsubAttendance = null;
    let unsubEvents = null;
    let unsubWishes = null;
    let isRegisterMode = false;
    let currentDate = new Date();

    // Elements
    const authModal = document.getElementById('auth-modal');
    const authForm = document.getElementById('auth-form');
    const navAuthItem = document.getElementById('nav-auth-item');
    const calendarGrid = document.getElementById('calendar-grid');
    const detailPanel = document.getElementById('calendar-detail-panel');
    const monthYearDisplay = document.getElementById('month-year');

    // Click Bindings (Ensure buttons work even if onclick fails)
    document.addEventListener('click', (e) => {
        const target = e.target.closest('#hero-login-btn, .menu-toggle');
        if (!target) return;
        if (target.id === 'hero-login-btn') {
            e.preventDefault();
            window.openAuthModal();
        }
        if (target.classList.contains('menu-toggle')) {
            target.classList.toggle('active');
            document.querySelector('.nav')?.classList.toggle('active');
        }
    });

    // Appearance
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); });
    }, { threshold: 0.1 });
    document.querySelectorAll('.fade-in, .fade-in-up').forEach(el => observer.observe(el));

    // Auth State
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        updateUI(user);
    });

    async function updateUI(user) {
        const adminEmail = "tomorrow373tomorrow@gmail.com".toLowerCase();
        const isAdmin = user && user.email?.toLowerCase() === adminEmail;
        
        // Nav Auth
        if (navAuthItem) {
            if (user) {
                navAuthItem.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:0.7rem; font-weight:800;">👤 ${user.displayName || 'Member'}</span>
                        <button id="logout-btn" class="btn" style="background:var(--color-navy); color:white; padding:4px 8px; font-size:0.6rem;">LOGOUT</button>
                    </div>
                `;
                document.getElementById('logout-btn').onclick = () => signOut(auth);
            } else {
                navAuthItem.innerHTML = `<button onclick="window.openAuthModal()" class="btn" style="background:var(--color-navy); color:white; padding:8px 15px; font-size:0.75rem;">LOGIN</button>`;
            }
        }

        // Hero UI
        const hC = document.getElementById('hero-login-container');
        const hD = document.getElementById('hero-user-display');
        if (hC) hC.style.display = user ? 'none' : 'block';
        if (hD) hD.innerHTML = user ? `🌟 ${user.displayName}さん、こんにちは！` : '';

        // Subscriptions
        if (!unsubEvents) {
            unsubEvents = onSnapshot(query(collection(db, "events"), orderBy("date", "asc")), (s) => {
                dynamicEvents = {};
                s.forEach(d => { dynamicEvents[d.data().date] = d.data().title; });
                renderCalendar();
            });
        }
        initWishList(user, isAdmin);
        renderCalendar();
    }

    function initWishList(user, isAdmin) {
        const container = document.getElementById('wish-list-container');
        const formContainer = document.getElementById('wish-form-container');
        if (!container) return;

        if (formContainer) {
            if (user) {
                const adminBtn = isAdmin ? `<button onclick="window.clearAllWishes()" class="btn" style="background:#e53e3e; color:white; padding:8px 15px; font-size:0.8rem; margin-bottom:15px; width:100%; border-radius:8px;">【管理者用】全削除</button>` : '';
                formContainer.innerHTML = `
                    ${adminBtn}
                    <div class="glass-panel" style="background:white; padding:25px; border-radius:15px;">
                        <textarea id="wish-input" placeholder="匿名で投稿できます..." style="width:100%; height:80px; padding:12px; border:1px solid #ddd; border-radius:8px; margin-bottom:12px; resize:none;"></textarea>
                        <div style="text-align:right;"><button id="wish-submit-btn" class="btn btn-primary" style="padding:8px 25px;">投稿する</button></div>
                    </div>
                `;
                document.getElementById('wish-submit-btn').onclick = async () => {
                    const content = document.getElementById('wish-input').value.trim();
                    if (!content) return;
                    await addDoc(collection(db, "wishlist"), { content, userId: user.uid, timestamp: serverTimestamp() });
                    document.getElementById('wish-input').value = '';
                };
            } else {
                formContainer.innerHTML = `<div class="glass-panel" style="padding:30px; text-align:center;"><p>投稿するにはログインが必要です</p><button class="btn btn-primary" onclick="window.openAuthModal()">ログインする</button></div>`;
            }
        }

        if (!unsubWishes) {
            unsubWishes = onSnapshot(query(collection(db, "wishlist"), orderBy("timestamp", "desc")), (s) => {
                container.innerHTML = '';
                s.forEach(d => {
                    const wish = d.data();
                    const isOwner = user && wish.userId === user.uid;
                    const canDelete = isOwner || isAdmin;
                    const delBtn = canDelete ? `<button onclick="window.handleDeleteWish('${d.id}')" style="background:none; border:none; color:#e53e3e; cursor:pointer; font-size:1.1rem; position:absolute; top:15px; right:15px;">🗑️</button>` : '';
                    const date = wish.timestamp ? new Date(wish.timestamp.seconds * 1000).toLocaleString('ja-JP', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) : 'なう';
                    container.innerHTML += `
                        <div class="wish-card" style="background:white; padding:20px; border-radius:12px; border-left:5px solid var(--color-accent); position:relative; box-shadow:var(--shadow-sm); margin-bottom:15px;">
                            ${delBtn}<p style="font-size:0.95rem; color:var(--color-navy); margin-bottom:10px;">${wish.content}</p>
                            <div style="font-size:0.7rem; color:#888; text-align:right;">📅 ${date}</div>
                        </div>
                    `;
                });
            });
        }
    }

    function renderCalendar() {
        if (!calendarGrid) return;
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const monthStr = `${year}-${String(month+1).padStart(2,'0')}`;
        if (monthYearDisplay) monthYearDisplay.textContent = `${year}.${String(month+1).padStart(2,'0')}`;

        if (unsubAttendance) unsubAttendance();
        unsubAttendance = onSnapshot(query(collection(db, "attendance"), where("date", ">=", `${monthStr}-01`), where("date", "<=", `${monthStr}-31`)), (s) => {
            currentAttendanceData = {};
            s.forEach(d => {
                const item = d.data();
                if (!currentAttendanceData[item.date]) currentAttendanceData[item.date] = [];
                currentAttendanceData[item.date].push(item);
            });
            drawCalendar();
        });
    }

    function drawCalendar() {
        calendarGrid.innerHTML = '';
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const lastDate = new Date(year, month + 1, 0).getDate();
        const monthStr = `${year}-${String(month+1).padStart(2,'0')}`;
        const adminEmail = "tomorrow373tomorrow@gmail.com".toLowerCase();
        const isAdmin = currentUser && currentUser.email?.toLowerCase() === adminEmail;

        // Panel
        if (detailPanel) {
            const eventsInMonth = Object.keys(dynamicEvents).filter(d => d.startsWith(monthStr)).sort();
            let adminForm = isAdmin ? `
                <div style="background:white; padding:15px; border-radius:10px; margin-bottom:20px; border:2px solid var(--color-accent);">
                    <p style="font-size:0.7rem; font-weight:800; margin-bottom:10px;">【管理者】予定追加</p>
                    <input type="date" id="admin-event-date" style="width:100%; margin-bottom:5px;">
                    <input type="text" id="admin-event-title" placeholder="予定名" style="width:100%; margin-bottom:10px;">
                    <button onclick="window.handleAddEvent()" class="btn btn-primary" style="width:100%;">追加</button>
                </div>
            ` : '';
            detailPanel.innerHTML = adminForm + (eventsInMonth.length > 0 ? `<div class="monthly-event-list">${eventsInMonth.map(d => {
                const count = (currentAttendanceData[d] || []).filter(a => a.status === 'going').length;
                const delBtn = isAdmin ? `<button onclick="window.handleDeleteEvent('${d}')" style="color:#e53e3e; border:none; background:none; cursor:pointer;">🗑️</button>` : '';
                return `<div class="monthly-event-item" onclick="window.openAttendanceModal('${d}', '${dynamicEvents[d]}')"><div style="display:flex; justify-content:space-between;"><span>${d} ${dynamicEvents[d]}</span>${delBtn}</div><div style="font-size:0.7rem; color:#3182ce;">👤 ${count}人参加</div></div>`;
            }).join('')}</div>` : '<p style="text-align:center; opacity:0.5;">予定なし</p>');
        }

        for (let i = 0; i < firstDay; i++) calendarGrid.appendChild(document.createElement('div'));
        for (let d = 1; d <= lastDate; d++) {
            const dayEl = document.createElement('div');
            dayEl.className = 'cal-day';
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const event = dynamicEvents[dateStr];
            dayEl.innerHTML = `<span class="cal-day-num">${d}</span>`;
            if (event || (currentAttendanceData[dateStr] || []).length > 0) {
                dayEl.classList.add('has-events');
                dayEl.onclick = () => window.openAttendanceModal(dateStr, event || "練習");
            }
            calendarGrid.appendChild(dayEl);
        }
    }

    // Modal Control
    document.querySelectorAll('.modal-close').forEach(b => b.onclick = () => {
        if (authModal) authModal.style.display = 'none';
        const attModal = document.getElementById('attendance-modal');
        if (attModal) attModal.style.display = 'none';
    });

    // Auth Form Submit
    if (authForm) {
        authForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('auth-email').value;
            const pass = document.getElementById('auth-password').value;
            const name = document.getElementById('auth-display-name')?.value;
            try {
                if (isRegisterMode) {
                    const res = await createUserWithEmailAndPassword(auth, email, pass);
                    await updateProfile(res.user, { displayName: name });
                } else {
                    await signInWithEmailAndPassword(auth, email, pass);
                }
                authModal.style.display = 'none';
                authForm.reset();
            } catch (err) { alert("エラー: " + err.message); }
        };
    }

    const authSwitch = document.getElementById('auth-switch-link');
    if (authSwitch) {
        authSwitch.onclick = (e) => {
            e.preventDefault();
            isRegisterMode = !isRegisterMode;
            document.getElementById('auth-modal-title').textContent = isRegisterMode ? '新規登録' : 'LOGIN';
            document.getElementById('register-only-fields').style.display = isRegisterMode ? 'block' : 'none';
            document.getElementById('auth-submit-btn').textContent = isRegisterMode ? '登録してログイン' : 'ログイン';
        };
    }

    // Prev/Next
    document.getElementById('prev-month').onclick = () => { currentDate.setMonth(currentDate.getMonth()-1); renderCalendar(); };
    document.getElementById('next-month').onclick = () => { currentDate.setMonth(currentDate.getMonth()+1); renderCalendar(); };
});

window.openAttendanceModal = (date, title) => {
    const modal = document.getElementById('attendance-modal');
    if (!modal || !getAuth().currentUser) return alert("ログインが必要です");
    modal.dataset.currentDate = date;
    document.getElementById('att-modal-date').textContent = date;
    document.getElementById('att-modal-event').textContent = title;
    modal.style.display = 'flex';
    // ここに出欠リスト更新処理
};
