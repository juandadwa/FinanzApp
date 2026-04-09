/* =============================================
   FINANZAPP — JAVASCRIPT + FIREBASE
   ============================================= */
'use strict';

// =============================================
// FIREBASE CONFIG & INIT
// =============================================
const firebaseConfig = {
  apiKey:            "AIzaSyCx0WhsYfsws71heEltcHAW8534qCyhSY8",
  authDomain:        "finanzapp-94de6.firebaseapp.com",
  projectId:         "finanzapp-94de6",
  storageBucket:     "finanzapp-94de6.firebasestorage.app",
  messagingSenderId: "555906381171",
  appId:             "1:555906381171:web:6b77d3ec549a9eeb990106",
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

// Persistencia offline en el dispositivo
db.enablePersistence({ synchronizeTabs: true }).catch(e => {
  if (e.code === 'failed-precondition') console.warn('[Firestore] Multiple tabs open');
  else if (e.code === 'unimplemented')  console.warn('[Firestore] Offline persistence not available');
});

// =============================================
// CONSTANTS
// =============================================
const CATEGORIES = {
  income: [
    { id: 'salary',     label: 'Salario',        icon: '💼' },
    { id: 'freelance',  label: 'Freelance',       icon: '💻' },
    { id: 'investment', label: 'Inversiones',     icon: '📈' },
    { id: 'gift',       label: 'Regalos',         icon: '🎁' },
    { id: 'other',      label: 'Otro ingreso',    icon: '💰' },
  ],
  expense: [
    { id: 'food',       label: 'Comida',          icon: '🍔' },
    { id: 'transport',  label: 'Transporte',      icon: '🚌' },
    { id: 'housing',    label: 'Vivienda',        icon: '🏠' },
    { id: 'health',     label: 'Salud',           icon: '❤️' },
    { id: 'education',  label: 'Educación',       icon: '📚' },
    { id: 'entertain',  label: 'Entretenimiento', icon: '🎮' },
    { id: 'clothing',   label: 'Ropa',            icon: '👗' },
    { id: 'bills',      label: 'Servicios',       icon: '💡' },
    { id: 'other',      label: 'Otro gasto',      icon: '🧾' },
  ],
};

const GOAL_ICONS = ['🎯','✈️','🏠','🚗','💻','📱','🎓','💍','🏖️','🎸','🐶','👶','💪','🌍','⛵','🏋️'];

const CATEGORY_COLORS = [
  '#00d4aa','#a78bfa','#60a5fa','#f87171','#fbbf24',
  '#34d399','#fb923c','#e879f9','#38bdf8',
];

const FIREBASE_ERRORS = {
  'auth/email-already-in-use':   'Este correo ya está registrado.',
  'auth/invalid-email':          'Correo electrónico inválido.',
  'auth/wrong-password':         'Contraseña incorrecta.',
  'auth/invalid-credential':     'Correo o contraseña incorrectos.',
  'auth/user-not-found':         'No existe una cuenta con este correo.',
  'auth/weak-password':          'La contraseña debe tener al menos 6 caracteres.',
  'auth/network-request-failed': 'Error de conexión. Verifica tu internet.',
  'auth/too-many-requests':      'Demasiados intentos. Intenta más tarde.',
};

// =============================================
// STATE
// =============================================
let currentUser = null;
let unsubListeners = [];

let state = {
  transactions:          [],
  goals:                 [],
  filters:               { type: 'all', category: 'all', month: '' },
  selectedGoalIcon:      GOAL_ICONS[0],
  currentTransactionType:'income',
  currentPage:           'dashboard',
};

// =============================================
// FIRESTORE HELPERS
// =============================================
function txCol()    { return db.collection('users').doc(currentUser.uid).collection('transactions'); }
function goalsCol() { return db.collection('users').doc(currentUser.uid).collection('goals'); }

// =============================================
// REALTIME LISTENERS
// =============================================
function setupListeners() {
  clearListeners();

  const unsubTx = txCol()
    .orderBy('date', 'desc')
    .onSnapshot(snap => {
      state.transactions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderCurrentPage();
    }, err => console.error('[Firestore] Transactions error:', err));

  const unsubGoals = goalsCol()
    .orderBy('createdAt', 'asc')
    .onSnapshot(snap => {
      state.goals = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (state.currentPage === 'savings') renderGoals();
      if (state.currentPage === 'dashboard') renderDashboard();
    }, err => console.error('[Firestore] Goals error:', err));

  unsubListeners = [unsubTx, unsubGoals];
}

function clearListeners() {
  unsubListeners.forEach(u => { try { u(); } catch(_){} });
  unsubListeners = [];
  state.transactions = [];
  state.goals = [];
}

function renderCurrentPage() {
  if (state.currentPage === 'dashboard')    renderDashboard();
  if (state.currentPage === 'transactions') renderTransactions();
  if (state.currentPage === 'savings')      renderGoals();
}

// =============================================
// AUTH STATE OBSERVER
// =============================================
auth.onAuthStateChanged(user => {
  if (user) {
    currentUser = user;
    hideAuthScreen();
    document.getElementById('sidebar-user-name').textContent  = user.displayName || 'Mi Cuenta';
    document.getElementById('sidebar-user-email').textContent = user.email;
    // Set default month filter
    document.getElementById('filter-month').value = getCurrentMonthKey();
    state.filters.month = getCurrentMonthKey();
    setupListeners();
    navigateTo('dashboard');
  } else {
    currentUser = null;
    clearListeners();
    showAuthScreen();
    if (chartDonut) { chartDonut.destroy(); chartDonut = null; }
    if (chartBar)   { chartBar.destroy();   chartBar   = null; }
  }
});

// =============================================
// AUTH UI
// =============================================
function showAuthScreen() {
  document.getElementById('auth-overlay').classList.add('open');
}

function hideAuthScreen() {
  document.getElementById('auth-overlay').classList.remove('open');
}

function showAuthTab(tab) {
  const loginForm = document.getElementById('form-login');
  const regForm   = document.getElementById('form-register');
  const tabLogin  = document.getElementById('tab-login');
  const tabReg    = document.getElementById('tab-register');

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    regForm.classList.add('hidden');
    tabLogin.classList.add('active');
    tabReg.classList.remove('active');
    document.getElementById('login-error').textContent = '';
  } else {
    loginForm.classList.add('hidden');
    regForm.classList.remove('hidden');
    tabLogin.classList.remove('active');
    tabReg.classList.add('active');
    document.getElementById('reg-error').textContent = '';
  }
}

