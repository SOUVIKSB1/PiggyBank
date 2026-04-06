const PiggyBankCore = (() => {
  const STORAGE_KEY = "financeTrackerState";
  const ANALYTICS_KEY = "financeData";
  const DEFAULT_PROFILE_ID = "main";
  const STATE_EVENT = "finance-state-changed";

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function createId(prefix = "id") {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }

  function createProfile(name = "Personal Space", id = DEFAULT_PROFILE_ID) {
    const now = new Date().toISOString();
    return {
      id,
      name,
      budgetTarget: 0,
      categoryBudgets: {},
      recurringTransactions: [],
      transactions: [],
      createdAt: now,
      updatedAt: now
    };
  }

  function readRawStorage() {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  function sanitizeTransaction(transaction) {
    return {
      id: transaction.id || createId("txn"),
      type: transaction.type === "income" ? "income" : "expense",
      category: String(transaction.category || (transaction.type === "income" ? "Income" : "Other")).trim() || "Other",
      description: String(transaction.description || "").trim() || "Untitled transaction",
      amount: Math.max(Number(transaction.amount) || 0, 0),
      date: transaction.date || todayIso(),
      recurring: Boolean(transaction.recurring),
      sourceRecurringId: transaction.sourceRecurringId || null,
      occurrenceKey: transaction.occurrenceKey || null
    };
  }

  function sanitizeRecurring(entry) {
    return {
      id: entry.id || createId("rec"),
      type: entry.type === "income" ? "income" : "expense",
      category: String(entry.category || (entry.type === "income" ? "Income" : "Other")).trim() || "Other",
      description: String(entry.description || "").trim() || "Recurring entry",
      amount: Math.max(Number(entry.amount) || 0, 0),
      frequency: entry.frequency === "weekly" ? "weekly" : "monthly",
      startDate: entry.startDate || todayIso(),
      enabled: entry.enabled !== false,
      lastAppliedDate: entry.lastAppliedDate || null
    };
  }

  function sanitizeCategoryBudgets(categoryBudgets) {
    return Object.entries(categoryBudgets || {}).reduce((totals, [category, target]) => {
      const cleanKey = String(category || "").trim();
      const cleanValue = Math.max(Number(target) || 0, 0);

      if (cleanKey && cleanValue > 0) {
        totals[cleanKey] = cleanValue;
      }

      return totals;
    }, {});
  }

  function sanitizeProfile(profile, fallbackId = createId("profile"), fallbackName = "Personal Space") {
    const base = createProfile(fallbackName, fallbackId);
    return {
      ...base,
      ...profile,
      id: profile.id || fallbackId,
      name: String(profile.name || fallbackName).trim() || fallbackName,
      budgetTarget: Math.max(Number(profile.budgetTarget) || 0, 0),
      categoryBudgets: sanitizeCategoryBudgets(profile.categoryBudgets),
      recurringTransactions: Array.isArray(profile.recurringTransactions)
        ? profile.recurringTransactions.map(sanitizeRecurring).filter((entry) => entry.amount > 0)
        : [],
      transactions: Array.isArray(profile.transactions)
        ? profile.transactions.map(sanitizeTransaction).filter((entry) => entry.amount > 0)
        : [],
      createdAt: profile.createdAt || base.createdAt,
      updatedAt: profile.updatedAt || base.updatedAt
    };
  }

  function migrateState(rawState) {
    if (rawState && rawState.profiles && typeof rawState.profiles === "object") {
      const entries = Object.entries(rawState.profiles);
      const profiles = entries.reduce((result, [id, profile], index) => {
        result[id] = sanitizeProfile(profile, id, index === 0 ? "Personal Space" : `Profile ${index + 1}`);
        return result;
      }, {});

      if (!Object.keys(profiles).length) {
        profiles[DEFAULT_PROFILE_ID] = createProfile("Personal Space", DEFAULT_PROFILE_ID);
      }

      const activeProfileId = profiles[rawState.activeProfileId] ? rawState.activeProfileId : Object.keys(profiles)[0];
      return { activeProfileId, profiles };
    }

    const migrated = sanitizeProfile(rawState || {}, DEFAULT_PROFILE_ID, "Personal Space");
    return {
      activeProfileId: DEFAULT_PROFILE_ID,
      profiles: {
        [DEFAULT_PROFILE_ID]: migrated
      }
    };
  }

  function cloneStore(store) {
    return JSON.parse(JSON.stringify(store));
  }

  function normalizeProfileName(name) {
    return String(name || "").trim().toLowerCase();
  }

  function isProfileNameTaken(store, name, excludedId = "") {
    const target = normalizeProfileName(name);

    if (!target) {
      return false;
    }

    return Object.values(store.profiles).some((profile) => (
      profile.id !== excludedId && normalizeProfileName(profile.name) === target
    ));
  }

  function sortTransactions(transactions) {
    return [...transactions].sort((a, b) => {
      const dateCompare = String(b.date || "").localeCompare(String(a.date || ""));
      if (dateCompare !== 0) {
        return dateCompare;
      }
      return String(b.id).localeCompare(String(a.id));
    });
  }

  function buildAnalyticsPayload(profile) {
    const expensesByCategory = getExpensesByCategory(profile.transactions);
    const totals = getTotals(profile.transactions);

    return {
      data: expensesByCategory,
      income: totals.income,
      expense: totals.expense,
      balance: totals.balance,
      transactions: profile.transactions,
      recurringTransactions: profile.recurringTransactions,
      categoryBudgets: profile.categoryBudgets,
      budgetTarget: profile.budgetTarget
    };
  }

  function emitChange(profile) {
    window.dispatchEvent(new CustomEvent(STATE_EVENT, { detail: profile }));
  }

  function persistStore(store) {
    const cleanStore = cloneStore(store);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanStore));

    const profile = cleanStore.profiles[cleanStore.activeProfileId];
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(buildAnalyticsPayload(profile)));
    emitChange(profile);
    return cleanStore;
  }

  function toDate(value) {
    const parsed = new Date(value);
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }

  function fromDate(date) {
    return new Date(date.getTime()).toISOString().slice(0, 10);
  }

  function nextOccurrence(date, frequency) {
    const next = new Date(date.getTime());
    if (frequency === "weekly") {
      next.setDate(next.getDate() + 7);
    } else {
      const originalDate = next.getDate();
      next.setMonth(next.getMonth() + 1);
      if (next.getDate() < originalDate) {
        next.setDate(0);
      }
    }
    next.setHours(0, 0, 0, 0);
    return next;
  }

  function applyRecurringToProfile(profile) {
    let changed = false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const existingKeys = new Set(
      profile.transactions
        .filter((entry) => entry.sourceRecurringId && entry.occurrenceKey)
        .map((entry) => `${entry.sourceRecurringId}:${entry.occurrenceKey}`)
    );

    profile.recurringTransactions = profile.recurringTransactions.map((entry) => {
      const recurring = sanitizeRecurring(entry);

      if (!recurring.enabled || recurring.amount <= 0) {
        return recurring;
      }

      let cursor = recurring.lastAppliedDate ? nextOccurrence(toDate(recurring.lastAppliedDate), recurring.frequency) : toDate(recurring.startDate);
      if (cursor > now) {
        return recurring;
      }

      while (cursor <= now) {
        const occurrenceKey = fromDate(cursor);
        const transactionKey = `${recurring.id}:${occurrenceKey}`;

        if (!existingKeys.has(transactionKey)) {
          profile.transactions.push(sanitizeTransaction({
            id: createId("txn"),
            type: recurring.type,
            category: recurring.category,
            description: recurring.description,
            amount: recurring.amount,
            date: occurrenceKey,
            recurring: true,
            sourceRecurringId: recurring.id,
            occurrenceKey
          }));
          existingKeys.add(transactionKey);
          changed = true;
        }

        recurring.lastAppliedDate = occurrenceKey;
        cursor = nextOccurrence(cursor, recurring.frequency);
      }

      return recurring;
    });

    if (changed) {
      profile.transactions = sortTransactions(profile.transactions);
      profile.updatedAt = new Date().toISOString();
    }

    return changed;
  }

  function getStore() {
    const migrated = migrateState(readRawStorage());
    const activeProfile = migrated.profiles[migrated.activeProfileId];
    const changed = applyRecurringToProfile(activeProfile);

    if (changed) {
      return persistStore(migrated);
    }

    return migrated;
  }

  function getProfile() {
    const store = getStore();
    return cloneStore(store.profiles[store.activeProfileId]);
  }

  function getProfiles() {
    const store = getStore();
    return Object.values(store.profiles).map((profile) => ({
      id: profile.id,
      name: profile.name,
      transactionCount: profile.transactions.length
    }));
  }

  function updateProfile(updater) {
    const store = getStore();
    const profile = cloneStore(store.profiles[store.activeProfileId]);
    const nextProfile = sanitizeProfile(
      typeof updater === "function" ? updater(profile) : updater,
      profile.id,
      profile.name
    );
    nextProfile.transactions = sortTransactions(nextProfile.transactions);
    nextProfile.updatedAt = new Date().toISOString();
    store.profiles[store.activeProfileId] = nextProfile;
    persistStore(store);
    return cloneStore(nextProfile);
  }

  function replaceProfile(nextProfile) {
    return updateProfile(() => nextProfile);
  }

  function createNewProfile(name) {
    const store = getStore();
    const trimmed = String(name || "").trim() || `Profile ${Object.keys(store.profiles).length + 1}`;

    if (isProfileNameTaken(store, trimmed)) {
      throw new Error("PROFILE_NAME_EXISTS");
    }

    const id = createId("profile");
    store.profiles[id] = createProfile(trimmed, id);
    store.activeProfileId = id;
    persistStore(store);
    return cloneStore(store.profiles[id]);
  }

  function renameProfile(id, name) {
    const store = getStore();
    const trimmed = String(name || "").trim();

    if (!store.profiles[id]) {
      throw new Error("PROFILE_NOT_FOUND");
    }

    if (!trimmed) {
      throw new Error("PROFILE_NAME_EMPTY");
    }

    if (isProfileNameTaken(store, trimmed, id)) {
      throw new Error("PROFILE_NAME_EXISTS");
    }

    store.profiles[id].name = trimmed;
    store.profiles[id].updatedAt = new Date().toISOString();
    persistStore(store);
    return cloneStore(store.profiles[id]);
  }

  function switchProfile(id) {
    const store = getStore();
    if (!store.profiles[id]) {
      return getProfile();
    }
    store.activeProfileId = id;
    persistStore(store);
    return cloneStore(store.profiles[id]);
  }

  function deleteProfile(id) {
    const store = getStore();
    const keys = Object.keys(store.profiles);

    if (!store.profiles[id] || keys.length === 1) {
      return getProfile();
    }

    delete store.profiles[id];
    if (store.activeProfileId === id) {
      store.activeProfileId = Object.keys(store.profiles)[0];
    }
    persistStore(store);
    return cloneStore(store.profiles[store.activeProfileId]);
  }

  function exportBackup() {
    return JSON.stringify(getStore(), null, 2);
  }

  function importBackup(rawText) {
    const parsed = JSON.parse(rawText);
    const migrated = migrateState(parsed);
    persistStore(migrated);
    return cloneStore(migrated.profiles[migrated.activeProfileId]);
  }

  function getTotals(transactions) {
    return (transactions || []).reduce((totals, transaction) => {
      const amount = Number(transaction.amount) || 0;
      if (transaction.type === "income") {
        totals.income += amount;
      } else {
        totals.expense += amount;
      }
      totals.balance = totals.income - totals.expense;
      return totals;
    }, { income: 0, expense: 0, balance: 0 });
  }

  function getExpensesByCategory(transactions) {
    return (transactions || [])
      .filter((transaction) => transaction.type === "expense")
      .reduce((totals, transaction) => {
        const category = transaction.category || "Other";
        totals[category] = (totals[category] || 0) + Number(transaction.amount || 0);
        return totals;
      }, {});
  }

  function getMonthlyTrend(transactions) {
    const grouped = {};

    (transactions || []).forEach((transaction) => {
      const key = transaction.date ? transaction.date.slice(0, 7) : "Unknown";
      if (!grouped[key]) {
        grouped[key] = { income: 0, expense: 0 };
      }

      if (transaction.type === "income") {
        grouped[key].income += Number(transaction.amount || 0);
      } else {
        grouped[key].expense += Number(transaction.amount || 0);
      }
    });

    const labels = Object.keys(grouped).sort();
    return {
      labels,
      income: labels.map((label) => grouped[label].income),
      expense: labels.map((label) => grouped[label].expense)
    };
  }

  function getCurrentMonthTransactions(transactions) {
    const currentMonth = todayIso().slice(0, 7);
    return (transactions || []).filter((transaction) => String(transaction.date || "").startsWith(currentMonth));
  }

  function getCategoryBudgetStatus(profile) {
    const currentMonthExpenses = getCurrentMonthTransactions(profile.transactions).filter((transaction) => transaction.type === "expense");
    const spentMap = getExpensesByCategory(currentMonthExpenses);
    const categories = new Set([...Object.keys(profile.categoryBudgets || {}), ...Object.keys(spentMap)]);

    return [...categories].map((category) => {
      const target = Number(profile.categoryBudgets?.[category]) || 0;
      const spent = Number(spentMap[category]) || 0;
      const progress = target > 0 ? Math.min((spent / target) * 100, 999) : 0;
      const remaining = Math.max(target - spent, 0);
      const overage = Math.max(spent - target, 0);
      let status = "tracking";

      if (target <= 0) {
        status = "unplanned";
      } else if (spent > target) {
        status = "over";
      } else if (progress >= 85) {
        status = "warning";
      }

      return { category, target, spent, progress, remaining, overage, status };
    }).sort((a, b) => {
      if (a.status === "over" && b.status !== "over") {
        return -1;
      }
      if (a.status !== "over" && b.status === "over") {
        return 1;
      }
      return b.spent - a.spent;
    });
  }

  function getForecast(profile) {
    const currentMonthTransactions = getCurrentMonthTransactions(profile.transactions);
    const totals = getTotals(currentMonthTransactions);
    const today = new Date();
    const day = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const factor = day > 0 ? daysInMonth / day : 1;
    const projectedExpense = totals.expense * factor;
    const projectedIncome = totals.income * factor;
    return {
      projectedExpense,
      projectedIncome,
      projectedBalance: projectedIncome - projectedExpense
    };
  }

  function formatCurrency(amount) {
    return "₹" + Number(amount || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  }

  function formatDate(date, options = { day: "numeric", month: "short", year: "numeric" }) {
    if (!date) {
      return "No date";
    }

    return new Date(date).toLocaleDateString("en-IN", options);
  }

  function subscribe(listener) {
    const wrapped = (event) => listener(event.detail);
    window.addEventListener(STATE_EVENT, wrapped);
    window.addEventListener("storage", wrapped);
    return () => {
      window.removeEventListener(STATE_EVENT, wrapped);
      window.removeEventListener("storage", wrapped);
    };
  }

  return {
    STORAGE_KEY,
    ANALYTICS_KEY,
    STATE_EVENT,
    createId,
    createProfile,
    getStore,
    getProfile,
    getProfiles,
    updateProfile,
    replaceProfile,
    createNewProfile,
    renameProfile,
    switchProfile,
    deleteProfile,
    exportBackup,
    importBackup,
    getTotals,
    getExpensesByCategory,
    getMonthlyTrend,
    getCurrentMonthTransactions,
    getCategoryBudgetStatus,
    getForecast,
    formatCurrency,
    formatDate,
    subscribe
  };
})();

window.PiggyBankCore = PiggyBankCore;
