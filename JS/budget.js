const budgetCore = window.PiggyBankCore;
let budgetChart;

function formatCurrency(amount) {
  return budgetCore.formatCurrency(amount);
}

async function saveBudgetTarget() {
  const value = Number(document.getElementById("budgetTargetInput").value);
  const state = budgetCore.getProfile();

  if (value < 0 || Number.isNaN(value)) {
    return;
  }

  if (state.budgetTarget > 0 && state.budgetTarget !== value) {
    const confirmed = await window.showConfirmDialog(
      "Update budget target",
      `Change the monthly budget target from ${formatCurrency(state.budgetTarget)} to ${formatCurrency(value)}?`,
      { confirmLabel: "Update target" }
    );

    if (!confirmed) {
      return;
    }
  }

  await window.runWithPiggyLoader(() => {
    budgetCore.updateProfile((profile) => ({
      ...profile,
      budgetTarget: value
    }));
  }, {
    title: "Saving budget target",
    message: "Updating this profile's monthly budget plan."
  });
}

async function useExpenseAverage() {
  const state = budgetCore.getProfile();
  const currentMonthTransactions = budgetCore.getCurrentMonthTransactions(state.transactions);
  const totals = budgetCore.getTotals(currentMonthTransactions);
  const confirmed = await window.showConfirmDialog(
    "Use expense total",
    `Use the current month expense total ${formatCurrency(totals.expense)} as the new budget target?`,
    { confirmLabel: "Use total" }
  );

  if (!confirmed) {
    return;
  }

  await window.runWithPiggyLoader(() => {
    budgetCore.updateProfile((profile) => ({
      ...profile,
      budgetTarget: totals.expense
    }));
  }, {
    title: "Applying expense total",
    message: "Using the current month spending total as the new target."
  });
}

async function saveCategoryBudget() {
  const state = budgetCore.getProfile();
  const category = document.getElementById("categoryBudgetName").value.trim();
  const amount = Number(document.getElementById("categoryBudgetAmount").value);

  if (!category || !amount || amount <= 0) {
    return;
  }

  const existing = Number(state.categoryBudgets?.[category]) || 0;

  if (existing > 0 && existing !== amount) {
    const confirmed = await window.showConfirmDialog(
      "Update category budget",
      `Update the ${category} budget from ${formatCurrency(existing)} to ${formatCurrency(amount)}?`,
      { confirmLabel: "Update budget" }
    );

    if (!confirmed) {
      return;
    }
  }

  await window.runWithPiggyLoader(() => {
    budgetCore.updateProfile((profile) => ({
      ...profile,
      categoryBudgets: {
        ...profile.categoryBudgets,
        [category]: amount
      }
    }));
  }, {
    title: "Saving category budget",
    message: `Updating the spending guardrail for ${category}.`
  });

  document.getElementById("categoryBudgetName").value = "";
  document.getElementById("categoryBudgetAmount").value = "";
}

async function deleteCategoryBudget(encodedCategory) {
  const category = decodeURIComponent(encodedCategory);
  const confirmed = await window.showConfirmDialog(
    "Remove category budget",
    `Remove the category budget for "${category}"?`,
    { confirmLabel: "Remove" }
  );

  if (!confirmed) {
    return;
  }

  await window.runWithPiggyLoader(() => {
    budgetCore.updateProfile((profile) => {
      const nextBudgets = { ...profile.categoryBudgets };
      delete nextBudgets[category];
      return {
        ...profile,
        categoryBudgets: nextBudgets
      };
    });
  }, {
    title: "Removing category budget",
    message: `Clearing the saved target for ${category}.`
  });
}

function getMonthlyExpenses(transactions, budgetTarget) {
  const grouped = {};

  transactions
    .filter((transaction) => transaction.type === "expense")
    .forEach((transaction) => {
      const key = transaction.date ? transaction.date.slice(0, 7) : "Unknown";
      grouped[key] = (grouped[key] || 0) + Number(transaction.amount || 0);
    });

  const labels = Object.keys(grouped).sort();
  return {
    labels,
    expenses: labels.map((label) => grouped[label]),
    remaining: labels.map((label) => Math.max((budgetTarget || 0) - grouped[label], 0))
  };
}