function togglePasswordVis(inputId, btnId) {
  const input = document.getElementById(inputId);
  const btn   = document.getElementById(btnId);
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  btn.innerHTML = isHidden
    ? '<i class="fa-solid fa-eye-slash"></i>'
    : '<i class="fa-solid fa-eye"></i>';
}

function setAuthLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  const span = btn.querySelector('span');
  if (loading) {
    btn.dataset.origText = span.textContent;
    span.textContent = 'Cargando...';
    btn.style.opacity = '0.7';
  } else {
    span.textContent = btn.dataset.origText || span.textContent;
    btn.style.opacity = '';
  }
}

function showAuthError(elId, code) {
  const el = document.getElementById(elId);
  el.textContent = FIREBASE_ERRORS[code] || 'Ocurrió un error. Inténtalo de nuevo.';
  el.style.display = 'block';
}

// =============================================
// AUTH FORM HANDLERS
// =============================================
function setupAuthForms() {
  // Login
  document.getElementById('form-login').addEventListener('submit', async e => {
    e.preventDefault();
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    document.getElementById('login-error').textContent = '';
    setAuthLoading('btn-login', true);
    try {
      await auth.signInWithEmailAndPassword(email, password);
    } catch (err) {
      showAuthError('login-error', err.code);
      setAuthLoading('btn-login', false);
    }
  });

  // Register
  document.getElementById('form-register').addEventListener('submit', async e => {
    e.preventDefault();
    const name     = document.getElementById('reg-name').value.trim();
    const email    = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    document.getElementById('reg-error').textContent = '';

    if (!name) { showAuthError('reg-error', 'auth/invalid-name'); return; }

    setAuthLoading('btn-register', true);
    try {
      const { user } = await auth.createUserWithEmailAndPassword(email, password);
      await user.updateProfile({ displayName: name });
      // Create user profile doc
      await db.collection('users').doc(user.uid).set({
        name, email, createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      showAuthError('reg-error', err.code);
      setAuthLoading('btn-register', false);
    }
  });

  // Logout
  document.getElementById('btn-logout').addEventListener('click', async () => {
    await auth.signOut();
    showToast('Sesión cerrada', 'info');
  });
}

// =============================================
// UTILITIES
// =============================================
function formatCurrency(amount) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getTxDateMonth(tx) { return (tx.date || '').substring(0, 7); }

function getCategoryInfo(type, categoryId) {
  const list = CATEGORIES[type] || [];
  return list.find(c => c.id === categoryId) || { label: categoryId, icon: '🧾' };
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
  toast.className = `toast show ${type}`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.className = 'toast'; }, 3200);
}

