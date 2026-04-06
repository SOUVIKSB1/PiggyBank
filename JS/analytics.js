const analyticsCore = window.PiggyBankCore;
const palette = ["#2563eb", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];
let pieChart;
let trendChart;

function formatCurrency(amount) {
  return analyticsCore.formatCurrency(amount);
}

function formatDate(date) {
  return analyticsCore.formatDate(date, {
    day: "numeric",
    month: "short"
  });
}

function renderStats(state) {
  const totals = analyticsCore.getTotals(state.transactions);
  document.getElementById("incomeTotal").innerText = formatCurrency(totals.income);
  document.getElementById("expenseTotal").innerText = formatCurrency(totals.expense);
  document.getElementById("balanceTotal").innerText = formatCurrency(totals.balance);
  document.getElementById("transactionCount").innerText = state.transactions.length;
}

function renderPie(state) {
  const expenseMap = analyticsCore.getExpensesByCategory(state.transactions);
  const labels = Object.keys(expenseMap);
  const data = Object.values(expenseMap);

  if (pieChart) {
    pieChart.destroy();
  }

  if (labels.length === 0) {
    document.getElementById("categorySummary").innerHTML = '<p class="empty">Add some expense transactions on the dashboard to see category analytics.</p>';
    return;
  }

  pieChart = new Chart(document.getElementById("expensePie"), {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: labels.map((_, index) => palette[index % palette.length]),
        borderWidth: 0
      }]
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

function renderTrend(state) {
  const trend = analyticsCore.getMonthlyTrend(state.transactions);
  const canvas = document.getElementById("monthlyTrend");
  const frame = canvas.parentElement;
  const parent = frame.parentElement;

  if (trendChart) {
    trendChart.destroy();
  }

  const previousEmpty = parent.querySelector(".chart-empty");
  if (previousEmpty) {
    previousEmpty.remove();
  }

  if (!trend.labels.length) {
    frame.style.display = "none";
    parent.insertAdjacentHTML("beforeend", '<p class="empty chart-empty">Add a few dated transactions to build the monthly trend view.</p>');
    return;
  }

  frame.style.display = "block";

  const netBalance = trend.labels.map((_, index) => trend.income[index] - trend.expense[index]);

  trendChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: trend.labels,
      datasets: [
        {
          type: "bar",
          label: "Expense",
          data: trend.expense,
          backgroundColor: "rgba(239, 68, 68, 0.68)",
          borderColor: "#ef4444",
          borderWidth: 1,
          borderRadius: 12,
          borderSkipped: false,
          barThickness: 22,
          order: 2
        },
        {
          type: "line",
          label: "Income",
          data: trend.income,
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.24)",
          pointBackgroundColor: "#d1fae5",
          pointBorderColor: "#10b981",
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBorderWidth: 2,
          tension: 0.34,
          fill: false,
          borderWidth: 3,
          order: 1
        },
        {
          type: "line",
          label: "Net Balance",
          data: netBalance,
          borderColor: "#7dd3fc",
          backgroundColor: "rgba(125, 211, 252, 0.12)",
          pointBackgroundColor: "#e0f2fe",
          pointBorderColor: "#38bdf8",
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBorderWidth: 2,
          tension: 0.28,
          borderDash: [7, 6],
          fill: false,
          borderWidth: 2,
          order: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      resizeDelay: 180,
      animation: {
        duration: 650
      },
      interaction: {
        mode: "index",
        intersect: false
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#dbeafe",
            usePointStyle: true,
            boxWidth: 10,
            padding: 18
          }
        },
        tooltip: {
          backgroundColor: "rgba(10, 22, 42, 0.96)",
          borderColor: "rgba(125, 211, 252, 0.18)",
          borderWidth: 1,
          titleColor: "#f8fbff",
          bodyColor: "#dbeafe",
          padding: 12,
          displayColors: true,
          callbacks: {
            label(context) {
              return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: "#abc0df"
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: "rgba(148, 163, 184, 0.14)",
            drawBorder: false
          },
          ticks: {
            color: "#abc0df",
            maxTicksLimit: 6,
            callback(value) {
              return formatCurrency(value);
            }
          }
        }
      },
      elements: {
        line: {
          capBezierPoints: true
        }
      }
    }
  });
}

