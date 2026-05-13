/**
 * FrisCo Official Site - Ultra Stable Version (Compat Mode)
 */

// --- Firebase Config (Using local file via window or re-defined here for safety) ---
const firebaseConfig = {
    apiKey: "AIzaSyDE_some_key", // 実際の設定に置き換わる前提
    authDomain: "frisco-明治学院大学.firebaseapp.com",
    projectId: "frisco-明治学院大学",
    storageBucket: "frisco-明治学院大学.appspot.com",
    messagingSenderId: "367306236968",
    appId: "1:367306236968:web:7f6f571344400490f2305c"
};

// --- Initialization ---
let app, auth, db;
try {
    app = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    console.log("Firebase initialized successfully");
} catch (e) {
    console.error("Firebase initialization failed:", e);
}

/**
 * --- Global Functions ---
 */
window.openAuthModal = () => {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.style.display = 'flex';
        const emailInput = document.getElementById('auth-email');
        if (emailInput) setTimeout(() => emailInput.focus(), 100);
    }
};

window.handleAddEvent = async () => {
    const dIn = document.getElementById('admin-event-date');
    const tIn = document.getElementById('admin-event-title');
    if (!dIn.value || !tIn.value) return alert("日付と内容を入力してください");
    try {
        await db.collection("events").doc(dIn.value).set({ date: dIn.value, title: tIn.value });
        tIn.value = '';
    } catch (e) { alert("保存エラー: " + e.message); }
};

window.handleDeleteEvent = async (date) => {
    if (!confirm(`${date} の予定を削除しますか？`)) return;
    try { await db.collection("events").doc(date).delete(); } catch (e) { alert("削除エラー: " + e.message); }
};

window.handleDeleteWish = async (id) => {
    if (!confirm("削除しますか？")) return;
    try { await db.collection("wishlist").doc(id).delete(); } catch (e) { alert("エラー: " + e.message); }
};

