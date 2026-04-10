// ===== Firebase 초기화 =====
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyBRJGaLoFC8sIIGE5qCBjjnjT4TTXOH2HY",
  authDomain: "my-diet-a8860.firebaseapp.com",
  projectId: "my-diet-a8860",
  storageBucket: "my-diet-a8860.firebasestorage.app",
  messagingSenderId: "631471613217",
  appId: "1:631471613217:web:a9abbe7d1e181e6487ca60",
  measurementId: "G-7BX690TN34"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db   = getFirestore(firebaseApp);

// ===== 상수 =====
const MEAL_TYPES = { breakfast: '아침', lunch: '점심', dinner: '저녁', snack: '간식' };

const QUICK_FOODS = [
  { name: '닭가슴살 100g',  calories: 165, carbs: 0,  protein: 31,  fat: 3.6 },
  { name: '흰쌀밥 한공기',  calories: 300, carbs: 65, protein: 5,   fat: 0.5 },
  { name: '달걀 1개',       calories: 78,  carbs: 0.6,protein: 6,   fat: 5   },
  { name: '고구마 중간',    calories: 130, carbs: 30, protein: 2,   fat: 0.1 },
  { name: '바나나 1개',     calories: 89,  carbs: 23, protein: 1,   fat: 0.3 },
  { name: '아몬드 30g',     calories: 174, carbs: 6,  protein: 6,   fat: 15  },
  { name: '두부 반모',      calories: 90,  carbs: 2,  protein: 9,   fat: 5   },
  { name: '삼겹살 100g',   calories: 331, carbs: 0,  protein: 17,  fat: 28  },
  { name: '라면 1봉',       calories: 500, carbs: 72, protein: 10,  fat: 17  },
  { name: '아메리카노',     calories: 5,   carbs: 1,  protein: 0,   fat: 0   },
  { name: '우유 200ml',    calories: 130, carbs: 10, protein: 6.5, fat: 7   },
  { name: '요거트 플레인',  calories: 100, carbs: 12, protein: 8,   fat: 2   },
];

// ===== 상태 =====
let currentUser = null;

let state = {
  selectedDate: todayStr(),
  meals:   {},
  weights: {},
  goals: {
    name: '', height: '', age: '', gender: 'male',
    targetWeight: '', calories: 2000,
    carbs: 250, protein: 100, fat: 65,
  },
};

let currentPage    = 'dashboard';
let modalMealType  = 'breakfast';
let weightChart    = null;
let calorieChart   = null;
let macroChart     = null;

