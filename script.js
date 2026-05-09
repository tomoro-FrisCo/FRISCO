import { registerUser, loginUser, logoutUser, observeAuthState } from "./auth.js";
import { setAttendance, removeAttendance, subscribeToAttendance } from "./attendance.js";
import { addWish, subscribeToWishes, deleteWish } from "./wishlist.js";

/**
 * --- Global Functions ---
 * 確実にどこからでも（HTMLのonclickからも）呼べるように window オブジェクトに登録
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

window.handleDeleteWish = async (wishId) => {
    if (!confirm("この投稿を削除しますか？")) return;
    try {
        const res = await deleteWish(wishId);
        if (!res.success) alert("削除に失敗しました: " + res.error);
    } catch (e) {
        console.error("Delete error:", e);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // --- Global State ---
    let currentUser = null;
    let currentAttendanceData = {};
    let unsubscribeAttendance = null;
    let isRegisterMode = false;

    // --- DOM Elements ---
    const authModal = document.getElementById('auth-modal');
    const authForm = document.getElementById('auth-form');
    const navAuthItem = document.getElementById('nav-auth-item');
    const authSwitchLink = document.getElementById('auth-switch-link');
    const authModalTitle = document.getElementById('auth-modal-title');
    const registerFields = document.getElementById('register-only-fields');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const authErrorMsg = document.getElementById('auth-error-msg');
    const attendanceModal = document.getElementById('attendance-modal');

    const prevMonthBtn = document.getElementById('prev-month');
    const nextMonthBtn = document.getElementById('next-month');
    const monthYearDisplay = document.getElementById('month-year');
    const calendarGrid = document.getElementById('calendar-grid');
    const detailPanel = document.getElementById('calendar-detail-panel');
    const detailContent = document.getElementById('detail-content');
    const detailEmptyMsg = document.getElementById('detail-empty-msg');

    let currentDate = new Date();

    // --- 1. Header & Menu ---
    const header = document.querySelector('.header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) header.classList.add('scrolled');
        else header.classList.remove('scrolled');
    });

    const menuToggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('.nav');
    if (menuToggle) {
        menuToggle.onclick = () => {
            menuToggle.classList.toggle('active');
            nav.classList.toggle('active');
        };
    }

    // --- 1.5 Appearance (Fade-in logic) ---
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('visible');
        });
    }, { threshold: 0.1 });
    document.querySelectorAll('.fade-in, .fade-in-up, .fade-in-left, .fade-in-right').forEach(el => observer.observe(el));

    // Smooth Scrolling
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.onclick = (e) => {
            e.preventDefault();
            const targetId = anchor.getAttribute('href');
            if (targetId === '#') return;
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                if (menuToggle) {
                    menuToggle.classList.remove('active');
                    nav.classList.remove('active');
                }
                window.scrollTo({
                    top: targetElement.offsetTop - 70,
                    behavior: 'smooth'
                });
            }
        };
    });

    // --- 2. Modals Control ---
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.onclick = () => {
            authModal.style.display = 'none';
            if (attendanceModal) attendanceModal.style.display = 'none';
        };
    });

    window.onclick = (event) => {
        if (event.target == authModal) authModal.style.display = 'none';
        if (event.target == attendanceModal) attendanceModal.style.display = 'none';
    };

    // --- 3. Auth Logic ---
    if (authSwitchLink) {
        authSwitchLink.onclick = (e) => {
            e.preventDefault();
            isRegisterMode = !isRegisterMode;
            authModalTitle.textContent = isRegisterMode ? '新規アカウント作成' : 'LOGIN';
            registerFields.style.display = isRegisterMode ? 'block' : 'none';
            authSubmitBtn.textContent = isRegisterMode ? '登録してログイン' : 'ログイン';
            authSwitchLink.textContent = isRegisterMode ? 'すでにアカウントをお持ちの方（ログインへ）' : 'アカウントをお持ちでない方（新規登録）';
            authErrorMsg.style.display = 'none';
        };
    }

    if (authForm) {
        authForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('auth-email').value;
            const password = document.getElementById('auth-password').value;
            const displayName = document.getElementById('auth-display-name')?.value || "";

            authSubmitBtn.disabled = true;
            authSubmitBtn.textContent = '処理中...';

            const result = isRegisterMode 
                ? await registerUser(email, password, displayName)
                : await loginUser(email, password);

            if (result.success) {
                authModal.style.display = 'none';
                authForm.reset();
            } else {
                authErrorMsg.textContent = "エラー: " + result.error;
                authErrorMsg.style.display = 'block';
            }
            authSubmitBtn.disabled = false;
            authSubmitBtn.textContent = isRegisterMode ? '登録してログイン' : 'ログイン';
        };
    }

    // ログイン状態の反映
    observeAuthState((user) => {
        currentUser = user;
        const heroUserDisplay = document.getElementById('hero-user-display');
        const wishFormContainer = document.getElementById('wish-form-container');
        
        if (user) {
            navAuthItem.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 0.7rem; font-weight: 800; color: var(--color-navy); white-space: nowrap;">👤 ${user.displayName || 'Member'}</span>
                    <button id="nav-logout-btn" class="btn" style="background: var(--color-navy); color: var(--color-white); padding: 5px 10px; font-size: 0.6rem; border-radius: 20px;">LOGOUT</button>
                </div>
            `;
            document.getElementById('nav-logout-btn').onclick = logoutUser;
            
            if (wishFormContainer) {
                wishFormContainer.innerHTML = `
                    <div class="glass-panel" style="background: white; padding: 30px; border-radius: 15px; box-shadow: var(--shadow-sm);">
                        <textarea id="wish-input" placeholder="例：BBQがしたい！、新しい練習メニューを試したい！など自由にどうぞ" style="width: 100%; height: 100px; padding: 15px; border: 1px solid rgba(27, 54, 93, 0.1); border-radius: 10px; margin-bottom: 15px; font-family: var(--font-ja); resize: none; font-size: 0.95rem;"></textarea>
                        <div style="text-align: right;">
                            <button id="wish-submit-btn" class="btn btn-primary" style="padding: 10px 30px; font-size: 0.9rem;">匿名で投稿する</button>
                        </div>
                    </div>
                `;
                setupWishSubmit();
            }
            if (heroUserDisplay) heroUserDisplay.innerHTML = `🌟 ${user.displayName}さん、こんにちは！`;
        } else {
            navAuthItem.innerHTML = `<button id="nav-login-btn" class="btn" onclick="window.openAuthModal()" style="background: var(--color-navy); color: var(--color-white); padding: 8px 15px; font-size: 0.75rem; position: relative; z-index: 10005 !important;">LOGIN</button>`;
            if (wishFormContainer) {
                wishFormContainer.innerHTML = `
                    <div class="glass-panel" style="background: rgba(27, 54, 93, 0.03); padding: 40px; border-radius: 15px; text-align: center; border: 1px dashed rgba(27, 54, 93, 0.2);">
                        <p style="color: var(--color-navy); margin-bottom: 20px; font-weight: bold;">意見を投稿するにはログインが必要です</p>
                        <button class="btn btn-primary" onclick="window.openAuthModal()">ログインして投稿する</button>
                    </div>
                `;
            }
            if (heroUserDisplay) heroUserDisplay.innerHTML = '';
        }
        renderCalendar(currentDate);
    });

    // --- 4. Wish List Logic ---
    function setupWishSubmit() {
        const wishInput = document.getElementById('wish-input');
        const wishSubmitBtn = document.getElementById('wish-submit-btn');
        if (!wishSubmitBtn) return;
        wishSubmitBtn.onclick = async () => {
            const content = wishInput.value.trim();
            if (!content || !currentUser) return;
            wishSubmitBtn.disabled = true;
            const res = await addWish(content, currentUser.uid);
            if (res.success) wishInput.value = '';
            wishSubmitBtn.disabled = false;
        };
    }

    const wishListContainer = document.getElementById('wish-list-container');
    if (wishListContainer) {
        subscribeToWishes((wishes) => {
            wishListContainer.innerHTML = wishes.map(wish => {
                const date = wish.timestamp ? new Date(wish.timestamp.seconds * 1000).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'なう';
                const canDelete = currentUser && (wish.userId === currentUser.uid); 
                const deleteBtn = canDelete ? `<button onclick="window.handleDeleteWish('${wish.id}')" style="background:none; border:none; color:#e53e3e; cursor:pointer; font-size:1.1rem; position:absolute; top:15px; right:15px; opacity:0.8;">🗑️</button>` : '';
                return `
                    <div class="wish-card" style="background: white; padding: 20px; border-radius: 12px; border-left: 5px solid var(--color-accent); box-shadow: var(--shadow-sm); position: relative; animation: fadeIn 0.5s ease;">
                        ${deleteBtn}
                        <p style="font-size: 1rem; color: var(--color-navy); margin-bottom: 10px; line-height: 1.5; white-space: pre-wrap; padding-right: 30px;">${wish.content}</p>
                        <div style="font-size: 0.75rem; color: var(--color-text-muted); text-align: right; opacity: 0.7;">📅 ${date}</div>
                    </div>
                `;
            }).join('');
        });
    }

    // --- 5. Calendar Logic ---
    const fixedEvents = {
        "2026-05-13": "14時～16時 白金体育館",
        "2026-05-21": "戸塚キャンパス練習",
        "2026-05-27": "14時～16時 白金体育館",
        "2026-06-27": "15時～17時 早稲田大学合同練習"
    };

    function renderCalendar(date) {
        if (!calendarGrid) return;
        calendarGrid.innerHTML = '';
        const year = date.getFullYear();
        const month = date.getMonth();
        const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
        monthYearDisplay.textContent = `${year}.${String(month + 1).padStart(2, '0')}`;

        // 出欠データの購読
        if (unsubscribeAttendance) unsubscribeAttendance();
        unsubscribeAttendance = subscribeToAttendance(monthStr, (data) => {
            currentAttendanceData = data;
            drawCalendarGrid(year, month);
        });
    }

    function drawCalendarGrid(year, month) {
        calendarGrid.innerHTML = '';
        const firstDay = new Date(year, month, 1).getDay();
        const lastDate = new Date(year, month + 1, 0).getDate();
        const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

        // 詳細パネルを今月の予定リストに書き換え
        const eventsInMonth = Object.keys(fixedEvents)
            .filter(date => date.startsWith(monthStr))
            .sort();

        if (detailPanel) {
            if (eventsInMonth.length > 0) {
                detailPanel.innerHTML = `
                    <h4 style="font-size: 0.8rem; opacity: 0.6; margin-bottom: 20px; font-weight: 800; color: var(--color-navy);">SCHEDULE - ${monthYearDisplay.textContent}</h4>
                    <div class="monthly-event-list">
                        ${eventsInMonth.map(date => `
                            <div class="monthly-event-item" onclick="window.openAttendanceModal('${date}', '${fixedEvents[date]}')">
                                <div class="monthly-event-date">${date.replace(/-/g, '.')}</div>
                                <div class="monthly-event-title">${fixedEvents[date]}</div>
                            </div>
                        `).join('')}
                    </div>
                `;
            } else {
                detailPanel.innerHTML = `
                    <div style="height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: var(--color-text-muted); opacity: 0.5; padding: 40px 0;">
                        <span style="font-size: 2rem; margin-bottom: 10px;">📅</span>
                        今月の予定はありません
                    </div>
                `;
            }
        }

        // カレンダーグリッドの描画
        for (let i = 0; i < firstDay; i++) {
            calendarGrid.appendChild(document.createElement('div'));
        }

        for (let d = 1; d <= lastDate; d++) {
            const dayEl = document.createElement('div');
            dayEl.className = 'cal-day';
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            
            const dayOfWeek = new Date(year, month, d).getDay();
            let dayClass = '';
            if (dayOfWeek === 0) dayClass = 'sunday';
            if (dayOfWeek === 6) dayClass = 'saturday';

            dayEl.innerHTML = `<span class="cal-day-num ${dayClass}">${d}</span>`;
            
            const eventTitle = fixedEvents[dateStr];
            const dayData = currentAttendanceData[dateStr] || [];
            
            if (eventTitle) {
                dayEl.classList.add('has-events');
                dayEl.onclick = () => window.openAttendanceModal(dateStr, eventTitle);
            } else if (dayData.length > 0) {
                // DBにだけデータがある場合も一応表示
                dayEl.classList.add('has-events');
                dayEl.onclick = () => window.openAttendanceModal(dateStr, "練習 (17:00〜)");
            }
            
            calendarGrid.appendChild(dayEl);
        }
    }

    // グローバルに関数を公開（onclickから呼べるように）
    window.openAttendanceModal = (date, title) => {
        if (!currentUser) {
            alert("出欠登録にはログインが必要です");
            window.openAuthModal();
            return;
        }
        const modal = document.getElementById('attendance-modal');
        modal.dataset.currentDate = date;
        document.getElementById('att-modal-date').textContent = date;
        document.getElementById('att-modal-event').textContent = title;
        updateAttendanceModalUI(date);
        modal.style.display = 'flex';
    };

    function updateAttendanceModalUI(date) {
        const attendanceList = currentAttendanceData[date] || [];
        const myAttendance = attendanceList.find(a => a.userId === currentUser.uid);
        const membersList = document.getElementById('att-members-list');
        const removeBtn = document.getElementById('att-remove-btn');
        const choiceBtns = document.querySelectorAll('.att-choice-btn');

        // ボタンの状態リセット
        choiceBtns.forEach(btn => {
            btn.classList.remove('active-going', 'active-absent');
            btn.style.background = 'transparent';
            btn.style.color = btn.dataset.status === 'going' ? '#3182ce' : '#e53e3e';
        });

        if (myAttendance) {
            const activeClass = myAttendance.status === 'going' ? 'active-going' : 'active-absent';
            const activeBtn = document.querySelector(`.att-choice-btn[data-status="${myAttendance.status}"]`);
            if (activeBtn) activeBtn.classList.add(activeClass);
            removeBtn.style.display = 'block';
        } else {
            removeBtn.style.display = 'none';
        }

        // 参加者一覧
        const attendees = attendanceList.filter(a => a.status === 'going');
        membersList.innerHTML = attendees.length > 0 
            ? attendees.map(a => `<li>${a.userName}</li>`).join('')
            : '<li style="list-style:none; opacity:0.5;">まだ誰も登録していません</li>';
    }

    // 出欠ボタンイベント
    document.querySelectorAll('.att-choice-btn').forEach(btn => {
        btn.onclick = async () => {
            const status = btn.dataset.status;
            const date = document.getElementById('attendance-modal').dataset.currentDate;
            await setAttendance(currentUser.uid, currentUser.displayName, date, status);
        };
    });

    document.getElementById('att-remove-btn').onclick = async () => {
        const date = document.getElementById('attendance-modal').dataset.currentDate;
        await removeAttendance(currentUser.uid, date);
    };

    if (prevMonthBtn) prevMonthBtn.onclick = () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(currentDate); };
    if (nextMonthBtn) nextMonthBtn.onclick = () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(currentDate); };
    
    renderCalendar(currentDate);
});
