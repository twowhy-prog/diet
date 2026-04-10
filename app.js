'use strict';

// ===== 상수 =====
const MEAL_TYPES = { breakfast: '아침', lunch: '점심', dinner: '저녁', snack: '간식' };

const QUICK_FOODS = [
  { name: '닭가슴살 100g', calories: 165, carbs: 0, protein: 31, fat: 3.6 },
  { name: '흰쌀밥 한공기', calories: 300, carbs: 65, protein: 5, fat: 0.5 },
  { name: '달걀 1개', calories: 78, carbs: 0.6, protein: 6, fat: 5 },
  { name: '고구마 중간', calories: 130, carbs: 30, protein: 2, fat: 0.1 },
  { name: '바나나 1개', calories: 89, carbs: 23, protein: 1, fat: 0.3 },
  { name: '아몬드 30g', calories: 174, carbs: 6, protein: 6, fat: 15 },
  { name: '두부 반모', calories: 90, carbs: 2, protein: 9, fat: 5 },
  { name: '삼겹살 100g', calories: 331, carbs: 0, protein: 17, fat: 28 },
  { name: '라면 1봉', calories: 500, carbs: 72, protein: 10, fat: 17 },
  { name: '아메리카노', calories: 5, carbs: 1, protein: 0, fat: 0 },
  { name: '우유 200ml', calories: 130, carbs: 10, protein: 6.5, fat: 7 },
  { name: '요거트 플레인', calories: 100, carbs: 12, protein: 8, fat: 2 },
];

// ===== 상태 =====
let state = {
  selectedDate: todayStr(),
  meals: {},       // { "2025-01-01": { breakfast: [...], lunch: [...], dinner: [...], snack: [...] } }
  weights: {},     // { "2025-01-01": 70.5 }
  goals: {
    name: '',
    height: '',
    age: '',
    gender: 'male',
    targetWeight: '',
    calories: 2000,
    carbs: 250,
    protein: 100,
    fat: 65,
  },
};

let currentPage = 'dashboard';
let modalMealType = 'breakfast';
let weightChart = null;
let calorieChart = null;
let macroChart = null;