// ===== 유틸 =====
function todayStr() {
  return formatDate(new Date());
}
function formatDate(d) {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function displayDate(str) {
  const d    = parseDate(str);
  const days = ['일','월','화','수','목','금','토'];
  return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
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
  const m = getMealsForDate(date);
  return sumMacros([...m.breakfast, ...m.lunch, ...m.dinner, ...m.snack]);
}
function round1(n) { return Math.round(n * 10) / 10; }

function showLoading(v) {
  document.getElementById('loading-overlay').style.display = v ? 'flex' : 'none';
}

// ===== Firebase 저장/로드 =====
async function saveGoals() {
  if (!currentUser) return;
  try {
    await setDoc(doc(db, 'users', currentUser.uid, 'data', 'goals'), state.goals);
  } catch(e) { console.error('goals 저장 실패', e); }
}

async function saveWeights() {
  if (!currentUser) return;
  try {
    await setDoc(doc(db, 'users', currentUser.uid, 'data', 'weights'), { data: state.weights });
  } catch(e) { console.error('weights 저장 실패', e); }
}

async function saveMealsForDate(date) {
  if (!currentUser) return;
  try {
    await setDoc(doc(db, 'users', currentUser.uid, 'meals', date), getMealsForDate(date));
  } catch(e) { console.error('meals 저장 실패', e); }
}

async function loadAllData() {
  if (!currentUser) return;
  showLoading(true);
  try {
    // 목표 로드
    const goalsSnap = await getDoc(doc(db, 'users', currentUser.uid, 'data', 'goals'));
    if (goalsSnap.exists()) {
      state.goals = { ...state.goals, ...goalsSnap.data() };
    }

    // 체중 로드
    const wSnap = await getDoc(doc(db, 'users', currentUser.uid, 'data', 'weights'));
    if (wSnap.exists() && wSnap.data().data) {
      state.weights = wSnap.data().data;
    }

    // 오늘 식단 로드
    await loadMealsForDate(state.selectedDate);

  } catch(e) {
    console.error('데이터 로드 실패', e);
  } finally {
    showLoading(false);
  }
}

async function loadMealsForDate(date) {
  if (!currentUser) return;
  if (state.meals[date]) return; // 이미 로드됨
  try {
    const snap = await getDoc(doc(db, 'users', currentUser.uid, 'meals', date));
    if (snap.exists()) {
      state.meals[date] = snap.data();
    } else {
      state.meals[date] = { breakfast: [], lunch: [], dinner: [], snack: [] };
    }
  } catch(e) { console.error('meals 로드 실패', e); }
}

// ===== 인증 =====
async function loginWithGoogle() {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch(e) {
    if (e.code !== 'auth/popup-closed-by-user') {
      alert('로그인 실패: ' + e.message);
    }
  }
}

async function logout() {
  if (!confirm('로그아웃 하시겠어요?')) return;
  await signOut(auth);
}

function showLoginScreen() {
  document.getElementById('login-screen').style.display = 'flex';
  document.querySelector('.sidebar').style.display      = 'none';
  document.querySelector('.main-content').style.display = 'none';
}

function showApp(user) {
  document.getElementById('login-screen').style.display = 'none';
  document.querySelector('.sidebar').style.display      = 'flex';
  document.querySelector('.main-content').style.display = 'block';

  const userInfo = document.getElementById('user-info');
  userInfo.style.display = 'block';
  document.getElementById('user-name').textContent = user.displayName || user.email;
  const avatar = document.getElementById('user-avatar');
  if (user.photoURL) {
    avatar.src   = user.photoURL;
    avatar.style.display = 'block';
  } else {
    avatar.style.display = 'none';
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
  const total  = getDayTotal(state.selectedDate);
  const g      = state.goals;
  const calGoal = g.calories || 2000;

  document.getElementById('dash-calories').textContent = Math.round(total.calories);
  document.getElementById('dash-carbs').textContent    = round1(total.carbs);
  document.getElementById('dash-protein').textContent  = round1(total.protein);
  document.getElementById('dash-fat').textContent      = round1(total.fat);

  const pct = Math.min((total.calories / calGoal) * 100, 100);
  const bar = document.getElementById('calorie-bar');
  bar.style.width = pct + '%';
  bar.classList.toggle('over', total.calories > calGoal);
  document.getElementById('dash-cal-goal').textContent  = `목표: ${calGoal} kcal`;
  document.getElementById('calorie-label').textContent  =
    `${Math.round(total.calories)} / ${calGoal} kcal (${Math.round(pct)}%)`;

  const meals = getMealsForDate(state.selectedDate);
  const list  = document.getElementById('dash-meal-list');
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
        <span class="meal-cal">${cal} kcal</span>`;
      list.appendChild(div);
    }
  }
  if (!hasAny) list.innerHTML = '<div class="empty-state">오늘 식단을 기록해보세요!</div>';

  const w  = state.weights[state.selectedDate];
  const wd = document.getElementById('dash-weight-display');
  const wi = document.getElementById('dash-weight-input');
  if (w) { wd.textContent = `${w} kg`; wi.value = w; }
  else   { wd.textContent = '';         wi.value = ''; }
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
          <button class="meal-item-del" data-type="${type}" data-idx="${idx}" title="삭제">✕</button>`;
        container.appendChild(div);
      });
    }
    const s = sumMacros(meals[type]);
    totalEl.textContent = meals[type].length > 0 ? `합계: ${Math.round(s.calories)} kcal` : '';
  }
  document.querySelectorAll('.meal-item-del').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const t = e.currentTarget.dataset.type;
      const i = Number(e.currentTarget.dataset.idx);
      getMealsForDate(state.selectedDate)[t].splice(i, 1);
      await saveMealsForDate(state.selectedDate);
      renderAll();
    });
  });
}

