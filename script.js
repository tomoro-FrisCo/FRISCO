import { registerUser, loginUser, logoutUser, observeAuthState } from "./auth.js";
import { setAttendance, removeAttendance, subscribeToAttendance } from "./attendance.js";

document.addEventListener('DOMContentLoaded', () => {
    // --- Global State ---
    let currentUser = null;
    let currentAttendanceData = {};
    let unsubscribeAttendance = null;

    // --- 1. Header Scroll Effect ---
    const header = document.querySelector('.header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // --- 2. Mobile Menu Toggle ---
    const menuToggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('.nav');
    const navLinks = document.querySelectorAll('.nav-list a');

    menuToggle.addEventListener('click', () => {
        menuToggle.classList.toggle('active');
        nav.classList.toggle('active');
    });

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            menuToggle.classList.remove('active');
            nav.classList.remove('active');
        });
    });

    // --- 3. Smooth Scrolling ---
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                const headerHeight = document.querySelector('.header').offsetHeight;
                const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - headerHeight;
                window.scrollTo({ top: targetPosition, behavior: 'smooth' });
            }
        });
    });

    // --- 4. Intersection Observer ---
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('visible');
        });
    }, { threshold: 0.15 });
    document.querySelectorAll('.fade-in, .fade-in-up, .fade-in-left, .fade-in-right').forEach(el => observer.observe(el));

    // --- 5. Firebase Auth UI Logic ---
    const authModal = document.getElementById('auth-modal');
    const authForm = document.getElementById('auth-form');
    const navLoginBtn = document.getElementById('nav-login-btn');
    const navAuthItem = document.getElementById('nav-auth-item');
    const authSwitchLink = document.getElementById('auth-switch-link');
    const authModalTitle = document.getElementById('auth-modal-title');
    const registerFields = document.getElementById('register-only-fields');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const authErrorMsg = document.getElementById('auth-error-msg');
    let isRegisterMode = false;

    // モーダル開閉
    navLoginBtn.addEventListener('click', () => {
        if (currentUser) {
            logoutUser();
        } else {
            authModal.style.display = 'flex';
        }
    });

    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            authModal.style.display = 'none';
            attendanceModal.style.display = 'none';
        });
    });

    // モード切り替え
    authSwitchLink.addEventListener('click', (e) => {
        e.preventDefault();
        isRegisterMode = !isRegisterMode;
        authModalTitle.textContent = isRegisterMode ? 'REGISTER' : 'LOGIN';
        registerFields.style.display = isRegisterMode ? 'block' : 'none';
        authSubmitBtn.textContent = isRegisterMode ? '新規登録' : 'ログイン';
        authErrorMsg.style.display = 'none';
    });

    // 送信処理
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        const displayName = document.getElementById('auth-display-name').value;

        let result;
        if (isRegisterMode) {
            result = await registerUser(email, password, displayName);
        } else {
            result = await loginUser(email, password);
        }

        if (result.success) {
            authModal.style.display = 'none';
            authForm.reset();
        } else {
            authErrorMsg.textContent = "エラー: " + result.error;
            authErrorMsg.style.display = 'block';
        }
    });

    // ログイン状態監視
    observeAuthState((user) => {
        currentUser = user;
        const heroUserDisplay = document.getElementById('hero-user-display');
        
        if (user) {
            // ヘッダーに名前を大きく表示
            navAuthItem.innerHTML = `
                <div style="display: flex; align-items: center; gap: 15px; background: rgba(27, 54, 93, 0.05); padding: 5px 15px; border-radius: 50px;">
                    <span style="font-size: 0.9rem; font-weight: 800; color: var(--color-navy);">👤 ${user.displayName || 'Member'}</span>
                    <button id="nav-logout-btn" class="btn" style="background: var(--color-navy); color: var(--color-white); padding: 5px 12px; font-size: 0.65rem; border-radius: 20px;">LOGOUT</button>
                </div>
            `;
            document.getElementById('nav-logout-btn').addEventListener('click', logoutUser);
            
            // トップバナーにも名前を表示
            if (heroUserDisplay) {
                heroUserDisplay.innerHTML = `🌟 ${user.displayName}さん、こんにちは！`;
            }
        } else {
            navAuthItem.innerHTML = `<button id="nav-login-btn" class="btn" style="background: var(--color-navy); color: var(--color-white); padding: 8px 20px; font-size: 0.8rem;">LOGIN</button>`;
            document.getElementById('nav-login-btn').addEventListener('click', () => authModal.style.display = 'flex');
            
            if (heroUserDisplay) {
                heroUserDisplay.innerHTML = '';
            }
        }
        renderCalendar(currentDate);
    });

    // --- 6. Custom Calendar & Attendance UI ---
    const calendarGrid = document.getElementById('calendar-grid');
    const monthYearText = document.getElementById('month-year');
    const prevMonthBtn = document.getElementById('prev-month');
    const nextMonthBtn = document.getElementById('next-month');
    const attendanceModal = document.getElementById('attendance-modal');
    
    let currentDate = new Date();
    const eventsData = {
        '2026-05-13': [{ title: '14:00~16:00 白金体育館', type: 'practice' }],
        '2026-05-21': [{ title: '戸塚キャンパス', type: 'practice' }],
        '2026-05-27': [{ title: '14:00~16:00 白金体育館', type: 'practice' }],
        '2026-06-27': [{ title: '15:00~17:00 早稲田大学合同練習', type: 'special' }]
    };

    function renderCalendar(date) {
        if (!calendarGrid) return;
        calendarGrid.innerHTML = '';
        const year = date.getFullYear();
        const month = date.getMonth();
        monthYearText.textContent = `${year}.${String(month + 1).padStart(2, '0')}`;

        const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
        if (unsubscribeAttendance) unsubscribeAttendance();
        unsubscribeAttendance = subscribeToAttendance(monthStr, (data) => {
            currentAttendanceData = data;
            updateCalendarAttendanceUI();
        });

        const firstDayIndex = new Date(year, month, 1).getDay();
        const lastDate = new Date(year, month + 1, 0).getDate();
        const today = new Date();
        const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

        for (let i = 0; i < firstDayIndex; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'cal-day empty';
            calendarGrid.appendChild(emptyCell);
        }

        for (let i = 1; i <= lastDate; i++) {
            const dayCell = document.createElement('div');
            dayCell.className = 'cal-day';
            
            // 日曜日の判定 (1日から始まる月の場合、曜日のインデックスを計算)
            const dayOfWeek = new Date(year, month, i).getDay();
            if (dayOfWeek === 0) dayCell.classList.add('is-sunday');
            
            if (isCurrentMonth && i === today.getDate()) dayCell.classList.add('today');
            
            const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            dayCell.dataset.date = dateString;
            
            let dayContent = `<span class="cal-day-num">${i}</span>`;
            if (eventsData[dateString]) {
                dayCell.classList.add('has-events');
            }
            
            dayCell.innerHTML = dayContent;
            dayCell.addEventListener('click', () => {
                document.querySelectorAll('.cal-day').forEach(d => d.classList.remove('selected'));
                dayCell.classList.add('selected');
                const target = document.getElementById(`event-item-${dateString}`);
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
            calendarGrid.appendChild(dayCell);
        }
    }

    function updateCalendarAttendanceUI() {
        const detailPanel = document.getElementById('calendar-detail-panel');
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const monthStr = `${year}-${String(month).padStart(2, '0')}`;

        // 該当月の予定を抽出してソート
        const monthlyEvents = Object.keys(eventsData)
            .filter(d => d.startsWith(monthStr))
            .sort();

        if (monthlyEvents.length === 0) {
            detailPanel.innerHTML = `<div style="text-align:center; padding:50px; opacity:0.5;">この月の予定はありません</div>`;
            return;
        }

        let html = `<h4 style="color:var(--color-navy); margin-bottom:20px; font-size:1rem; border-bottom:2px solid var(--color-navy); padding-bottom:5px;">${month}月の予定一覧</h4>`;
        
        monthlyEvents.forEach(date => {
            const events = eventsData[date];
            const attendanceList = currentAttendanceData[date] || [];
            const myAttendance = currentUser ? attendanceList.find(a => a.userId === currentUser.uid) : null;
            const attendees = attendanceList.filter(a => a.status === 'going');

            events.forEach((evt, idx) => {
                html += `
                    <div id="event-item-${date}" class="detail-event-item">
                        <div style="font-family:var(--font-en); font-weight:bold; color:var(--color-navy); font-size:0.9rem;">${date.replace(/-/g, '.')}</div>
                        <div style="font-weight:800; font-size:1.1rem; margin:5px 0; color:var(--color-accent);">${evt.title}</div>
                        
                        <div style="margin:15px 0;">
                            <div style="display: flex; gap: 10px;">
                                <button class="btn quick-att-btn ${myAttendance?.status === 'going' ? 'active-going' : ''}" 
                                    onclick="window.handleQuickAttendance('${date}', 'going')"
                                    style="flex:1; padding:8px; font-size:0.75rem; border:1px solid #3182ce; border-radius:5px; background:${myAttendance?.status === 'going' ? '#3182ce' : 'transparent'}; color:${myAttendance?.status === 'going' ? 'white' : '#3182ce'};">
                                    参加
                                </button>
                                <button class="btn quick-att-btn ${myAttendance?.status === 'absent' ? 'active-absent' : ''}" 
                                    onclick="window.handleQuickAttendance('${date}', 'absent')"
                                    style="flex:1; padding:8px; font-size:0.75rem; border:1px solid #e53e3e; border-radius:5px; background:${myAttendance?.status === 'absent' ? '#e53e3e' : 'transparent'}; color:${myAttendance?.status === 'absent' ? 'white' : '#e53e3e'};">
                                    欠席
                                </button>
                            </div>
                        </div>

                        <div style="font-size:0.8rem;">
                            <span style="font-weight:bold; opacity:0.7;">参加者 (${attendees.length}):</span>
                            <span style="margin-left:5px;">${attendees.map(a => a.userName).join(', ') || 'まだいません'}</span>
                        </div>
                    </div>
                `;
            });
        });

        detailPanel.innerHTML = html;
    }

    // クイック出欠登録用のグローバル関数
    window.handleQuickAttendance = async (date, status) => {
        if (!currentUser) {
            alert("ログインが必要です");
            document.getElementById('auth-modal').style.display = 'flex';
            return;
        }
        await setAttendance(currentUser.uid, currentUser.displayName, date, status);
        // updateCalendarAttendanceUI は Firestore のリスナーによって自動で呼ばれます
    };


    async function openAttendanceModal(date, eventTitle) {
        if (!currentUser) {
            alert("出欠登録にはログインが必要です。");
            authModal.style.display = 'flex';
            return;
        }

        document.getElementById('att-modal-date').textContent = date.replace(/-/g, '.');
        document.getElementById('att-modal-event').textContent = eventTitle;
        attendanceModal.style.display = 'flex';
        attendanceModal.dataset.currentDate = date;

        updateAttendanceModalUI(date);
    }

    function updateAttendanceModalUI(date) {
        const membersList = document.getElementById('att-members-list');
        const removeBtn = document.getElementById('att-remove-btn');
        const choiceBtns = document.querySelectorAll('.att-choice-btn');
        
        const attendanceList = currentAttendanceData[date] || [];
        const myAttendance = attendanceList.find(a => a.userId === currentUser.uid);

        // ボタンの状態リセット
        choiceBtns.forEach(btn => btn.className = 'btn att-choice-btn');
        if (myAttendance) {
            const activeClass = myAttendance.status === 'going' ? 'active-going' : 'active-absent';
            document.querySelector(`.att-choice-btn[data-status="${myAttendance.status}"]`).classList.add(activeClass);
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

    // 出欠ボタンクリック
    document.querySelectorAll('.att-choice-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const status = btn.dataset.status;
            const date = attendanceModal.dataset.currentDate;
            const res = await setAttendance(currentUser.uid, currentUser.displayName, date, status);
            if (res.success) updateAttendanceModalUI(date);
        });
    });

    document.getElementById('att-remove-btn').addEventListener('click', async () => {
        const date = attendanceModal.dataset.currentDate;
        const res = await removeAttendance(currentUser.uid, date);
        if (res.success) updateAttendanceModalUI(date);
    });

    renderCalendar(currentDate);
    prevMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(currentDate); });
    nextMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(currentDate); });
});

