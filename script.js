// Get DOM elements
const expenseForm = document.getElementById('expenseForm');
const incomeForm = document.getElementById('incomeForm');
const expDateInput = document.getElementById('expDate');
const expDescriptionInput = document.getElementById('expDescription');
const expSourceInput = document.getElementById('expSource');
const expCategoryInput = document.getElementById('expCategory');
const expAmountInput = document.getElementById('expAmount');
const incDateInput = document.getElementById('incDate');
const incDescriptionInput = document.getElementById('incDescription');
const incSourceInput = document.getElementById('incSource');
const incAmountInput = document.getElementById('incAmount');
const expensesList = document.getElementById('expensesList');
const filterCategory = document.getElementById('filterCategory');
const filterDate = document.getElementById('filterDate');
const clearDateFilterBtn = document.getElementById('clearDateFilter');
const filterSummary = document.getElementById('filterSummary');
const filterSummaryText = document.getElementById('filterSummaryText');
const filterSummaryAmount = document.getElementById('filterSummaryAmount');
const clearAllBtn = document.getElementById('clearAll');
const totalAmountEl = document.getElementById('totalAmount');
const todayAmountEl = document.getElementById('todayAmount');
const monthAmountEl = document.getElementById('monthAmount');
const entryCountEl = document.getElementById('entryCount');

// Monthly view elements
const monthlyTotalAmountEl = document.getElementById('monthlyTotalAmount');
const dailyAvgAmountEl = document.getElementById('dailyAvgAmount');
const categoryChartEl = document.getElementById('categoryChart');
const monthlyExpensesListEl = document.getElementById('monthlyExpensesList');
const currentMonthLabelEl = document.getElementById('currentMonthLabel');
const prevMonthBtn = document.getElementById('prevMonth');
const nextMonthBtn = document.getElementById('nextMonth');

// Tab elements
const tabBtns = document.querySelectorAll('.tab-btn');
const dailyTab = document.getElementById('dailyTab');
const monthlyTab = document.getElementById('monthlyTab');

// Category labels mapping
const categoryLabels = {
    food: '🍔 Food & Dining',
    transport: '🚗 Transportation',
    shopping: '🛍️ Shopping',
    entertainment: '🎬 Entertainment',
    bills: '📄 Bills & Utilities',
    health: '💊 Health',
    education: '📚 Education',
    other: '📦 Other'
};

// Category colors
const categoryColors = {
    food: '#ff6b6b',
    transport: '#4ecdc4',
    shopping: '#ffe66d',
    entertainment: '#95e1d3',
    bills: '#a8d8ea',
    health: '#ff8b94',
    education: '#dcd6f7',
    other: '#c9ccd5'
};

// Database setup
const DB_NAME = 'ExpenseTrackerDB';
const DB_VERSION = 2;
const STORE_NAME = 'expenses';
let db = null;
let expenses = [];
let currentViewMonth = new Date();
let users = [];
let currentUserId = null;

// Initialize IndexedDB
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => {
            console.error('Database error:', request.error);
            showDBStatus('Database Error', true);
            reject(request.error);
        };
        
        request.onsuccess = () => {
            db = request.result;
            showDBStatus('Database Connected');
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('date', 'date', { unique: false });
                store.createIndex('category', 'category', { unique: false });
                store.createIndex('month', 'month', { unique: false });
                store.createIndex('userId', 'userId', { unique: false });
            } else {
                // if store exists (upgrade path), try to add index if missing
                const store = event.target.transaction.objectStore(STORE_NAME);
                try {
                    if (!store.indexNames.contains('userId')) {
                        store.createIndex('userId', 'userId', { unique: false });
                    }
                } catch (err) {
                    // ignore if cannot create (older browsers)
                }
            }
        };
    });
}

// Show database status
function showDBStatus(message, isError = false) {
    let statusEl = document.querySelector('.db-status');
    if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.className = 'db-status';
        document.body.appendChild(statusEl);
    }
    
    statusEl.innerHTML = `<span class="dot"></span>${message}`;
    statusEl.classList.toggle('error', isError);
    
    setTimeout(() => {
        statusEl.style.opacity = '0';
        setTimeout(() => statusEl.remove(), 300);
    }, 3000);
}