// =============================================
// NAVIGATION
// =============================================
function navigateTo(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`page-${pageId}`)?.classList.add('active');
  document.getElementById(`nav-${pageId}`)?.classList.add('active');
  const titles = { dashboard: 'Dashboard', transactions: 'Transacciones', savings: 'Metas de Ahorro' };
  document.getElementById('topbar-title').textContent = titles[pageId] || pageId;
  state.currentPage = pageId;
  if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('mobile-open');
  renderCurrentPage();
}

// =============================================
// DASHBOARD
// =============================================
let chartDonut = null;
let chartBar   = null;

function renderDashboard() {
  const currMonthKey = getCurrentMonthKey();
  const now = new Date();
  const monthTx  = state.transactions.filter(tx => getTxDateMonth(tx) === currMonthKey);
  const monthIncome  = monthTx.filter(tx => tx.type==='income').reduce((s,tx)=>s+tx.amount,0);
  const monthExpense = monthTx.filter(tx => tx.type==='expense').reduce((s,tx)=>s+tx.amount,0);
  const totalIncome  = state.transactions.filter(tx=>tx.type==='income').reduce((s,tx)=>s+tx.amount,0);
  const totalExpense = state.transactions.filter(tx=>tx.type==='expense').reduce((s,tx)=>s+tx.amount,0);
  const balance      = totalIncome - totalExpense;
  const totalSavings = state.goals.reduce((s,g)=>s+g.current,0);

  document.getElementById('kpi-balance').textContent  = formatCurrency(balance);
  document.getElementById('kpi-income').textContent   = formatCurrency(monthIncome);
  document.getElementById('kpi-expense').textContent  = formatCurrency(monthExpense);
  document.getElementById('kpi-savings').textContent  = formatCurrency(totalSavings);
  document.getElementById('dashboard-month-label').textContent =
    `${now.toLocaleDateString('es-CO',{month:'long',year:'numeric'})} · Balance total acumulado`;

  const badge = document.getElementById('kpi-balance-badge');
  badge.textContent = balance >= 0 ? '▲ Positivo' : '▼ Negativo';
  badge.style.cssText = balance >= 0
    ? 'background:rgba(52,211,153,0.15);color:#34d399;'
    : 'background:rgba(248,113,113,0.15);color:#f87171;';

  renderDonutChart(monthTx);
  renderBarChart();
  renderRecentTransactions();
}

function renderDonutChart(monthTx) {
  const expenses    = monthTx.filter(tx => tx.type === 'expense');
  const totalExpense= expenses.reduce((s,tx)=>s+tx.amount,0);
  const catMap = {};
  expenses.forEach(tx => { catMap[tx.category] = (catMap[tx.category]||0) + tx.amount; });
  const labels = Object.keys(catMap).map(id => {
    const info = getCategoryInfo('expense', id);
    return `${info.icon} ${info.label}`;
  });
  const data = Object.values(catMap);

  document.getElementById('chart-donut-center').querySelector('.center-amount').textContent =
    formatCurrency(totalExpense);

  const ctx = document.getElementById('chart-donut').getContext('2d');
  if (chartDonut) chartDonut.destroy();
  if (!data.length) { chartDonut = null; return; }

  chartDonut = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: CATEGORY_COLORS.slice(0,data.length), borderColor:'transparent', hoverOffset:6 }] },
    options: {
      responsive:true, maintainAspectRatio:false, cutout:'72%',
      plugins: {
        legend: { position:'bottom', labels:{ color:'#94a3b8', font:{family:'Inter',size:11}, padding:10, boxWidth:10, boxHeight:10 } },
        tooltip: { callbacks:{ label: ctx=>`${formatCurrency(ctx.raw)} (${((ctx.raw/totalExpense)*100).toFixed(1)}%)` }, backgroundColor:'#1c2540', titleColor:'#e2e8f0', bodyColor:'#94a3b8' },
      },
    },
  });
}

