const core = window.PiggyBankCore;
const colors = ["#2563eb", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

let state = core.getProfile();
let activeCategoryFocus = "";

function formatCurrency(amount) {
  return core.formatCurrency(amount);
}

function formatDate(value) {
  return core.formatDate(value);
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeType(value) {
  return value === "income" ? "income" : "expense";
}

function persistAndRender(updater) {
  state = core.updateProfile(updater);
  renderAll();
}

async function saveBudgetTarget() {
  const value = Number(document.getElementById("budgetTarget").value);

  if (value < 0 || Number.isNaN(value)) {
    return;
  }

  if (state.budgetTarget > 0 && state.budgetTarget !== value) {
    const confirmed = await window.showConfirmDialog(
      "Update spending target",
      `Change the monthly spending target from ${formatCurrency(state.budgetTarget)} to ${formatCurrency(value)}?`,
      { confirmLabel: "Update target" }
    );

    if (!confirmed) {
      return;
    }
  }

  await window.runWithPiggyLoader(() => {
    persistAndRender((profile) => ({
      ...profile,
      budgetTarget: value
    }));
  }, {
    title: "Saving target",
    message: "Updating the monthly spending target for this profile."
  });

  window.showToast?.("Target updated", "Your monthly spending target is now synced across the app.");
}

async function addTransaction() {
  const type = normalizeType(document.getElementById("entryType").value);
  const categoryInput = document.getElementById("entryCategory");
  const descriptionInput = document.getElementById("entryDescription");
  const amountInput = document.getElementById("entryAmount");
  const dateInput = document.getElementById("entryDate");

  const category = categoryInput.value.trim() || (type === "income" ? "Income" : "Other");
  const description = descriptionInput.value.trim() || (type === "income" ? "Income added" : "Expense added");
  const amount = Number(amountInput.value);
  const date = dateInput.value || new Date().toISOString().slice(0, 10);

  if (!amount || amount <= 0) {
    amountInput.focus();
    return;
  }

  await window.runWithPiggyLoader(() => {
    persistAndRender((profile) => ({
      ...profile,
      transactions: [
        {
          id: core.createId("txn"),
          type,
          category,
          description,
          amount,
          date
        },
        ...profile.transactions
      ]
    }));
  }, {
    title: "Saving transaction",
    message: "Dropping the latest entry into your finance timeline."
  });

  categoryInput.value = "";
  descriptionInput.value = "";
  amountInput.value = "";
  document.getElementById("entryType").value = "expense";
  dateInput.value = new Date().toISOString().slice(0, 10);
}

async function deleteTransaction(id) {
  const transaction = state.transactions.find((entry) => entry.id === id);

  if (!transaction) {
    return;
  }

  const confirmed = await window.showConfirmDialog(
    "Delete transaction",
    `Delete "${transaction.description}" for ${formatCurrency(transaction.amount)}?`,
    { confirmLabel: "Delete" }
  );

  if (!confirmed) {
    return;
  }

  await window.runWithPiggyLoader(() => {
    persistAndRender((profile) => ({
      ...profile,
      transactions: profile.transactions.filter((transaction) => transaction.id !== id)
    }));
  }, {
    title: "Removing transaction",
    message: "Cleaning up the selected entry from this profile."
  });
}

async function addRecurringTransaction() {
  const type = normalizeType(document.getElementById("recurringType").value);
  const category = document.getElementById("recurringCategory").value.trim() || (type === "income" ? "Income" : "Other");
  const description = document.getElementById("recurringDescription").value.trim() || "Recurring entry";
  const amount = Number(document.getElementById("recurringAmount").value);
  const frequency = document.getElementById("recurringFrequency").value === "weekly" ? "weekly" : "monthly";
  const startDate = document.getElementById("recurringStartDate").value || new Date().toISOString().slice(0, 10);

  if (!amount || amount <= 0) {
    document.getElementById("recurringAmount").focus();
    return;
  }

  await window.runWithPiggyLoader(() => {
    persistAndRender((profile) => ({
      ...profile,
      recurringTransactions: [
        {
          id: core.createId("rec"),
          type,
          category,
          description,
          amount,
          frequency,
          startDate,
          enabled: true
        },
        ...profile.recurringTransactions
      ]
    }));
  }, {
    title: "Saving recurring entry",
    message: "Teaching the piggy bank to repeat this transaction automatically."
  });

  document.getElementById("recurringCategory").value = "";
  document.getElementById("recurringDescription").value = "";
  document.getElementById("recurringAmount").value = "";
  document.getElementById("recurringType").value = "expense";
  document.getElementById("recurringFrequency").value = "monthly";
  document.getElementById("recurringStartDate").value = new Date().toISOString().slice(0, 10);
}

async function toggleRecurringTransaction(id) {
  const recurring = state.recurringTransactions.find((entry) => entry.id === id);

  if (!recurring) {
    return;
  }

  const action = recurring.enabled ? "pause" : "resume";
  const confirmed = await window.showConfirmDialog(
    `${action === "pause" ? "Pause" : "Resume"} recurring entry`,
    `${action === "pause" ? "Pause" : "Resume"} the recurring entry "${recurring.description}"?`,
    { confirmLabel: action === "pause" ? "Pause" : "Resume" }
  );

  if (!confirmed) {
    return;
  }

  await window.runWithPiggyLoader(() => {
    persistAndRender((profile) => ({
      ...profile,
      recurringTransactions: profile.recurringTransactions.map((entry) => (
        entry.id === id ? { ...entry, enabled: !entry.enabled } : entry
      ))
    }));
  }, {
    title: action === "pause" ? "Pausing recurring entry" : "Resuming recurring entry",
    message: "Refreshing the recurring planner for this profile."
  });
}

async function deleteRecurringTransaction(id) {
  const recurring = state.recurringTransactions.find((entry) => entry.id === id);

  if (!recurring) {
    return;
  }

  const confirmed = await window.showConfirmDialog(
    "Delete recurring entry",
    `Delete the recurring entry "${recurring.description}"? Future auto-created records will stop.`,
    { confirmLabel: "Delete" }
  );

  if (!confirmed) {
    return;
  }

  await window.runWithPiggyLoader(() => {
    persistAndRender((profile) => ({
      ...profile,
      recurringTransactions: profile.recurringTransactions.filter((entry) => entry.id !== id)
    }));
  }, {
    title: "Deleting recurring entry",
    message: "Removing the recurring rule and updating future automation."
  });
}

async function seedDemoData() {
  if (state.transactions.length > 0 || state.recurringTransactions.length > 0) {
    return;
  }

  const confirmed = await window.showConfirmDialog(
    "Load demo data",
    "Load demo data into the current profile? This will add sample transactions, budgets, and recurring entries.",
    { confirmLabel: "Load demo" }
  );

  if (!confirmed) {
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  await window.runWithPiggyLoader(() => {
    persistAndRender((profile) => ({
      ...profile,
      budgetTarget: 12000,
      categoryBudgets: {
        Food: 4000,
        Travel: 2500,
        Bills: 3000
      },
      recurringTransactions: [
        { id: core.createId("rec"), type: "income", category: "Salary", description: "Monthly salary", amount: 42000, frequency: "monthly", startDate: today, enabled: true },
        { id: core.createId("rec"), type: "expense", category: "Rent", description: "Apartment rent", amount: 9000, frequency: "monthly", startDate: today, enabled: true }
      ],
      transactions: [
        { id: core.createId("txn"), type: "expense", category: "Food", description: "Groceries", amount: 3200, date: today },
        { id: core.createId("txn"), type: "expense", category: "Travel", description: "Fuel", amount: 1800, date: today },
        { id: core.createId("txn"), type: "expense", category: "Bills", description: "Electricity bill", amount: 2400, date: today },
        { id: core.createId("txn"), type: "expense", category: "Shopping", description: "Clothes", amount: 1500, date: today }
      ]
    }));
  }, {
    title: "Loading demo data",
    message: "Filling this profile with a polished sample finance setup."
  });
}

async function clearAllData() {
  const confirmed = await window.showConfirmDialog(
    "Clear profile data",
    "Clear all transactions, recurring entries, and budget settings from the current profile?",
    { confirmLabel: "Clear data" }
  );

  if (!confirmed) {
    return;
  }

  await window.runWithPiggyLoader(() => {
    persistAndRender((profile) => ({
      ...profile,
      budgetTarget: 0,
      categoryBudgets: {},
      recurringTransactions: [],
      transactions: []
    }));
  }, {
    title: "Clearing profile",
    message: "Resetting transactions, budgets, and recurring entries for this profile."
  });
}

function renderCards() {
  const totals = core.getTotals(state.transactions);
  const incomeRecords = state.transactions.filter((transaction) => transaction.type === "income").length;
  const expenseRecords = state.transactions.filter((transaction) => transaction.type === "expense").length;
  const savingsRate = totals.income > 0 ? ((totals.balance / totals.income) * 100) : 0;
  const targetLeft = Math.max(state.budgetTarget - totals.expense, 0);

  document.getElementById("balanceValue").innerText = formatCurrency(totals.balance);
  document.getElementById("incomeValue").innerText = formatCurrency(totals.income);
  document.getElementById("expenseValue").innerText = formatCurrency(totals.expense);
  document.getElementById("savingsRate").innerText = `${Math.round(savingsRate)}%`;

  document.getElementById("incomeMeta").innerText = `${incomeRecords} income record${incomeRecords === 1 ? "" : "s"}`;
  document.getElementById("expenseMeta").innerText = `${expenseRecords} expense record${expenseRecords === 1 ? "" : "s"}`;
  document.getElementById("targetMeta").innerText = state.budgetTarget > 0
    ? `${formatCurrency(targetLeft)} left before hitting target`
    : "No budget target yet";
}

function renderInsights() {
  const totals = core.getTotals(state.transactions);
  const expensesByCategory = core.getExpensesByCategory(state.transactions);
  const largest = state.transactions.reduce((max, transaction) => {
    return Number(transaction.amount) > Number(max.amount || 0) ? transaction : max;
  }, {});

  let topCategory = "None";
  let topAmount = 0;

  Object.entries(expensesByCategory).forEach(([category, amount]) => {
    if (amount > topAmount) {
      topCategory = category;
      topAmount = amount;
    }
  });

  const targetLeft = state.budgetTarget > 0 ? state.budgetTarget - totals.expense : 0;
  let message = "Start adding income and expenses to unlock smarter insights.";

  if (state.recurringTransactions.length > 0) {
    const nextRecurring = state.recurringTransactions.find((entry) => entry.enabled);
    if (nextRecurring) {
      message = `${nextRecurring.description} is scheduled ${nextRecurring.frequency}. Recurring entries now auto-add themselves on time.`;
    }
  }

  if (state.transactions.length > 0 && totals.income === 0 && totals.expense > 0) {
    message = "You are tracking expenses, but no income is recorded yet. Add income to see a clearer balance view.";
  } else if (state.budgetTarget > 0 && targetLeft < 0) {
    message = `You are over your monthly target by ${formatCurrency(Math.abs(targetLeft))}. Review ${topCategory} spending first.`;
  } else if (topCategory !== "None") {
    message = `${topCategory} is your largest expense category at ${formatCurrency(topAmount)}.`;
  }

  document.getElementById("transactionCount").innerText = state.transactions.length;
  document.getElementById("topCategory").innerText = topCategory;
  document.getElementById("largestTransaction").innerText = largest.amount ? formatCurrency(largest.amount) : "₹0";
  document.getElementById("targetLeft").innerText = state.budgetTarget > 0 ? formatCurrency(Math.max(targetLeft, 0)) : "₹0";
  document.getElementById("insight").innerText = message;
  document.getElementById("budgetMessage").innerText = state.budgetTarget > 0
    ? `Your current expenses are ${formatCurrency(totals.expense)} out of ${formatCurrency(state.budgetTarget)}.`
    : "Set a target to track how much spending room is left this month.";
}

function renderPie() {
  const pie = document.getElementById("pieChart");
  const info = document.getElementById("pieInfo");
  const centerValue = document.getElementById("pieCenterValue");
  const centerLabel = document.getElementById("pieCenterLabel");
  const centerMeta = document.getElementById("pieCenterMeta");
  const highlights = document.getElementById("categoryHighlights");
  const expensesByCategory = core.getExpensesByCategory(state.transactions);
  const entries = Object.entries(expensesByCategory);

  if (entries.length === 0) {
    pie.style.background = "conic-gradient(#dbeafe 0% 100%)";
    centerLabel.innerText = "Expense total";
    centerValue.innerText = "₹0";
    centerMeta.innerText = "Select a category";
    highlights.innerHTML = "";
    info.innerText = "Add expenses to build the chart.";
    activeCategoryFocus = "";
    return;
  }

  const sortedEntries = [...entries].sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, entry) => sum + entry[1], 0);
  let start = 0;
  const segments = entries.map(([category, amount], index) => {
    const end = start + ((amount / total) * 100);
    const segment = `${colors[index % colors.length]} ${start}% ${end}%`;
    start = end;
    return segment;
  });

  pie.style.background = `conic-gradient(${segments.join(",")})`;
  const highest = sortedEntries[0];
  const focusedCategory = sortedEntries.find(([category]) => category === activeCategoryFocus) || highest;
  const share = total > 0 ? Math.round((focusedCategory[1] / total) * 100) : 0;

  centerLabel.innerText = focusedCategory[0];
  centerValue.innerText = formatCurrency(focusedCategory[1]);
  centerMeta.innerText = `${share}% of all tracked expenses`;
  highlights.innerHTML = `
    <div class="highlight-card">
      <span>Total spent</span>
      <strong>${formatCurrency(total)}</strong>
    </div>
    <div class="highlight-card">
      <span>Top category share</span>
      <strong>${Math.round((highest[1] / total) * 100)}%</strong>
    </div>
  `;
  info.innerText = `${focusedCategory[0]} accounts for ${share}% of your expense mix.`;
}

function renderCategoryList() {
  const list = document.getElementById("categoryList");
  const expenseStatuses = core.getCategoryBudgetStatus(state);
  const totalExpense = expenseStatuses.reduce((sum, entry) => sum + entry.spent, 0);

  if (expenseStatuses.length === 0) {
    list.innerHTML = '<p class="empty-state">No expense categories yet.</p>';
    return;
  }

  list.innerHTML = expenseStatuses.map((entry, index) => `
    <button type="button" class="category-item ${entry.category === activeCategoryFocus ? "active" : ""}" onclick="showCategoryInfo('${encodeURIComponent(entry.category)}', ${entry.spent})">
      <span class="swatch" style="background:${colors[index % colors.length]}"></span>
      <span class="category-item-main">
        <span>${escapeHtml(entry.category)}</span>
        <span class="category-item-meta">${totalExpense > 0 ? Math.round((entry.spent / totalExpense) * 100) : 0}% share • ${entry.status === "over" ? "Over budget" : entry.target > 0 ? `${Math.round(entry.progress)}% of target` : "No target set"}</span>
      </span>
      <strong>${formatCurrency(entry.spent)}</strong>
    </button>
  `).join("");
}

function showCategoryInfo(encodedCategory, amount) {
  activeCategoryFocus = decodeURIComponent(encodedCategory);
  document.getElementById("pieInfo").innerText = `${activeCategoryFocus}: ${formatCurrency(amount)}`;
  renderPie();
  renderCategoryList();
}

function renderBars() {
  const barGraph = document.getElementById("barGraph");
  const entries = Object.entries(core.getExpensesByCategory(state.transactions)).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    barGraph.innerHTML = '<p class="empty-state">Expense bars will appear here once you add expenses.</p>';
    return;
  }

  const max = entries[0][1];
  barGraph.innerHTML = entries.map(([category, amount], index) => {
    const width = max > 0 ? (amount / max) * 100 : 0;
    return `
      <button type="button" class="bar-row" onclick="showCategoryInfo('${encodeURIComponent(category)}', ${amount})">
        <span class="bar-label">${escapeHtml(category)}</span>
        <span class="bar-track">
          <span class="bar-fill" style="width:${width}%; background:${colors[index % colors.length]}"></span>
        </span>
        <strong>${formatCurrency(amount)}</strong>
      </button>
    `;
  }).join("");
}