// User management (local only)
function loadUsersFromStorage() {
    const raw = localStorage.getItem('users');
    users = raw ? JSON.parse(raw) : [];
    if (!users || users.length === 0) {
        const defaultUser = { id: 'default', name: 'Default' };
        users = [defaultUser];
        localStorage.setItem('users', JSON.stringify(users));
    }
    const saved = localStorage.getItem('currentUserId');
    currentUserId = saved || users[0].id;
}

function saveUsersToStorage() {
    localStorage.setItem('users', JSON.stringify(users));
    localStorage.setItem('currentUserId', currentUserId);
}

function populateUserSelect() {
    const sel = document.getElementById('userSelect');
    if (!sel) return;
    sel.innerHTML = users.map(u => `<option value="${u.id}">${escapeHtml(u.name)}</option>`).join('');
    sel.value = currentUserId;
}

function addUser() {
    const name = prompt('Enter new user name');
    if (!name) return;
    const id = 'user_' + generateId();
    users.push({ id, name: name.trim() });
    currentUserId = id;
    saveUsersToStorage();
    populateUserSelect();
    refreshViewForUser();
}

function refreshViewForUser() {
    // ensure currentUserId set
    if (!currentUserId && users.length) currentUserId = users[0].id;
    updateSummary();
    applyFilters();
    updateMonthlyView();
}

// Load all expenses from database
async function loadExpenses() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        
        request.onsuccess = () => {
            expenses = request.result || [];
            resolve(expenses);
        };
        
        request.onerror = () => {
            reject(request.error);
        };
    });
}

// Upsert (put) an expense to DB
async function upsertExpenseToDB(expense) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(expense);

        request.onsuccess = () => {
            resolve();
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

// Clear only current user's entries from DB
async function clearAllUserFromDB(userId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.openCursor();
        request.onsuccess = async (e) => {
            const cursor = e.target.result;
            if (cursor) {
                const rec = cursor.value;
                if (rec.userId === userId) {
                    cursor.delete();
                }
                cursor.continue();
            } else {
                resolve();
            }
        };
        request.onerror = () => reject(request.error);
    });
}

// Save expense to database
async function saveExpenseToDB(expense) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add(expense);
        
        request.onsuccess = () => {
            showDBStatus('Expense Saved');
            resolve();
        };
        
        request.onerror = () => {
            showDBStatus('Save Failed', true);
            reject(request.error);
        };
    });
}

// Delete expense from database
async function deleteExpenseFromDB(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);
        
        request.onsuccess = () => {
            showDBStatus('Expense Deleted');
            resolve();
        };
        
        request.onerror = () => {
            reject(request.error);
        };
    });
}

// Clear all expenses from database
async function clearAllFromDB() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();
        
        request.onsuccess = () => {
            showDBStatus('All Data Cleared');
            resolve();
        };
        
        request.onerror = () => {
            reject(request.error);
        };
    });
}

// Set default date to today
function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    expDateInput.value = today;
    incDateInput.value = today;
}

// Generate unique ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Get month key from date (YYYY-MM format)
function getMonthKey(dateString) {
    return dateString.substring(0, 7);
}

