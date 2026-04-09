/* =============================================
   FINANZAPP — JAVASCRIPT APPLICATION
   ============================================= */

'use strict';

// =============================================
// CONSTANTS & CONFIG
// =============================================

const CATEGORIES = {
  income: [
    { id: 'salary',     label: 'Salario',       icon: '💼' },
    { id: 'freelance',  label: 'Freelance',      icon: '💻' },
    { id: 'investment', label: 'Inversiones',    icon: '📈' },
    { id: 'gift',       label: 'Regalos',        icon: '🎁' },
    { id: 'other',      label: 'Otro ingreso',   icon: '💰' },
  ],
  expense: [
    { id: 'food',       label: 'Comida',         icon: '🍔' },
    { id: 'transport',  label: 'Transporte',     icon: '🚌' },
    { id: 'housing',    label: 'Vivienda',       icon: '🏠' },
    { id: 'health',     label: 'Salud',          icon: '❤️' },
    { id: 'education',  label: 'Educación',      icon: '📚' },
    { id: 'entertain',  label: 'Entretenimiento',icon: '🎮' },
    { id: 'clothing',   label: 'Ropa',           icon: '👗' },
    { id: 'bills',      label: 'Servicios',      icon: '💡' },
    { id: 'other',      label: 'Otro gasto',     icon: '🧾' },
  ],
};

const GOAL_ICONS = ['🎯','✈️','🏠','🚗','💻','📱','🎓','💍','🏖️','🎸','🐶','👶','💪','🌍','⛵','🏋️'];

const CATEGORY_COLORS = [
  '#00d4aa','#a78bfa','#60a5fa','#f87171','#fbbf24','#34d399','#fb923c','#e879f9','#38bdf8'
];

// =============================================
// STATE MANAGEMENT
// =============================================

let state = {
  transactions: [],
  goals: [],
  filters: { type: 'all', category: 'all', month: '' },
  selectedGoalIcon: GOAL_ICONS[0],
  currentTransactionType: 'income',
};

function loadState() {
  try {
    const tx = localStorage.getItem('finanzapp_transactions');
    const gl = localStorage.getItem('finanzapp_goals');
    if (tx) state.transactions = JSON.parse(tx);
    if (gl) state.goals = JSON.parse(gl);
  } catch (e) {
    console.error('Error loading state:', e);
  }
}

function saveTransactions() {
  localStorage.setItem('finanzapp_transactions', JSON.stringify(state.transactions));
}

function saveGoals() {
  localStorage.setItem('finanzapp_goals', JSON.stringify(state.goals));
}

// =============================================
// UTILITIES
// =============================================

function formatCurrency(amount) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(key) {
  const [year, month] = key.split('-').map(Number);
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
}

function getTxDateMonth(tx) {
  return tx.date.substring(0, 7);
}

function getCategoryInfo(type, categoryId) {
  const list = CATEGORIES[type] || [];
  return list.find(c => c.id === categoryId) || { label: categoryId, icon: '🧾' };
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
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

const pages = { dashboard: null, transactions: null, savings: null };

function navigateTo(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const page = document.getElementById(`page-${pageId}`);
  const navItem = document.getElementById(`nav-${pageId}`);
  if (page) page.classList.add('active');
  if (navItem) navItem.classList.add('active');

  const titles = { dashboard: 'Dashboard', transactions: 'Transacciones', savings: 'Metas de Ahorro' };
  document.getElementById('topbar-title').textContent = titles[pageId] || pageId;

  // On mobile, close sidebar
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('mobile-open');
  }

  // Render page content
  if (pageId === 'dashboard') renderDashboard();
  if (pageId === 'transactions') renderTransactions();
  if (pageId === 'savings') renderGoals();
}

// =============================================
// DASHBOARD
// =============================================

let chartDonut = null;
let chartBar   = null;

