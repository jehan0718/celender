// State Management
const API_URL = 'http://localhost:3000/api/schedules';
let schedules = [];
let currentYear = 2026;
let currentMonth = 0; // January (0-indexed)
let currentWeekStart = null;
let editingScheduleId = null;
let counselors = new Set();

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
});

async function initializeApp() {
    await loadSchedules();
    updateCounselors();
    updateCounselorFilter();
    renderCalendar();
    renderWeekSelector();
    renderScheduleGrid();
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
        if (e.target.id === 'scheduleModal') {
            closeModal();
        }
    });

    // Form
    document.getElementById('scheduleForm').addEventListener('submit', handleFormSubmit);

    // Filter
    document.getElementById('counselorFilter').addEventListener('change', renderScheduleGrid);
}

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
        // Time cell
        const timeCell = document.createElement('div');
        timeCell.className = 'time-cell';
        timeCell.textContent = time;
        grid.appendChild(timeCell);

        // Schedule cells for each day
        for (let i = 0; i < 5; i++) {
            const date = new Date(currentWeekStart);
            date.setDate(date.getDate() + i);

            const cell = document.createElement('div');
            cell.className = 'schedule-cell';
            cell.dataset.date = formatDate(date);
            cell.dataset.time = time;

            // Add schedules to cell
            const cellSchedules = getSchedulesForCell(date, time);
            cellSchedules.forEach(schedule => {
                const item = createScheduleItem(schedule);
                cell.appendChild(item);
            });

            // Click to add new schedule
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
        if (schedule.date !== dateStr) return false;
        if (schedule.startTime !== time) return false;
        if (selectedCounselor !== 'all' && schedule.counselor !== selectedCounselor) return false;
        return true;
    });
}

function createScheduleItem(schedule) {
    const item = document.createElement('div');
    item.className = 'schedule-item';

    // Assign color based on counselor
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

    form.reset();

    if (schedule) {
        // Edit mode
        title.textContent = '스케줄 수정';
        editingScheduleId = schedule.id;

        document.getElementById('counselor').value = schedule.counselor;
        document.getElementById('date').value = schedule.date;
        document.getElementById('startTime').value = schedule.startTime;
        document.getElementById('endTime').value = schedule.endTime;
        document.getElementById('clientName').value = schedule.clientName;
        document.getElementById('sessionNumber').value = schedule.sessionNumber;
    } else {
        // Add mode
        title.textContent = '스케줄 추가';
        editingScheduleId = null;

        if (date) {
            document.getElementById('date').value = formatDate(date);
        }
        if (time) {
            document.getElementById('startTime').value = time;
            // Set end time to next hour
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
        counselor: document.getElementById('counselor').value,
        date: document.getElementById('date').value,
        startTime: document.getElementById('startTime').value,
        endTime: document.getElementById('endTime').value,
        clientName: document.getElementById('clientName').value,
        sessionNumber: parseInt(document.getElementById('sessionNumber').value)
    };

    try {
        if (editingScheduleId) {
            // Update existing schedule
            await updateSchedule(editingScheduleId, formData);
        } else {
            // Add new schedule
            await addSchedule(formData);
        }

        await loadSchedules();
        updateCounselors();
        updateCounselorFilter();
        renderScheduleGrid();
        closeModal();
    } catch (error) {
        console.error('Error saving schedule:', error);
        alert('스케줄 저장에 실패했습니다. 다시 시도해주세요.');
    }
}

// API Helper Functions
async function loadSchedules() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Failed to load schedules');
        schedules = await response.json();
    } catch (error) {
        console.error('Error loading schedules:', error);
        schedules = [];
    }
}

async function addSchedule(scheduleData) {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(scheduleData)
    });

    if (!response.ok) throw new Error('Failed to add schedule');
    return await response.json();
}

async function updateSchedule(id, scheduleData) {
    const response = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(scheduleData)
    });

    if (!response.ok) throw new Error('Failed to update schedule');
    return await response.json();
}

async function deleteSchedule(id) {
    const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE'
    });

    if (!response.ok) throw new Error('Failed to delete schedule');
    return await response.json();
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

// Add delete functionality with right-click
document.addEventListener('contextmenu', async (e) => {
    const scheduleItem = e.target.closest('.schedule-item');
    if (scheduleItem) {
        e.preventDefault();

        if (confirm('이 스케줄을 삭제하시겠습니까?')) {
            const cell = scheduleItem.parentElement;
            const date = cell.dataset.date;
            const time = cell.dataset.time;
            const clientName = scheduleItem.querySelector('.schedule-item-client').textContent;

            const schedule = schedules.find(s =>
                s.date === date &&
                s.startTime === time &&
                s.clientName === clientName
            );

            if (schedule) {
                try {
                    await deleteSchedule(schedule.id);
                    await loadSchedules();
                    updateCounselors();
                    updateCounselorFilter();
                    renderScheduleGrid();
                } catch (error) {
                    console.error('Error deleting schedule:', error);
                    alert('스케줄 삭제에 실패했습니다. 다시 시도해주세요.');
                }
            }
        }
    }
});
