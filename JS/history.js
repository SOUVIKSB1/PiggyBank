const historyCore = window.PiggyBankCore;

function formatCurrency(amount) {
  return historyCore.formatCurrency(amount);
}

function formatDate(date) {
  return historyCore.formatDate(date);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeCsv(value) {
  return `"${String(value ?? "").replace(/"/g, "\"\"")}"`;
}

function getFilters() {
  return {
    type: document.getElementById("typeFilter").value,
    category: document.getElementById("categoryFilter").value.trim().toLowerCase(),
    search: document.getElementById("searchFilter").value.trim().toLowerCase(),
    fromDate: document.getElementById("fromDateFilter").value,
    toDate: document.getElementById("toDateFilter").value
  };
}

function getFilteredTransactions() {
  const state = historyCore.getProfile();
  const filters = getFilters();

  return state.transactions.filter((transaction) => {
    const typeMatch = filters.type === "all" ? true : transaction.type === filters.type;
    const categoryMatch = (transaction.category || "").toLowerCase().includes(filters.category);
    const searchMatch = (transaction.description || "").toLowerCase().includes(filters.search);
    const fromMatch = filters.fromDate ? transaction.date >= filters.fromDate : true;
    const toMatch = filters.toDate ? transaction.date <= filters.toDate : true;
    return typeMatch && categoryMatch && searchMatch && fromMatch && toMatch;
  });
}

function getFilteredExpenses() {
  return getFilteredTransactions().filter((transaction) => transaction.type === "expense");
}

function buildExpenseFilename(extension) {
  const stamp = new Date().toISOString().slice(0, 10);
  return `expenses-${stamp}.${extension}`;
}

function showNoExpenseMessage() {
  window.alert("No expense records match the current filters.");
}

async function exportExpensesToCSV() {
  const expenses = getFilteredExpenses();

  if (!expenses.length) {
    showNoExpenseMessage();
    return;
  }

  const header = ["Date", "Description", "Category", "Amount", "Recurring"];
  const rows = expenses.map((transaction) => [
    transaction.date || "",
    transaction.description || "",
    transaction.category || "",
    Number(transaction.amount || 0).toFixed(2),
    transaction.recurring ? "Yes" : "No"
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map(escapeCsv).join(","))
    .join("\n");

  await window.runWithPiggyLoader(() => {
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.href = url;
    link.download = buildExpenseFilename("csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, {
    title: "Preparing Excel export",
    message: "Packing your filtered expense rows into a sheet-friendly file."
  });
}

async function exportExpensesToPDF() {
  const expenses = getFilteredExpenses();

  if (!expenses.length) {
    showNoExpenseMessage();
    return;
  }

  const totalExpense = expenses.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  const exportWindow = window.open("", "_blank", "width=960,height=720");

  if (!exportWindow) {
    window.alert("Please allow pop-ups to export the PDF.");
    return;
  }

  const rows = expenses.map((transaction, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(formatDate(transaction.date))}</td>
      <td>${escapeHtml(transaction.description || "-")}</td>
      <td>${escapeHtml(transaction.category || "-")}</td>
      <td>${transaction.recurring ? "Yes" : "No"}</td>
      <td class="amount">${escapeHtml(formatCurrency(transaction.amount))}</td>
    </tr>
  `).join("");

  await window.runWithPiggyLoader(() => {
    exportWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Expense Report</title>
        <style>
          body { margin: 0; padding: 32px; font-family: "Segoe UI", Arial, sans-serif; color: #0f172a; background: #f8fbff; }
          .sheet { max-width: 980px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; gap: 18px; margin-bottom: 24px; padding-bottom: 18px; border-bottom: 2px solid #dbeafe; }
          .brand { font-size: 28px; font-weight: 800; color: #1d4ed8; }
          .subtle, .meta, .footer { color: #475569; line-height: 1.6; }
          .summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-bottom: 22px; }
          .card { padding: 14px 16px; border-radius: 16px; background: #eff6ff; border: 1px solid #bfdbfe; }
          .label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #2563eb; font-weight: 700; }
          .value { display: block; margin-top: 8px; font-size: 22px; font-weight: 800; }
          table { width: 100%; border-collapse: collapse; border-radius: 16px; overflow: hidden; background: #fff; border: 1px solid #dbeafe; }
          thead { background: #dbeafe; }
          th, td { padding: 12px 14px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
          th { color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.05em; font-size: 12px; }
          .amount { text-align: right; font-weight: 700; color: #b91c1c; }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="header">
            <div>
              <div class="brand">PiggyBank Live</div>
              <div class="subtle">Expense export generated from the current filtered history view.</div>
            </div>
            <div class="meta">
              <div><strong>Generated:</strong> ${escapeHtml(new Date().toLocaleString("en-IN"))}</div>
              <div><strong>File:</strong> ${escapeHtml(buildExpenseFilename("pdf"))}</div>
            </div>
          </div>
          <div class="summary">
            <div class="card"><span class="label">Expense Entries</span><span class="value">${expenses.length}</span></div>
            <div class="card"><span class="label">Total Spent</span><span class="value">${escapeHtml(formatCurrency(totalExpense))}</span></div>
            <div class="card"><span class="label">Recurring Entries</span><span class="value">${expenses.filter((entry) => entry.recurring).length}</span></div>
          </div>
          <table>
            <thead>
              <tr><th>#</th><th>Date</th><th>Description</th><th>Category</th><th>Recurring</th><th>Amount</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="footer" style="margin-top: 18px;">Use your browser's save dialog to store this view as a PDF.</div>
        </div>
      </body>
      </html>
    `);

    exportWindow.document.close();
    exportWindow.focus();
    exportWindow.print();
  }, {
    title: "Preparing PDF export",
    message: "Building a clean printable report for your filtered expenses."
  });
}

function clearFilters() {
  document.getElementById("typeFilter").value = "all";
  document.getElementById("categoryFilter").value = "";
  document.getElementById("searchFilter").value = "";
  document.getElementById("fromDateFilter").value = "";
  document.getElementById("toDateFilter").value = "";
  render();
}

function renderStats(transactions) {
  const incomeEntries = transactions.filter((transaction) => transaction.type === "income").length;
  const expenseEntries = transactions.filter((transaction) => transaction.type === "expense").length;
  const latest = [...transactions]
    .filter((transaction) => transaction.date)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  document.getElementById("entryCount").innerText = transactions.length;
  document.getElementById("incomeCount").innerText = incomeEntries;
  document.getElementById("expenseCount").innerText = expenseEntries;
  document.getElementById("latestDate").innerText = latest ? formatDate(latest.date) : "-";
}

function render() {
  const state = historyCore.getProfile();
  const filtered = getFilteredTransactions();
  const list = document.getElementById("historyList");

  renderStats(state.transactions);

  if (!filtered.length) {
    list.innerHTML = '<p class="empty">No transactions match the current filters.</p>';
    return;
  }

  list.innerHTML = filtered.map((transaction) => `
    <div class="item">
      <div>
        <strong>${escapeHtml(transaction.description || "-")}</strong>
        <span class="tag ${transaction.type}">${transaction.recurring ? "recurring" : escapeHtml(transaction.type)}</span>
        <div class="meta">${escapeHtml(transaction.category || "-")} • ${escapeHtml(formatDate(transaction.date))}</div>
      </div>
      <strong class="${transaction.type === "income" ? "amount-income" : "amount-expense"}">
        ${transaction.type === "income" ? "+" : "-"}${escapeHtml(formatCurrency(transaction.amount))}
      </strong>
    </div>
  `).join("");
}

historyCore.subscribe(render);
render();