function renderBarChart() {
  const now = new Date();
  const months = [];
  for (let i=5; i>=0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    months.push({ key:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`, label:d.toLocaleDateString('es-CO',{month:'short'}) });
  }
  const incomeData  = months.map(m=>state.transactions.filter(tx=>tx.type==='income' &&getTxDateMonth(tx)===m.key).reduce((s,tx)=>s+tx.amount,0));
  const expenseData = months.map(m=>state.transactions.filter(tx=>tx.type==='expense'&&getTxDateMonth(tx)===m.key).reduce((s,tx)=>s+tx.amount,0));
  const ctx = document.getElementById('chart-bar').getContext('2d');
  if (chartBar) chartBar.destroy();
  chartBar = new Chart(ctx, {
    type:'bar',
    data:{ labels:months.map(m=>m.label), datasets:[
      { label:'Ingresos',  data:incomeData,  backgroundColor:'rgba(52,211,153,0.7)',  borderRadius:6, borderSkipped:false },
      { label:'Egresos',   data:expenseData, backgroundColor:'rgba(248,113,113,0.7)', borderRadius:6, borderSkipped:false },
    ]},
    options:{
      responsive:true, maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{labels:{color:'#94a3b8',font:{family:'Inter',size:11},boxWidth:10,boxHeight:10}},
        tooltip:{callbacks:{label:ctx=>` ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`},backgroundColor:'#1c2540',titleColor:'#e2e8f0',bodyColor:'#94a3b8'},
      },
      scales:{
        x:{grid:{color:'rgba(255,255,255,0.04)'},ticks:{color:'#94a3b8',font:{family:'Inter',size:11}}},
        y:{grid:{color:'rgba(255,255,255,0.04)'},ticks:{color:'#94a3b8',font:{family:'Inter',size:11},callback:v=>formatCurrency(v)}},
      },
    },
  });
}

function renderRecentTransactions() {
  const list   = document.getElementById('recent-list');
  const recent = [...state.transactions].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5);
  if (!recent.length) {
    list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-receipt"></i><p>No hay transacciones aún. ¡Agrega una!</p></div>`;
    return;
  }
  list.innerHTML = recent.map(tx => {
    const cat  = getCategoryInfo(tx.type, tx.category);
    const sign = tx.type==='income' ? '+' : '-';
    return `<div class="recent-item">
      <div class="tx-icon ${tx.type}">${cat.icon}</div>
      <div class="tx-info">
        <div class="tx-desc">${escapeHtml(tx.description||cat.label)}</div>
        <div class="tx-meta">${cat.label} · ${formatDate(tx.date)}</div>
      </div>
      <div class="tx-amount ${tx.type}">${sign}${formatCurrency(tx.amount)}</div>
    </div>`;
  }).join('');
}

// =============================================
// TRANSACTIONS PAGE
// =============================================
function populateCategoryFilter() {
  const sel = document.getElementById('filter-category');
  const allCats = [...CATEGORIES.income,...CATEGORIES.expense];
  const seen = new Set();
  const unique = allCats.filter(c=>{ if(seen.has(c.id)) return false; seen.add(c.id); return true; });
  sel.innerHTML = `<option value="all">Todas</option>` +
    unique.map(c=>`<option value="${c.id}">${c.icon} ${c.label}</option>`).join('');
  sel.value = state.filters.category;
}

function getFilteredTransactions() {
  return state.transactions.filter(tx => {
    const {type,category,month} = state.filters;
    if (type!=='all'     && tx.type!==type)         return false;
    if (category!=='all' && tx.category!==category) return false;
    if (month            && getTxDateMonth(tx)!==month) return false;
    return true;
  });
}

function renderTransactions() {
  populateCategoryFilter();
  const filtered = getFilteredTransactions();
  const tbody    = document.getElementById('transactions-tbody');

  const income  = filtered.filter(tx=>tx.type==='income').reduce((s,tx)=>s+tx.amount,0);
  const expense = filtered.filter(tx=>tx.type==='expense').reduce((s,tx)=>s+tx.amount,0);
  const balance = income - expense;

  document.getElementById('filtered-income').textContent  = formatCurrency(income);
  document.getElementById('filtered-expense').textContent = formatCurrency(expense);
  const balEl = document.getElementById('filtered-balance');
  balEl.textContent = formatCurrency(balance);
  balEl.style.color = balance>=0 ? 'var(--accent-income)' : 'var(--accent-expense)';

  document.getElementById('filter-type').value     = state.filters.type;
  document.getElementById('filter-category').value = state.filters.category;
  document.getElementById('filter-month').value    = state.filters.month;

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row"><div class="empty-state"><i class="fa-solid fa-receipt"></i><p>No hay transacciones para estos filtros</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = [...filtered].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(tx => {
    const cat  = getCategoryInfo(tx.type, tx.category);
    const sign = tx.type==='income' ? '+' : '-';
    return `<tr>
      <td>${formatDate(tx.date)}</td>
      <td>${escapeHtml(tx.description||cat.label)}</td>
      <td><span class="badge category">${cat.icon} ${cat.label}</span></td>
      <td><span class="badge ${tx.type}">${tx.type==='income'?'▲ Ingreso':'▼ Egreso'}</span></td>
      <td class="text-right"><span class="tx-amount ${tx.type}">${sign}${formatCurrency(tx.amount)}</span></td>
      <td><button class="btn-icon" onclick="deleteTransaction('${tx.id}')" title="Eliminar"><i class="fa-solid fa-trash-can"></i></button></td>
    </tr>`;
  }).join('');
}

