'use strict';

const MEAL_TYPES = { breakfast: '아침', lunch: '점심', dinner: '저녁', snack: '간식' };

const FOOD_DB = [
  { name: '양배추 계란부침', calories: 210, carbs: 10, protein: 12, fat: 14, aliases: ['양배추전', '양배추 계란', '계란부침'] },
  { name: '잡곡우유', calories: 140, carbs: 20, protein: 6, fat: 4, aliases: ['잡곡 우유'] },
  { name: '윌 180ml', calories: 125, carbs: 17, protein: 5, fat: 4, aliases: ['윌', 'will'] },
  { name: '닭가슴살 100g', calories: 165, carbs: 0, protein: 31, fat: 3.6 },
  { name: '흰쌀밥 한공기', calories: 300, carbs: 65, protein: 5, fat: 0.5 },
  { name: '달걀 1개', calories: 78, carbs: 0.6, protein: 6, fat: 5 },
  { name: '고구마 중간', calories: 130, carbs: 30, protein: 2, fat: 0.1 },
  { name: '바나나 1개', calories: 89, carbs: 23, protein: 1, fat: 0.3 },
  { name: '요거트 플레인', calories: 100, carbs: 12, protein: 8, fat: 2 },
];

const QUICK_FOODS = FOOD_DB.slice(0, 7);

let state = {
  selectedDate: todayStr(),
  meals: {},
  weights: {},
  exercises: {}, // { date: [{name, minutes, calories}] }
  meds: {}, // { date: { bp: boolean, lipid: boolean } }
  health: {}, // { date: {activeCalories, restingCalories, exerciseMinutes, steps, distanceKm} }
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

function todayStr() {
  return formatDate(new Date());
}
function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
function round1(n) { return Math.round(n * 10) / 10; }

function getMealsForDate(date) {
  if (!state.meals[date]) state.meals[date] = { breakfast: [], lunch: [], dinner: [], snack: [] };
  return state.meals[date];
}
function getExercisesForDate(date) {
  if (!state.exercises[date]) state.exercises[date] = [];
  return state.exercises[date];
}
function getMedsForDate(date) {
  if (!state.meds[date]) state.meds[date] = { bp: false, lipid: false };
  return state.meds[date];
}
function getHealthForDate(date) {
  if (!state.health[date]) {
    state.health[date] = { activeCalories: 0, restingCalories: 0, exerciseMinutes: 0, steps: 0, distanceKm: 0 };
  }
  return state.health[date];
}

function sumMacros(items) {
  return items.reduce((acc, item) => {
    const amt = item.amount || 1;
    acc.calories += (item.calories || 0) * amt;
    acc.carbs += (item.carbs || 0) * amt;
    acc.protein += (item.protein || 0) * amt;
    acc.fat += (item.fat || 0) * amt;
    return acc;
  }, { calories: 0, carbs: 0, protein: 0, fat: 0 });
}

function getDayTotal(date) {
  const meals = getMealsForDate(date);
  return sumMacros([...meals.breakfast, ...meals.lunch, ...meals.dinner, ...meals.snack]);
}

function getExerciseCalories(date) {
  return getExercisesForDate(date).reduce((acc, cur) => acc + (cur.calories || 0), 0);
}

function getEnergySummary(date) {
  const intake = Math.round(getDayTotal(date).calories);
  const health = getHealthForDate(date);
  const manualExercise = Math.round(getExerciseCalories(date));
  const appleBurn = Math.round((health.activeCalories || 0) + (health.restingCalories || 0));
  const totalBurn = appleBurn + manualExercise;
  const balance = intake - totalBurn;
  return { intake, appleBurn, manualExercise, totalBurn, balance, health };
}

function saveState() {
  localStorage.setItem('diet_state', JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem('diet_state');
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    state = { ...state, ...saved };
    if (saved.goals) state.goals = { ...state.goals, ...saved.goals };
  } catch (e) {
    console.error('상태 로드 실패', e);
  }
}

function renderAll() {
  renderDateDisplay();
  if (currentPage === 'dashboard') renderDashboard();
  if (currentPage === 'meals') renderMeals();
  if (currentPage === 'weight') renderWeight();
  if (currentPage === 'stats') renderStats();
  if (currentPage === 'goals') renderGoals();
  if (currentPage === 'health') renderHealth();
}

function renderDateDisplay() {
  document.getElementById('currentDate').textContent = displayDate(state.selectedDate);
}

function renderDashboard() {
  const total = getDayTotal(state.selectedDate);
  const g = state.goals;

  document.getElementById('dash-calories').textContent = Math.round(total.calories);
  document.getElementById('dash-carbs').textContent = round1(total.carbs);
  document.getElementById('dash-protein').textContent = round1(total.protein);
  document.getElementById('dash-fat').textContent = round1(total.fat);

  const calGoal = g.calories || 2000;
  const pct = Math.min((total.calories / calGoal) * 100, 100);
  const bar = document.getElementById('calorie-bar');
  bar.style.width = `${pct}%`;
  bar.classList.toggle('over', total.calories > calGoal);
  document.getElementById('dash-cal-goal').textContent = `목표: ${calGoal} kcal`;
  document.getElementById('calorie-label').textContent = `${Math.round(total.calories)} / ${calGoal} kcal (${Math.round(pct)}%)`;

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
      div.innerHTML = `<span class="meal-type">${label}</span><span class="meal-name">${item.name}${item.amount !== 1 ? ` × ${item.amount}` : ''}</span><span class="meal-cal">${cal} kcal</span>`;
      list.appendChild(div);
    }
  }
  if (!hasAny) list.innerHTML = '<div class="empty-state">오늘 식단을 기록해보세요!</div>';

  const w = state.weights[state.selectedDate];
  const wd = document.getElementById('dash-weight-display');
  const wi = document.getElementById('dash-weight-input');
  if (w) { wd.textContent = `${w} kg`; wi.value = w; } else { wd.textContent = ''; wi.value = ''; }

  renderMedication();
  renderExerciseList();
  renderEnergyBalance('energy-balance');
}