// ===== 유틸 =====
function todayStr() {
  const d = new Date();
  return formatDate(d);
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function displayDate(str) {
  const d = parseDate(str);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}

function addDays(str, n) {
  const d = parseDate(str);
  d.setDate(d.getDate() + n);
  return formatDate(d);
}

function getMealsForDate(date) {
  if (!state.meals[date]) {
    state.meals[date] = { breakfast: [], lunch: [], dinner: [], snack: [] };
  }
  return state.meals[date];
}

function sumMacros(items) {
  return items.reduce((acc, item) => {
    const amt = item.amount || 1;
    acc.calories += (item.calories || 0) * amt;
    acc.carbs    += (item.carbs    || 0) * amt;
    acc.protein  += (item.protein  || 0) * amt;
    acc.fat      += (item.fat      || 0) * amt;
    return acc;
  }, { calories: 0, carbs: 0, protein: 0, fat: 0 });
}

function getDayTotal(date) {
  const meals = getMealsForDate(date);
  const all = [
    ...meals.breakfast,
    ...meals.lunch,
    ...meals.dinner,
    ...meals.snack,
  ];
  return sumMacros(all);
}

function round1(n) { return Math.round(n * 10) / 10; }

// ===== 저장/로드 =====
function saveState() {
  localStorage.setItem('diet_state', JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem('diet_state');
  if (raw) {
    try {
      const saved = JSON.parse(raw);
      state = { ...state, ...saved };
      // 목표는 깊은 병합
      if (saved.goals) state.goals = { ...state.goals, ...saved.goals };
    } catch (e) {
      console.error('상태 로드 실패', e);
    }
  }
}

// ===== 렌더링 =====
function renderAll() {
  renderDateDisplay();
  if (currentPage === 'dashboard') renderDashboard();
  if (currentPage === 'meals')     renderMeals();
  if (currentPage === 'weight')    renderWeight();
  if (currentPage === 'stats')     renderStats();
  if (currentPage === 'goals')     renderGoals();
}

function renderDateDisplay() {
  document.getElementById('currentDate').textContent = displayDate(state.selectedDate);
}

// --- 대시보드 ---
function renderDashboard() {
  const total = getDayTotal(state.selectedDate);
  const g = state.goals;

  document.getElementById('dash-calories').textContent = Math.round(total.calories);
  document.getElementById('dash-carbs').textContent    = round1(total.carbs);
  document.getElementById('dash-protein').textContent  = round1(total.protein);
  document.getElementById('dash-fat').textContent      = round1(total.fat);

  const calGoal = g.calories || 2000;
  const pct = Math.min((total.calories / calGoal) * 100, 100);
  const bar = document.getElementById('calorie-bar');
  bar.style.width = pct + '%';
  bar.classList.toggle('over', total.calories > calGoal);

  document.getElementById('dash-cal-goal').textContent = `목표: ${calGoal} kcal`;
  document.getElementById('calorie-label').textContent =
    `${Math.round(total.calories)} / ${calGoal} kcal (${Math.round(pct)}%)`;

  // 식단 미리보기
  const meals = getMealsForDate(state.selectedDate);
  const list = document.getElementById('dash-meal-list');
  list.innerHTML = '';
  let hasAny = false;
  for (const [type, label] of Object.entries(MEAL_TYPES)) {
    for (const item of meals[type]) {
      hasAny = true;
      const cal = Math.round((item.calories || 0) * (item.amount || 1));
      const div = document.createElement('div');
      div.className = 'dash-meal-item';
      div.innerHTML = `
        <span class="meal-type">${label}</span>
        <span class="meal-name">${item.name}${item.amount !== 1 ? ` × ${item.amount}` : ''}</span>
        <span class="meal-cal">${cal} kcal</span>
      `;
      list.appendChild(div);
    }
  }
  if (!hasAny) {
    list.innerHTML = '<div class="empty-state">오늘 식단을 기록해보세요!</div>';
  }

  // 오늘 체중
  const w = state.weights[state.selectedDate];
  const wd = document.getElementById('dash-weight-display');
  const wi = document.getElementById('dash-weight-input');
  if (w) {
    wd.textContent = `${w} kg`;
    wi.value = w;
  } else {
    wd.textContent = '';
    wi.value = '';
  }
}

// --- 식단 ---
function renderMeals() {
  const meals = getMealsForDate(state.selectedDate);
  for (const type of Object.keys(MEAL_TYPES)) {
    const container = document.getElementById(`meal-${type}`);
    const totalEl   = document.getElementById(`total-${type}`);
    container.innerHTML = '';
    if (meals[type].length === 0) {
      container.innerHTML = '<div class="empty-state">아직 기록 없음</div>';
    } else {
      meals[type].forEach((item, idx) => {
        const cal = Math.round((item.calories || 0) * (item.amount || 1));
        const div = document.createElement('div');
        div.className = 'meal-item';
        div.innerHTML = `
          <div class="meal-item-left">
            <div class="meal-item-name">${item.name}${item.amount !== 1 ? ` × ${item.amount}` : ''}</div>
            <div class="meal-item-macros">
              탄 ${round1((item.carbs||0)*(item.amount||1))}g &nbsp;
              단 ${round1((item.protein||0)*(item.amount||1))}g &nbsp;
              지 ${round1((item.fat||0)*(item.amount||1))}g
            </div>
          </div>
          <span class="meal-item-cal">${cal} kcal</span>
          <button class="meal-item-del" data-type="${type}" data-idx="${idx}" title="삭제">✕</button>
        `;
        container.appendChild(div);
      });
    }
    const s = sumMacros(meals[type]);
    totalEl.textContent = meals[type].length > 0
      ? `합계: ${Math.round(s.calories)} kcal`
      : '';
  }

  // 삭제 이벤트
  document.querySelectorAll('.meal-item-del').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const t = e.currentTarget.dataset.type;
      const i = Number(e.currentTarget.dataset.idx);
      getMealsForDate(state.selectedDate)[t].splice(i, 1);
      saveState();
      renderAll();
    });
  });
}