function renderTransactions() {
  const list = document.getElementById("transactionList");
  const filterType = document.getElementById("filterType").value;
  const searchText = document.getElementById("searchText").value.trim().toLowerCase();

  const filtered = state.transactions.filter((transaction) => {
    const matchesType = filterType === "all" ? true : transaction.type === filterType;
    const haystack = `${transaction.description} ${transaction.category}`.toLowerCase();
    const matchesSearch = haystack.includes(searchText);
    return matchesType && matchesSearch;
  });

  if (filtered.length === 0) {
    list.innerHTML = '<p class="empty-state">No transactions match this filter yet.</p>';
    return;
  }

  list.innerHTML = filtered.map((transaction) => `
    <div class="transaction-item">
      <div>
        <div class="transaction-title-row">
          <strong>${escapeHtml(transaction.description)}</strong>
          <span class="badge ${transaction.type}">${transaction.recurring ? "recurring" : escapeHtml(transaction.type)}</span>
        </div>
        <p class="transaction-meta">${escapeHtml(transaction.category)} • ${formatDate(transaction.date)}</p>
      </div>

      <div class="transaction-actions">
        <strong class="${transaction.type === "income" ? "amount-positive" : "amount-negative"}">
          ${transaction.type === "income" ? "+" : "-"}${formatCurrency(transaction.amount)}
        </strong>
        <button type="button" class="delete-btn" onclick="deleteTransaction('${transaction.id}')">Delete</button>
      </div>
    </div>
  `).join("");
}