function renderMedication() {
  const meds = getMedsForDate(state.selectedDate);
  document.getElementById('dash-med-bp').checked = !!meds.bp;
  document.getElementById('dash-med-lipid').checked = !!meds.lipid;
}

function renderExerciseList() {
  const list = document.getElementById('exercise-list');
  if (!list) return;
  const rows = getExercisesForDate(state.selectedDate);
  list.innerHTML = '';
  if (rows.length === 0) {
    list.innerHTML = '<div class="empty-state">운동 기록이 없습니다.</div>';
    return;
  }
  rows.forEach((ex, idx) => {
    const div = document.createElement('div');
    div.className = 'weight-row';
    div.innerHTML = `<span class="weight-row-date">${ex.name} · ${ex.minutes}분</span><span class="weight-row-val">${ex.calories} kcal</span><button class="weight-row-del" data-ex-idx="${idx}">✕</button>`;
    list.appendChild(div);
  });
  document.querySelectorAll('[data-ex-idx]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const i = Number(e.currentTarget.dataset.exIdx);
      getExercisesForDate(state.selectedDate).splice(i, 1);
      saveState();
      renderAll();
    });
  });
}

function renderEnergyBalance(targetId) {
  const wrap = document.getElementById(targetId);
  if (!wrap) return;
  const s = getEnergySummary(state.selectedDate);
  const sign = s.balance > 0 ? '+' : '';
  const stage = s.balance <= -500 ? '감량 적자 구간' : s.balance <= -200 ? '완만한 감량 구간' : s.balance < 200 ? '유지 구간' : '증량/과잉 구간';
  wrap.innerHTML = `
    <div>섭취: <b>${s.intake} kcal</b></div>
    <div>소모(애플건강): <b>${s.appleBurn} kcal</b> + 운동기록 <b>${s.manualExercise} kcal</b></div>
    <div>순에너지(섭취-소모): <b>${sign}${s.balance} kcal</b></div>
    <div>현재 단계: <b>${stage}</b></div>
  `;
}