document.addEventListener('DOMContentLoaded', () => {
    let currentUser = null;
    let dynamicEvents = {};
    let currentAttendanceData = {};
    let isRegisterMode = false;
    let currentDate = new Date();

    // Elements
    const authModal = document.getElementById('auth-modal');
    const authForm = document.getElementById('auth-form');
    const navAuthItem = document.getElementById('nav-auth-item');
    const calendarGrid = document.getElementById('calendar-grid');
    const detailPanel = document.getElementById('calendar-detail-panel');
    const monthYearDisplay = document.getElementById('month-year');

    // Click Bindings (SUPER ROBUST)
    document.addEventListener('click', (e) => {
        const target = e.target.closest('#hero-login-btn, .menu-toggle, .modal-close, #prev-month, #next-month');
        if (!target) return;

        if (target.id === 'hero-login-btn') {
            e.preventDefault();
            window.openAuthModal();
        } else if (target.classList.contains('menu-toggle')) {
            target.classList.toggle('active');
            document.querySelector('.nav')?.classList.toggle('active');
        } else if (target.classList.contains('modal-close')) {
            authModal.style.display = 'none';
            document.getElementById('attendance-modal').style.display = 'none';
        } else if (target.id === 'prev-month') {
            currentDate.setMonth(currentDate.getMonth() - 1);
            renderCalendar();
        } else if (target.id === 'next-month') {
            currentDate.setMonth(currentDate.getMonth() + 1);
            renderCalendar();
        }
    });

    // Appearance
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); });
    }, { threshold: 0.1 });
    document.querySelectorAll('.fade-in, .fade-in-up').forEach(el => observer.observe(el));

    // Auth State
    auth.onAuthStateChanged((user) => {
        currentUser = user;
        updateUI(user);
    });

    function updateUI(user) {
        const adminEmail = "tomorrow373tomorrow@gmail.com".toLowerCase();
        const isAdmin = user && user.email?.toLowerCase() === adminEmail;
        
        if (navAuthItem) {
            if (user) {
                navAuthItem.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:0.7rem; font-weight:800;">👤 ${user.displayName || 'Member'}</span>
                        <button id="logout-btn" class="btn" style="background:var(--color-navy); color:white; padding:4px 8px; font-size:0.6rem;">LOGOUT</button>
                    </div>
                `;
                document.getElementById('logout-btn').onclick = () => auth.signOut();
            } else {
                navAuthItem.innerHTML = `<button onclick="window.openAuthModal()" class="btn" style="background:var(--color-navy); color:white; padding:8px 15px; font-size:0.75rem;">LOGIN</button>`;
            }
        }

        const hC = document.getElementById('hero-login-container');
        const hD = document.getElementById('hero-user-display');
        if (hC) hC.style.display = user ? 'none' : 'block';
        if (hD) hD.innerHTML = user ? `🌟 ${user.displayName}さん、こんにちは！` : '';

        // Events Subscription
        db.collection("events").orderBy("date", "asc").onSnapshot((s) => {
            dynamicEvents = {};
            s.forEach(d => { dynamicEvents[d.data().date] = d.data().title; });
            renderCalendar();
        });

        initWishList(user, isAdmin);
        renderCalendar();
    }

    function initWishList(user, isAdmin) {
        const container = document.getElementById('wish-list-container');
        const formContainer = document.getElementById('wish-form-container');
        if (!container) return;

        if (formContainer) {
            if (user) {
                formContainer.innerHTML = `
                    <div class="glass-panel" style="background:white; padding:25px; border-radius:15px;">
                        <textarea id="wish-input" placeholder="匿名で投稿できます..." style="width:100%; height:80px; padding:12px; border:1px solid #ddd; border-radius:8px; margin-bottom:12px; resize:none;"></textarea>
                        <div style="text-align:right;"><button id="wish-submit-btn" class="btn btn-primary" style="padding:8px 25px;">投稿する</button></div>
                    </div>
                `;
                document.getElementById('wish-submit-btn').onclick = async () => {
                    const content = document.getElementById('wish-input').value.trim();
                    if (!content) return;
                    await db.collection("wishlist").add({ content, userId: user.uid, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
                    document.getElementById('wish-input').value = '';
                };
            } else {
                formContainer.innerHTML = `<div class="glass-panel" style="padding:30px; text-align:center;"><p>投稿するにはログインが必要です</p><button class="btn btn-primary" onclick="window.openAuthModal()">ログインする</button></div>`;
            }
        }

        db.collection("wishlist").orderBy("timestamp", "desc").onSnapshot((s) => {
            container.innerHTML = '';
            s.forEach(d => {
                const wish = d.data();
                const canDelete = isAdmin || (user && wish.userId === user.uid);
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

    function renderCalendar() {
        if (!calendarGrid) return;
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const monthStr = `${year}-${String(month+1).padStart(2,'0')}`;
        if (monthYearDisplay) monthYearDisplay.textContent = `${year}.${String(month+1).padStart(2,'0')}`;

        db.collection("attendance")
            .where("date", ">=", `${monthStr}-01`)
            .where("date", "<=", `${monthStr}-31`)
            .onSnapshot((s) => {
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
        const isAdmin = currentUser && currentUser.email?.toLowerCase() === "tomorrow373tomorrow@gmail.com";

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

    // Auth Form
    if (authForm) {
        authForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('auth-email').value;
            const pass = document.getElementById('auth-password').value;
            const name = document.getElementById('auth-display-name')?.value;
            try {
                if (isRegisterMode) {
                    const res = await auth.createUserWithEmailAndPassword(email, pass);
                    await res.user.updateProfile({ displayName: name });
                } else {
                    await auth.signInWithEmailAndPassword(email, pass);
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
});

window.openAttendanceModal = (date, title) => {
    const modal = document.getElementById('attendance-modal');
    if (!modal || !auth.currentUser) return alert("ログインが必要です");
    modal.dataset.currentDate = date;
    document.getElementById('att-modal-date').textContent = date;
    document.getElementById('att-modal-event').textContent = title;
    modal.style.display = 'flex';
};