// Format currency
function formatCurrency(amount) {
    return 'Rs. ' + amount.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Escape text before placing it into HTML templates
function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Resolve a safe category label for display
function getCategoryLabel(category) {
    return categoryLabels[category] || categoryLabels.other;
}

// Format date for display
function formatDate(dateString) {
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

// Calculate and update summary
function updateSummary() {
    // Only count current user's records
    const userExpenses = expenses.filter(e => e.userId === currentUserId);

    const totalExpenses = userExpenses
        .filter(e => e.type !== 'income')
        .reduce((sum, expense) => sum + expense.amount, 0);

    const totalIncome = userExpenses
        .filter(e => e.type === 'income')
        .reduce((sum, expense) => sum + expense.amount, 0);

    const today = new Date().toISOString().split('T')[0];
    const todayExpenses = userExpenses
        .filter(expense => expense.date === today && expense.type !== 'income')
        .reduce((sum, expense) => sum + expense.amount, 0);

    const currentMonth = getMonthKey(today);
    const monthExpenses = userExpenses
        .filter(expense => expense.month === currentMonth && expense.type !== 'income')
        .reduce((sum, expense) => sum + expense.amount, 0);

    totalAmountEl.textContent = formatCurrency(totalExpenses);
    const totalIncomeElLocal = document.getElementById('totalIncome');
    if (totalIncomeElLocal) totalIncomeElLocal.textContent = formatCurrency(totalIncome);
    const balanceElLocal = document.getElementById('balance');
    if (balanceElLocal) balanceElLocal.textContent = formatCurrency(totalIncome - totalExpenses);
    if (todayAmountEl) todayAmountEl.textContent = formatCurrency(todayExpenses);
    if (monthAmountEl) monthAmountEl.textContent = formatCurrency(monthExpenses);
    entryCountEl.textContent = userExpenses.length;

    // Show/hide clear all button
    clearAllBtn.classList.toggle('is-hidden', userExpenses.length === 0);
}

// Render expenses list
function renderExpenses(categoryFilter = 'all', dateFilter = null) {
    let filteredExpenses = expenses.filter(e => e.userId === currentUserId && e.type !== 'income');
    
    // Apply category filter
    if (categoryFilter !== 'all') {
        filteredExpenses = filteredExpenses.filter(expense => expense.category === categoryFilter);
    }
    
    // Apply date filter
    if (dateFilter) {
        filteredExpenses = filteredExpenses.filter(expense => expense.date === dateFilter);
    }
    
    // Sort by date (newest first)
    filteredExpenses.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Update filter summary
    if (dateFilter) {
        const totalForDate = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        filterSummary.classList.remove('is-hidden');
        filterSummaryText.textContent = `Showing expenses for ${formatDate(dateFilter)}`;
        filterSummaryAmount.textContent = `Total: ${formatCurrency(totalForDate)}`;
    } else {
        filterSummary.classList.add('is-hidden');
    }
    
    if (filteredExpenses.length === 0) {
        const message = dateFilter 
            ? `No expenses found for ${formatDate(dateFilter)}` 
            : 'No expenses found. Start adding your expenses!';
        expensesList.innerHTML = `<p class="empty-message">${escapeHtml(message)}</p>`;
        return;
    }
    
    expensesList.innerHTML = filteredExpenses.map(expense => `
        <div class="expense-item" data-id="${expense.id}">
            <div class="expense-info">
                <div class="description">
                    ${escapeHtml(expense.description)}
                    <span class="category-badge">${escapeHtml(getCategoryLabel(expense.category))}</span>
                </div>
                <div class="source">Source: ${escapeHtml(expense.source || 'Not specified')}</div>
                <div class="details">${formatDate(expense.date)} • ${escapeHtml(expense.type || 'expense')}</div>
            </div>
            <div class="expense-amount ${expense.type === 'income' ? 'income-amount' : ''}">${formatCurrency(expense.amount)}</div>
            <button class="btn-delete" onclick="deleteExpense('${expense.id}')" title="Delete">×</button>
        </div>
    `).join('');
}

// Apply filters
function applyFilters() {
    const categoryFilter = filterCategory.value;
    const dateFilter = filterDate.value || null;
    renderExpenses(categoryFilter, dateFilter);
}

// Clear date filter
function clearDateFilter() {
    filterDate.value = '';
    applyFilters();
}

// Add new expense
async function addExpense(e) {
    e.preventDefault();
    
    const expense = {
        id: generateId(),
        date: expDateInput.value,
        month: getMonthKey(expDateInput.value),
        description: expDescriptionInput.value.trim(),
        source: expSourceInput.value.trim(),
        category: expCategoryInput.value,
        amount: parseFloat(expAmountInput.value),
        type: 'expense',
        userId: currentUserId,
        createdAt: new Date().toISOString()
    };
    
    try {
        await saveExpenseToDB(expense);
        expenses.push(expense);
        updateSummary();
        applyFilters();
        updateMonthlyView();
        
        // Reset form
        expenseForm.reset();
        setDefaultDate();
        expDescriptionInput.focus();
    } catch (error) {
        console.error('Error saving expense:', error);
        alert('Failed to save expense. Please try again.');
    }
}

// Add new income
async function addIncome(e) {
    e.preventDefault();
    
    const income = {
        id: generateId(),
        date: incDateInput.value,
        month: getMonthKey(incDateInput.value),
        description: incDescriptionInput.value.trim(),
        source: incSourceInput.value.trim(),
        category: 'income',
        amount: parseFloat(incAmountInput.value),
        type: 'income',
        userId: currentUserId,
        createdAt: new Date().toISOString()
    };
    
    try {
        await saveExpenseToDB(income);
        expenses.push(income);
        updateSummary();
        applyFilters();
        updateMonthlyView();
        
        // Reset form
        incomeForm.reset();
        setDefaultDate();
        incDescriptionInput.focus();
    } catch (error) {
        console.error('Error saving income:', error);
        alert('Failed to save income. Please try again.');
    }
}
async function deleteExpense(id) {
    if (confirm('Are you sure you want to delete this expense?')) {
        try {
            await deleteExpenseFromDB(id);
            expenses = expenses.filter(expense => expense.id !== id);
            updateSummary();
            applyFilters();
            updateMonthlyView();
        } catch (error) {
            console.error('Error deleting expense:', error);
            alert('Failed to delete expense. Please try again.');
        }
    }
}

// Clear all expenses
async function clearAllExpenses() {
    if (confirm('Are you sure you want to delete ALL expenses? This cannot be undone.')) {
        try {
            await clearAllUserFromDB(currentUserId);
            expenses = expenses.filter(e => e.userId !== currentUserId);
            updateSummary();
            renderExpenses();
            updateMonthlyView();
        } catch (error) {
            console.error('Error clearing expenses:', error);
            alert('Failed to clear expenses. Please try again.');
        }
    }
}

// Tab switching
function switchTab(tabName) {
    tabBtns.forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    dailyTab.classList.remove('active');
    monthlyTab.classList.remove('active');
    
    if (tabName === 'daily') {
        dailyTab.classList.add('active');
    } else {
        monthlyTab.classList.add('active');
        updateMonthlyView();
    }
}

// Format month label
function formatMonthLabel(date) {
    const options = { month: 'long', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

// Update monthly view
function updateMonthlyView() {
    const monthKey = `${currentViewMonth.getFullYear()}-${String(currentViewMonth.getMonth() + 1).padStart(2, '0')}`;
    const monthEntries = expenses.filter(expense => expense.month === monthKey && expense.userId === currentUserId);
    const monthExpenses = monthEntries.filter(e => e.type !== 'income');
    
    // Update month label
    currentMonthLabelEl.textContent = formatMonthLabel(currentViewMonth);
    
    // Calculate totals
    const monthTotal = monthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const daysInMonth = new Date(currentViewMonth.getFullYear(), currentViewMonth.getMonth() + 1, 0).getDate();
    const dailyAvg = monthExpenses.length > 0 ? monthTotal / daysInMonth : 0;
    
    monthlyTotalAmountEl.textContent = formatCurrency(monthTotal);
    dailyAvgAmountEl.textContent = formatCurrency(dailyAvg);
    
    // Category breakdown
    renderCategoryChart(monthExpenses);
    
    // Monthly expenses list
    renderMonthlyExpensesList(monthExpenses);
}

// Render category chart
function renderCategoryChart(monthExpenses) {
    const categoryTotals = {};
    let maxTotal = 0;
    
    monthExpenses.forEach(expense => {
        categoryTotals[expense.category] = (categoryTotals[expense.category] || 0) + expense.amount;
        if (categoryTotals[expense.category] > maxTotal) {
            maxTotal = categoryTotals[expense.category];
        }
    });
    
    if (Object.keys(categoryTotals).length === 0) {
        categoryChartEl.innerHTML = '<p class="empty-message">No expenses this month</p>';
        return;
    }
    
    // Sort by amount
    const sortedCategories = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1]);
    
    categoryChartEl.innerHTML = sortedCategories.map(([category, amount]) => {
        const percentage = maxTotal > 0 ? (amount / maxTotal) * 100 : 0;
        return `
            <div class="category-bar">
                <span class="label">${escapeHtml(getCategoryLabel(category))}</span>
                <div class="bar-container">
                    <div class="bar" style="width: ${percentage}%; background: ${categoryColors[category]}"></div>
                </div>
                <span class="amount">${formatCurrency(amount)}</span>
            </div>
        `;
    }).join('');
}

// Render monthly expenses list
function renderMonthlyExpensesList(monthExpenses) {
    if (monthExpenses.length === 0) {
        monthlyExpensesListEl.innerHTML = '<p class="empty-message">No expenses this month</p>';
        return;
    }
    
    // Sort by date (newest first)
    const sortedExpenses = [...monthExpenses].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    monthlyExpensesListEl.innerHTML = sortedExpenses.map(expense => `
        <div class="expense-item" data-id="${expense.id}">
            <div class="expense-info">
                <div class="description">
                    ${escapeHtml(expense.description)}
                    <span class="category-badge">${escapeHtml(getCategoryLabel(expense.category))}</span>
                </div>
                <div class="source">Source: ${escapeHtml(expense.source || 'Not specified')}</div>
                <div class="details">${formatDate(expense.date)}</div>
            </div>
            <div class="expense-amount">${formatCurrency(expense.amount)}</div>
        </div>
    `).join('');
}

// Navigate months
function navigateMonth(direction) {
    currentViewMonth.setMonth(currentViewMonth.getMonth() + direction);
    updateMonthlyView();
}

// Event listeners
expenseForm.addEventListener('submit', addExpense);
incomeForm.addEventListener('submit', addIncome);
filterCategory.addEventListener('change', applyFilters);
filterDate.addEventListener('change', applyFilters);
clearDateFilterBtn.addEventListener('click', clearDateFilter);
clearAllBtn.addEventListener('click', clearAllExpenses);

// Form toggle
document.getElementById('expenseTabBtn').addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.form-tab-btn').forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
    document.querySelectorAll('.transaction-form').forEach(form => form.classList.remove('active'));
    expenseForm.classList.add('active');
});