function renderMeals() {
  const meals = getMealsForDate(state.selectedDate);
  for (const type of Object.keys(MEAL_TYPES)) {
    const container = document.getElementById(`meal-${type}`);
    const totalEl = document.getElementById(`total-${type}`);
    container.innerHTML = '';
    if (meals[type].length === 0) {
      container.innerHTML = '<div class="empty-state">아직 기록 없음</div>';
    } else {
      meals[type].forEach((item, idx) => {
        const cal = Math.round((item.calories || 0) * (item.amount || 1));
        const div = document.createElement('div');
        div.className = 'meal-item';
        div.innerHTML = `
          <div class="meal-item-left"><div class="meal-item-name">${item.name}${item.amount !== 1 ? ` × ${item.amount}` : ''}</div><div class="meal-item-macros">탄 ${round1((item.carbs || 0) * (item.amount || 1))}g &nbsp; 단 ${round1((item.protein || 0) * (item.amount || 1))}g &nbsp; 지 ${round1((item.fat || 0) * (item.amount || 1))}g</div></div>
          <span class="meal-item-cal">${cal} kcal</span><button class="meal-item-del" data-type="${type}" data-idx="${idx}" title="삭제">✕</button>`;
        container.appendChild(div);
      });
    }
    const s = sumMacros(meals[type]);
    totalEl.textContent = meals[type].length > 0 ? `합계: ${Math.round(s.calories)} kcal` : '';
  }
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

function renderWeight() {
  const input = document.getElementById('weight-input');
  input.value = state.weights[state.selectedDate] || '';

  const list = document.getElementById('weight-list');
  const entries = Object.entries(state.weights).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 30);
  list.innerHTML = '';
  if (entries.length === 0) {
    list.innerHTML = '<div class="empty-state">체중 기록이 없습니다.</div>';
  } else {
    entries.forEach(([date, w]) => {
      const div = document.createElement('div');
      div.className = 'weight-row';
      div.innerHTML = `<span class="weight-row-date">${displayDate(date)}</span><span class="weight-row-val">${w} kg</span><button class="weight-row-del" data-date="${date}">✕</button>`;
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
  const entries = Object.entries(state.weights).sort((a, b) => a[0].localeCompare(b[0])).slice(-30);
  const labels = entries.map(([d]) => `${parseDate(d).getMonth() + 1}/${parseDate(d).getDate()}`);
  const data = entries.map(([, w]) => w);

  if (weightChart) weightChart.destroy();
  weightChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label: '체중 (kg)', data, borderColor: '#4CAF50', backgroundColor: 'rgba(76,175,80,0.1)', tension: 0.3, fill: true, pointBackgroundColor: '#4CAF50', pointRadius: 4 }] },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: false, ticks: { callback: v => `${v}kg` } } } },
  });
}

function renderStats() {
  const last7 = [];
  for (let i = 6; i >= 0; i--) last7.push(addDays(todayStr(), -i));
  const calData = last7.map(d => Math.round(getDayTotal(d).calories));
  const recordedDays = calData.filter(v => v > 0);
  const avgCal = recordedDays.length ? Math.round(recordedDays.reduce((a, b) => a + b, 0) / recordedDays.length) : '-';
  document.getElementById('stat-avg-cal').textContent = avgCal;

  const weightEntries = Object.entries(state.weights).sort((a, b) => a[0].localeCompare(b[0]));
  if (weightEntries.length >= 2) {
    const diff = round1(weightEntries[weightEntries.length - 1][1] - weightEntries[0][1]);
    const el = document.getElementById('stat-weight-change');
    el.textContent = (diff > 0 ? '+' : '') + diff;
    el.style.color = diff > 0 ? '#E53E3E' : '#38A169';
  } else {
    document.getElementById('stat-weight-change').textContent = '-';
  }

  document.getElementById('stat-record-days').textContent = Object.values(state.meals).filter(m => Object.values(m).some(arr => arr.length > 0)).length;
  renderCalorieChart(last7, calData);
  renderMacroChart();
}

