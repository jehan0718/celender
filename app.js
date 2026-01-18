// State Management
const API_URL = '/api/proxy';
let schedules = [];
let currentYear = 2026;
let currentMonth = 0; // January (0-indexed)
let currentWeekStart = null;
let editingScheduleId = null;
let counselors = new Set();
let isInitialLoad = true;

// Time slots from 08:00 to 22:00
const TIME_SLOTS = [
    '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00',
    '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'
];

const DAYS = ['월', '화', '수', '목', '금'];
const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
    // 주기적 새로고침 제거 - 필요할 때만 데이터 로드
});

async function initializeApp() {
    await loadSchedules();
    updateCounselors();
    updateCounselorFilter();
    renderCalendar();
    renderWeekSelector();
    renderScheduleGrid();
    isInitialLoad = false;
}

function setupEventListeners() {
    // Navigation
    document.getElementById('prevMonth').addEventListener('click', () => {
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
        renderCalendar();
        renderWeekSelector();
        renderScheduleGrid();
    });

    document.getElementById('nextMonth').addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        renderCalendar();
        renderWeekSelector();
        renderScheduleGrid();
    });

    // Modal
    document.getElementById('addScheduleBtn').addEventListener('click', () => {
        openModal();
    });

    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('cancelBtn').addEventListener('click', closeModal);

    document.getElementById('scheduleModal').addEventListener('click', (e) => {
        // 모달 배경을 직접 클릭했을 때만 닫기 (modal-content 내부는 제외)
        if (e.target === document.getElementById('scheduleModal')) {
            closeModal();
        }
    });

    // modal-content 내부 클릭 시 이벤트 전파 방지 (confirm 팝업 안정화)
    document.querySelector('.modal-content').addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Form
    document.getElementById('scheduleForm').addEventListener('submit', handleFormSubmit);

    // Filter
    document.getElementById('counselorFilter').addEventListener('change', renderScheduleGrid);

    // Refresh Button
    document.getElementById('refreshBtn').addEventListener('click', async () => {
        const btn = document.getElementById('refreshBtn');
        btn.disabled = true;
        btn.innerHTML = '<span class="icon">⌛</span> 로딩 중...';
        await initializeApp();
        btn.disabled = false;
        btn.innerHTML = '<span class="icon">🔄</span> 새로고침';
    });

    // Delete Button (in modal)
    document.getElementById('deleteBtn').addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();

        // 삭제할 ID를 미리 저장
        const scheduleIdToDelete = editingScheduleId;

        const confirmed = await showConfirm('이 스케줄을 삭제하시겠습니까?');
        if (confirmed) {
            // 확인 즉시 모든 모달 닫기
            closeModal();
            // 즉시 삭제 실행 (await 없이)
            handleDeleteById(scheduleIdToDelete);
        }
    });

    // Custom Confirm Modal Event Listeners
    document.getElementById('confirmModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('confirmModal')) {
            closeConfirmModal(false);
        }
    });

    document.querySelector('#confirmModal .modal-content').addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

// ... (renderCalendar, renderWeekSelector remain same) ...

function renderCalendar() {
    document.getElementById('currentMonth').textContent = `${currentYear}년 ${MONTHS[currentMonth]}`;
}

function renderWeekSelector() {
    const weekSelector = document.getElementById('weekSelector');
    weekSelector.innerHTML = '';

    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);

    let weeks = [];
    let currentDate = new Date(firstDay);

    // Adjust to Monday
    while (currentDate.getDay() !== 1) {
        currentDate.setDate(currentDate.getDate() - 1);
    }

    while (currentDate <= lastDay || currentDate.getMonth() === currentMonth) {
        const weekStart = new Date(currentDate);
        const weekEnd = new Date(currentDate);
        weekEnd.setDate(weekEnd.getDate() + 6);

        weeks.push({
            start: new Date(weekStart),
            end: new Date(weekEnd)
        });

        currentDate.setDate(currentDate.getDate() + 7);

        if (currentDate.getMonth() !== currentMonth && weekStart.getMonth() !== currentMonth) {
            break;
        }
    }

    // Set first week as default if no week is selected
    if (!currentWeekStart || currentWeekStart.getMonth() !== currentMonth) {
        currentWeekStart = weeks[0].start;
    }

    weeks.forEach((week, index) => {
        const btn = document.createElement('button');
        btn.className = 'week-btn';
        btn.textContent = `${week.start.getMonth() + 1}/${week.start.getDate()} - ${week.end.getMonth() + 1}/${week.end.getDate()}`;

        if (isSameDay(week.start, currentWeekStart)) {
            btn.classList.add('active');
        }

        btn.addEventListener('click', () => {
            currentWeekStart = week.start;
            renderWeekSelector();
            renderScheduleGrid();
        });

        weekSelector.appendChild(btn);
    });
}

