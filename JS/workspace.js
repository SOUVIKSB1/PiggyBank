const workspaceCore = window.PiggyBankCore;

function formatCurrency(amount) {
  return workspaceCore.formatCurrency(amount);
}

async function createProfileFromInput() {
  const input = document.getElementById("newProfileName");
  const name = input.value.trim();

  if (!name) {
    input.focus();
    return;
  }

  const confirmed = await window.showConfirmDialog(
    "Create profile",
    `Create a new profile named "${name}"?`,
    { confirmLabel: "Create profile" }
  );

  if (!confirmed) {
    return;
  }

  try {
    await window.runWithPiggyLoader(() => workspaceCore.createNewProfile(name), {
      title: "Creating profile",
      message: "Opening a fresh workspace for this user."
    });
    input.value = "";
    render();
    window.showToast?.("Profile created", `${name} is ready to use.`);
  } catch (error) {
    if (error.message === "PROFILE_NAME_EXISTS") {
      window.showToast?.("Name already used", "Choose a different profile name. Duplicate usernames are not allowed.");
      input.focus();
      return;
    }
    throw error;
  }
}

async function switchProfileFromPage() {
  const id = document.getElementById("workspaceProfileSelect").value;
  const profile = await window.runWithPiggyLoader(() => workspaceCore.switchProfile(id), {
    title: "Switching profile",
    message: "Loading the selected workspace and finance data."
  });
  render();
  window.showToast?.("Profile switched", `Now viewing ${profile.name}.`);
}

async function switchToProfile(id) {
  const profile = await window.runWithPiggyLoader(() => workspaceCore.switchProfile(id), {
    title: "Switching profile",
    message: "Loading the selected workspace and finance data."
  });
  render();
  window.showToast?.("Profile switched", `Now viewing ${profile.name}.`);
}

async function deleteProfileFromWorkspace(id) {
  const current = workspaceCore.getProfile();
  const store = workspaceCore.getStore();
  const profile = store.profiles[id];

  if (current.id === id) {
    window.showToast?.("Profile in use", "Switch to another profile before deleting this one.");
    return;
  }

  if (!profile) {
    return;
  }

  const confirmed = await window.showConfirmDialog(
    "Delete profile",
    `Delete the profile "${profile.name}"? This removes its saved local data from this browser.`,
    { confirmLabel: "Delete profile" }
  );

  if (!confirmed) {
    return;
  }

  await window.runWithPiggyLoader(() => workspaceCore.deleteProfile(id), {
    title: "Deleting profile",
    message: "Removing this saved workspace from the browser."
  });
  render();
  window.showToast?.("Profile removed", "That workspace profile was deleted.");
}

async function renameProfileFromWorkspace(id, encodedCurrentName) {
  const currentName = decodeURIComponent(encodedCurrentName);
  const nextName = await window.showPromptDialog(
    "Rename profile",
    `Enter a new name for "${currentName}".`,
    { initialValue: currentName, confirmLabel: "Save name" }
  );

  if (nextName === null) {
    return;
  }

  const trimmedName = nextName.trim();

  if (trimmedName && trimmedName !== currentName) {
    const confirmed = await window.showConfirmDialog(
      "Confirm rename",
      `Rename "${currentName}" to "${trimmedName}"?`,
      { confirmLabel: "Rename" }
    );

    if (!confirmed) {
      return;
    }
  }

  try {
    const profile = await window.runWithPiggyLoader(() => workspaceCore.renameProfile(id, nextName), {
      title: "Renaming profile",
      message: "Updating the workspace name everywhere it appears."
    });
    render();
    window.showToast?.("Profile updated", `${profile.name} was renamed successfully.`);
  } catch (error) {
    if (error.message === "PROFILE_NAME_EXISTS") {
      window.showToast?.("Name already used", "Choose a different profile name. Duplicate usernames are not allowed.");
      return;
    }

    if (error.message === "PROFILE_NAME_EMPTY") {
      window.showToast?.("Name required", "Profile names cannot be empty.");
      return;
    }

    throw error;
  }
}