async function deleteTransaction(id) {
  try {
    await txCol().doc(id).delete();
    showToast('Transacción eliminada', 'success');
  } catch(e) {
    showToast('Error al eliminar', 'error');
  }
}

// =============================================
// SAVINGS GOALS
// =============================================
function renderGoals() {
  const grid = document.getElementById('goals-grid');
  if (!state.goals.length) {
    grid.innerHTML = `<div class="empty-state full-width">
      <i class="fa-solid fa-piggy-bank" style="font-size:48px;opacity:0.3"></i>
      <p>No tienes metas de ahorro aún</p>
      <button class="btn-primary" onclick="openGoalModal()"><i class="fa-solid fa-plus"></i> Crear mi primera meta</button>
    </div>`;
    return;
  }
  grid.innerHTML = state.goals.map(goal => {
    const pct  = Math.min(100, goal.target>0 ? (goal.current/goal.target)*100 : 0);
    const done = pct >= 100;
    const deadlineStr = goal.deadline ? `Meta: ${formatDate(goal.deadline)}` : 'Sin fecha límite';
    const daysLeft    = goal.deadline ? Math.ceil((new Date(goal.deadline)-new Date())/86400000) : null;
    let deadlineBadge = '';
    if (daysLeft!==null && !done) {
      if (daysLeft<0)      deadlineBadge = `<span style="color:var(--accent-expense);font-size:11px">⚠️ Venció</span>`;
      else if (daysLeft<=7) deadlineBadge = `<span style="color:var(--accent-expense);font-size:11px">⏰ ${daysLeft} días</span>`;
    }
    return `<div class="goal-card ${done?'completed':''}" id="goal-${goal.id}">
      <div class="goal-header">
        <div class="goal-icon-wrap">${goal.icon}</div>
        <div class="goal-title-wrap">
          <div class="goal-name">${escapeHtml(goal.name)}</div>
          <div class="goal-deadline">${deadlineStr} ${deadlineBadge}</div>
          ${done ? '<div class="goal-completed-badge">✅ ¡Meta alcanzada!</div>' : ''}
        </div>
      </div>
      <div class="goal-amounts">
        <div><div class="goal-current">${formatCurrency(goal.current)}</div><div style="font-size:11px;color:var(--text-secondary)">Ahorrado</div></div>
        <div><div class="goal-target-label">Objetivo</div><div class="goal-target-value">${formatCurrency(goal.target)}</div></div>
      </div>
      <div class="goal-progress-bar"><div class="goal-progress-fill ${done?'done':''}" style="width:${pct}%"></div></div>
      <div class="goal-percent">${pct.toFixed(1)}% completado · Faltan ${formatCurrency(Math.max(0,goal.target-goal.current))}</div>
      <div class="goal-actions">
        ${!done ? `<button class="btn-secondary btn-add-savings" onclick="openSavingsModal('${goal.id}')"><i class="fa-solid fa-plus"></i> Agregar ahorro</button>` : ''}
        <button class="btn-icon" onclick="deleteGoal('${goal.id}')" title="Eliminar meta"><i class="fa-solid fa-trash-can"></i></button>
      </div>
    </div>`;
  }).join('');
}