function renderCalorieChart(dates, calData) {
  const ctx = document.getElementById('calorieChart').getContext('2d');
  const labels = dates.map(d => `${parseDate(d).getMonth() + 1}/${parseDate(d).getDate()}`);
  const goal = state.goals.calories || 2000;
  if (calorieChart) calorieChart.destroy();
  calorieChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: '섭취 칼로리', data: calData, backgroundColor: calData.map(v => v > goal ? 'rgba(229,62,62,0.7)' : 'rgba(76,175,80,0.7)'), borderRadius: 6 },
        { label: '목표', data: dates.map(() => goal), type: 'line', borderColor: '#D69E2E', borderDash: [6, 3], borderWidth: 2, pointRadius: 0, fill: false },
      ],
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } },
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
    macroChart = new Chart(ctx, { type: 'doughnut', data: { labels: ['데이터 없음'], datasets: [{ data: [1], backgroundColor: ['#E2E8F0'] }] } });
    return;
  }

  macroChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: [`탄수화물 ${Math.round(total.carbs)}g`, `단백질 ${Math.round(total.protein)}g`, `지방 ${Math.round(total.fat)}g`],
      datasets: [{ data: [cCal, pCal, fCal], backgroundColor: ['#4CAF50', '#2196F3', '#FF7043'], borderWidth: 2, borderColor: '#fff' }],
    },
    options: { plugins: { legend: { position: 'bottom' } } },
  });
}

function renderGoals() {
  const g = state.goals;
  document.getElementById('goal-name').value = g.name || '';
  document.getElementById('goal-height').value = g.height || '';
  document.getElementById('goal-age').value = g.age || '';
  document.getElementById('goal-gender').value = g.gender || 'male';
  document.getElementById('goal-target-weight').value = g.targetWeight || '';
  document.getElementById('goal-calories').value = g.calories || '';
  document.getElementById('goal-carbs').value = g.carbs || '';
  document.getElementById('goal-protein').value = g.protein || '';
  document.getElementById('goal-fat').value = g.fat || '';
}

function renderHealth() {
  const h = getHealthForDate(state.selectedDate);
  document.getElementById('health-active-cal').value = h.activeCalories || '';
  document.getElementById('health-resting-cal').value = h.restingCalories || '';
  document.getElementById('health-exercise-min').value = h.exerciseMinutes || '';
  document.getElementById('health-steps').value = h.steps || '';
  document.getElementById('health-distance').value = h.distanceKm || '';
  renderEnergyBalance('health-stage');
}

function openMealModal(mealType) {
  modalMealType = mealType;
  document.getElementById('modal-title').textContent = `${MEAL_TYPES[mealType] || '식사'} 추가`;
  document.getElementById('food-name').value = '';
  document.getElementById('food-calories').value = '';
  document.getElementById('food-carbs').value = '';
  document.getElementById('food-protein').value = '';
  document.getElementById('food-fat').value = '';
  document.getElementById('food-amount').value = '1';
  document.getElementById('food-lookup-input').value = '';
  document.getElementById('food-lookup-result').innerHTML = '';
  document.getElementById('meal-modal-backdrop').classList.add('open');

  const qf = document.getElementById('quick-foods');
  qf.innerHTML = '';
  QUICK_FOODS.forEach(food => {
    const btn = document.createElement('button');
    btn.className = 'quick-food-btn';
    btn.textContent = food.name;
    btn.addEventListener('click', () => applyFoodToForm(food));
    qf.appendChild(btn);
  });
}

function applyFoodToForm(food) {
  document.getElementById('food-name').value = food.name;
  document.getElementById('food-calories').value = food.calories;
  document.getElementById('food-carbs').value = food.carbs;
  document.getElementById('food-protein').value = food.protein;
  document.getElementById('food-fat').value = food.fat;
  document.getElementById('food-amount').value = '1';
}

function findFood(keyword) {
  const q = keyword.trim().toLowerCase();
  if (!q) return null;
  return FOOD_DB.find(f => f.name.toLowerCase().includes(q) || (f.aliases || []).some(a => a.toLowerCase().includes(q)));
}

function lookupFood() {
  const keyword = document.getElementById('food-lookup-input').value;
  const food = findFood(keyword);
  const result = document.getElementById('food-lookup-result');
  if (!food) {
    result.textContent = '일치하는 음식이 없습니다. 직접 입력해주세요.';
    return;
  }
  result.innerHTML = `${food.name} · ${food.calories}kcal (탄 ${food.carbs}g / 단 ${food.protein}g / 지 ${food.fat}g) <button class="btn btn-primary btn-sm" id="food-apply-btn">적용</button>`;
  document.getElementById('food-apply-btn').addEventListener('click', () => applyFoodToForm(food));
}

