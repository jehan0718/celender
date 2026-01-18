// State Management
const API_URL = '/api/proxy';
let schedules = [];
let currentYear = 2026;
let currentMonth = 0; // January (0-indexed)
let currentWeekStart = null;
let editingScheduleId = null;
let counselors = new Set();
let clients = new Set();
let months = new Set();
let isInitialLoad = true;

// View and Filter State
let currentView = 'calendar'; // 'calendar' or 'list'
let searchQuery = '';
let activeFilters = {
    counselor: 'all',
    client: 'all',
    month: 'all'
};

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

    // Smart initial date: Navigate to most recent schedule on first load
    if (isInitialLoad && schedules.length > 0) {
        const mostRecentDate = findMostRecentScheduleDate();
        if (mostRecentDate) {
            currentYear = mostRecentDate.getFullYear();
            currentMonth = mostRecentDate.getMonth();
            currentWeekStart = getWeekStart(mostRecentDate);
        }
    }

    updateCounselors();
    updateClients();
    updateMonths();
    updateCounselorFilter();
    updateClientFilter();
    updateMonthFilter();
    renderCalendar();
    renderWeekSelector();
    renderCurrentView();
    isInitialLoad = false;
}

function findMostRecentScheduleDate() {
    if (schedules.length === 0) return null;

    // Find the most recent date among all schedules
    let mostRecent = null;
    schedules.forEach(schedule => {
        const scheduleDate = new Date(schedule.date);
        if (!mostRecent || scheduleDate > mostRecent) {
            mostRecent = scheduleDate;
        }
    });

    return mostRecent;
}

