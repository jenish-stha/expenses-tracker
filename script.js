// Get DOM elements
const expenseForm = document.getElementById('expenseForm');
const dateInput = document.getElementById('date');
const descriptionInput = document.getElementById('description');
const categoryInput = document.getElementById('category');
const amountInput = document.getElementById('amount');
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
const DB_VERSION = 1;
const STORE_NAME = 'expenses';
let db = null;
let expenses = [];
let currentViewMonth = new Date();

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
    dateInput.value = today;
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

// Format date for display
function formatDate(dateString) {
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

// Calculate and update summary
function updateSummary() {
    const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    
    const today = new Date().toISOString().split('T')[0];
    const todayTotal = expenses
        .filter(expense => expense.date === today)
        .reduce((sum, expense) => sum + expense.amount, 0);
    
    const currentMonth = getMonthKey(today);
    const monthTotal = expenses
        .filter(expense => expense.month === currentMonth)
        .reduce((sum, expense) => sum + expense.amount, 0);
    
    totalAmountEl.textContent = formatCurrency(total);
    todayAmountEl.textContent = formatCurrency(todayTotal);
    monthAmountEl.textContent = formatCurrency(monthTotal);
    entryCountEl.textContent = expenses.length;
    
    // Show/hide clear all button
    clearAllBtn.style.display = expenses.length > 0 ? 'block' : 'none';
}

// Render expenses list
function renderExpenses(categoryFilter = 'all', dateFilter = null) {
    let filteredExpenses = expenses;
    
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
        filterSummary.style.display = 'flex';
        filterSummaryText.textContent = `Showing expenses for ${formatDate(dateFilter)}`;
        filterSummaryAmount.textContent = `Total: ${formatCurrency(totalForDate)}`;
    } else {
        filterSummary.style.display = 'none';
    }
    
    if (filteredExpenses.length === 0) {
        const message = dateFilter 
            ? `No expenses found for ${formatDate(dateFilter)}` 
            : 'No expenses found. Start adding your expenses!';
        expensesList.innerHTML = `<p class="empty-message">${message}</p>`;
        return;
    }
    
    expensesList.innerHTML = filteredExpenses.map(expense => `
        <div class="expense-item" data-id="${expense.id}">
            <div class="expense-info">
                <div class="description">
                    ${expense.description}
                    <span class="category-badge">${categoryLabels[expense.category]}</span>
                </div>
                <div class="details">${formatDate(expense.date)}</div>
            </div>
            <div class="expense-amount">${formatCurrency(expense.amount)}</div>
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
        date: dateInput.value,
        month: getMonthKey(dateInput.value),
        description: descriptionInput.value.trim(),
        category: categoryInput.value,
        amount: parseFloat(amountInput.value),
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
        descriptionInput.focus();
    } catch (error) {
        console.error('Error saving expense:', error);
        alert('Failed to save expense. Please try again.');
    }
}

// Delete expense
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
            await clearAllFromDB();
            expenses = [];
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
    const monthExpenses = expenses.filter(expense => expense.month === monthKey);
    
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
                <span class="label">${categoryLabels[category]}</span>
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
                    ${expense.description}
                    <span class="category-badge">${categoryLabels[expense.category]}</span>
                </div>
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
filterCategory.addEventListener('change', applyFilters);
filterDate.addEventListener('change', applyFilters);
clearDateFilterBtn.addEventListener('click', clearDateFilter);
clearAllBtn.addEventListener('click', clearAllExpenses);

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
        updateSummary();
        renderExpenses();
        updateMonthlyView();
    } catch (error) {
        console.error('Initialization error:', error);
        showDBStatus('Failed to Initialize', true);
    }
}

// Start the app
init();
