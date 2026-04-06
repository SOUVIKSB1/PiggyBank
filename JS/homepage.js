const homepageCore = window.PiggyBankCore;

function formatCurrency(amount) {
  return homepageCore.formatCurrency(amount);
}

function formatDate(date) {
  return homepageCore.formatDate(date, {
    day: "numeric",
    month: "short"
  });
}

function renderExpenseLanes(entries) {
  const container = document.getElementById("expenseLanes");

  if (entries.length === 0) {
    container.innerHTML = `
      <div class="list-item">
        <div>
          <strong>No expenses yet</strong>
          <small>Add a few expense transactions on the dashboard.</small>
        </div>
        <div>${formatCurrency(0)}</div>
      </div>
    `;
    return;
  }

  const max = entries[0][1];
  container.innerHTML = entries.slice(0, 3).map(([category, amount], index) => {
    const width = max > 0 ? (amount / max) * 100 : 0;
    const gradientClass = index + 1;
    return `
      <div class="line-row">
        <span>${category}</span>
        <div class="line-track"><div class="line-fill lane-${gradientClass}" style="width:${width}%"></div></div>
        <strong>${formatCurrency(amount)}</strong>
      </div>
    `;
  }).join("");
}

function renderRecentActivity(transactions) {
  const container = document.getElementById("recentActivityList");
  const recent = [...transactions].slice(0, 3);

  if (recent.length === 0) {
    container.innerHTML = `
      <div class="list-item">
        <div>
          <strong>No activity yet</strong>
          <small>Your latest dashboard entries will appear here.</small>
        </div>
        <div>${formatCurrency(0)}</div>
      </div>
    `;
    return;
  }

  container.innerHTML = recent.map((transaction) => `
    <div class="list-item">
      <div>
        <strong>${transaction.description || transaction.category || "Transaction"}</strong>
        <small>${transaction.category || "General"} • ${formatDate(transaction.date)}</small>
      </div>
      <div>${transaction.type === "income" ? "+" : "-"}${formatCurrency(transaction.amount)}</div>
    </div>
  `).join("");
}

function renderHomepageOverview() {
  const state = homepageCore.getProfile();
  const transactions = state.transactions;
  const totals = homepageCore.getTotals(transactions);
  const expenses = Object.entries(homepageCore.getExpensesByCategory(transactions)).sort((a, b) => b[1] - a[1]);
  const topCategory = expenses[0];
  const largestTransaction = transactions.reduce((max, transaction) => {
    return Number(transaction.amount || 0) > Number(max.amount || 0) ? transaction : max;
  }, {});
  const savingsRate = totals.income > 0 ? Math.round((totals.balance / totals.income) * 100) : 0;
  const targetLeft = Math.max((state.budgetTarget || 0) - totals.expense, 0);
  const budgetProgress = state.budgetTarget > 0 ? Math.min(Math.round((totals.expense / state.budgetTarget) * 100), 100) : 0;
  const recurringCount = state.recurringTransactions.filter((entry) => entry.enabled).length;

  document.getElementById("heroStatPrimary").innerText = formatCurrency(totals.balance);
  document.getElementById("heroStatPrimaryLabel").innerText = "Current balance";
  document.getElementById("heroStatSecondary").innerText = transactions.length;
  document.getElementById("heroStatSecondaryLabel").innerText = recurringCount > 0 ? `${recurringCount} recurring active` : "Transactions tracked";
  document.getElementById("heroStatTertiary").innerText = formatCurrency(targetLeft);
  document.getElementById("heroStatTertiaryLabel").innerText = state.budgetTarget > 0 ? "Monthly target left" : "Target not set yet";

  document.getElementById("overviewSubtitle").innerText = transactions.length > 0
    ? `${transactions.length} saved entries across the ${state.name} profile`
    : "Add transactions on the dashboard to bring this overview to life";
  document.getElementById("overviewStatus").innerText = transactions.length > 0 ? `${state.name} synced` : "Waiting for first entry";
  document.getElementById("overviewIncome").innerText = formatCurrency(totals.income);
  document.getElementById("overviewExpense").innerText = formatCurrency(totals.expense);
  document.getElementById("overviewSavingsRate").innerText = `${savingsRate}%`;

  document.getElementById("budgetRhythmTitle").innerText = state.budgetTarget > 0 ? "Budget Rhythm" : "Set a target";
  document.getElementById("budgetRhythmCopy").innerText = state.budgetTarget > 0
    ? `${formatCurrency(totals.expense)} spent out of ${formatCurrency(state.budgetTarget)} so far.`
    : "Add a monthly target on the dashboard or budget page to track spending progress here.";
  document.getElementById("budgetRing").style.setProperty("--progress", budgetProgress);
  document.getElementById("budgetRing").setAttribute("data-progress", `${budgetProgress}%`);

  document.getElementById("fastReviewTitle").innerText = topCategory ? `${topCategory[0]} leads` : "Fast review";
  document.getElementById("fastReviewCopy").innerText = topCategory
    ? `${topCategory[0]} is your top expense category at ${formatCurrency(topCategory[1])}. ${recurringCount > 0 ? `${recurringCount} recurring flows are active too.` : ""}`
    : "Jump from summary to history and spot patterns once your first expenses are added.";

  document.getElementById("miniOverviewPrimary").innerText = expenses.length;
  document.getElementById("miniOverviewPrimaryLabel").innerText = recurringCount > 0 ? "Expense categories + routines" : "Expense categories";
  document.getElementById("miniOverviewSecondary").innerText = largestTransaction.amount ? formatCurrency(largestTransaction.amount) : formatCurrency(0);
  document.getElementById("miniOverviewSecondaryLabel").innerText = largestTransaction.amount ? "Largest entry" : "Largest entry";

  renderExpenseLanes(expenses);
  renderRecentActivity(transactions);
}

homepageCore.subscribe(renderHomepageOverview);
renderHomepageOverview();
