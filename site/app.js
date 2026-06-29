const PILOT_DISCUSSION_URL = "https://github.com/omerakben/haven-desk/discussions";

const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");

function setNav(open) {
  if (siteNav) siteNav.dataset.open = String(open);
  navToggle?.setAttribute("aria-expanded", String(open));
  navToggle?.setAttribute("aria-label", open ? "Close menu" : "Open menu");
}

navToggle?.addEventListener("click", () => {
  setNav(siteNav?.dataset.open !== "true");
});

siteNav?.addEventListener("click", (event) => {
  if (event.target instanceof HTMLAnchorElement) setNav(false);
});

// Escape and outside-tap close the open mobile drawer.
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && siteNav?.dataset.open === "true") {
    setNav(false);
    navToggle?.focus();
  }
});

document.addEventListener("click", (event) => {
  if (
    siteNav?.dataset.open === "true" &&
    event.target instanceof Node &&
    !siteNav.contains(event.target) &&
    !navToggle?.contains(event.target)
  ) {
    setNav(false);
  }
});

const installTabs = document.querySelectorAll("[data-install-tab]");
const installPanels = document.querySelectorAll("[data-install-panel]");

function activateTab(tab) {
  const target = tab.getAttribute("data-install-tab");
  installTabs.forEach((item) => {
    const isActive = item === tab;
    item.classList.toggle("active", isActive);
    item.setAttribute("aria-selected", String(isActive));
    item.tabIndex = isActive ? 0 : -1;
  });
  installPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.getAttribute("data-install-panel") === target);
  });
}

installTabs.forEach((tab) => {
  tab.addEventListener("click", () => activateTab(tab));
  tab.addEventListener("keydown", (event) => {
    const tabs = [...installTabs];
    const i = tabs.indexOf(tab);
    let next;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = tabs[(i + 1) % tabs.length];
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = tabs[(i - 1 + tabs.length) % tabs.length];
    if (next) {
      event.preventDefault();
      activateTab(next);
      next.focus();
    }
  });
});

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall back for local previews and browsers that block clipboard writes.
    }
  }

  const scratch = document.createElement("textarea");
  scratch.value = text;
  scratch.setAttribute("readonly", "");
  scratch.style.position = "fixed";
  scratch.style.opacity = "0";
  document.body.appendChild(scratch);
  scratch.select();
  document.execCommand("copy");
  scratch.remove();
}

document.querySelectorAll("[data-copy-command]").forEach((button) => {
  button.addEventListener("click", async () => {
    const commandId = button.getAttribute("data-copy-command");
    const command = commandId ? document.getElementById(commandId)?.textContent?.trim() : "";
    if (!command) {
      return;
    }
    await copyText(command);
    button.textContent = "Copied";
    button.classList.add("copied");
    window.setTimeout(() => {
      button.textContent = "Copy";
      button.classList.remove("copied");
    }, 1600);
  });
});

const form = document.querySelector("#pilot-form");
const output = document.querySelector("#application-output");
const summaryField = document.querySelector("#application-summary");
const copyButton = document.querySelector("#copy-application");
const contactLink = document.querySelector("#contact-application");
const emailWarning = document.querySelector("#email-warning");

function getValue(formData, key) {
  return String(formData.get(key) || "").trim();
}

function buildSummary(formData) {
  return [
    "Haven Desk small business early-access application",
    "",
    `Name: ${getValue(formData, "name")}`,
    `Email: ${getValue(formData, "email")}`,
    `Business type: ${getValue(formData, "business")}`,
    `Machine: ${getValue(formData, "machine")}`,
    "",
    "Weekly admin pain:",
    getValue(formData, "pain"),
    "",
    "Data they avoid pasting into cloud AI:",
    getValue(formData, "privacy"),
    "",
    "Consent:",
    "The applicant understands Haven Desk is early access and does not send messages or take external actions for them.",
  ].join("\n");
}

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const summary = buildSummary(formData);

  if (summaryField instanceof HTMLTextAreaElement) {
    summaryField.value = summary;
  }
  if (contactLink instanceof HTMLAnchorElement) {
    contactLink.href = PILOT_DISCUSSION_URL;
  }
  if (emailWarning) {
    emailWarning.textContent =
      "Keep the application summary private. GitHub Discussions are public, so use them only to request pilot contact.";
  }
  output?.removeAttribute("hidden");
  const prefersReduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  output?.scrollIntoView({ behavior: prefersReduce ? "auto" : "smooth", block: "start" });
});

copyButton?.addEventListener("click", async () => {
  if (!(summaryField instanceof HTMLTextAreaElement)) {
    return;
  }
  await copyText(summaryField.value);
  copyButton.textContent = "Copied";
  window.setTimeout(() => {
    copyButton.textContent = "Copy application";
  }, 1800);
});

/* ── Theme toggle (system-aware, persisted; mirrors the app's defaultTheme="system") ── */
const themeToggle = document.querySelector(".theme-toggle");
const root = document.documentElement;
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");

function effectiveDark() {
  const forced = root.getAttribute("data-theme");
  if (forced === "dark") return true;
  if (forced === "light") return false;
  return prefersDark.matches;
}

function syncToggle() {
  const dark = effectiveDark();
  themeToggle?.setAttribute("aria-pressed", String(dark));
  // Keep the browser-chrome color in step with the active theme, not just the OS.
  let meta = document.querySelector('meta[name="theme-color"]:not([media])');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", dark ? "#0e0e11" : "#f4f4f7");
}

syncToggle();

themeToggle?.addEventListener("click", () => {
  const next = effectiveDark() ? "light" : "dark";
  root.setAttribute("data-theme", next);
  try {
    localStorage.setItem("hd-theme", next);
  } catch {
    // Private mode / storage disabled — the toggle still works for the session.
  }
  syncToggle();
});

// If the visitor has no explicit choice, follow OS changes live.
prefersDark.addEventListener?.("change", () => {
  if (!root.getAttribute("data-theme")) {
    syncToggle();
  }
});

/* ── Scroll reveal (reduced-motion safe; reveals everything if unsupported) ── */
const revealEls = document.querySelectorAll("[data-reveal]");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
window.__hdRevealed = true; // signal the head failsafe that app.js is handling reveal

if (!reduceMotion && "IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          observer.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
  );
  revealEls.forEach((el) => observer.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add("in"));
}