function renderScheduleGrid() {
    const grid = document.getElementById('scheduleGrid');
    grid.innerHTML = '';

    // Header row
    const emptyHeader = document.createElement('div');
    emptyHeader.className = 'grid-header';
    emptyHeader.textContent = '시간';
    grid.appendChild(emptyHeader);

    // Day headers
    for (let i = 0; i < 5; i++) {
        const date = new Date(currentWeekStart);
        date.setDate(date.getDate() + i);

        const header = document.createElement('div');
        header.className = 'grid-header';
        header.textContent = `${DAYS[i]} ${date.getMonth() + 1}/${date.getDate()}`;
        grid.appendChild(header);
    }

    // Time slots and schedule cells
    TIME_SLOTS.forEach(time => {
        const timeCell = document.createElement('div');
        timeCell.className = 'time-cell';
        timeCell.textContent = time;
        grid.appendChild(timeCell);

        for (let i = 0; i < 5; i++) {
            const date = new Date(currentWeekStart);
            date.setDate(date.getDate() + i);

            const cell = document.createElement('div');
            cell.className = 'schedule-cell';
            cell.dataset.date = formatDate(date);
            cell.dataset.time = time;

            const cellSchedules = getSchedulesForCell(date, time);
            cellSchedules.forEach(schedule => {
                const item = createScheduleItem(schedule);
                cell.appendChild(item);
            });

            cell.addEventListener('click', (e) => {
                if (e.target === cell) {
                    openModal(date, time);
                }
            });

            grid.appendChild(cell);
        }
    });
}

function getSchedulesForCell(date, time) {
    const dateStr = formatDate(date);
    const selectedCounselor = document.getElementById('counselorFilter').value;

    return schedules.filter(schedule => {
        // GAS는 날짜 형식이 다를 수 있으므로 보정
        const sDate = schedule.date instanceof Date ? formatDate(schedule.date) : schedule.date;
        if (sDate !== dateStr) return false;
        if (schedule.startTime !== time) return false;
        if (selectedCounselor !== 'all' && schedule.counselor !== selectedCounselor) return false;
        return true;
    });
}

function createScheduleItem(schedule) {
    const item = document.createElement('div');
    item.className = 'schedule-item';

    const counselorIndex = Array.from(counselors).indexOf(schedule.counselor) % 7;
    item.dataset.counselorIndex = counselorIndex;

    item.innerHTML = `
        <div class="schedule-item-client">${schedule.clientName}</div>
        <div class="schedule-item-time">${schedule.startTime} - ${schedule.endTime}</div>
        <div class="schedule-item-session">${schedule.sessionNumber}회기</div>
        <div class="schedule-item-counselor">${schedule.counselor}</div>
    `;

    item.addEventListener('click', (e) => {
        e.stopPropagation();
        openModal(null, null, schedule);
    });

    return item;
}