function closeMealModal() { document.getElementById('meal-modal-backdrop').classList.remove('open'); }

function saveMealItem() {
  const name = document.getElementById('food-name').value.trim();
  const calories = parseFloat(document.getElementById('food-calories').value) || 0;
  const carbs = parseFloat(document.getElementById('food-carbs').value) || 0;
  const protein = parseFloat(document.getElementById('food-protein').value) || 0;
  const fat = parseFloat(document.getElementById('food-fat').value) || 0;
  const amount = parseFloat(document.getElementById('food-amount').value) || 1;
  if (!name) return alert('음식 이름을 입력해주세요.');
  if (calories <= 0) return alert('칼로리를 입력해주세요.');
  getMealsForDate(state.selectedDate)[modalMealType].push({ name, calories, carbs, protein, fat, amount });
  saveState();
  closeMealModal();
  renderAll();
}

function openExerciseModal() {
  document.getElementById('exercise-name').value = '';
  document.getElementById('exercise-minutes').value = '';
  document.getElementById('exercise-calories').value = '';
  document.getElementById('exercise-modal-backdrop').classList.add('open');
}
function closeExerciseModal() { document.getElementById('exercise-modal-backdrop').classList.remove('open'); }
function saveExercise() {
  const name = document.getElementById('exercise-name').value.trim();
  const minutes = parseInt(document.getElementById('exercise-minutes').value, 10) || 0;
  const calories = parseInt(document.getElementById('exercise-calories').value, 10) || 0;
  if (!name || minutes <= 0 || calories <= 0) return alert('운동명/시간/칼로리를 입력해주세요.');
  getExercisesForDate(state.selectedDate).push({ name, minutes, calories });
  saveState();
  closeExerciseModal();
  renderAll();
}

function parseHealthText() {
  const text = document.getElementById('health-text-import').value || '';
  const h = getHealthForDate(state.selectedDate);

  const n = (regex) => {
    const m = text.match(regex);
    return m ? Number(String(m[1]).replace(/,/g, '')) : null;
  };

  const active = n(/(?:활동\s*에너지|active\s*energy)\D*(\d+[\d,]*\.?\d*)/i);
  const resting = n(/(?:기초\s*에너지|resting\s*energy)\D*(\d+[\d,]*\.?\d*)/i);
  const mins = n(/(?:운동\s*시간|exercise\s*time)\D*(\d+[\d,]*\.?\d*)/i);
  const steps = n(/(?:걸음\s*수|steps?)\D*(\d+[\d,]*)/i);
  const dist = n(/(?:거리|distance)\D*(\d+[\d,]*\.?\d*)/i);

  if (active !== null) h.activeCalories = active;
  if (resting !== null) h.restingCalories = resting;
  if (mins !== null) h.exerciseMinutes = mins;
  if (steps !== null) h.steps = steps;
  if (dist !== null) h.distanceKm = dist;

  saveState();
  renderAll();
}

function saveHealthManual() {
  const h = getHealthForDate(state.selectedDate);
  h.activeCalories = parseFloat(document.getElementById('health-active-cal').value) || 0;
  h.restingCalories = parseFloat(document.getElementById('health-resting-cal').value) || 0;
  h.exerciseMinutes = parseFloat(document.getElementById('health-exercise-min').value) || 0;
  h.steps = parseFloat(document.getElementById('health-steps').value) || 0;
  h.distanceKm = parseFloat(document.getElementById('health-distance').value) || 0;
  saveState();
  renderAll();
}