async function deleteGoal(id) {
  try {
    await goalsCol().doc(id).delete();
    showToast('Meta eliminada', 'success');
  } catch(e) {
    showToast('Error al eliminar', 'error');
  }
}

// =============================================
// MODALS
// =============================================
function openTransactionModal() {
  document.getElementById('tx-amount').value      = '';
  document.getElementById('tx-description').value = '';
  document.getElementById('tx-date').value        = new Date().toISOString().split('T')[0];
  setTransactionType('income');
  document.getElementById('modal-transaction').classList.add('open');
}
function closeTransactionModal() { document.getElementById('modal-transaction').classList.remove('open'); }

function setTransactionType(type) {
  state.currentTransactionType = type;
  document.getElementById('toggle-income').classList.toggle('active',  type==='income');
  document.getElementById('toggle-expense').classList.toggle('active', type==='expense');
  const catSel = document.getElementById('tx-category');
  catSel.innerHTML = `<option value="" disabled selected>Selecciona una categoría</option>` +
    (CATEGORIES[type]||[]).map(c=>`<option value="${c.id}">${c.icon} ${c.label}</option>`).join('');
}

function openGoalModal() {
  document.getElementById('goal-name').value     = '';
  document.getElementById('goal-target').value   = '';
  document.getElementById('goal-deadline').value = '';
  state.selectedGoalIcon = GOAL_ICONS[0];
  renderIconPicker();
  document.getElementById('modal-goal').classList.add('open');
}
function closeGoalModal() { document.getElementById('modal-goal').classList.remove('open'); }

function renderIconPicker() {
  document.getElementById('icon-picker').innerHTML = GOAL_ICONS.map(ic =>
    `<div class="icon-option ${ic===state.selectedGoalIcon?'selected':''}" onclick="selectIcon('${ic}')">${ic}</div>`
  ).join('');
}
function selectIcon(icon) { state.selectedGoalIcon = icon; renderIconPicker(); }

function openSavingsModal(goalId) {
  const goal = state.goals.find(g=>g.id===goalId);
  if (!goal) return;
  document.getElementById('savings-goal-name').textContent = `Agregar dinero a: ${goal.name}`;
  document.getElementById('savings-goal-id').value         = goalId;
  document.getElementById('savings-amount').value          = '';
  document.getElementById('modal-add-savings').classList.add('open');
}
function closeSavingsModal() { document.getElementById('modal-add-savings').classList.remove('open'); }

function setupModalOverlayClose() {
  ['modal-transaction','modal-goal','modal-add-savings'].forEach(id => {
    document.getElementById(id).addEventListener('click', e => {
      if (e.target.id === id) document.getElementById(id).classList.remove('open');
    });
  });
}