function openModal(date = null, time = null, schedule = null) {
    const modal = document.getElementById('scheduleModal');
    const form = document.getElementById('scheduleForm');
    const title = document.getElementById('modalTitle');
    const deleteBtn = document.getElementById('deleteBtn');

    form.reset();

    if (schedule) {
        title.textContent = '스케줄 상세 정보';
        editingScheduleId = schedule.id;
        deleteBtn.style.display = 'flex'; // 삭제 버튼 표시

        document.getElementById('counselor').value = schedule.counselor;
        document.getElementById('date').value = schedule.date instanceof Date ? formatDate(schedule.date) : schedule.date;
        document.getElementById('startTime').value = schedule.startTime;
        document.getElementById('endTime').value = schedule.endTime;
        document.getElementById('clientName').value = schedule.clientName;
        document.getElementById('sessionNumber').value = schedule.sessionNumber;
    } else {
        title.textContent = '스케줄 추가';
        editingScheduleId = null;
        deleteBtn.style.display = 'none'; // 삭제 버튼 숨김

        if (date) document.getElementById('date').value = formatDate(date);
        if (time) {
            document.getElementById('startTime').value = time;
            const timeIndex = TIME_SLOTS.indexOf(time);
            if (timeIndex < TIME_SLOTS.length - 1) {
                document.getElementById('endTime').value = TIME_SLOTS[timeIndex + 1];
            }
        }
    }

    modal.classList.add('active');
}

function closeModal() {
    const modal = document.getElementById('scheduleModal');
    modal.classList.remove('active');
    editingScheduleId = null;
}

async function handleFormSubmit(e) {
    e.preventDefault();

    const formData = {
        id: editingScheduleId || Date.now().toString(),
        counselor: document.getElementById('counselor').value,
        date: document.getElementById('date').value,
        startTime: document.getElementById('startTime').value,
        endTime: document.getElementById('endTime').value,
        clientName: document.getElementById('clientName').value,
        sessionNumber: parseInt(document.getElementById('sessionNumber').value)
    };

    try {
        // Optimistic UI Update: 서버 응답 전 화면 먼저 갱신
        if (editingScheduleId) {
            const idx = schedules.findIndex(s => s.id === editingScheduleId);
            if (idx !== -1) schedules[idx] = formData;
        } else {
            schedules.push(formData);
        }

        renderScheduleGrid();
        closeModal();

        // Background Sync with GAS
        await saveToGAS(formData);

        // Final sync to ensure data integrity
        await loadSchedules();
        updateCounselors();
        updateCounselorFilter();
        renderScheduleGrid();
    } catch (error) {
        console.error('Error saving schedule:', error);
        alert('저장에 실패했습니다. 네트워크 상태를 확인해주세요.');
        await loadSchedules(); // 에러 시 원래 데이터로 롤백
        renderScheduleGrid();
    }
}

// API Helper Functions
async function loadSchedules() {
    try {
        // 캐시 방지: 매번 새로운 요청으로 인식되도록 타임스탬프 추가
        const timestamp = new Date().getTime();
        const response = await fetch(`${API_URL}?t=${timestamp}`, {
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });

        if (!response.ok) {
            console.error('Failed to load schedules, status:', response.status);
            throw new Error('Failed to load schedules');
        }

        let data = await response.json();
        console.log('📥 Loaded schedules from server:', data);

        // 강력한 날짜 변환 함수
        function convertDate(dateValue) {
            if (!dateValue) return '';

            // 이미 YYYY-MM-DD 형식이면 그대로 반환
            if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
                return dateValue;
            }

            // ISO 문자열 (예: "2025-12-30T00:00:00.000Z")
            if (typeof dateValue === 'string' && dateValue.includes('T')) {
                return dateValue.split('T')[0];
            }

            // Date 객체 또는 타임스탬프
            try {
                const date = new Date(dateValue);
                if (!isNaN(date.getTime())) {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                }
            } catch (e) {
                console.error('Date conversion error:', e);
            }

            // 변환 실패 시 원본 반환
            return dateValue;
        }

        // 시간 변환 함수 (1899-12-30T02:32:08.000Z -> "10:00")
        function convertTime(timeValue) {
            if (!timeValue) return '';

            // 이미 HH:MM 형식이면 그대로 반환
            if (typeof timeValue === 'string' && /^\d{2}:\d{2}$/.test(timeValue)) {
                return timeValue;
            }

            // Date 객체 또는 ISO 문자열
            try {
                const date = new Date(timeValue);
                if (!isNaN(date.getTime())) {
                    // 구글 스프레드시트에서 시간만 저장한 경우 (1899-12-30으로 시작)
                    // 이 경우 시간 부분만 추출 (UTC 시간 사용)
                    // 1899-12-30T01:32:08.000Z -> 01:32 -> 10:00 (한국 시간대 +9시간)
                    let hours = date.getUTCHours();
                    let minutes = date.getUTCMinutes();

                    // 1899-12-30으로 시작하는 경우 (시간만 저장된 경우)
                    // UTC 시간을 그대로 사용 (구글 스프레드시트가 UTC로 저장)
                    if (timeValue.includes('1899-12-30')) {
                        // UTC 시간을 로컬 시간으로 변환하지 않고 그대로 사용
                        // 하지만 실제로는 시간대 차이를 고려해야 함
                        // 한국 시간대(KST)는 UTC+9이므로, UTC 시간에 9를 더해야 함
                        hours = (hours + 9) % 24;
                    }

                    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                }
            } catch (e) {
                console.error('Time conversion error:', e);
            }

            return timeValue;
        }

        schedules = data.map(item => ({
            ...item,
            date: convertDate(item.date),
            startTime: convertTime(item.startTime),
            endTime: convertTime(item.endTime)
        }));

        console.log('✅ Processed schedules:', schedules);
    } catch (error) {
        console.error('❌ Error loading schedules:', error);
    }
}

