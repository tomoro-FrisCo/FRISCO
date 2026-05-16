/**
 * FrisCo Official Site - Final Stable Script
 * (Requires Firebase pre-initialized in index.html)
 */

// Global Reference to pre-initialized Firebase from index.html
const auth = window.auth;
const db = window.db;

console.log("FrisCo Core Script Starting...");

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
        alert("保存しました");
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
    if (!auth || !db) {
        console.error("Firebase not found. Check index.html initialization.");
        return;
    }

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

    // Click Bindings
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
            const attModal = document.getElementById('attendance-modal');
            if (attModal) attModal.style.display = 'none';
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
        const isAdmin = user && user.email?.toLowerCase() === "tomorrow373tomorrow@gmail.com";
        const name = user ? (user.displayName || user.email.split('@')[0] || 'Member') : '';
        
        if (navAuthItem) {
            if (user) {
                navAuthItem.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:0.7rem; font-weight:800; color:var(--color-navy);">👤 ${name}</span>
                        <button id="logout-btn" class="btn" style="background:var(--color-navy); color:white; padding:4px 8px; font-size:0.6rem; border-radius:4px;">LOGOUT</button>
                    </div>
                `;
                const lBtn = document.getElementById('logout-btn');
                if (lBtn) lBtn.onclick = () => auth.signOut();
            } else {
                navAuthItem.innerHTML = `<button onclick="window.openAuthModal()" class="btn" style="background:var(--color-navy); color:white; padding:8px 15px; font-size:0.75rem; border-radius:4px;">LOGIN</button>`;
            }
        }

        const hC = document.getElementById('hero-login-container');
        const hD = document.getElementById('hero-user-display');
        if (hC) hC.style.display = user ? 'none' : 'block';
        if (hD) hD.innerHTML = user ? `🌟 ${name}さん、こんにちは！` : '';

        // Realtime Subscriptions
        if (db) {
            db.collection("events").orderBy("date", "asc").onSnapshot((s) => {
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

    window.editEvent = (date, title) => {
        const dIn = document.getElementById('admin-event-date');
        const tIn = document.getElementById('admin-event-title');
        if (dIn && tIn) {
            dIn.value = date;
            tIn.value = title;
            tIn.focus();
            // フォームまでスクロール
            dIn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

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
                <div id="admin-panel" style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 25px; border: 2px solid var(--color-accent); box-shadow: var(--shadow-md);">
                    <p style="font-size: 0.8rem; font-weight: 800; margin-bottom: 15px; color: var(--color-navy); display: flex; align-items: center; gap: 5px;">
                        <span style="font-size: 1.2rem;">📅</span> 予定の追加・編集
                    </p>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <input type="date" id="admin-event-date" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-family: inherit;">
                        <input type="text" id="admin-event-title" placeholder="例：13:35～15:35 白金体育館" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-family: inherit;">
                        <button onclick="window.handleAddEvent()" class="btn btn-primary" style="width: 100%; padding: 10px; font-weight: 800; letter-spacing: 1px;">保存する</button>
                    </div>
                    <p style="font-size: 0.6rem; color: #888; margin-top: 10px;">※同じ日付で保存すると上書き（編集）されます</p>
                </div>
            ` : '';

            detailPanel.innerHTML = adminForm + (eventsInMonth.length > 0 ? `
                <h4 style="font-size:0.7rem; opacity:0.6; margin-bottom:15px; letter-spacing: 2px;">SCHEDULE LIST</h4>
                <div class="monthly-event-list">
                    ${eventsInMonth.map(d => {
                        const count = (currentAttendanceData[d] || []).filter(a => a.status === 'going').length;
                        const eventTitle = dynamicEvents[d];
                        let adminControls = isAdmin ? `
                            <div style="display: flex; gap: 10px;">
                                <button onclick="window.editEvent('${d}', '${eventTitle}')" style="background:none; border:none; cursor:pointer; font-size:1rem; filter: grayscale(1);" title="編集">✏️</button>
                                <button onclick="window.handleDeleteEvent('${d}')" style="background:none; border:none; cursor:pointer; font-size:1rem; filter: grayscale(1);" title="削除">🗑️</button>
                            </div>
                        ` : '';
                        
                        return `
                            <div class="monthly-event-item" style="background: white; border-radius: 10px; padding: 15px; margin-bottom: 12px; border: 1px solid rgba(0,0,0,0.05); transition: all 0.2s ease;">
                                <div style="display:flex; justify-content:space-between; align-items: flex-start;">
                                    <div onclick="window.openAttendanceModal('${d}', '${eventTitle}')" style="cursor: pointer; flex: 1;">
                                        <div class="monthly-event-date" style="color: var(--color-accent); font-weight: 800; font-size: 0.7rem; margin-bottom: 3px;">${d}</div>
                                        <div class="monthly-event-title" style="font-weight: 700; color: var(--color-navy); font-size: 0.9rem;">${eventTitle}</div>
                                        <div style="font-size:0.7rem; color:#3182ce; margin-top:6px; font-weight: 600;">👤 ${count}人参加予定</div>
                                    </div>
                                    ${adminControls}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            ` : '<div style="text-align:center; padding:40px; opacity:0.4; font-size: 0.9rem;">予定はありません</div>');
        }

        // Calendar Grid Update (保持)
        for (let i = 0; i < firstDay; i++) {
            const empty = document.createElement('div');
            empty.className = 'cal-day empty';
            calendarGrid.appendChild(empty);
        }
        for (let d = 1; d <= lastDate; d++) {
            const dayEl = document.createElement('div');
            dayEl.className = 'cal-day';
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const event = dynamicEvents[dateStr];
            const dayOfWeek = new Date(year, month, d).getDay();
            if (dayOfWeek === 0) dayEl.classList.add('is-sunday');
            
            dayEl.innerHTML = `<span class="cal-day-num">${d}</span>`;
            if (event || (currentAttendanceData[dateStr] || []).length > 0) {
                dayEl.classList.add('has-events');
                dayEl.onclick = () => window.openAttendanceModal(dateStr, event || "練習");
            }
            calendarGrid.appendChild(dayEl);
        }
    }

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
    
    updateAttendanceModalUI(date);
    modal.style.display = 'flex';
};

function updateAttendanceModalUI(date) {
    const list = currentAttendanceData[date] || [];
    const myAtt = list.find(a => a.userId === auth.currentUser.uid);
    const membersList = document.getElementById('att-members-list');
    const removeBtn = document.getElementById('att-remove-btn');

    // ボタンの状態更新
    document.querySelectorAll('.att-choice-btn').forEach(btn => {
        btn.classList.remove('active-going', 'active-absent');
        if (myAtt && myAtt.status === btn.dataset.status) {
            btn.classList.add('active-' + myAtt.status);
        }
    });

    if (removeBtn) removeBtn.style.display = myAtt ? 'block' : 'none';
    
    // 参加者名簿の更新
    const attendees = list.filter(a => a.status === 'going');
    if (membersList) {
        membersList.innerHTML = attendees.length > 0 
            ? attendees.map(a => `<li>${a.userName}</li>`).join('') 
            : '<li>まだ参加者はいません</li>';
    }
}

// 出欠ボタンのクリックイベント（デリゲーションで確実に動作させる）
document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.att-choice-btn');
    const removeBtn = e.target.closest('#att-remove-btn');
    const date = document.getElementById('attendance-modal')?.dataset.currentDate;
    if (!date || !auth.currentUser) return;

    if (btn) {
        const status = btn.dataset.status;
        // 即座にUI反映（楽観的更新）
        document.querySelectorAll('.att-choice-btn').forEach(b => b.classList.remove('active-going', 'active-absent'));
        btn.classList.add('active-' + status);

        try {
            const attId = `${auth.currentUser.uid}_${date}`;
            await db.collection("attendance").doc(attId).set({
                userId: auth.currentUser.uid,
                userName: auth.currentUser.displayName || auth.currentUser.email.split('@')[0],
                date: date,
                status: status,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (err) {
            alert("登録に失敗しました: " + err.message);
            updateAttendanceModalUI(date);
        }
    }

    if (removeBtn) {
        if (!confirm("出欠登録を取り消しますか？")) return;
        try {
            const attId = `${auth.currentUser.uid}_${date}`;
            await db.collection("attendance").doc(attId).delete();
        } catch (err) {
            alert("取り消しに失敗しました");
            updateAttendanceModalUI(date);
        }
    }
});