document.getElementById('incomeTabBtn').addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.form-tab-btn').forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
    document.querySelectorAll('.transaction-form').forEach(form => form.classList.remove('active'));
    incomeForm.classList.add('active');
});

// Tab navigation
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// Month navigation
prevMonthBtn.addEventListener('click', () => navigateMonth(-1));
nextMonthBtn.addEventListener('click', () => navigateMonth(1));

// Make deleteExpense available globally
window.deleteExpense = deleteExpense;

// Initialize app
async function init() {
    try {
        await initDB();
        await loadExpenses();
        // Load or create users
        loadUsersFromStorage();
        populateUserSelect();
        // Wire up user controls
        const addUserBtn = document.getElementById('addUserBtn');
        const userSelect = document.getElementById('userSelect');
        if (addUserBtn) addUserBtn.addEventListener('click', addUser);
        if (userSelect) userSelect.addEventListener('change', (e) => { currentUserId = e.target.value; saveUsersToStorage(); refreshViewForUser(); });
        // Migrate existing DB records that lack userId or type to current user
        for (const rec of expenses) {
            let changed = false;
            if (!rec.userId) { rec.userId = currentUserId; changed = true; }
            if (!rec.type) { rec.type = 'expense'; changed = true; }
            if (changed) await upsertExpenseToDB(rec);
        }
        
        // Migrate from localStorage if needed
        const oldData = localStorage.getItem('expenses');
        if (oldData && expenses.length === 0) {
            const oldExpenses = JSON.parse(oldData);
            for (const expense of oldExpenses) {
                expense.month = getMonthKey(expense.date);
                expense.createdAt = expense.createdAt || new Date().toISOString();
                await saveExpenseToDB(expense);
                expenses.push(expense);
            }
            localStorage.removeItem('expenses');
            showDBStatus('Data Migrated to Database');
        }
        
        setDefaultDate();
        refreshViewForUser();
    } catch (error) {
        console.error('Initialization error:', error);
        showDBStatus('Failed to Initialize', true);
    }
}

// Start the app
init();