function renderStats(state) {
  const currentMonthTransactions = budgetCore.getCurrentMonthTransactions(state.transactions);
  const totals = budgetCore.getTotals(currentMonthTransactions);
  const remaining = Math.max((state.budgetTarget || 0) - totals.expense, 0);
  const progress = state.budgetTarget > 0 ? Math.min((totals.expense / state.budgetTarget) * 100, 100) : 0;

  document.getElementById("budgetTargetValue").innerText = formatCurrency(state.budgetTarget);
  document.getElementById("spentValue").innerText = formatCurrency(totals.expense);
  document.getElementById("remainingValue").innerText = formatCurrency(remaining);
  document.getElementById("savingsValue").innerText = formatCurrency(totals.balance);
  document.getElementById("budgetTargetInput").value = state.budgetTarget || "";
  document.getElementById("progressFill").style.width = `${progress}%`;
  document.getElementById("progressText").innerText = state.budgetTarget > 0
    ? `${formatCurrency(totals.expense)} spent out of ${formatCurrency(state.budgetTarget)} target this month.`
    : "Set a target to start tracking progress.";
}

function renderBudgetList(state) {
  const list = document.getElementById("budgetList");
  const entries = budgetCore.getCategoryBudgetStatus(state);

  if (entries.length === 0) {
    list.innerHTML = '<p class="empty">Add expenses on the dashboard to see category usage.</p>';
    return;
  }

  list.innerHTML = entries.map((entry) => `
    <div class="budget-item">
      <div class="budget-row">
        <strong>${entry.category}</strong>
        <span>${formatCurrency(entry.spent)}</span>
      </div>
      <div class="budget-row muted-row">
        <span>${entry.target > 0 ? `Target ${formatCurrency(entry.target)}` : "No category target yet"}</span>
        <span>${entry.status === "over" ? `Over by ${formatCurrency(entry.overage)}` : `${Math.round(entry.progress)}% used`}</span>
      </div>
      <div class="mini-bar">
        <div class="mini-fill ${entry.status}" style="width:${Math.min(entry.progress, 100)}%"></div>
      </div>
    </div>
  `).join("");
}

function renderCategoryBudgetList(state) {
  const list = document.getElementById("categoryBudgetList");
  const entries = budgetCore.getCategoryBudgetStatus(state).filter((entry) => entry.target > 0);

  if (!entries.length) {
    list.innerHTML = '<p class="empty">Add category targets to create guardrails for your main spending buckets.</p>';
    return;
  }

  list.innerHTML = entries.map((entry) => `
    <div class="budget-item">
      <div class="budget-row">
        <strong>${entry.category}</strong>
        <span>${formatCurrency(entry.target)}</span>
      </div>
      <div class="budget-row muted-row">
        <span>${formatCurrency(entry.spent)} spent this month</span>
        <button type="button" class="secondary" onclick="deleteCategoryBudget('${encodeURIComponent(entry.category)}')">Remove</button>
      </div>
    </div>
  `).join("");
}

function renderAlerts(state) {
  const list = document.getElementById("budgetAlerts");
  const entries = budgetCore.getCategoryBudgetStatus(state);
  const alerts = [];
  const currentMonthTotals = budgetCore.getTotals(budgetCore.getCurrentMonthTransactions(state.transactions));

  if (state.budgetTarget > 0 && currentMonthTotals.expense > state.budgetTarget) {
    alerts.push(`Monthly spend is over target by ${formatCurrency(currentMonthTotals.expense - state.budgetTarget)}.`);
  }

  entries.forEach((entry) => {
    if (entry.status === "over") {
      alerts.push(`${entry.category} is over budget by ${formatCurrency(entry.overage)}.`);
    } else if (entry.status === "warning") {
      alerts.push(`${entry.category} has used ${Math.round(entry.progress)}% of its target.`);
    }
  });

  if (!alerts.length) {
    list.innerHTML = '<p class="empty">No active budget alerts. Your budget is under control right now.</p>';
    return;
  }

  list.innerHTML = alerts.map((alert) => `<div class="alert-item">${alert}</div>`).join("");
}

function renderChart(state) {
  const monthly = getMonthlyExpenses(state.transactions, state.budgetTarget);

  if (budgetChart) {
    budgetChart.destroy();
  }

  budgetChart = new Chart(document.getElementById("budgetChart"), {
    type: "bar",
    data: {
      labels: monthly.labels,
      datasets: [
        {
          label: "Expenses",
          data: monthly.expenses,
          backgroundColor: "#2563eb"
        },
        {
          label: "Remaining Budget",
          data: monthly.remaining,
          backgroundColor: "#10b981"
        }
      ]
    },
    options: {
      plugins: {
        legend: {
          position: "bottom"
        }
      }
    }
  });
}

function render() {
  const state = budgetCore.getProfile();
  renderStats(state);
  renderBudgetList(state);
  renderCategoryBudgetList(state);
  renderAlerts(state);
  renderChart(state);
}

budgetCore.subscribe(render);
render();
