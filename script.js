import { registerUser, loginUser, logoutUser, observeAuthState } from "./auth.js";
import { setAttendance, removeAttendance, subscribeToAttendance } from "./attendance.js";
import { addWish, subscribeToWishes, deleteWish } from "./wishlist.js";
import { subscribeToEvents, saveEvent, deleteEvent } from "./events.js";

/**
 * --- Global Functions ---
 */
window.openAuthModal = () => {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => {
            const emailInput = document.getElementById('auth-email');
            if (emailInput) emailInput.focus();
        }, 100);
    }
};

// 管理者用：予定を削除
window.handleDeleteEvent = async (date) => {
    if (!confirm(`${date} の予定を削除しますか？`)) return;
    const res = await deleteEvent(date);
    if (!res.success) alert("削除に失敗しました: " + res.error);
};

// 管理者用：予定を追加
window.handleAddEvent = async () => {
    const dateInput = document.getElementById('admin-event-date');
    const titleInput = document.getElementById('admin-event-title');
    const date = dateInput.value;
    const title = titleInput.value.trim();

    if (!date || !title) {
        alert("日付と内容を入力してください");
        return;
    }

    const res = await saveEvent(date, title);
    if (res.success) {
        titleInput.value = '';
        alert("予定を保存しました");
    } else {
        alert("保存に失敗しました: " + res.error);
    }
};

window.handleDeleteWish = async (wishId) => {
    if (!confirm("この投稿を削除しますか？")) return;
    try {
        const res = await deleteWish(wishId);
        if (!res.success) alert("削除に失敗しました: " + res.error);
    } catch (e) {
        console.error("Delete error:", e);
    }
};

// 全削除機能
window.clearAllWishes = async () => {
    if (!confirm("【警告】表示されているすべての投稿を削除しますか？")) return;
    const container = document.getElementById('wish-list-container');
    if (!container) return;
    const btns = container.querySelectorAll('button[onclick*="handleDeleteWish"]');
    if (btns.length === 0) {
        alert("削除可能な投稿が見つかりませんでした。管理者として認識されていないか、投稿がありません。");
        return;
    }
    alert(btns.length + "件の投稿を削除します...");
    for (const btn of btns) {
        const match = btn.getAttribute('onclick').match(/'([^']+)'/);
        if (match) await deleteWish(match[1]);
    }
    alert("削除完了しました");
};