// =============================================
// FORM HANDLERS
// =============================================
async function handleTransactionSubmit(e) {
  e.preventDefault();
  const amount = parseFloat(document.getElementById('tx-amount').value);
  const date   = document.getElementById('tx-date').value;
  const cat    = document.getElementById('tx-category').value;
  const desc   = document.getElementById('tx-description').value.trim();

  if (!amount||amount<=0) { showToast('Ingresa un monto válido','error'); return; }
  if (!date)              { showToast('Selecciona una fecha','error'); return; }
  if (!cat)               { showToast('Selecciona una categoría','error'); return; }

  const btn = document.getElementById('submit-transaction');
  btn.disabled = true;
  try {
    await txCol().add({
      type: state.currentTransactionType, amount, date, category: cat,
      description: desc, createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    closeTransactionModal();
    showToast(`${state.currentTransactionType==='income'?'Ingreso':'Egreso'} registrado exitosamente`, 'success');
  } catch(err) {
    showToast('Error al guardar. Intenta de nuevo.', 'error');
    console.error(err);
  } finally {
    btn.disabled = false;
  }
}

async function handleGoalSubmit(e) {
  e.preventDefault();
  const name     = document.getElementById('goal-name').value.trim();
  const target   = parseFloat(document.getElementById('goal-target').value);
  const deadline = document.getElementById('goal-deadline').value;

  if (!name)           { showToast('Ingresa un nombre para la meta','error'); return; }
  if (!target||target<=0) { showToast('Ingresa un monto objetivo válido','error'); return; }

  try {
    await goalsCol().add({
      name, target, current: 0,
      deadline: deadline || null,
      icon: state.selectedGoalIcon,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    closeGoalModal();
    showToast('¡Meta de ahorro creada!', 'success');
  } catch(err) {
    showToast('Error al crear meta.', 'error');
  }
}

async function handleSavingsSubmit(e) {
  e.preventDefault();
  const amount = parseFloat(document.getElementById('savings-amount').value);
  const goalId = document.getElementById('savings-goal-id').value;

  if (!amount||amount<=0) { showToast('Ingresa un monto válido','error'); return; }

  const goal = state.goals.find(g=>g.id===goalId);
  if (!goal) return;

  const newCurrent = Math.min(goal.target, goal.current + amount);
  try {
    await goalsCol().doc(goalId).update({ current: newCurrent });
    closeSavingsModal();
    if (newCurrent >= goal.target) showToast(`🎉 ¡Alcanzaste tu meta "${goal.name}"!`, 'success');
    else showToast(`Ahorro agregado a "${goal.name}"`, 'success');
  } catch(err) {
    showToast('Error al actualizar la meta.', 'error');
  }
}

// =============================================
// SIDEBAR TOGGLE
// =============================================
function setupSidebar() {
  const sidebar = document.getElementById('sidebar');
  const main    = document.getElementById('main-content');
  document.getElementById('menu-toggle').addEventListener('click', () => {
    if (window.innerWidth <= 768) sidebar.classList.toggle('mobile-open');
    else {
      sidebar.classList.toggle('collapsed');
      main.classList.toggle('sidebar-collapsed');
    }
  });
}

// =============================================
// FILTERS
// =============================================
function setupFilters() {
  document.getElementById('filter-type').addEventListener('change', e => {
    state.filters.type = e.target.value; renderTransactions();
  });
  document.getElementById('filter-category').addEventListener('change', e => {
    state.filters.category = e.target.value; renderTransactions();
  });
  document.getElementById('filter-month').addEventListener('change', e => {
    state.filters.month = e.target.value; renderTransactions();
  });
  document.getElementById('btn-clear-filters').addEventListener('click', () => {
    state.filters = { type:'all', category:'all', month:getCurrentMonthKey() };
    renderTransactions();
  });
}

// =============================================
// INIT
// =============================================
function init() {
  setupAuthForms();
  setupSidebar();
  setupFilters();
  setupModalOverlayClose();

  // Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => { e.preventDefault(); navigateTo(item.dataset.page); });
  });
  document.getElementById('link-all-transactions')?.addEventListener('click', e => {
    e.preventDefault(); navigateTo('transactions');
  });

  // Topbar + Modals
  document.getElementById('btn-add-transaction').addEventListener('click', openTransactionModal);
  document.getElementById('btn-add-goal').addEventListener('click', openGoalModal);
  document.getElementById('close-transaction-modal').addEventListener('click', closeTransactionModal);
  document.getElementById('cancel-transaction-modal').addEventListener('click', closeTransactionModal);
  document.getElementById('close-goal-modal').addEventListener('click', closeGoalModal);
  document.getElementById('cancel-goal-modal').addEventListener('click', closeGoalModal);
  document.getElementById('close-savings-modal').addEventListener('click', closeSavingsModal);
  document.getElementById('cancel-savings-modal').addEventListener('click', closeSavingsModal);

  // Type toggles
  document.getElementById('toggle-income').addEventListener('click',  () => setTransactionType('income'));
  document.getElementById('toggle-expense').addEventListener('click', () => setTransactionType('expense'));

  // Form submits
  document.getElementById('transaction-form').addEventListener('submit', handleTransactionSubmit);
  document.getElementById('goal-form').addEventListener('submit', handleGoalSubmit);
  document.getElementById('savings-form').addEventListener('submit', handleSavingsSubmit);

  // Keyboard ESC
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      ['modal-transaction','modal-goal','modal-add-savings'].forEach(id =>
        document.getElementById(id).classList.remove('open')
      );
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
