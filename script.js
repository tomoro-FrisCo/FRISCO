/**
 * FrisCo Official Site - Ultimate Stable Final Script
 */

function startApp() {
    const auth = window.auth;
    const db = window.db;

    if (!auth || !db) {
        setTimeout(startApp, 100);
        return;
    }

    console.log("Starting FrisCo App Logic...");

    let currentUser = null;
    let dynamicEvents = {};
    let currentAttendanceData = {};
    let currentDate = new Date();

    const calendarGrid = document.getElementById('calendar-grid');
    const detailPanel = document.getElementById('calendar-detail-panel');
    const monthYearDisplay = document.getElementById('month-year');
    const navAuthItem = document.getElementById('nav-auth-item');

    // --- Actions ---
    window.openAuthModal = () => {
        document.getElementById('auth-modal').style.display = 'flex';
    };

    window.handleAddEvent = async () => {
        const dIn = document.getElementById('admin-event-date');
        const tIn = document.getElementById('admin-event-title');
        if (!dIn.value || !tIn.value) return alert("入力してください");
        try {
            await db.collection("events").doc(dIn.value).set({ date: dIn.value, title: tIn.value });
            alert("保存しました");
        } catch (e) { alert(e.message); }
    };

    window.handleDeleteEvent = async (d) => {
        if (confirm("削除しますか？")) await db.collection("events").doc(d).delete();
    };

    window.editEvent = (d, t) => {
        const dIn = document.getElementById('admin-event-date');
        const tIn = document.getElementById('admin-event-title');
        if (dIn && tIn) { dIn.value = d; tIn.value = t; tIn.focus(); }
    };

    // --- Auth & Data ---
    auth.onAuthStateChanged(user => {
        currentUser = user;
        const name = user ? (user.displayName || user.email.split('@')[0]) : '';
        if (navAuthItem) {
            navAuthItem.innerHTML = user 
                ? `<div style="display:flex;align-items:center;gap:10px;"><span style="font-size:0.7rem;font-weight:800;">👤 ${name}</span><button id="logout-btn" class="btn" style="background:var(--color-navy);color:white;padding:5px 10px;font-size:0.6rem;border-radius:4px;">LOGOUT</button></div>`
                : `<button onclick="window.openAuthModal()" class="btn" style="background:var(--color-navy);color:white;padding:8px 15px;font-size:0.75rem;border-radius:4px;">LOGIN</button>`;
            const lo = document.getElementById('logout-btn');
            if (lo) lo.onclick = () => auth.signOut();
        }
        const hD = document.getElementById('hero-user-display');
        if (hD) hD.innerHTML = user ? `🌟 ${name}さん、こんにちは！` : '';
        document.getElementById('hero-login-container').style.display = user ? 'none' : 'block';
        
        draw();
    });

    db.collection("events").onSnapshot(s => {
        dynamicEvents = {};
        s.forEach(d => dynamicEvents[d.id] = d.data().title);
        draw();
    });

    db.collection("attendance").onSnapshot(s => {
        currentAttendanceData = {};
        s.forEach(d => {
            const item = d.data();
            if (!currentAttendanceData[item.date]) currentAttendanceData[item.date] = [];
            currentAttendanceData[item.date].push(item);
        });
        draw();
    });

    function draw() {
        if (!calendarGrid || !detailPanel) return;
        
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const lastDate = new Date(year, month + 1, 0).getDate();
        const monthStr = `${year}-${String(month+1).padStart(2,'0')}`;
        const isAdmin = currentUser && currentUser.email?.toLowerCase() === "tomorrow373tomorrow@gmail.com";

        if (monthYearDisplay) monthYearDisplay.textContent = `${year}.${String(month+1).padStart(2,'0')}`;

        // Grid
        calendarGrid.innerHTML = '';
        for (let i = 0; i < firstDay; i++) calendarGrid.appendChild(document.createElement('div')).className = 'cal-day empty';
        for (let d = 1; d <= lastDate; d++) {
            const dayEl = document.createElement('div');
            dayEl.className = 'cal-day';
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            if (new Date(year, month, d).getDay() === 0) dayEl.classList.add('is-sunday');
            dayEl.innerHTML = `<span class="cal-day-num">${d}</span>`;
            if (dynamicEvents[dateStr]) {
                dayEl.classList.add('has-events');
                dayEl.onclick = () => window.openAttendanceModal(dateStr, dynamicEvents[dateStr]);
            }
            calendarGrid.appendChild(dayEl);
        }

        // Details & Admin (PC: Right, Mobile: Bottom)
        const events = Object.keys(dynamicEvents).filter(d => d.startsWith(monthStr)).sort();
        let html = `
            <div style="display:flex; flex-direction:column; gap:25px;">
                <div id="schedule-list">
                    <h4 style="font-size:0.7rem; opacity:0.6; margin-bottom:15px; letter-spacing:2px; color:var(--color-navy);">SCHEDULE & MEMBERS</h4>
                    ${events.length > 0 ? events.map(d => {
                        const going = (currentAttendanceData[d] || []).filter(a => a.status === 'going');
                        const names = going.map(a => a.userName).join('、 ') || '参加予定なし';
                        const title = dynamicEvents[d];
                        return `
                            <div style="background:white; border-radius:12px; padding:15px; margin-bottom:15px; box-shadow:0 2px 10px rgba(0,0,0,0.05); border:1px solid rgba(0,0,0,0.05);">
                                <div onclick="window.openAttendanceModal('${d}', '${title}')" style="cursor:pointer;">
                                    <div style="color:var(--color-accent); font-weight:800; font-size:0.7rem; margin-bottom:5px;">${d}</div>
                                    <div style="font-weight:700; color:var(--color-navy); font-size:0.95rem; margin-bottom:8px;">${title}</div>
                                    <div style="background:#f0f7ff; padding:10px; border-radius:8px;">
                                        <div style="font-size:0.7rem; color:#3182ce; font-weight:800; margin-bottom:4px;">👤 参加予定 (${going.length}人)</div>
                                        <div style="font-size:0.75rem; color:#555; line-height:1.5;">${names}</div>
                                    </div>
                                </div>
                                ${isAdmin ? `
                                    <div style="display:flex; gap:10px; margin-top:12px; border-top:1px solid #eee; padding-top:10px;">
                                        <button onclick="window.editEvent('${d}', '${title}')" style="background:var(--color-navy); color:white; font-size:0.65rem; padding:5px 10px; border:none; border-radius:4px; cursor:pointer;">✏️ 編集</button>
                                        <button onclick="window.handleDeleteEvent('${d}')" style="background:#e53e3e; color:white; font-size:0.65rem; padding:5px 10px; border:none; border-radius:4px; cursor:pointer;">🗑️ 削除</button>
                                    </div>
                                ` : ''}
                            </div>
                        `;
                    }).join('') : '<p style="text-align:center; padding:40px; opacity:0.5;">今月の予定はありません</p>'}
                </div>
                ${isAdmin ? `
                    <div style="background:#fff; padding:20px; border-radius:15px; border:2px dashed var(--color-accent);">
                        <p style="font-size:0.8rem; font-weight:800; margin-bottom:15px;">🛠️ 予定の追加・編集</p>
                        <input type="date" id="admin-event-date" style="width:100%; padding:10px; margin-bottom:10px; border:1px solid #ddd; border-radius:6px;">
                        <input type="text" id="admin-event-title" placeholder="内容を入力" style="width:100%; padding:10px; margin-bottom:10px; border:1px solid #ddd; border-radius:6px;">
                        <button onclick="window.handleAddEvent()" class="btn btn-primary" style="width:100%; padding:12px; font-weight:800;">保存</button>
                    </div>
                ` : ''}
            </div>
        `;
        detailPanel.innerHTML = html;
    }

    document.getElementById('prev-month').onclick = () => { currentDate.setMonth(currentDate.getMonth()-1); draw(); };
    document.getElementById('next-month').onclick = () => { currentDate.setMonth(currentDate.getMonth()+1); draw(); };
    document.querySelectorAll('.modal-close').forEach(b => b.onclick = () => {
        document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
    });

    document.getElementById('auth-form').onsubmit = async (e) => {
        e.preventDefault();
        try {
            await auth.signInWithEmailAndPassword(document.getElementById('auth-email').value, document.getElementById('auth-password').value);
            document.getElementById('auth-modal').style.display = 'none';
        } catch (e) { alert(e.message); }
    };
}

startApp();

window.openAttendanceModal = (date, title) => {
    const modal = document.getElementById('attendance-modal');
    if (!modal || !window.auth.currentUser) return alert("ログインが必要です");
    modal.dataset.currentDate = date;
    document.getElementById('att-modal-date').textContent = date;
    document.getElementById('att-modal-event').textContent = title;
    modal.style.display = 'flex';
};

document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.att-choice-btn');
    if (btn && window.auth.currentUser) {
        const date = document.getElementById('attendance-modal').dataset.currentDate;
        const user = window.auth.currentUser;
        try {
            await window.db.collection("attendance").doc(`${user.uid}_${date}`).set({
                userId: user.uid,
                userName: user.displayName || user.email.split('@')[0],
                date: date,
                status: btn.dataset.status,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            document.getElementById('attendance-modal').style.display = 'none';
            alert("登録しました");
        } catch (e) { alert(e.message); }
    }
});