document.addEventListener('DOMContentLoaded', () => {
    let currentUser = null;
    let currentAttendanceData = {};
    let dynamicEvents = {}; // Firestoreから取得した予定
    let unsubscribeAttendance = null;
    let unsubscribeEvents = null;
    let isRegisterMode = false;
    let currentDate = new Date();

    const authModal = document.getElementById('auth-modal');
    const authForm = document.getElementById('auth-form');
    const navAuthItem = document.getElementById('nav-auth-item');
    const authSwitchLink = document.getElementById('auth-switch-link');
    const authModalTitle = document.getElementById('auth-modal-title');
    const registerFields = document.getElementById('register-only-fields');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const authErrorMsg = document.getElementById('auth-error-msg');
    const attendanceModal = document.getElementById('attendance-modal');

    const calendarGrid = document.getElementById('calendar-grid');
    const monthYearDisplay = document.getElementById('month-year');
    const detailPanel = document.getElementById('calendar-detail-panel');

    // --- Header & Scroll ---
    const header = document.querySelector('.header');
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) header.classList.add('scrolled');
            else header.classList.remove('scrolled');
        });
    }

    const menuToggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('.nav');
    if (menuToggle && nav) {
        menuToggle.onclick = () => {
            menuToggle.classList.toggle('active');
            nav.classList.toggle('active');
        };
    }

    // Appearance (IntersectionObserver)
    try {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
        document.querySelectorAll('.fade-in, .fade-in-up').forEach(el => observer.observe(el));
    } catch (e) {
        console.warn("Animation observer failed:", e);
        // フォールバック: エラー時はすべて表示
        document.querySelectorAll('.fade-in, .fade-in-up').forEach(el => el.style.opacity = '1');
    }

    // --- Modals ---
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.onclick = () => {
            if (authModal) authModal.style.display = 'none';
            if (attendanceModal) attendanceModal.style.display = 'none';
        };
    });

    // --- Auth ---
    if (authSwitchLink) {
        authSwitchLink.onclick = (e) => {
            e.preventDefault();
            isRegisterMode = !isRegisterMode;
            authModalTitle.textContent = isRegisterMode ? '新規アカウント作成' : 'LOGIN';
            registerFields.style.display = isRegisterMode ? 'block' : 'none';
            authSubmitBtn.textContent = isRegisterMode ? '登録してログイン' : 'ログイン';
            authSwitchLink.textContent = isRegisterMode ? 'すでにアカウントをお持ちの方へ' : 'アカウントをお持ちでない方へ';
        };
    }

    if (authForm) {
        const handleAuth = async (e) => {
            e.preventDefault();
            const email = document.getElementById('auth-email').value;
            const password = document.getElementById('auth-password').value;
            const displayName = document.getElementById('auth-display-name')?.value || "";
            
            authSubmitBtn.disabled = true;
            authSubmitBtn.textContent = '処理中...';

            if (isRegisterMode && !displayName) {
                alert("名前を入力してください");
                authSubmitBtn.disabled = false;
                return;
            }

            const res = isRegisterMode ? await registerUser(email, password, displayName) : await loginUser(email, password);
            if (res.success) {
                authModal.style.display = 'none';
                authForm.reset();
            } else {
                alert("エラー: " + res.error);
            }
            authSubmitBtn.disabled = false;
            authSubmitBtn.textContent = isRegisterMode ? '登録してログイン' : 'ログイン';
        };
        authForm.onsubmit = handleAuth;
    }

    // ログイン状態監視
    observeAuthState((user) => {
        currentUser = user;
        updateUIForUser(user);
    });

    function updateUIForUser(user) {
        const adminEmail = "tomorrow373tomorrow@gmail.com".toLowerCase();
        const isAdmin = user && user.email && user.email.toLowerCase() === adminEmail;
        const heroLoginContainer = document.getElementById('hero-login-container');
        const heroUserDisplay = document.getElementById('hero-user-display');

        if (user) {
            navAuthItem.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:0.7rem; font-weight:800;">👤 ${user.displayName || 'Member'}</span>
                    <button id="nav-logout-btn" class="btn" style="background:var(--color-navy); color:white; padding:4px 8px; font-size:0.6rem;">LOGOUT</button>
                </div>
            `;
            document.getElementById('nav-logout-btn').onclick = logoutUser;
            
            // バナーのボタン制御
            if (heroLoginContainer) heroLoginContainer.style.display = 'none';
            if (heroUserDisplay) heroUserDisplay.innerHTML = `🌟 ${user.displayName}さん、こんにちは！`;

            // 予定購読の開始（初回のみ、またはログイン後）
            if (!unsubscribeEvents) {
                unsubscribeEvents = subscribeToEvents((events) => {
                    dynamicEvents = events;
                    renderCalendar(currentDate);
                });
            }

            // Wish List Form
            const wishFormContainer = document.getElementById('wish-form-container');
            if (wishFormContainer) {
                const adminBtn = isAdmin ? `<button onclick="window.clearAllWishes()" class="btn" style="background:#e53e3e; color:white; padding:8px 15px; font-size:0.8rem; margin-bottom:15px; width:100%; border-radius:8px;">【管理者用】このページに見えている全投稿を削除</button>` : '';
                wishFormContainer.innerHTML = `
                    ${adminBtn}
                    <div class="glass-panel" style="background:white; padding:25px; border-radius:15px; box-shadow:var(--shadow-sm);">
                        <textarea id="wish-input" placeholder="匿名で投稿できます..." style="width:100%; height:80px; padding:12px; border:1px solid #ddd; border-radius:8px; margin-bottom:12px; resize:none;"></textarea>
                        <div style="text-align:right;"><button id="wish-submit-btn" class="btn btn-primary" style="padding:8px 25px;">投稿する</button></div>
                    </div>
                `;
                const wishSubmitBtn = document.getElementById('wish-submit-btn');
                const wishInput = document.getElementById('wish-input');
                if (wishSubmitBtn) {
                    wishSubmitBtn.onclick = async () => {
                        const content = wishInput.value.trim();
                        if (!content) return;
                        wishSubmitBtn.disabled = true;
                        const res = await addWish(content, user.uid);
                        if (res.success) wishInput.value = '';
                        wishSubmitBtn.disabled = false;
                    };
                }
            }
        } else {
            navAuthItem.innerHTML = `<button onclick="window.openAuthModal()" class="btn" style="background:var(--color-navy); color:white; padding:8px 15px; font-size:0.75rem;">LOGIN</button>`;
            
            // バナーの表示リセット
            if (heroLoginContainer) heroLoginContainer.style.display = 'block';
            if (heroUserDisplay) heroUserDisplay.innerHTML = '';

            // ログアウト時は購読停止（オプション：閲覧のみ許可なら停止しない）
            // 今回は全ユーザー閲覧可能にするので、購読は継続させます
            if (!unsubscribeEvents) {
                unsubscribeEvents = subscribeToEvents((events) => {
                    dynamicEvents = events;
                    renderCalendar(currentDate);
                });
            }

            const wishFormContainer = document.getElementById('wish-form-container');
            if (wishFormContainer) {
                wishFormContainer.innerHTML = `<div class="glass-panel" style="padding:30px; text-align:center;"><p style="margin-bottom:15px;">投稿するにはログインが必要です</p><button class="btn btn-primary" onclick="window.openAuthModal()">ログインする</button></div>`;
            }
        }
        renderCalendar(currentDate);
        initWishList(user);
    }

    function initWishList(user) {
        const container = document.getElementById('wish-list-container');
        if (!container) return;
        const adminEmail = "tomorrow373tomorrow@gmail.com".toLowerCase();
        const isAdmin = user && user.email && user.email.toLowerCase() === adminEmail;

        subscribeToWishes((wishes) => {
            container.innerHTML = wishes.map(wish => {
                const isOwner = user && (wish.userId === user.uid);
                const canDelete = isOwner || isAdmin;
                const deleteBtn = canDelete ? `<button onclick="window.handleDeleteWish('${wish.id}')" style="background:none; border:none; color:#e53e3e; cursor:pointer; font-size:1.1rem; position:absolute; top:15px; right:15px;">🗑️</button>` : '';
                const date = wish.timestamp ? new Date(wish.timestamp.seconds * 1000).toLocaleString('ja-JP', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) : 'なう';
                return `
                    <div class="wish-card" style="background:white; padding:20px; border-radius:12px; border-left:5px solid var(--color-accent); position:relative; box-shadow:var(--shadow-sm);">
                        ${deleteBtn}
                        <p style="font-size:0.95rem; color:var(--color-navy); margin-bottom:10px; padding-right:30px;">${wish.content}</p>
                        <div style="font-size:0.7rem; color:#888; text-align:right;">📅 ${date}</div>
                    </div>
                `;
            }).join('');
        });
    }

    // --- Calendar Logic ---
    function renderCalendar(date) {
        if (!calendarGrid) return;
        const year = date.getFullYear();
        const month = date.getMonth();
        const monthStr = `${year}-${String(month+1).padStart(2,'0')}`;
        monthYearDisplay.textContent = `${year}.${String(month+1).padStart(2,'0')}`;
        
        if (unsubscribeAttendance) unsubscribeAttendance();
        unsubscribeAttendance = subscribeToAttendance(monthStr, (data) => {
            currentAttendanceData = data;
            drawCalendar(date);
        });
    }

    function drawCalendar(date) {
        calendarGrid.innerHTML = '';
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const lastDate = new Date(year, month + 1, 0).getDate();
        const monthStr = `${year}-${String(month+1).padStart(2,'0')}`;
        const adminEmail = "tomorrow373tomorrow@gmail.com".toLowerCase();
        const isAdmin = currentUser && currentUser.email && currentUser.email.toLowerCase() === adminEmail;

        // Panel Update (Firestoreの予定を表示)
        const eventsInMonth = Object.keys(dynamicEvents).filter(d => d.startsWith(monthStr)).sort();
        if (detailPanel) {
            let adminForm = isAdmin ? `
                <div class="admin-event-form" style="background: white; padding: 15px; border-radius: 10px; margin-bottom: 20px; border: 2px solid var(--color-accent);">
                    <p style="font-size: 0.7rem; font-weight: 800; margin-bottom: 10px;">【管理者】予定を追加</p>
                    <input type="date" id="admin-event-date" style="width: 100%; padding: 5px; margin-bottom: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    <input type="text" id="admin-event-title" placeholder="13:00~ 練習 @戸塚" style="width: 100%; padding: 5px; margin-bottom: 10px; border: 1px solid #ddd; border-radius: 4px;">
                    <button onclick="window.handleAddEvent()" class="btn btn-primary" style="width: 100%; padding: 8px; font-size: 0.75rem;">カレンダーに追加</button>
                </div>
            ` : '';

            if (eventsInMonth.length > 0 || isAdmin) {
                detailPanel.innerHTML = `
                    ${adminForm}
                    <h4 style="font-size:0.75rem; opacity:0.6; margin-bottom:15px;">SCHEDULE</h4>
                    <div class="monthly-event-list">
                        ${eventsInMonth.map(d => {
                            const count = (currentAttendanceData[d] || []).filter(a => a.status === 'going').length;
                            const names = (currentAttendanceData[d] || []).filter(a => a.status === 'going').map(a => a.userName).join(', ') || 'なし';
                            const delBtn = isAdmin ? `<button onclick="window.handleDeleteEvent('${d}')" style="background:none; border:none; color:#e53e3e; cursor:pointer; font-size:0.8rem; margin-left:10px;">🗑️</button>` : '';
                            return `
                                <div class="monthly-event-item" onclick="window.openAttendanceModal('${d}', '${dynamicEvents[d]}')">
                                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                                        <div>
                                            <div class="monthly-event-date">${d}</div>
                                            <div class="monthly-event-title">${dynamicEvents[d]}</div>
                                        </div>
                                        ${delBtn}
                                    </div>
                                    <div style="font-size:0.7rem; color:#3182ce; margin-top:4px;">👤 ${count}人参加 (${names})</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            } else {
                detailPanel.innerHTML = `<p style="text-align:center; padding:20px; opacity:0.5;">予定なし</p>`;
            }
        }

        // Calendar Grid Update
        for (let i = 0; i < firstDay; i++) calendarGrid.appendChild(document.createElement('div'));
        for (let d = 1; d <= lastDate; d++) {
            const dayEl = document.createElement('div');
            dayEl.className = 'cal-day';
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const event = dynamicEvents[dateStr];
            const hasDB = (currentAttendanceData[dateStr] || []).length > 0;
            const dayOfWeek = new Date(year, month, d).getDay();
            let dayClass = dayOfWeek === 0 ? 'sunday' : (dayOfWeek === 6 ? 'saturday' : '');
            dayEl.innerHTML = `<span class="cal-day-num ${dayClass}">${d}</span>`;
            if (event || hasDB) {
                dayEl.classList.add('has-events');
                dayEl.onclick = () => window.openAttendanceModal(dateStr, event || "練習");
            }
            calendarGrid.appendChild(dayEl);
        }
    }

    window.openAttendanceModal = (date, title) => {
        if (!currentUser) { alert("ログインが必要です"); window.openAuthModal(); return; }
        const modal = document.getElementById('attendance-modal');
        modal.dataset.currentDate = date;
        document.getElementById('att-modal-date').textContent = date;
        document.getElementById('att-modal-event').textContent = title;
        updateAttendanceModalUI(date);
        modal.style.display = 'flex';
    };

    function updateAttendanceModalUI(date) {
        const list = currentAttendanceData[date] || [];
        const myAtt = list.find(a => a.userId === currentUser.uid);
        const membersList = document.getElementById('att-members-list');
        const removeBtn = document.getElementById('att-remove-btn');
        document.querySelectorAll('.att-choice-btn').forEach(btn => {
            btn.classList.remove('active-going', 'active-absent');
            if (myAtt && myAtt.status === btn.dataset.status) btn.classList.add('active-' + myAtt.status);
        });
        removeBtn.style.display = myAtt ? 'block' : 'none';
        const attendees = list.filter(a => a.status === 'going');
        membersList.innerHTML = attendees.length > 0 ? attendees.map(a => `<li>${a.userName}</li>`).join('') : '<li>なし</li>';
    }

    document.querySelectorAll('.att-choice-btn').forEach(btn => {
        btn.onclick = async () => {
            const status = btn.dataset.status;
            const date = document.getElementById('attendance-modal').dataset.currentDate;
            
            // UIを即座に更新
            document.querySelectorAll('.att-choice-btn').forEach(b => b.classList.remove('active-going', 'active-absent'));
            btn.classList.add('active-' + status);
            
            const res = await setAttendance(currentUser.uid, currentUser.displayName, date, status);
            if (!res.success) {
                alert("登録に失敗しました");
                updateAttendanceModalUI(date); // 失敗したら元に戻す
            }
        };
    });

    const attRemoveBtn = document.getElementById('att-remove-btn');
    if (attRemoveBtn) {
        attRemoveBtn.onclick = async () => {
            const date = document.getElementById('attendance-modal').dataset.currentDate;
            if (!confirm("出欠登録を取り消しますか？")) return;
            
            // UIを即座にリセット
            document.querySelectorAll('.att-choice-btn').forEach(b => b.classList.remove('active-going', 'active-absent'));
            attRemoveBtn.style.display = 'none';

            const res = await removeAttendance(currentUser.uid, date);
            if (!res.success) {
                alert("取り消しに失敗しました");
                updateAttendanceModalUI(date); // 失敗したら元に戻す
            }
        };
    }

    const prevBtn = document.getElementById('prev-month');
    const nextBtn = document.getElementById('next-month');
    if (prevBtn) prevBtn.onclick = () => { currentDate.setMonth(currentDate.getMonth()-1); renderCalendar(currentDate); };
    if (nextBtn) nextBtn.onclick = () => { currentDate.setMonth(currentDate.getMonth()+1); renderCalendar(currentDate); };
});