function initEvents() {
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

  document.getElementById('prevDay').addEventListener('click', () => { state.selectedDate = addDays(state.selectedDate, -1); renderAll(); });
  document.getElementById('nextDay').addEventListener('click', () => { state.selectedDate = addDays(state.selectedDate, 1); renderAll(); });
  document.getElementById('todayBtn').addEventListener('click', () => { state.selectedDate = todayStr(); renderAll(); });

  document.getElementById('dash-add-meal').addEventListener('click', () => openMealModal('breakfast'));
  document.querySelectorAll('.add-meal-btn').forEach(btn => btn.addEventListener('click', () => openMealModal(btn.dataset.meal)));

  document.getElementById('modal-close').addEventListener('click', closeMealModal);
  document.getElementById('meal-modal-backdrop').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeMealModal(); });
  document.getElementById('modal-save').addEventListener('click', saveMealItem);
  document.getElementById('food-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') saveMealItem(); });
  document.getElementById('food-lookup-btn').addEventListener('click', lookupFood);

  document.getElementById('dash-weight-save').addEventListener('click', () => {
    const v = parseFloat(document.getElementById('dash-weight-input').value);
    if (v && v > 0) {
      state.weights[state.selectedDate] = v;
      saveState();
      renderAll();
    }
  });
  document.getElementById('weight-save').addEventListener('click', () => {
    const v = parseFloat(document.getElementById('weight-input').value);
    if (v && v > 0) {
      state.weights[state.selectedDate] = v;
      saveState();
      renderAll();
    }
  });

  document.getElementById('dash-med-save').addEventListener('click', () => {
    const meds = getMedsForDate(state.selectedDate);
    meds.bp = document.getElementById('dash-med-bp').checked;
    meds.lipid = document.getElementById('dash-med-lipid').checked;
    saveState();
    alert('복약 체크를 저장했습니다.');
  });

  document.getElementById('exercise-add').addEventListener('click', openExerciseModal);
  document.getElementById('exercise-modal-close').addEventListener('click', closeExerciseModal);
  document.getElementById('exercise-modal-backdrop').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeExerciseModal(); });
  document.getElementById('exercise-save').addEventListener('click', saveExercise);

  document.getElementById('health-save').addEventListener('click', saveHealthManual);
  document.getElementById('health-parse').addEventListener('click', parseHealthText);

  document.getElementById('goals-save').addEventListener('click', () => {
    state.goals.name = document.getElementById('goal-name').value.trim();
    state.goals.height = parseFloat(document.getElementById('goal-height').value) || '';
    state.goals.age = parseInt(document.getElementById('goal-age').value, 10) || '';
    state.goals.gender = document.getElementById('goal-gender').value;
    state.goals.targetWeight = parseFloat(document.getElementById('goal-target-weight').value) || '';
    state.goals.calories = parseInt(document.getElementById('goal-calories').value, 10) || 2000;
    state.goals.carbs = parseInt(document.getElementById('goal-carbs').value, 10) || 250;
    state.goals.protein = parseInt(document.getElementById('goal-protein').value, 10) || 100;
    state.goals.fat = parseInt(document.getElementById('goal-fat').value, 10) || 65;
    saveState();
    const msg = document.getElementById('goals-save-msg');
    msg.textContent = '저장되었습니다!';
    setTimeout(() => { msg.textContent = ''; }, 2000);
  });

  document.getElementById('goals-calc-bmr').addEventListener('click', () => {
    const height = parseFloat(document.getElementById('goal-height').value);
    const age = parseInt(document.getElementById('goal-age').value, 10);
    const gender = document.getElementById('goal-gender').value;
    const wEntries = Object.entries(state.weights).sort((a, b) => b[0].localeCompare(a[0]));
    const weight = wEntries.length > 0 ? wEntries[0][1] : 70;
    if (!height || !age) return alert('키와 나이를 먼저 입력해주세요.');

    const bmr = gender === 'male' ? 10 * weight + 6.25 * height - 5 * age + 5 : 10 * weight + 6.25 * height - 5 * age - 161;
    const tdee = Math.round(bmr * 1.375);
    const dietCal = Math.max(1200, tdee - 500);

    document.getElementById('goal-calories').value = dietCal;
    document.getElementById('goal-carbs').value = Math.round(dietCal * 0.5 / 4);
    document.getElementById('goal-protein').value = Math.round(dietCal * 0.25 / 4);
    document.getElementById('goal-fat').value = Math.round(dietCal * 0.25 / 9);

    const msg = document.getElementById('goals-save-msg');
    msg.textContent = `BMR: ${Math.round(bmr)} / TDEE: ${tdee} → 목표: ${dietCal} kcal`;
  });
}

function init() {
  loadState();
  initEvents();
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);