// --- 체중 ---
function renderWeight() {
  document.getElementById('weight-input').value = state.weights[state.selectedDate] || '';

  const list    = document.getElementById('weight-list');
  const entries = Object.entries(state.weights).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 30);
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
        <button class="weight-row-del" data-date="${date}">✕</button>`;
      list.appendChild(div);
    });
    document.querySelectorAll('.weight-row-del').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        delete state.weights[e.currentTarget.dataset.date];
        await saveWeights();
        renderAll();
        renderWeightChart();
      });
    });
  }
  renderWeightChart();
}

function renderWeightChart() {
  const ctx     = document.getElementById('weightChart').getContext('2d');
  const entries = Object.entries(state.weights).sort((a, b) => a[0].localeCompare(b[0])).slice(-30);
  const labels  = entries.map(([d]) => { const dt = parseDate(d); return `${dt.getMonth()+1}/${dt.getDate()}`; });
  const data    = entries.map(([, w]) => w);
  if (weightChart) weightChart.destroy();
  weightChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{ label: '체중 (kg)', data, borderColor: '#4CAF50', backgroundColor: 'rgba(76,175,80,0.1)', tension: 0.3, fill: true, pointBackgroundColor: '#4CAF50', pointRadius: 4 }],
    },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: false, ticks: { callback: v => `${v}kg` } } } },
  });
}

// --- 통계 ---
function renderStats() {
  const last7   = Array.from({ length: 7 }, (_, i) => addDays(todayStr(), i - 6));
  const calData = last7.map(d => Math.round(getDayTotal(d).calories));
  const recorded = calData.filter(v => v > 0);
  document.getElementById('stat-avg-cal').textContent = recorded.length
    ? Math.round(recorded.reduce((a, b) => a + b, 0) / recorded.length) : '-';

  const wEntries = Object.entries(state.weights).sort((a, b) => a[0].localeCompare(b[0]));
  if (wEntries.length >= 2) {
    const diff = round1(wEntries[wEntries.length-1][1] - wEntries[0][1]);
    const el = document.getElementById('stat-weight-change');
    el.textContent = (diff > 0 ? '+' : '') + diff;
    el.style.color = diff > 0 ? '#E53E3E' : '#38A169';
  } else {
    document.getElementById('stat-weight-change').textContent = '-';
  }
  document.getElementById('stat-record-days').textContent =
    Object.values(state.meals).filter(m => Object.values(m).some(a => a.length > 0)).length;

  renderCalorieChart(last7, calData);
  renderMacroChart();
}

function renderCalorieChart(dates, calData) {
  const ctx  = document.getElementById('calorieChart').getContext('2d');
  const goal = state.goals.calories || 2000;
  const labels = dates.map(d => { const dt = parseDate(d); return `${dt.getMonth()+1}/${dt.getDate()}`; });
  if (calorieChart) calorieChart.destroy();
  calorieChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: '섭취 칼로리', data: calData, backgroundColor: calData.map(v => v > goal ? 'rgba(229,62,62,0.7)' : 'rgba(76,175,80,0.7)'), borderRadius: 6 },
        { label: '목표', data: dates.map(() => goal), type: 'line', borderColor: '#D69E2E', borderDash: [6,3], borderWidth: 2, pointRadius: 0, fill: false },
      ],
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } },
  });
}

function renderMacroChart() {
  const ctx   = document.getElementById('macroChart').getContext('2d');
  const total = getDayTotal(state.selectedDate);
  const cCal  = total.carbs * 4, pCal = total.protein * 4, fCal = total.fat * 9;
  const sum   = cCal + pCal + fCal;
  if (macroChart) macroChart.destroy();
  if (sum < 1) {
    macroChart = new Chart(ctx, { type: 'doughnut', data: { labels: ['데이터 없음'], datasets: [{ data: [1], backgroundColor: ['#E2E8F0'] }] }, options: { plugins: { legend: { position: 'bottom' } } } });
    return;
  }
  macroChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: [`탄수화물 ${Math.round(total.carbs)}g`, `단백질 ${Math.round(total.protein)}g`, `지방 ${Math.round(total.fat)}g`],
      datasets: [{ data: [cCal, pCal, fCal], backgroundColor: ['#4CAF50','#2196F3','#FF7043'], borderWidth: 2, borderColor: '#fff' }],
    },
    options: { plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: ctx => `${ctx.label} (${Math.round((ctx.raw/sum)*100)}%)` } } } },
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
  document.getElementById('modal-title').textContent = `${MEAL_TYPES[mealType] || '식사'} 추가`;
  ['food-name','food-calories','food-carbs','food-protein','food-fat'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('food-amount').value = '1';
  document.getElementById('meal-modal-backdrop').classList.add('open');

  const qf = document.getElementById('quick-foods');
  qf.innerHTML = '';
  QUICK_FOODS.forEach(food => {
    const btn = document.createElement('button');
    btn.className   = 'quick-food-btn';
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

async function saveMealItem() {
  const name     = document.getElementById('food-name').value.trim();
  const calories = parseFloat(document.getElementById('food-calories').value) || 0;
  const carbs    = parseFloat(document.getElementById('food-carbs').value)    || 0;
  const protein  = parseFloat(document.getElementById('food-protein').value)  || 0;
  const fat      = parseFloat(document.getElementById('food-fat').value)      || 0;
  const amount   = parseFloat(document.getElementById('food-amount').value)   || 1;

  if (!name)        { alert('음식 이름을 입력해주세요.'); return; }
  if (calories <= 0){ alert('칼로리를 입력해주세요.'); return; }

  getMealsForDate(state.selectedDate)[modalMealType].push({ name, calories, carbs, protein, fat, amount });
  closeMealModal();
  renderAll();
  await saveMealsForDate(state.selectedDate);
}

// ===== 날짜 이동 (식단 미리 로드) =====
async function changeDate(newDate) {
  state.selectedDate = newDate;
  await loadMealsForDate(newDate);
  renderAll();
}

// ===== 이벤트 =====
function initEvents() {
  // 로그인/로그아웃
  document.getElementById('google-login-btn').addEventListener('click', loginWithGoogle);
  document.getElementById('logout-btn').addEventListener('click', logout);

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
  document.getElementById('prevDay').addEventListener('click',  () => changeDate(addDays(state.selectedDate, -1)));
  document.getElementById('nextDay').addEventListener('click',  () => changeDate(addDays(state.selectedDate, 1)));
  document.getElementById('todayBtn').addEventListener('click', () => changeDate(todayStr()));

  // 식사 추가 버튼
  document.getElementById('dash-add-meal').addEventListener('click', () => openMealModal('breakfast'));
  document.querySelectorAll('.add-meal-btn').forEach(btn => {
    btn.addEventListener('click', () => openMealModal(btn.dataset.meal));
  });

  // 모달
  document.getElementById('modal-close').addEventListener('click', closeMealModal);
  document.getElementById('meal-modal-backdrop').addEventListener('click', e => { if (e.target === e.currentTarget) closeMealModal(); });
  document.getElementById('modal-save').addEventListener('click', saveMealItem);
  document.getElementById('food-name').addEventListener('keydown', e => { if (e.key === 'Enter') saveMealItem(); });

  // 체중 저장 (대시보드)
  document.getElementById('dash-weight-save').addEventListener('click', async () => {
    const v = parseFloat(document.getElementById('dash-weight-input').value);
    if (v && v > 0) { state.weights[state.selectedDate] = v; renderAll(); await saveWeights(); }
  });

  // 체중 저장 (체중 페이지)
  document.getElementById('weight-save').addEventListener('click', async () => {
    const v = parseFloat(document.getElementById('weight-input').value);
    if (v && v > 0) { state.weights[state.selectedDate] = v; renderAll(); await saveWeights(); }
  });

  // 목표 저장
  document.getElementById('goals-save').addEventListener('click', async () => {
    state.goals.name         = document.getElementById('goal-name').value.trim();
    state.goals.height       = parseFloat(document.getElementById('goal-height').value) || '';
    state.goals.age          = parseInt(document.getElementById('goal-age').value)      || '';
    state.goals.gender       = document.getElementById('goal-gender').value;
    state.goals.targetWeight = parseFloat(document.getElementById('goal-target-weight').value) || '';
    state.goals.calories     = parseInt(document.getElementById('goal-calories').value) || 2000;
    state.goals.carbs        = parseInt(document.getElementById('goal-carbs').value)    || 250;
    state.goals.protein      = parseInt(document.getElementById('goal-protein').value)  || 100;
    state.goals.fat          = parseInt(document.getElementById('goal-fat').value)      || 65;
    const msg = document.getElementById('goals-save-msg');
    msg.textContent = '저장 중...';
    await saveGoals();
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
    let bmr = gender === 'male'
      ? 10*weight + 6.25*height - 5*age + 5
      : 10*weight + 6.25*height - 5*age - 161;
    const tdee    = Math.round(bmr * 1.375);
    const dietCal = Math.max(1200, tdee - 500);
    document.getElementById('goal-calories').value = dietCal;
    document.getElementById('goal-carbs').value    = Math.round(dietCal * 0.5  / 4);
    document.getElementById('goal-protein').value  = Math.round(dietCal * 0.25 / 4);
    document.getElementById('goal-fat').value      = Math.round(dietCal * 0.25 / 9);
    document.getElementById('goals-save-msg').textContent =
      `BMR: ${Math.round(bmr)} kcal / TDEE: ${tdee} kcal → 목표: ${dietCal} kcal`;
  });
}

// ===== 초기화 =====
function init() {
  initEvents();
  showLoginScreen(); // 기본은 로그인 화면

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      showApp(user);
      // 상태 초기화 후 Firebase에서 로드
      state = {
        selectedDate: todayStr(),
        meals: {}, weights: {},
        goals: { name:'', height:'', age:'', gender:'male', targetWeight:'', calories:2000, carbs:250, protein:100, fat:65 },
      };
      await loadAllData();
      renderAll();
    } else {
      currentUser = null;
      showLoginScreen();
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