function renderCategorySummary(state) {
  const categorySummary = document.getElementById("categorySummary");
  const entries = Object.entries(analyticsCore.getExpensesByCategory(state.transactions)).sort((a, b) => b[1] - a[1]);
  const budgetStatusMap = Object.fromEntries(analyticsCore.getCategoryBudgetStatus(state).map((entry) => [entry.category, entry]));

  if (entries.length === 0) {
    categorySummary.innerHTML = '<p class="empty">No category totals yet.</p>';
    return;
  }

  categorySummary.innerHTML = entries.map(([category, amount]) => {
    const budget = budgetStatusMap[category];
    const copy = budget && budget.target > 0
      ? `${Math.round(budget.progress)}% of ${formatCurrency(budget.target)} target`
      : "No category target";

    return `
      <div class="summary-item">
        <div>
          <span>${category}</span>
          <div class="muted">${copy}</div>
        </div>
        <strong>${formatCurrency(amount)}</strong>
      </div>
    `;
  }).join("");
}

function renderLatest(state) {
  const latestActivity = document.getElementById("latestActivity");
  const recent = [...state.transactions].slice(0, 5);

  if (recent.length === 0) {
    latestActivity.innerHTML = '<p class="empty">Recent transactions will show up here.</p>';
    return;
  }

  latestActivity.innerHTML = recent.map((transaction) => `
    <div class="activity-item">
      <div>
        <strong>${transaction.description}</strong>
        <div class="muted">${transaction.category} • ${formatDate(transaction.date)}</div>
      </div>
      <strong>${transaction.type === "income" ? "+" : "-"}${formatCurrency(transaction.amount)}</strong>
    </div>
  `).join("");
}

function renderForecast(state) {
  const summary = document.getElementById("forecastSummary");
  const forecast = analyticsCore.getForecast(state);

  summary.innerHTML = `
    <div class="summary-item">
      <span>Projected income</span>
      <strong>${formatCurrency(forecast.projectedIncome)}</strong>
    </div>
    <div class="summary-item">
      <span>Projected expense</span>
      <strong>${formatCurrency(forecast.projectedExpense)}</strong>
    </div>
    <div class="summary-item">
      <span>Projected balance</span>
      <strong>${formatCurrency(forecast.projectedBalance)}</strong>
    </div>
  `;
}

function renderAlerts(state) {
  const container = document.getElementById("alertSummary");
  const items = [];
  const statusEntries = analyticsCore.getCategoryBudgetStatus(state);
  const recurring = state.recurringTransactions.filter((entry) => entry.enabled).slice(0, 3);

  statusEntries.forEach((entry) => {
    if (entry.status === "over") {
      items.push({
        title: `${entry.category} is over budget`,
        copy: `${formatCurrency(entry.overage)} above target this month.`
      });
    } else if (entry.status === "warning") {
      items.push({
        title: `${entry.category} is nearing its cap`,
        copy: `${Math.round(entry.progress)}% of ${formatCurrency(entry.target)} already used.`
      });
    }
  });

  recurring.forEach((entry) => {
    items.push({
      title: `${entry.description} repeats ${entry.frequency}`,
      copy: `${formatCurrency(entry.amount)} in ${entry.category}.`
    });
  });

  if (!items.length) {
    container.innerHTML = '<p class="empty">No alerts yet. Recurring items and budget warnings will appear here.</p>';
    return;
  }

  container.innerHTML = items.slice(0, 6).map((item) => `
    <div class="activity-item">
      <div>
        <strong>${item.title}</strong>
        <div class="muted">${item.copy}</div>
      </div>
    </div>
  `).join("");
}

function render() {
  const state = analyticsCore.getProfile();
  renderStats(state);
  renderPie(state);
  renderTrend(state);
  renderCategorySummary(state);
  renderLatest(state);
  renderForecast(state);
  renderAlerts(state);
}

analyticsCore.subscribe(render);
render();