function exportBackupFile() {
  window.runWithPiggyLoader(() => {
    const blob = new Blob([workspaceCore.exportBackup()], { type: "application/json;charset=utf-8" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `piggybank-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, {
    title: "Preparing backup",
    message: "Bundling all profiles, budgets, and transactions into one file."
  });
}

function triggerImportBackup() {
  document.getElementById("backupImportInput").click();
}

async function importBackupFile(event) {
  const [file] = event.target.files || [];

  if (!file) {
    return;
  }

  const confirmed = await window.showConfirmDialog(
    "Import backup",
    "Import this backup file? This can replace the current local workspace data and profiles in this browser.",
    { confirmLabel: "Import backup" }
  );

  if (!confirmed) {
    event.target.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      await window.runWithPiggyLoader(() => workspaceCore.importBackup(String(reader.result || "")), {
        title: "Importing backup",
        message: "Restoring profiles, budgets, and transaction history."
      });
      render();
      window.showToast?.("Backup imported", "All profiles and finance data were restored.");
    } catch (error) {
      window.showToast?.("Import failed", "That file could not be read as a PiggyBank backup.");
    }
  };
  reader.readAsText(file);
  event.target.value = "";
}

function renderStats(store, activeProfile) {
  const profiles = Object.values(store.profiles);
  const totalTransactions = profiles.reduce((sum, profile) => sum + profile.transactions.length, 0);
  const totalRecurring = profiles.reduce((sum, profile) => (
    sum + profile.recurringTransactions.filter((entry) => entry.enabled).length
  ), 0);

  document.getElementById("profileCount").innerText = profiles.length;
  document.getElementById("activeProfileName").innerText = activeProfile.name;
  document.getElementById("totalTransactionCount").innerText = totalTransactions;
  document.getElementById("recurringCount").innerText = totalRecurring;
}

function renderProfileSelect(store, activeProfile) {
  const select = document.getElementById("workspaceProfileSelect");
  select.innerHTML = Object.values(store.profiles).map((profile) => `
    <option value="${profile.id}" ${profile.id === activeProfile.id ? "selected" : ""}>${profile.name}</option>
  `).join("");
}

function renderProfileList(store, activeProfile) {
  const list = document.getElementById("profileList");
  const profiles = Object.values(store.profiles);

  list.innerHTML = profiles.map((profile) => {
    const totals = workspaceCore.getTotals(profile.transactions);
    const recurringCount = profile.recurringTransactions.filter((entry) => entry.enabled).length;
    const budgetCategories = Object.keys(profile.categoryBudgets || {}).length;

    return `
      <article class="profile-card ${profile.id === activeProfile.id ? "active" : ""}">
        <div class="profile-head">
          <div>
            <h3>${profile.name}</h3>
            <p class="meta">${profile.id === activeProfile.id ? "Currently active" : "Saved local user profile"}</p>
          </div>
          <div class="meta">Updated ${workspaceCore.formatDate(profile.updatedAt)}</div>
        </div>

        <div class="profile-stats">
          <div class="metric">
            <span>Transactions</span>
            <strong>${profile.transactions.length}</strong>
          </div>
          <div class="metric">
            <span>Balance</span>
            <strong>${formatCurrency(totals.balance)}</strong>
          </div>
          <div class="metric">
            <span>Recurring</span>
            <strong>${recurringCount}</strong>
          </div>
          <div class="metric">
            <span>Category Budgets</span>
            <strong>${budgetCategories}</strong>
          </div>
        </div>

        <div class="profile-actions">
          <div class="meta">Target ${formatCurrency(profile.budgetTarget || 0)} • Income ${formatCurrency(totals.income)} • Expense ${formatCurrency(totals.expense)}</div>
          <div class="profile-actions">
            <button type="button" onclick="switchToProfile('${profile.id}')">${profile.id === activeProfile.id ? "Active" : "Switch To"}</button>
            <button type="button" class="secondary" onclick="renameProfileFromWorkspace('${profile.id}', '${encodeURIComponent(profile.name)}')">Edit Name</button>
            <button type="button" class="danger" onclick="deleteProfileFromWorkspace('${profile.id}')">Delete</button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function render() {
  const store = workspaceCore.getStore();
  const activeProfile = store.profiles[store.activeProfileId];
  renderStats(store, activeProfile);
  renderProfileSelect(store, activeProfile);
  renderProfileList(store, activeProfile);
}

workspaceCore.subscribe(render);
render();