async function saveToGAS(scheduleData) {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scheduleData)
    });
    return response;
}

async function deleteFromGAS(id) {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: id })
    });
    return response;
}

function updateCounselors() {
    counselors.clear();
    schedules.forEach(schedule => {
        counselors.add(schedule.counselor);
    });
}

function updateCounselorFilter() {
    const filter = document.getElementById('counselorFilter');
    const currentValue = filter.value;

    filter.innerHTML = '<option value="all">전체 상담사</option>';

    Array.from(counselors).sort().forEach(counselor => {
        const option = document.createElement('option');
        option.value = counselor;
        option.textContent = counselor;
        filter.appendChild(option);
    });

    // Restore previous selection if it still exists
    if (currentValue !== 'all' && counselors.has(currentValue)) {
        filter.value = currentValue;
    }
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate();
}

// Delete handler function
async function handleDeleteById(scheduleId) {
    console.log('🗑️ handleDeleteById called with ID:', scheduleId);

    if (!scheduleId) {
        console.error('❌ No schedule ID provided');
        return;
    }

    // 백업 (롤백용)
    const originalSchedules = [...schedules];

    try {
        // Optimistic UI: 즉시 UI에서 제거 (API 호출 전)
        schedules = schedules.filter(s => s.id !== scheduleId);
        updateCounselors();
        updateCounselorFilter();
        renderScheduleGrid();

        console.log('📤 Calling deleteFromGAS with ID:', scheduleId);
        const response = await deleteFromGAS(scheduleId);
        console.log('✅ Delete response:', response);
        console.log('✅ Delete completed successfully');
    } catch (error) {
        console.error('❌ Error deleting schedule:', error);
        // 실패 시 롤백
        schedules = originalSchedules;
        updateCounselors();
        updateCounselorFilter();
        renderScheduleGrid();
        alert('스케줄 삭제에 실패했습니다. 다시 시도해주세요.');
    }
}

// Custom Confirm Modal Functions
let confirmResolve = null;

function showConfirm(message) {
    return new Promise((resolve) => {
        confirmResolve = resolve;

        const modal = document.getElementById('confirmModal');
        const messageEl = document.getElementById('confirmMessage');

        messageEl.textContent = message;
        modal.classList.add('active');

        // 버튼 이벤트 리스너 설정 (기존 리스너 제거 후 추가)
        const okBtn = document.getElementById('confirmOkBtn');
        const cancelBtn = document.getElementById('confirmCancelBtn');

        const newOkBtn = okBtn.cloneNode(true);
        const newCancelBtn = cancelBtn.cloneNode(true);

        okBtn.parentNode.replaceChild(newOkBtn, okBtn);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

        newOkBtn.addEventListener('click', () => closeConfirmModal(true));
        newCancelBtn.addEventListener('click', () => closeConfirmModal(false));
    });
}

function closeConfirmModal(result) {
    const modal = document.getElementById('confirmModal');
    modal.classList.remove('active');

    if (confirmResolve) {
        confirmResolve(result);
        confirmResolve = null;
    }
}