function renderRecurringList() {
  const list = document.getElementById("recurringList");

  if (!state.recurringTransactions.length) {
    list.innerHTML = '<p class="empty-state">Add weekly or monthly entries here to automate the repetitive stuff.</p>';
    return;
  }

  list.innerHTML = state.recurringTransactions.map((entry) => `
    <div class="transaction-item recurring-item">
      <div>
        <div class="transaction-title-row">
          <strong>${escapeHtml(entry.description)}</strong>
          <span class="badge ${entry.type}">${escapeHtml(entry.frequency)}</span>
        </div>
        <p class="transaction-meta">${escapeHtml(entry.category)} • starts ${formatDate(entry.startDate)} • ${entry.enabled ? "enabled" : "paused"}</p>
      </div>

      <div class="transaction-actions">
        <strong>${formatCurrency(entry.amount)}</strong>
        <button type="button" class="secondary-btn" onclick="toggleRecurringTransaction('${entry.id}')">${entry.enabled ? "Pause" : "Resume"}</button>
        <button type="button" class="delete-btn" onclick="deleteRecurringTransaction('${entry.id}')">Delete</button>
      </div>
    </div>
  `).join("");
}

function renderAll() {
  state = core.getProfile();
  document.getElementById("budgetTarget").value = state.budgetTarget || "";
  document.getElementById("entryDate").value = document.getElementById("entryDate").value || new Date().toISOString().slice(0, 10);
  document.getElementById("recurringStartDate").value = document.getElementById("recurringStartDate").value || new Date().toISOString().slice(0, 10);
  renderCards();
  renderInsights();
  renderPie();
  renderCategoryList();
  renderBars();
  renderTransactions();
  renderRecurringList();
}

core.subscribe(() => {
  state = core.getProfile();
  renderAll();
});

renderAll();