// --- 체중 ---
function renderWeight() {
  const input = document.getElementById('weight-input');
  input.value = state.weights[state.selectedDate] || '';

  // 체중 목록 (최근 30일)
  const list = document.getElementById('weight-list');
  const entries = Object.entries(state.weights)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 30);
  list.innerHTML = '';
  if (entries.length === 0) {
    list.innerHTML = '<div class="empty-state">체중 기록이 없습니다.</div>';
  } else {
    entries.forEach(([date, w]) => {
      const div = document.createElement('div');
      div.className = 'weight-row';
      div.innerHTML = `
        <span class="weight-row-date">${displayDate(date)}</span>
        <span class="weight-row-val">${w} kg</span>
        <button class="weight-row-del" data-date="${date}">✕</button>
      `;
      list.appendChild(div);
    });
    document.querySelectorAll('.weight-row-del').forEach(btn => {
      btn.addEventListener('click', (e) => {
        delete state.weights[e.currentTarget.dataset.date];
        saveState();
        renderAll();
        renderWeightChart();
      });
    });
  }

  renderWeightChart();
}

function renderWeightChart() {
  const ctx = document.getElementById('weightChart').getContext('2d');
  const entries = Object.entries(state.weights)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-30);

  const labels = entries.map(([d]) => {
    const dt = parseDate(d);
    return `${dt.getMonth()+1}/${dt.getDate()}`;
  });
  const data = entries.map(([, w]) => w);

  if (weightChart) weightChart.destroy();
  weightChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: '체중 (kg)',
        data,
        borderColor: '#4CAF50',
        backgroundColor: 'rgba(76,175,80,0.1)',
        tension: 0.3,
        fill: true,
        pointBackgroundColor: '#4CAF50',
        pointRadius: 4,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: false, ticks: { callback: v => `${v}kg` } },
      },
    },
  });
}

// --- 통계 ---
function renderStats() {
  // 주간 평균 칼로리
  const last7 = [];
  for (let i = 6; i >= 0; i--) last7.push(addDays(todayStr(), -i));
  const calData = last7.map(d => Math.round(getDayTotal(d).calories));
  const recordedDays = calData.filter(v => v > 0);
  const avgCal = recordedDays.length > 0
    ? Math.round(recordedDays.reduce((a, b) => a + b, 0) / recordedDays.length)
    : '-';
  document.getElementById('stat-avg-cal').textContent = avgCal;

  // 체중 변화
  const weightEntries = Object.entries(state.weights).sort((a, b) => a[0].localeCompare(b[0]));
  if (weightEntries.length >= 2) {
    const diff = round1(
      weightEntries[weightEntries.length - 1][1] - weightEntries[0][1]
    );
    const el = document.getElementById('stat-weight-change');
    el.textContent = (diff > 0 ? '+' : '') + diff;
    el.style.color = diff > 0 ? '#E53E3E' : '#38A169';
  } else {
    document.getElementById('stat-weight-change').textContent = '-';
  }

  // 기록일
  document.getElementById('stat-record-days').textContent =
    Object.values(state.meals).filter(m =>
      Object.values(m).some(arr => arr.length > 0)
    ).length;

  // 주간 칼로리 차트
  renderCalorieChart(last7, calData);

  // 영양소 도넛
  renderMacroChart();
}

function renderCalorieChart(dates, calData) {
  const ctx = document.getElementById('calorieChart').getContext('2d');
  const labels = dates.map(d => {
    const dt = parseDate(d);
    return `${dt.getMonth()+1}/${dt.getDate()}`;
  });
  const goal = state.goals.calories || 2000;

  if (calorieChart) calorieChart.destroy();
  calorieChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: '섭취 칼로리',
          data: calData,
          backgroundColor: calData.map(v => v > goal ? 'rgba(229,62,62,0.7)' : 'rgba(76,175,80,0.7)'),
          borderRadius: 6,
        },
        {
          label: '목표',
          data: dates.map(() => goal),
          type: 'line',
          borderColor: '#D69E2E',
          borderDash: [6, 3],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
      scales: { y: { beginAtZero: true, ticks: { callback: v => `${v}` } } },
    },
  });
}