function renderDashboard() {
  const now = new Date();
  const currMonthKey = getCurrentMonthKey();

  // This month transactions
  const monthTx = state.transactions.filter(tx => getTxDateMonth(tx) === currMonthKey);
  const monthIncome  = monthTx.filter(tx => tx.type === 'income').reduce((s, tx) => s + tx.amount, 0);
  const monthExpense = monthTx.filter(tx => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0);

  // All time balance
  const totalIncome  = state.transactions.filter(tx => tx.type === 'income').reduce((s, tx) => s + tx.amount, 0);
  const totalExpense = state.transactions.filter(tx => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0);
  const balance      = totalIncome - totalExpense;
  const totalSavings = state.goals.reduce((s, g) => s + g.current, 0);

  // Update KPIs
  document.getElementById('kpi-balance').textContent  = formatCurrency(balance);
  document.getElementById('kpi-income').textContent   = formatCurrency(monthIncome);
  document.getElementById('kpi-expense').textContent  = formatCurrency(monthExpense);
  document.getElementById('kpi-savings').textContent  = formatCurrency(totalSavings);
  document.getElementById('dashboard-month-label').textContent =
    `${now.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })} · Balance total acumulado`;

  // Balance badge
  const badge = document.getElementById('kpi-balance-badge');
  if (balance >= 0) {
    badge.textContent = '▲ Positivo';
    badge.style.cssText = 'background:rgba(52,211,153,0.15);color:#34d399;';
  } else {
    badge.textContent = '▼ Negativo';
    badge.style.cssText = 'background:rgba(248,113,113,0.15);color:#f87171;';
  }

  renderDonutChart(monthTx);
  renderBarChart();
  renderRecentTransactions();
}

function renderDonutChart(monthTx) {
  const expenses = monthTx.filter(tx => tx.type === 'expense');
  const totalExpense = expenses.reduce((s, tx) => s + tx.amount, 0);

  // Group by category
  const catMap = {};
  expenses.forEach(tx => {
    catMap[tx.category] = (catMap[tx.category] || 0) + tx.amount;
  });

  const labels = Object.keys(catMap).map(id => {
    const info = getCategoryInfo('expense', id);
    return `${info.icon} ${info.label}`;
  });
  const data = Object.values(catMap);

  document.getElementById('chart-donut-center').querySelector('.center-amount').textContent =
    formatCurrency(totalExpense);

  const ctx = document.getElementById('chart-donut').getContext('2d');
  if (chartDonut) chartDonut.destroy();

  if (data.length === 0) {
    chartDonut = null;
    return;
  }

  chartDonut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: CATEGORY_COLORS.slice(0, data.length),
        borderColor: 'transparent',
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#94a3b8',
            font: { family: 'Inter', size: 11 },
            padding: 10,
            boxWidth: 10,
            boxHeight: 10,
          },
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${formatCurrency(ctx.raw)} (${((ctx.raw / totalExpense) * 100).toFixed(1)}%)`,
          },
          backgroundColor: '#1c2540',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          titleColor: '#e2e8f0',
          bodyColor: '#94a3b8',
        },
      },
    },
  });
}

function renderBarChart() {
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({
      key,
      label: d.toLocaleDateString('es-CO', { month: 'short' }),
    });
  }

  const incomeData  = months.map(m => state.transactions
    .filter(tx => tx.type === 'income' && getTxDateMonth(tx) === m.key)
    .reduce((s, tx) => s + tx.amount, 0));
  const expenseData = months.map(m => state.transactions
    .filter(tx => tx.type === 'expense' && getTxDateMonth(tx) === m.key)
    .reduce((s, tx) => s + tx.amount, 0));

  const ctx = document.getElementById('chart-bar').getContext('2d');
  if (chartBar) chartBar.destroy();

  chartBar = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months.map(m => m.label),
      datasets: [
        {
          label: 'Ingresos',
          data: incomeData,
          backgroundColor: 'rgba(52,211,153,0.7)',
          borderColor: '#34d399',
          borderWidth: 0,
          borderRadius: 6,
          borderSkipped: false,
        },
        {
          label: 'Egresos',
          data: expenseData,
          backgroundColor: 'rgba(248,113,113,0.7)',
          borderColor: '#f87171',
          borderWidth: 0,
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: {
            color: '#94a3b8',
            font: { family: 'Inter', size: 11 },
            boxWidth: 10,
            boxHeight: 10,
          },
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`,
          },
          backgroundColor: '#1c2540',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          titleColor: '#e2e8f0',
          bodyColor: '#94a3b8',
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#94a3b8', font: { family: 'Inter', size: 11 } },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#94a3b8',
            font: { family: 'Inter', size: 11 },
            callback: v => formatCurrency(v),
          },
        },
      },
    },
  });
}