function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    return new Date(d.setDate(diff));
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
        renderCurrentView();
    });

    document.getElementById('nextMonth').addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        renderCalendar();
        renderWeekSelector();
        renderCurrentView();
    });

    // View Toggle
    document.getElementById('calendarViewBtn').addEventListener('click', () => {
        switchView('calendar');
    });

    document.getElementById('listViewBtn').addEventListener('click', () => {
        switchView('list');
    });

    // Search
    document.getElementById('searchBtn').addEventListener('click', () => {
        performSearch();
    });

    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    document.getElementById('clearSearchBtn').addEventListener('click', () => {
        clearSearch();
    });

    // Filters
    document.getElementById('counselorFilter').addEventListener('change', (e) => {
        activeFilters.counselor = e.target.value;
        applyFilters();
    });

    document.getElementById('clientFilter').addEventListener('change', (e) => {
        activeFilters.client = e.target.value;
        applyFilters();
    });

    document.getElementById('monthFilter').addEventListener('change', (e) => {
        activeFilters.month = e.target.value;
        applyFilters();
    });

    document.getElementById('resetFiltersBtn').addEventListener('click', () => {
        resetFilters();
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

    // Termination Checkbox Handler
    document.getElementById('isTermination').addEventListener('change', (e) => {
        const sessionInput = document.getElementById('sessionNumber');
        if (e.target.checked) {
            sessionInput.value = '종료';
            sessionInput.disabled = true;
        } else {
            sessionInput.value = '';
            sessionInput.disabled = false;
            sessionInput.focus();
        }
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

// View Switching Functions
function switchView(viewType) {
    currentView = viewType;

    // Update button states
    document.getElementById('calendarViewBtn').classList.toggle('active', viewType === 'calendar');
    document.getElementById('listViewBtn').classList.toggle('active', viewType === 'list');

    // Show/hide containers
    document.getElementById('calendarViewContainer').style.display = viewType === 'calendar' ? 'block' : 'none';
    document.getElementById('weekSelector').style.display = viewType === 'calendar' ? 'flex' : 'none';
    document.getElementById('listViewContainer').style.display = viewType === 'list' ? 'block' : 'none';

    renderCurrentView();
}

function renderCurrentView() {
    if (currentView === 'calendar') {
        renderScheduleGrid();
    } else {
        renderListView();
    }
}

// Search Functions
function performSearch() {
    const input = document.getElementById('searchInput');
    searchQuery = input.value.toLowerCase().trim();

    if (searchQuery) {
        document.getElementById('clearSearchBtn').style.display = 'flex';
        switchView('list');
        renderListView();
    }
}

function clearSearch() {
    searchQuery = '';
    document.getElementById('searchInput').value = '';
    document.getElementById('clearSearchBtn').style.display = 'none';
    renderCurrentView();
}

// Filter Functions
function applyFilters() {
    // Show reset button if any filter is active
    const hasActiveFilter = activeFilters.counselor !== 'all' ||
        activeFilters.client !== 'all' ||
        activeFilters.month !== 'all';

    document.getElementById('resetFiltersBtn').style.display = hasActiveFilter ? 'inline-flex' : 'none';

    // Switch to list view when filters are active
    if (hasActiveFilter) {
        switchView('list');
    } else {
        renderCurrentView();
    }
}

function resetFilters() {
    activeFilters = {
        counselor: 'all',
        client: 'all',
        month: 'all'
    };

    document.getElementById('counselorFilter').value = 'all';
    document.getElementById('clientFilter').value = 'all';
    document.getElementById('monthFilter').value = 'all';
    document.getElementById('resetFiltersBtn').style.display = 'none';

    renderCurrentView();
}

function getFilteredSchedules() {
    let filtered = [...schedules];

    // Apply search filter
    if (searchQuery) {
        filtered = filtered.filter(schedule => {
            const dateMatch = schedule.date.includes(searchQuery);
            const counselorMatch = schedule.counselor.toLowerCase().includes(searchQuery);
            const clientMatch = schedule.clientName.toLowerCase().includes(searchQuery);
            return dateMatch || counselorMatch || clientMatch;
        });
    }

    // Apply counselor filter
    if (activeFilters.counselor !== 'all') {
        filtered = filtered.filter(s => s.counselor === activeFilters.counselor);
    }

    // Apply client filter
    if (activeFilters.client !== 'all') {
        filtered = filtered.filter(s => s.clientName === activeFilters.client);
    }

    // Apply month filter
    if (activeFilters.month !== 'all') {
        filtered = filtered.filter(s => s.date.startsWith(activeFilters.month));
    }

    return filtered;
}

// List View Rendering
function renderListView() {
    const container = document.getElementById('listViewContent');
    container.innerHTML = '';

    const filtered = getFilteredSchedules();

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <p>검색 결과가 없습니다</p>
            </div>
        `;
        return;
    }

    // Sort by date and time
    const sorted = filtered.sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return b.startTime.localeCompare(a.startTime);
    });

    // Group by date
    const grouped = {};
    sorted.forEach(schedule => {
        if (!grouped[schedule.date]) {
            grouped[schedule.date] = [];
        }
        grouped[schedule.date].push(schedule);
    });

    // Render grouped schedules
    Object.keys(grouped).sort().reverse().forEach(date => {
        const dateSection = document.createElement('div');
        dateSection.className = 'list-date-section';

        const dateHeader = document.createElement('div');
        dateHeader.className = 'list-date-header';
        const dateObj = new Date(date);
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        dateHeader.textContent = `${date} (${dayNames[dateObj.getDay()]})`;
        dateSection.appendChild(dateHeader);

        const itemsContainer = document.createElement('div');
        itemsContainer.className = 'list-items-container';

        grouped[date].forEach(schedule => {
            const item = createListItem(schedule);
            itemsContainer.appendChild(item);
        });

        dateSection.appendChild(itemsContainer);
        container.appendChild(dateSection);
    });
}

function createListItem(schedule) {
    const item = document.createElement('div');
    item.className = 'list-item';

    const counselorIndex = Array.from(counselors).indexOf(schedule.counselor) % 7;
    item.dataset.counselorIndex = counselorIndex;

    const sessionDisplay = schedule.sessionNumber === '종료' ?
        '<span class="termination-badge">종료</span>' :
        `${schedule.sessionNumber}회기`;

    item.innerHTML = `
        <div class="list-item-time">
            <span class="time-badge">${schedule.startTime} - ${schedule.endTime}</span>
        </div>
        <div class="list-item-details">
            <div class="list-item-client">${schedule.clientName}</div>
            <div class="list-item-meta">
                <span class="meta-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    ${schedule.counselor}
                </span>
                <span class="meta-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                    </svg>
                    ${sessionDisplay}
                </span>
            </div>
        </div>
    `;

    item.addEventListener('click', () => {
        openModal(null, null, schedule);
    });

    return item;
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

    const sessionDisplay = schedule.sessionNumber === '종료' ?
        '<span class="termination-badge">종료</span>' :
        `${schedule.sessionNumber}회기`;

    item.innerHTML = `
        <div class="schedule-item-client">${schedule.clientName}</div>
        <div class="schedule-item-time">${schedule.startTime} - ${schedule.endTime}</div>
        <div class="schedule-item-session">${sessionDisplay}</div>
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
    const sessionInput = document.getElementById('sessionNumber');
    const terminationCheckbox = document.getElementById('isTermination');

    form.reset();
    sessionInput.disabled = false;
    terminationCheckbox.checked = false;

    if (schedule) {
        title.textContent = '스케줄 상세 정보';
        editingScheduleId = schedule.id;
        deleteBtn.style.display = 'flex'; // 삭제 버튼 표시

        document.getElementById('counselor').value = schedule.counselor;
        document.getElementById('date').value = schedule.date instanceof Date ? formatDate(schedule.date) : schedule.date;
        document.getElementById('startTime').value = schedule.startTime;
        document.getElementById('endTime').value = schedule.endTime;
        document.getElementById('clientName').value = schedule.clientName;

        // Handle termination status
        if (schedule.sessionNumber === '종료' || schedule.sessionNumber === 0) {
            terminationCheckbox.checked = true;
            sessionInput.value = '종료';
            sessionInput.disabled = true;
        } else {
            sessionInput.value = schedule.sessionNumber;
        }
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

    const isTermination = document.getElementById('isTermination').checked;
    const sessionValue = document.getElementById('sessionNumber').value;

    const formData = {
        id: editingScheduleId || Date.now().toString(),
        counselor: document.getElementById('counselor').value,
        date: document.getElementById('date').value,
        startTime: document.getElementById('startTime').value,
        endTime: document.getElementById('endTime').value,
        clientName: document.getElementById('clientName').value,
        sessionNumber: isTermination ? '종료' : (sessionValue === '종료' ? '종료' : parseInt(sessionValue) || 1)
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

function updateClients() {
    clients.clear();
    schedules.forEach(schedule => {
        clients.add(schedule.clientName);
    });
}

function updateClientFilter() {
    const filter = document.getElementById('clientFilter');
    const currentValue = filter.value;

    filter.innerHTML = '<option value="all">전체 내담자</option>';

    Array.from(clients).sort().forEach(client => {
        const option = document.createElement('option');
        option.value = client;
        option.textContent = client;
        filter.appendChild(option);
    });

    // Restore previous selection if it still exists
    if (currentValue !== 'all' && clients.has(currentValue)) {
        filter.value = currentValue;
    }
}

function updateMonths() {
    months.clear();
    schedules.forEach(schedule => {
        const yearMonth = schedule.date.substring(0, 7); // YYYY-MM
        months.add(yearMonth);
    });
}

function updateMonthFilter() {
    const filter = document.getElementById('monthFilter');
    const currentValue = filter.value;

    filter.innerHTML = '<option value="all">전체 월</option>';

    Array.from(months).sort().reverse().forEach(month => {
        const option = document.createElement('option');
        option.value = month;
        const [year, monthNum] = month.split('-');
        option.textContent = `${year}년 ${parseInt(monthNum)}월`;
        filter.appendChild(option);
    });

    // Restore previous selection if it still exists
    if (currentValue !== 'all' && months.has(currentValue)) {
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