function renderMacroChart() {
  const ctx = document.getElementById('macroChart').getContext('2d');
  const total = getDayTotal(state.selectedDate);
  const cCal = total.carbs * 4;
  const pCal = total.protein * 4;
  const fCal = total.fat * 9;
  const sum = cCal + pCal + fCal;

  if (macroChart) macroChart.destroy();

  if (sum < 1) {
    macroChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['데이터 없음'],
        datasets: [{ data: [1], backgroundColor: ['#E2E8F0'] }],
      },
      options: { plugins: { legend: { position: 'bottom' } } },
    });
    return;
  }

  macroChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: [
        `탄수화물 ${Math.round(total.carbs)}g`,
        `단백질 ${Math.round(total.protein)}g`,
        `지방 ${Math.round(total.fat)}g`,
      ],
      datasets: [{
        data: [cCal, pCal, fCal],
        backgroundColor: ['#4CAF50', '#2196F3', '#FF7043'],
        borderWidth: 2,
        borderColor: '#fff',
      }],
    },
    options: {
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: ctx => {
              const pct = Math.round((ctx.raw / sum) * 100);
              return `${ctx.label} (${pct}%)`;
            },
          },
        },
      },
    },
  });
}

// --- 목표 ---
function renderGoals() {
  const g = state.goals;
  document.getElementById('goal-name').value          = g.name || '';
  document.getElementById('goal-height').value        = g.height || '';
  document.getElementById('goal-age').value           = g.age || '';
  document.getElementById('goal-gender').value        = g.gender || 'male';
  document.getElementById('goal-target-weight').value = g.targetWeight || '';
  document.getElementById('goal-calories').value      = g.calories || '';
  document.getElementById('goal-carbs').value         = g.carbs || '';
  document.getElementById('goal-protein').value       = g.protein || '';
  document.getElementById('goal-fat').value           = g.fat || '';
}

// ===== 모달 =====
function openMealModal(mealType) {
  modalMealType = mealType;
  const label = MEAL_TYPES[mealType] || '식사';
  document.getElementById('modal-title').textContent = `${label} 추가`;
  document.getElementById('food-name').value     = '';
  document.getElementById('food-calories').value = '';
  document.getElementById('food-carbs').value    = '';
  document.getElementById('food-protein').value  = '';
  document.getElementById('food-fat').value      = '';
  document.getElementById('food-amount').value   = '1';
  document.getElementById('meal-modal-backdrop').classList.add('open');

  // 빠른 선택 버튼
  const qf = document.getElementById('quick-foods');
  qf.innerHTML = '';
  QUICK_FOODS.forEach(food => {
    const btn = document.createElement('button');
    btn.className = 'quick-food-btn';
    btn.textContent = food.name;
    btn.addEventListener('click', () => {
      document.getElementById('food-name').value     = food.name;
      document.getElementById('food-calories').value = food.calories;
      document.getElementById('food-carbs').value    = food.carbs;
      document.getElementById('food-protein').value  = food.protein;
      document.getElementById('food-fat').value      = food.fat;
      document.getElementById('food-amount').value   = '1';
    });
    qf.appendChild(btn);
  });
}

function closeMealModal() {
  document.getElementById('meal-modal-backdrop').classList.remove('open');
}

function saveMealItem() {
  const name     = document.getElementById('food-name').value.trim();
  const calories = parseFloat(document.getElementById('food-calories').value) || 0;
  const carbs    = parseFloat(document.getElementById('food-carbs').value)    || 0;
  const protein  = parseFloat(document.getElementById('food-protein').value)  || 0;
  const fat      = parseFloat(document.getElementById('food-fat').value)      || 0;
  const amount   = parseFloat(document.getElementById('food-amount').value)   || 1;

  if (!name) { alert('음식 이름을 입력해주세요.'); return; }
  if (calories <= 0) { alert('칼로리를 입력해주세요.'); return; }

  const meals = getMealsForDate(state.selectedDate);
  meals[modalMealType].push({ name, calories, carbs, protein, fat, amount });
  saveState();
  closeMealModal();
  renderAll();
}