function renderRecentTransactions() {
  const list = document.getElementById('recent-list');
  const recent = [...state.transactions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  if (recent.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-receipt"></i>
        <p>No hay transacciones aún. ¡Agrega una!</p>
      </div>`;
    return;
  }

  list.innerHTML = recent.map(tx => {
    const cat = getCategoryInfo(tx.type, tx.category);
    const sign = tx.type === 'income' ? '+' : '-';
    return `
      <div class="recent-item">
        <div class="tx-icon ${tx.type}">${cat.icon}</div>
        <div class="tx-info">
          <div class="tx-desc">${tx.description || cat.label}</div>
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
  const allCats = [...CATEGORIES.income, ...CATEGORIES.expense];
  const unique = [];
  const seen = new Set();
  allCats.forEach(c => {
    if (!seen.has(c.id)) { seen.add(c.id); unique.push(c); }
  });
  sel.innerHTML = `<option value="all">Todas</option>` +
    unique.map(c => `<option value="${c.id}">${c.icon} ${c.label}</option>`).join('');
}

function getFilteredTransactions() {
  return state.transactions.filter(tx => {
    const { type, category, month } = state.filters;
    if (type !== 'all' && tx.type !== type) return false;
    if (category !== 'all' && tx.category !== category) return false;
    if (month && getTxDateMonth(tx) !== month) return false;
    return true;
  });
}

function renderTransactions() {
  populateCategoryFilter();
  const filtered = getFilteredTransactions();
  const tbody = document.getElementById('transactions-tbody');

  const income  = filtered.filter(tx => tx.type === 'income').reduce((s, tx) => s + tx.amount, 0);
  const expense = filtered.filter(tx => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0);
  const balance = income - expense;

  document.getElementById('filtered-income').textContent  = formatCurrency(income);
  document.getElementById('filtered-expense').textContent = formatCurrency(expense);
  const balEl = document.getElementById('filtered-balance');
  balEl.textContent = formatCurrency(balance);
  balEl.style.color = balance >= 0 ? 'var(--accent-income)' : 'var(--accent-expense)';

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-row">
          <div class="empty-state">
            <i class="fa-solid fa-receipt"></i>
            <p>No hay transacciones para estos filtros</p>
          </div>
        </td>
      </tr>`;
    return;
  }

  const sorted = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));
  tbody.innerHTML = sorted.map(tx => {
    const cat = getCategoryInfo(tx.type, tx.category);
    const sign = tx.type === 'income' ? '+' : '-';
    return `
      <tr>
        <td>${formatDate(tx.date)}</td>
        <td>${tx.description || cat.label}</td>
        <td><span class="badge category">${cat.icon} ${cat.label}</span></td>
        <td>
          <span class="badge ${tx.type}">
            ${tx.type === 'income' ? '▲ Ingreso' : '▼ Egreso'}
          </span>
        </td>
        <td class="text-right">
          <span class="tx-amount ${tx.type}">${sign}${formatCurrency(tx.amount)}</span>
        </td>
        <td>
          <button class="btn-icon" onclick="deleteTransaction('${tx.id}')" title="Eliminar">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      </tr>`;
  }).join('');

  // Sync filter dropdowns
  const ft = document.getElementById('filter-type');
  const fc = document.getElementById('filter-category');
  const fm = document.getElementById('filter-month');
  ft.value = state.filters.type;
  fc.value = state.filters.category;
  fm.value = state.filters.month;
}

function deleteTransaction(id) {
  state.transactions = state.transactions.filter(tx => tx.id !== id);
  saveTransactions();
  renderTransactions();
  showToast('Transacción eliminada', 'success');
}

// =============================================
// SAVINGS GOALS
// =============================================

function renderGoals() {
  const grid = document.getElementById('goals-grid');
  if (state.goals.length === 0) {
    grid.innerHTML = `
      <div class="empty-state full-width">
        <i class="fa-solid fa-piggy-bank" style="font-size:48px;opacity:0.3"></i>
        <p>No tienes metas de ahorro aún</p>
        <button class="btn-primary" onclick="openGoalModal()">
          <i class="fa-solid fa-plus"></i> Crear mi primera meta
        </button>
      </div>`;
    return;
  }

  grid.innerHTML = state.goals.map(goal => {
    const pct = Math.min(100, goal.target > 0 ? (goal.current / goal.target) * 100 : 0);
    const done = pct >= 100;
    const deadlineStr = goal.deadline
      ? `Meta: ${formatDate(goal.deadline)}`
      : 'Sin fecha límite';

    const daysLeft = goal.deadline
      ? Math.ceil((new Date(goal.deadline) - new Date()) / 86400000)
      : null;

    let deadlineBadge = '';
    if (daysLeft !== null && !done) {
      if (daysLeft < 0) deadlineBadge = `<span style="color:var(--accent-expense);font-size:11px">⚠️ Venció</span>`;
      else if (daysLeft <= 7) deadlineBadge = `<span style="color:var(--accent-expense);font-size:11px">⏰ ${daysLeft} días</span>`;
    }

    return `
      <div class="goal-card ${done ? 'completed' : ''}" id="goal-${goal.id}">
        <div class="goal-header">
          <div class="goal-icon-wrap">${goal.icon}</div>
          <div class="goal-title-wrap">
            <div class="goal-name">${escapeHtml(goal.name)}</div>
            <div class="goal-deadline">${deadlineStr} ${deadlineBadge}</div>
            ${done ? '<div class="goal-completed-badge">✅ ¡Meta alcanzada!</div>' : ''}
          </div>
        </div>
        <div class="goal-amounts">
          <div>
            <div class="goal-current">${formatCurrency(goal.current)}</div>
            <div style="font-size:11px;color:var(--text-secondary)">Ahorrado</div>
          </div>
          <div>
            <div class="goal-target-label">Objetivo</div>
            <div class="goal-target-value">${formatCurrency(goal.target)}</div>
          </div>
        </div>
        <div class="goal-progress-bar">
          <div class="goal-progress-fill ${done ? 'done' : ''}" style="width:${pct}%"></div>
        </div>
        <div class="goal-percent">${pct.toFixed(1)}% completado · Faltan ${formatCurrency(Math.max(0, goal.target - goal.current))}</div>
        <div class="goal-actions">
          ${!done ? `<button class="btn-secondary btn-add-savings" onclick="openSavingsModal('${goal.id}')">
            <i class="fa-solid fa-plus"></i> Agregar ahorro
          </button>` : ''}
          <button class="btn-icon" onclick="deleteGoal('${goal.id}')" title="Eliminar meta">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>`;
  }).join('');
}

function deleteGoal(id) {
  state.goals = state.goals.filter(g => g.id !== id);
  saveGoals();
  renderGoals();
  showToast('Meta eliminada', 'success');
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// =============================================
// MODALS
// =============================================

// --- Transaction Modal ---
function openTransactionModal() {
  // Reset form
  document.getElementById('tx-amount').value       = '';
  document.getElementById('tx-description').value  = '';
  document.getElementById('tx-date').value          = new Date().toISOString().split('T')[0];
  setTransactionType('income');
  document.getElementById('modal-transaction').classList.add('open');
}

function closeTransactionModal() {
  document.getElementById('modal-transaction').classList.remove('open');
}

function setTransactionType(type) {
  state.currentTransactionType = type;
  document.getElementById('toggle-income').classList.toggle('active', type === 'income');
  document.getElementById('toggle-expense').classList.toggle('active', type === 'expense');

  const catSel = document.getElementById('tx-category');
  const categories = CATEGORIES[type] || [];
  catSel.innerHTML = `<option value="" disabled selected>Selecciona una categoría</option>` +
    categories.map(c => `<option value="${c.id}">${c.icon} ${c.label}</option>`).join('');
}

// --- Goal Modal ---
function openGoalModal() {
  document.getElementById('goal-name').value     = '';
  document.getElementById('goal-target').value   = '';
  document.getElementById('goal-deadline').value = '';
  state.selectedGoalIcon = GOAL_ICONS[0];
  renderIconPicker();
  document.getElementById('modal-goal').classList.add('open');
}

function closeGoalModal() {
  document.getElementById('modal-goal').classList.remove('open');
}

function renderIconPicker() {
  const picker = document.getElementById('icon-picker');
  picker.innerHTML = GOAL_ICONS.map(ic => `
    <div class="icon-option ${ic === state.selectedGoalIcon ? 'selected' : ''}"
         onclick="selectIcon('${ic}')" title="${ic}">${ic}</div>
  `).join('');
}

function selectIcon(icon) {
  state.selectedGoalIcon = icon;
  renderIconPicker();
}

// --- Savings Modal ---
function openSavingsModal(goalId) {
  const goal = state.goals.find(g => g.id === goalId);
  if (!goal) return;
  document.getElementById('savings-goal-name').textContent =
    `Agregar dinero a: ${goal.name}`;
  document.getElementById('savings-goal-id').value = goalId;
  document.getElementById('savings-amount').value  = '';
  document.getElementById('modal-add-savings').classList.add('open');
}

function closeSavingsModal() {
  document.getElementById('modal-add-savings').classList.remove('open');
}

// Close modal on overlay click
function setupModalOverlayClose() {
  ['modal-transaction','modal-goal','modal-add-savings'].forEach(id => {
    document.getElementById(id).addEventListener('click', e => {
      if (e.target.id === id) {
        document.getElementById(id).classList.remove('open');
      }
    });
  });
}

// =============================================
// FORM HANDLERS
// =============================================

function handleTransactionSubmit(e) {
  e.preventDefault();
  const amount = parseFloat(document.getElementById('tx-amount').value);
  const date   = document.getElementById('tx-date').value;
  const cat    = document.getElementById('tx-category').value;
  const desc   = document.getElementById('tx-description').value.trim();

  if (!amount || amount <= 0) { showToast('Ingresa un monto válido', 'error'); return; }
  if (!date)   { showToast('Selecciona una fecha', 'error'); return; }
  if (!cat)    { showToast('Selecciona una categoría', 'error'); return; }

  const tx = {
    id: generateId(),
    type: state.currentTransactionType,
    amount,
    date,
    category: cat,
    description: desc,
    createdAt: new Date().toISOString(),
  };

  state.transactions.push(tx);
  saveTransactions();
  closeTransactionModal();
  showToast(`${tx.type === 'income' ? 'Ingreso' : 'Egreso'} registrado exitosamente`, 'success');
  renderDashboard();
}

function handleGoalSubmit(e) {
  e.preventDefault();
  const name     = document.getElementById('goal-name').value.trim();
  const target   = parseFloat(document.getElementById('goal-target').value);
  const deadline = document.getElementById('goal-deadline').value;

  if (!name)             { showToast('Ingresa un nombre para la meta', 'error'); return; }
  if (!target || target <= 0) { showToast('Ingresa un monto objetivo válido', 'error'); return; }

  const goal = {
    id: generateId(),
    name,
    target,
    current: 0,
    deadline: deadline || null,
    icon: state.selectedGoalIcon,
    createdAt: new Date().toISOString(),
  };

  state.goals.push(goal);
  saveGoals();
  closeGoalModal();
  renderGoals();
  showToast('¡Meta de ahorro creada!', 'success');
}

function handleSavingsSubmit(e) {
  e.preventDefault();
  const amount = parseFloat(document.getElementById('savings-amount').value);
  const goalId = document.getElementById('savings-goal-id').value;

  if (!amount || amount <= 0) { showToast('Ingresa un monto válido', 'error'); return; }

  const goal = state.goals.find(g => g.id === goalId);
  if (!goal) return;

  goal.current = Math.min(goal.target, goal.current + amount);
  saveGoals();
  closeSavingsModal();
  renderGoals();

  if (goal.current >= goal.target) {
    showToast(`🎉 ¡Alcanzaste tu meta "${goal.name}"!`, 'success');
  } else {
    showToast(`Ahorro agregado a "${goal.name}"`, 'success');
  }
}

// =============================================
// SIDEBAR TOGGLE
// =============================================

function setupSidebar() {
  const sidebar = document.getElementById('sidebar');
  const main    = document.getElementById('main-content');
  const toggle  = document.getElementById('menu-toggle');

  toggle.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
      sidebar.classList.toggle('mobile-open');
    } else {
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
    state.filters.type = e.target.value;
    renderTransactions();
  });
  document.getElementById('filter-category').addEventListener('change', e => {
    state.filters.category = e.target.value;
    renderTransactions();
  });
  document.getElementById('filter-month').addEventListener('change', e => {
    state.filters.month = e.target.value;
    renderTransactions();
  });
  document.getElementById('btn-clear-filters').addEventListener('click', () => {
    state.filters = { type: 'all', category: 'all', month: '' };
    renderTransactions();
  });
}

// =============================================
// INIT
// =============================================

function init() {
  loadState();

  // Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(item.dataset.page);
    });
  });

  document.getElementById('link-all-transactions').addEventListener('click', e => {
    e.preventDefault();
    navigateTo('transactions');
  });

  // Topbar add button
  document.getElementById('btn-add-transaction').addEventListener('click', openTransactionModal);

  // Savings page button
  document.getElementById('btn-add-goal').addEventListener('click', openGoalModal);

  // Sidebar
  setupSidebar();

  // Filters
  setupFilters();

  // Modal close buttons
  document.getElementById('close-transaction-modal').addEventListener('click', closeTransactionModal);
  document.getElementById('cancel-transaction-modal').addEventListener('click', closeTransactionModal);
  document.getElementById('close-goal-modal').addEventListener('click', closeGoalModal);
  document.getElementById('cancel-goal-modal').addEventListener('click', closeGoalModal);
  document.getElementById('close-savings-modal').addEventListener('click', closeSavingsModal);
  document.getElementById('cancel-savings-modal').addEventListener('click', closeSavingsModal);
  setupModalOverlayClose();

  // Type toggles
  document.getElementById('toggle-income').addEventListener('click', () => setTransactionType('income'));
  document.getElementById('toggle-expense').addEventListener('click', () => setTransactionType('expense'));

  // Form submits
  document.getElementById('transaction-form').addEventListener('submit', handleTransactionSubmit);
  document.getElementById('goal-form').addEventListener('submit', handleGoalSubmit);
  document.getElementById('savings-form').addEventListener('submit', handleSavingsSubmit);

  // Keyboard close
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      ['modal-transaction','modal-goal','modal-add-savings'].forEach(id => {
        document.getElementById(id).classList.remove('open');
      });
    }
  });

  // Set default month filter to current month
  document.getElementById('filter-month').value = getCurrentMonthKey();

  // Initial render
  navigateTo('dashboard');
}

document.addEventListener('DOMContentLoaded', init);
