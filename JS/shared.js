(function initializeSharedUi() {
  const core = window.PiggyBankCore;
  const navbar = document.querySelector(".navbar");

  if (!navbar || !core) {
    return;
  }

  if (!document.querySelector(".toast-stack")) {
    const toastStack = document.createElement("div");
    toastStack.className = "toast-stack";
    document.body.appendChild(toastStack);
  }

  if (!document.querySelector(".modal-root")) {
    const modalRoot = document.createElement("div");
    modalRoot.className = "modal-root";
    document.body.appendChild(modalRoot);
  }

  if (!document.querySelector(".loader-root")) {
    const loaderRoot = document.createElement("div");
    loaderRoot.className = "loader-root";
    document.body.appendChild(loaderRoot);
  }

  const menu = navbar.querySelector(".menu");

  if (menu && !navbar.querySelector(".nav-tools")) {
    const tools = document.createElement("div");
    tools.className = "nav-tools";

    const profileChip = document.createElement("div");
    profileChip.className = "profile-chip";
    profileChip.innerHTML = `
      <div class="profile-meta">
        <small>Active profile</small>
        <strong id="activeProfileChip">Personal Space</strong>
      </div>
      <select id="navProfileSelect" class="profile-select" aria-label="Switch active profile"></select>
    `;

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "nav-toggle";
    toggle.setAttribute("aria-label", "Toggle navigation");
    toggle.innerHTML = '<span class="nav-toggle-lines"></span>';
    toggle.addEventListener("click", () => {
      document.body.classList.toggle("nav-open");
    });

    tools.appendChild(profileChip);
    tools.appendChild(toggle);
    navbar.appendChild(tools);
  }

  function syncProfileChip() {
    const chip = document.getElementById("activeProfileChip");
    const select = document.getElementById("navProfileSelect");
    const profile = core.getProfile();
    const profiles = core.getProfiles();

    if (chip && profile) {
      chip.textContent = profile.name;
    }

    if (select) {
      select.innerHTML = profiles.map((entry) => `
        <option value="${entry.id}" ${profile && entry.id === profile.id ? "selected" : ""}>${entry.name}</option>
      `).join("");
    }
  }

  function closeNavOnWide() {
    if (window.innerWidth > 860) {
      document.body.classList.remove("nav-open");
    }
  }

  const navProfileSelect = document.getElementById("navProfileSelect");
  if (navProfileSelect) {
    navProfileSelect.addEventListener("change", async (event) => {
      const nextId = event.target.value;
      const nextProfile = await window.runWithPiggyLoader(
        () => core.switchProfile(nextId),
        {
          title: "Switching profile",
          message: "Loading the selected workspace and finance data."
        }
      );
      syncProfileChip();
      window.showToast?.("Profile switched", `Now viewing ${nextProfile.name}.`);
    });
  }

  window.showToast = function showToast(title, message) {
    const stack = document.querySelector(".toast-stack");
    if (!stack) {
      return;
    }

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `<strong>${title}</strong><p>${message}</p>`;
    stack.appendChild(toast);

    window.setTimeout(() => {
      toast.remove();
    }, 3600);
  };

  function openModal({ title, message, inputValue = "", confirmLabel = "Confirm", cancelLabel = "Cancel", mode = "confirm" }) {
    const root = document.querySelector(".modal-root");

    if (!root) {
      return Promise.resolve(mode === "prompt" ? null : false);
    }

    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";

      const panel = document.createElement("div");
      panel.className = "modal-panel";

      const inputMarkup = mode === "prompt"
        ? `<input id="sharedModalInput" class="modal-input" type="text" value="${String(inputValue).replace(/"/g, "&quot;")}">`
        : "";

      panel.innerHTML = `
        <div class="modal-kicker">Confirmation</div>
        <div class="modal-success" aria-hidden="true">
          <div class="modal-success-ring"></div>
          <div class="modal-success-check"></div>
        </div>
        <h3>${title}</h3>
        <p>${message}</p>
        ${inputMarkup}
        <div class="modal-actions">
          <button type="button" class="modal-btn modal-btn-secondary" data-action="cancel">${cancelLabel}</button>
          <button type="button" class="modal-btn modal-btn-primary" data-action="confirm">${confirmLabel}</button>
        </div>
      `;

      overlay.appendChild(panel);
      root.appendChild(overlay);
      document.body.classList.add("modal-open");

      const input = panel.querySelector("#sharedModalInput");
      const close = (result) => {
        overlay.classList.add("closing");
        window.setTimeout(() => {
          overlay.remove();
          document.body.classList.remove("modal-open");
          resolve(result);
        }, 180);
      };

      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
          close(mode === "prompt" ? null : false);
        }
      });

      panel.querySelector('[data-action="cancel"]').addEventListener("click", () => {
        close(mode === "prompt" ? null : false);
      });

      panel.querySelector('[data-action="confirm"]').addEventListener("click", () => {
        panel.classList.add("is-completing");
        window.setTimeout(() => {
          close(mode === "prompt" ? input.value : true);
        }, 520);
      });

      panel.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          close(mode === "prompt" ? null : false);
        }

        if (event.key === "Enter") {
          event.preventDefault();
          panel.classList.add("is-completing");
          window.setTimeout(() => {
            close(mode === "prompt" ? input.value : true);
          }, 520);
        }
      });

      window.setTimeout(() => {
        (input || panel.querySelector('[data-action="confirm"]')).focus();
        if (input) {
          input.select();
        }
      }, 20);
    });
  }

  window.showConfirmDialog = function showConfirmDialog(title, message, options = {}) {
    return openModal({
      title,
      message,
      confirmLabel: options.confirmLabel || "Confirm",
      cancelLabel: options.cancelLabel || "Cancel",
      mode: "confirm"
    });
  };

  window.showPromptDialog = function showPromptDialog(title, message, options = {}) {
    return openModal({
      title,
      message,
      inputValue: options.initialValue || "",
      confirmLabel: options.confirmLabel || "Save",
      cancelLabel: options.cancelLabel || "Cancel",
      mode: "prompt"
    });
  };

  window.runWithPiggyLoader = async function runWithPiggyLoader(action, options = {}) {
    const root = document.querySelector(".loader-root");

    if (!root) {
      return Promise.resolve(action());
    }

    const overlay = document.createElement("div");
    overlay.className = "loader-overlay";
    overlay.innerHTML = `
      <div class="loader-panel">
        <div class="piggy-loader" aria-hidden="true">
          <div class="piggy-shadow"></div>
          <div class="piggy-coin piggy-coin-one"></div>
          <div class="piggy-coin piggy-coin-two"></div>
          <div class="piggy-body">
            <div class="piggy-ear"></div>
            <div class="piggy-ear piggy-ear-right"></div>
            <div class="piggy-eye"></div>
            <div class="piggy-snout"></div>
            <div class="piggy-leg piggy-leg-one"></div>
            <div class="piggy-leg piggy-leg-two"></div>
          </div>
        </div>
        <strong>${options.title || "Updating your money tracker"}</strong>
        <p>${options.message || "One moment while we finish this step."}</p>
      </div>
    `;

    root.appendChild(overlay);
    document.body.classList.add("loader-open");

    const startedAt = Date.now();

    try {
      const result = await Promise.resolve(action());
      const minDuration = options.minDuration ?? 900;
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(minDuration - elapsed, 0);

      await new Promise((resolve) => window.setTimeout(resolve, remaining));
      overlay.classList.add("closing");
      await new Promise((resolve) => window.setTimeout(resolve, 220));
      overlay.remove();
      document.body.classList.remove("loader-open");
      return result;
    } catch (error) {
      overlay.classList.add("closing");
      await new Promise((resolve) => window.setTimeout(resolve, 220));
      overlay.remove();
      document.body.classList.remove("loader-open");
      throw error;
    }
  };

  syncProfileChip();
  core.subscribe(syncProfileChip);
  window.addEventListener("resize", closeNavOnWide);
})();