// ===== 이벤트 =====
function initEvents() {
  // 네비게이션
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      currentPage = item.dataset.page;
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById(`page-${currentPage}`).classList.add('active');
      renderAll();
    });
  });

  // 날짜 이동
  document.getElementById('prevDay').addEventListener('click', () => {
    state.selectedDate = addDays(state.selectedDate, -1);
    renderAll();
  });
  document.getElementById('nextDay').addEventListener('click', () => {
    state.selectedDate = addDays(state.selectedDate, 1);
    renderAll();
  });
  document.getElementById('todayBtn').addEventListener('click', () => {
    state.selectedDate = todayStr();
    renderAll();
  });

  // 대시보드 식사 추가 버튼
  document.getElementById('dash-add-meal').addEventListener('click', () => {
    openMealModal('breakfast');
  });

  // 식단 페이지 추가 버튼
  document.querySelectorAll('.add-meal-btn').forEach(btn => {
    btn.addEventListener('click', () => openMealModal(btn.dataset.meal));
  });

  // 모달 닫기
  document.getElementById('modal-close').addEventListener('click', closeMealModal);
  document.getElementById('meal-modal-backdrop').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeMealModal();
  });

  // 식사 저장
  document.getElementById('modal-save').addEventListener('click', saveMealItem);

  // Enter 키로 저장
  document.getElementById('food-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveMealItem();
  });

  // 대시보드 체중 저장
  document.getElementById('dash-weight-save').addEventListener('click', () => {
    const v = parseFloat(document.getElementById('dash-weight-input').value);
    if (v && v > 0) {
      state.weights[state.selectedDate] = v;
      saveState();
      renderAll();
    }
  });

  // 체중 페이지 저장
  document.getElementById('weight-save').addEventListener('click', () => {
    const v = parseFloat(document.getElementById('weight-input').value);
    if (v && v > 0) {
      state.weights[state.selectedDate] = v;
      saveState();
      renderAll();
    }
  });

  // 목표 저장
  document.getElementById('goals-save').addEventListener('click', () => {
    state.goals.name          = document.getElementById('goal-name').value.trim();
    state.goals.height        = parseFloat(document.getElementById('goal-height').value) || '';
    state.goals.age           = parseInt(document.getElementById('goal-age').value)      || '';
    state.goals.gender        = document.getElementById('goal-gender').value;
    state.goals.targetWeight  = parseFloat(document.getElementById('goal-target-weight').value) || '';
    state.goals.calories      = parseInt(document.getElementById('goal-calories').value) || 2000;
    state.goals.carbs         = parseInt(document.getElementById('goal-carbs').value)    || 250;
    state.goals.protein       = parseInt(document.getElementById('goal-protein').value)  || 100;
    state.goals.fat           = parseInt(document.getElementById('goal-fat').value)      || 65;
    saveState();
    const msg = document.getElementById('goals-save-msg');
    msg.textContent = '저장되었습니다!';
    setTimeout(() => { msg.textContent = ''; }, 2000);
  });

  // BMR 자동 계산
  document.getElementById('goals-calc-bmr').addEventListener('click', () => {
    const height = parseFloat(document.getElementById('goal-height').value);
    const age    = parseInt(document.getElementById('goal-age').value);
    const gender = document.getElementById('goal-gender').value;
    const wEntries = Object.entries(state.weights).sort((a, b) => b[0].localeCompare(a[0]));
    const weight = wEntries.length > 0 ? wEntries[0][1] : 70;

    if (!height || !age) { alert('키와 나이를 먼저 입력해주세요.'); return; }

    let bmr;
    if (gender === 'male') {
      bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
      bmr = 10 * weight + 6.25 * height - 5 * age - 161;
    }
    // 활동량 보통 1.375 적용
    const tdee = Math.round(bmr * 1.375);
    // 다이어트: 500kcal 적자
    const dietCal = Math.max(1200, tdee - 500);

    document.getElementById('goal-calories').value = dietCal;
    document.getElementById('goal-carbs').value    = Math.round(dietCal * 0.5 / 4);
    document.getElementById('goal-protein').value  = Math.round(dietCal * 0.25 / 4);
    document.getElementById('goal-fat').value      = Math.round(dietCal * 0.25 / 9);

    const msg = document.getElementById('goals-save-msg');
    msg.textContent = `BMR: ${Math.round(bmr)} kcal / TDEE: ${tdee} kcal → 다이어트 목표: ${dietCal} kcal`;
  });
}

// ===== 초기화 =====
function init() {
  loadState();
  initEvents();
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);
