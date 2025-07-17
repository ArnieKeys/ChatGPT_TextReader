// ==========================
// Elements
// ==========================
const textInput = document.getElementById("text-input");
const fileInput = document.getElementById("file-input");
const pasteBtn = document.getElementById("paste-btn");
const startBtn = document.getElementById("start-btn");
const stopBtn = document.getElementById("stop-btn");
const readingArea = document.getElementById("reading-area");
const wpmSlider = document.getElementById("wpm-slider");
const wpmValue = document.getElementById("wpm-value");
const assistiveToggle = document.getElementById("assistive-toggle");
const recentList = document.getElementById("recent-list");
const codeDisplay = document.getElementById("code-display");
const chunkSlider = document.getElementById("chunk-slider");
const chunkValue = document.getElementById("chunk-value");
const categoryInput = document.getElementById("category-input");
const addCategoryBtn = document.getElementById("add-category-btn");
const categoryFilter = document.getElementById("category-filter");
const categoryList = document.getElementById("category-list");

// ==========================
// State
// ==========================
let words = [];
let currentWord = 0;
let readingInterval = null;
let isPaused = false;
let readingIndex = 0;
let assistiveMode = false;
let recentDocs = [];
let currentDocument = {};
let chunkSize = 1;
let categories = JSON.parse(localStorage.getItem("categories") || "[]");

// ==========================
// Storage Keys
// ==========================
const LAST_POSITION_KEY = "text_reader_last_position";
const LAST_TEXT_KEY = "text_reader_last_text";
const ASSIST_MODE_KEY = "text_reader_assistive_mode";
const RECENT_DOCS_KEY = "text_reader_recent_docs";
const CATEGORIES_KEY = "text_reader_categories";

// ==========================
// UI HELPERS
// ==========================
function createDeleteButton(label = "Delete") {
  const btn = document.createElement("button");
  btn.textContent = label;
  btn.classList.add("btn-delete");
  return btn;
}

function escapeHtml(html) {
  const div = document.createElement("div");
  div.textContent = html;
  return div.innerHTML;
}

function updateCodeView(text) {
  if (codeDisplay) {
    codeDisplay.innerHTML = escapeHtml(text);
    if (typeof Prism !== "undefined") Prism.highlightElement(codeDisplay);
  }
}

// ==========================
// CATEGORY RENDERING
// ==========================

// Update UI when categories change
function renderCategories() {
  const categoryList = document.getElementById("category-list");
  const categoryFilter = document.getElementById("category-filter");

  categoryList.innerHTML = "";
  categoryFilter.innerHTML = '<option value="">All Categories</option>';

  categories.forEach((cat, index) => {
    // Sidebar manager list
    const li = document.createElement("li");
    li.textContent = cat;

    // Delete button
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => {
      categories.splice(index, 1);
      localStorage.setItem("categories", JSON.stringify(categories));
      renderCategories();
    });

    li.appendChild(deleteBtn);
    categoryList.appendChild(li);

    // Filter dropdown option
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    categoryFilter.appendChild(opt);
  });
}

// Handle Save Category button click
document.getElementById("add-category-btn").addEventListener("click", () => {
  const input = document.getElementById("category-input");
  const newCategory = input.value.trim();

  if (!newCategory) {
    alert("Please enter a category name.");
    return;
  }
  if (categories.includes(newCategory)) {
    alert("Category already exists.");
    return;
  }

  categories.push(newCategory);
  localStorage.setItem("categories", JSON.stringify(categories));
  renderCategories();

  input.value = ""; // clear input
});

function refreshCategoriesUI() {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  renderCategories();
}

// ==========================
// DOCUMENT FILTER & RENDER
// ==========================
function filterDocumentsByCategory(category) {
  let filteredDocs = recentDocs;
  if (category) {
    filteredDocs = recentDocs.filter((doc) => doc.category === category);
  }
  renderRecentDocs(filteredDocs);
}

function renderRecentDocs(docs = recentDocs) {
  recentList.innerHTML = "";

  if (docs.length === 0) {
    recentList.innerHTML = "<li>No documents found for this category</li>";
    return;
  }

  docs.forEach((doc, idx) => {
    const li = document.createElement("li");

    const span = document.createElement("span");
    span.textContent = doc.text.slice(0, 40) + "...";
    span.classList.add("doc-title");
    span.addEventListener("click", () => {
      textInput.value = doc.text;
      updateCodeView(doc.text);
    });

    const catLabel = document.createElement("span");
    catLabel.classList.add("category-label");
    catLabel.textContent = `(${doc.category || "Uncategorized"})`;

    const btnContainer = document.createElement("div");
    btnContainer.classList.add("doc-buttons");

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "Save";
    saveBtn.classList.add("btn-save");

    const delBtn = createDeleteButton();
    delBtn.addEventListener("click", () => removeRecentDoc(idx));

    btnContainer.appendChild(saveBtn);
    btnContainer.appendChild(delBtn);

    li.appendChild(span);
    li.appendChild(catLabel);
    li.appendChild(btnContainer);
    recentList.appendChild(li);
  });
}

// ==========================
// DOCUMENT STORAGE
// ==========================
function loadRecentDocs() {
  const data = localStorage.getItem(RECENT_DOCS_KEY);
  recentDocs = data ? JSON.parse(data) : [];
  filterDocumentsByCategory(categoryFilter.value);
}

function saveRecentDocs() {
  localStorage.setItem(RECENT_DOCS_KEY, JSON.stringify(recentDocs));
  filterDocumentsByCategory(categoryFilter.value);
}

function saveRecentDoc(text) {
  const selectedCategory = categoryFilter.value || "Uncategorized";
  const doc = { text, ts: Date.now(), category: selectedCategory };

  // Avoid duplicates
  recentDocs = recentDocs.filter((d) => d.text !== text);
  recentDocs.unshift(doc);

  saveRecentDocs();
}

function removeRecentDoc(index) {
  recentDocs.splice(index, 1);
  saveRecentDocs();
}

// ==========================
// CATEGORY SAVE
// ==========================
function saveDocumentToCategory(text) {
  let selectedCategory = categoryFilter.value || prompt("Enter category name:");
  if (!selectedCategory) return;

  if (!categories.includes(selectedCategory)) {
    categories.push(selectedCategory);
    refreshCategoriesUI();
  }

  const docIndex = recentDocs.findIndex((doc) => doc.text === text);
  if (docIndex !== -1) {
    recentDocs[docIndex].category = selectedCategory;
    saveRecentDocs();
  } else {
    alert("Document not found.");
  }
}

// ==========================
// READER CONTROLS
// ==========================
function showWord() {
  const chunk = words.slice(currentWord, currentWord + chunkSize).join(" ");
  readingArea.innerHTML = `<span class="highlight">${chunk}</span>`;
  if (assistiveMode) {
    readingArea.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function showFullText() {
  readingArea.textContent = textInput.value;
}

function startReading() {
  const text = document.getElementById("text-input").value.trim();
  if (!text) return;

  words = text.split(/\s+/);
  readingIndex = 0;
  isPaused = false;
  resumeReading(); // start fresh
}

function stopReading() {
  clearInterval(readingInterval);
  readingInterval = null;
  isPaused = true;

  // Enable Resume button
  document.getElementById("resume-btn").disabled = false;
  document.getElementById("start-btn").disabled = false;
}

function resumeReading() {
  if (readingInterval) return; // avoid multiple intervals

  const wpm = parseInt(document.getElementById("wpm-slider").value, 10);
  const chunkSize = parseInt(document.getElementById("chunk-slider").value, 10);
  const delay = 60000 / wpm;

  const readingArea = document.getElementById("reading-area");
  const chunkedWords = chunkSize > 1 ? chunkSize : 1;

  readingInterval = setInterval(() => {
    if (readingIndex >= words.length) {
      clearInterval(readingInterval);
      readingInterval = null;
      return;
    }

    const chunk = words
      .slice(readingIndex, readingIndex + chunkedWords)
      .join(" ");
    readingArea.innerHTML = `<span class="highlight">${chunk}</span>`;
    readingIndex += chunkedWords;
  }, delay);

  // Update button states
  document.getElementById("resume-btn").disabled = true;
  document.getElementById("stop-btn").disabled = false;
}
// ==========================
// CLEAR BUTTON
// ==========================
const clearBtn = document.createElement("button");
clearBtn.textContent = "🧹 Clear All";
clearBtn.classList.add("clear-btn");
clearBtn.disabled = true;

function setClearBtnState(enable) {
  clearBtn.disabled = !enable;
  clearBtn.classList.toggle("active", enable);
}

clearBtn.addEventListener("click", () => {
  if (clearBtn.disabled) return;
  const confirmed = confirm("⚠️ Clear all text?");
  if (confirmed) {
    stopReading();
    textInput.value = "";
    readingArea.textContent = "";
    updateCodeView("");
    words = [];
    currentWord = 0;
    localStorage.removeItem(LAST_TEXT_KEY);
    localStorage.removeItem(LAST_POSITION_KEY);
    setClearBtnState(false);
  }
});

function lockClearWhileReading(lock) {
  if (lock) {
    setClearBtnState(false);
  } else {
    const hasText = textInput.value.trim().length > 0;
    setClearBtnState(hasText);
  }
}

// ==========================
// INIT FUNCTION
// ==========================
function init() {
  // Load assistive mode
  assistiveMode = JSON.parse(localStorage.getItem(ASSIST_MODE_KEY) || "false");
  assistiveToggle.checked = assistiveMode;
  readingArea.classList.toggle("assistive-bg", assistiveMode);

  renderCategories();
  loadRecentDocs();

  // Resume state
  if (localStorage.getItem(LAST_POSITION_KEY)) {
    document.getElementById("resume-btn").disabled = false;
  }

  // Add clear button to DOM
  document.body.appendChild(clearBtn);

  // Event listeners
  categoryFilter.addEventListener("change", () =>
    filterDocumentsByCategory(categoryFilter.value)
  );

  addCategoryBtn.addEventListener("click", () => {
    const category = categoryInput.value.trim();
    if (category && !categories.includes(category)) {
      categories.push(category);
      categoryInput.value = "";
      refreshCategoriesUI();
    } else {
      alert("Enter a valid or unique category.");
    }
  });

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      textInput.value = evt.target.result;
      saveRecentDoc(textInput.value);
      updateCodeView(textInput.value);
    };
    reader.readAsText(file);
    fileInput.value = "";
  });

  pasteBtn.addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        textInput.value = text;
        saveRecentDoc(text);
        updateCodeView(text);
      }
    } catch {
      alert("Clipboard access denied.");
    }
  });

  wpmSlider.addEventListener("input", () => {
    wpmValue.textContent = wpmSlider.value;
  });

  chunkSlider.addEventListener("input", () => {
    chunkSize = parseInt(chunkSlider.value, 10);
    chunkValue.textContent = chunkSize;
  });

  assistiveToggle.addEventListener("change", () => {
    assistiveMode = assistiveToggle.checked;
    readingArea.classList.toggle("assistive-bg", assistiveMode);
    localStorage.setItem(ASSIST_MODE_KEY, assistiveMode);
  });

  textInput.addEventListener("input", () => {
    const hasText = textInput.value.trim().length > 0;
    if (!readingInterval) setClearBtnState(hasText);
  });

  startBtn.addEventListener("click", () => startReading());
  stopBtn.addEventListener("click", () => stopReading());
}

// ==========================
// BOOTSTRAP
// ==========================
document.addEventListener("DOMContentLoaded", init);

// ==========================
// PWA INSTALL PROMPT
// ==========================
let deferredPrompt = null;

function setupInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;

    const installBtn = document.createElement("button");
    installBtn.textContent = "📲 Install App";
    installBtn.classList.add("btn-install");
    installBtn.addEventListener("click", async () => {
      installBtn.remove();
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(
        outcome === "accepted" ? "User installed app" : "User dismissed install"
      );
      deferredPrompt = null;
    });

    document.body.appendChild(installBtn);
  });
}

// ==========================
// INSTALL BANNER HELPERS
// ==========================
function isInStandaloneMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function showInstallBanner() {
  if (isInStandaloneMode() || localStorage.getItem("installPromptDismissed"))
    return;

  const banner = document.createElement("div");
  banner.classList.add("install-banner");

  const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  banner.innerHTML = isIOS
    ? `📲 Add to Home Screen: <br>Tap <strong>Share</strong> → <strong>Add to Home Screen</strong>`
    : `📲 Install this app: <br>Tap <strong>⋮ Menu</strong> → <strong>Add to Home Screen</strong>`;

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  closeBtn.classList.add("btn-banner-close");

  closeBtn.addEventListener("click", () => {
    banner.remove();
    localStorage.setItem("installPromptDismissed", "true");
  });

  banner.appendChild(closeBtn);
  document.body.appendChild(banner);

  // Optional auto-hide
  setTimeout(() => banner.remove(), 10000);
}

// ==========================
// FB/INSTAGRAM IN-APP BROWSER WARNING
// ==========================
function isFacebookBrowser() {
  const ua = navigator.userAgent || navigator.vendor || window.opera;
  return ua.includes("FBAN") || ua.includes("FBAV") || ua.includes("Instagram");
}

function showFacebookWarning() {
  if (!isFacebookBrowser()) return;

  const fbBanner = document.createElement("div");
  fbBanner.classList.add("install-banner", "fb-warning");
  fbBanner.innerHTML = `
    ⚠️ You're viewing this inside Facebook/Instagram.<br>
    <b>Tap ⋮ or "Open in Browser"</b> for best experience.
  `;
  document.body.appendChild(fbBanner);

  // Remove after 15s to avoid clutter
  setTimeout(() => fbBanner.remove(), 15000);
}

// ==========================
// DRAG & DROP SUPPORT
// ==========================
function handleDroppedFile(file) {
  if (!file.type.startsWith("text/")) {
    alert("Please drop a plain text file.");
    return;
  }
  const reader = new FileReader();
  reader.onload = (evt) => {
    const text = evt.target.result;
    textInput.value = text;
    saveRecentDoc(text);
    updateCodeView(text);
  };
  reader.readAsText(file);
}

function setupDragAndDrop() {
  document.addEventListener("dragover", (e) => {
    e.preventDefault();
    document.body.classList.add("drag-over");
  });
  document.addEventListener("dragleave", (e) => {
    e.preventDefault();
    document.body.classList.remove("drag-over");
  });
  document.addEventListener("drop", (e) => {
    e.preventDefault();
    document.body.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) handleDroppedFile(file);
  });
}

// ==========================
// SERVICE WORKER HANDLER
// ==========================
function setupServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.forEach((reg) => reg.unregister())) // Dev: always unregister first
      .finally(() => {
        navigator.serviceWorker.register("/service-worker.js");
      });
  }
}

// ==========================
// PHASE 2 INIT
// ==========================
function initPhase2() {
  setupInstallPrompt();

  // Show install banners only on mobile
  if (/android|iphone|ipad|ipod/i.test(window.navigator.userAgent)) {
    showInstallBanner();
  }

  // Show FB/Instagram warning if needed
  showFacebookWarning();

  // Drag & drop handling
  setupDragAndDrop();

  // Register service worker
  setupServiceWorker();
}

// Final unified bootstrap
document.addEventListener("DOMContentLoaded", () => {
  init(); // Phase 1 (reader, categories, clear btn)
  initPhase2(); // Phase 2 (install prompt, banners, drag/drop)
});

// ==========================
// STATE PERSISTENCE & AUTOSAVE
// ==========================
function autoSaveReadingState() {
  if (readingInterval) {
    localStorage.setItem(LAST_POSITION_KEY, currentWord);
    localStorage.setItem(LAST_TEXT_KEY, textInput.value);
  }
}

function restoreSavedText() {
  const savedText = localStorage.getItem(LAST_TEXT_KEY);
  const savedPos = parseInt(localStorage.getItem(LAST_POSITION_KEY), 10);

  if (savedText) {
    textInput.value = savedText;
    updateCodeView(savedText);

    const resumeBtn = document.getElementById("resume-btn");
    if (resumeBtn && !isNaN(savedPos)) {
      resumeBtn.disabled = false;
      resumeBtn.addEventListener("click", () => {
        resumeReadingFromPosition(savedPos);
      });
    }
  }
}

function resumeReadingFromPosition(index) {
  const text = textInput.value.trim();
  if (!text || isNaN(index)) {
    alert("No saved position or text found.");
    return;
  }

  words = text
    .replace(/[\n\r]+/g, " ")
    .replace(/\s+/g, " ")
    .split(" ");
  if (index >= words.length) {
    alert("Saved position exceeds text length.");
    return;
  }
  startReading(index);
}

// ==========================
// GENERIC READING HANDLER
// ==========================
function beginReading(text, startIndex = 0) {
  words = text
    .replace(/[\n\r]+/g, " ")
    .replace(/\s+/g, " ")
    .split(" ");
  currentWord = startIndex;

  showWord(); // first chunk
  startBtn.disabled = true;
  stopBtn.disabled = false;
  textInput.disabled = true;
  wpmSlider.disabled = true;

  const interval = 60000 / parseInt(wpmSlider.value, 10);
  if (readingInterval) clearInterval(readingInterval);

  readingInterval = setInterval(() => {
    currentWord += chunkSize;
    if (currentWord >= words.length) {
      stopReading();
    } else {
      showWord();
    }
  }, interval);

  lockClearWhileReading(true);
}

// ==========================
// MAIN START/STOP
// ==========================
function startReading(startIndex = 0) {
  const text = textInput.value.trim();
  if (!text) {
    alert("Please enter or load text before reading.");
    return;
  }
  beginReading(text, startIndex);
}

function stopReading() {
  if (readingInterval) clearInterval(readingInterval);
  readingInterval = null;

  showFullText();
  startBtn.disabled = false;
  stopBtn.disabled = true;
  textInput.disabled = false;
  wpmSlider.disabled = false;

  autoSaveReadingState();
  lockClearWhileReading(false);
}

// ==========================
// SELECTION-BASED READING
// ==========================
function readSelectedText() {
  const selStart = textInput.selectionStart;
  const selEnd = textInput.selectionEnd;

  if (selStart === selEnd) {
    alert("Please select some text inside the text box.");
    return;
  }

  const selectedText = textInput.value.substring(selStart, selEnd).trim();
  if (!selectedText) {
    alert("Selected text is empty.");
    return;
  }

  beginReading(selectedText, 0);
}

// ==========================
// KEYBOARD SHORTCUTS
// ==========================
function setupKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "Enter") {
      if (!readingInterval) startReading();
    }
    if (e.key === "Escape") {
      if (readingInterval) stopReading();
    }
  });
}

// ==========================
// CLEAR BUTTON LOCK/UNLOCK
// ==========================
function lockClearWhileReading(lock) {
  if (lock) {
    setClearBtnState(false); // fully disable during reading
  } else {
    const hasText = textInput.value.trim().length > 0;
    setClearBtnState(hasText);
  }
}

// ==========================
// AUTO SAVE TIMER
// ==========================
function setupAutoSaveTimer() {
  setInterval(() => autoSaveReadingState(), 10000);
}
function initPhase3() {
  // Restore last text & resume button state
  restoreSavedText();

  // Resume reading manually if needed
  const resumeBtn = document.getElementById("resume-btn");
  if (resumeBtn) {
    resumeBtn.addEventListener("click", () => {
      const savedIndex = parseInt(localStorage.getItem(LAST_POSITION_KEY), 10);
      resumeReadingFromPosition(savedIndex);
    });
  }

  // Read selection button
  const selectionBtn = document.getElementById("read-selection-btn");
  if (selectionBtn) {
    selectionBtn.addEventListener("click", readSelectedText);
  }

  // Keyboard shortcuts
  setupKeyboardShortcuts();

  // Auto-save timer every 10s
  setupAutoSaveTimer();
}
document.addEventListener("DOMContentLoaded", () => {
  init(); // Phase 1 - categories, reader UI, clear btn
  initPhase2(); // Phase 2 - install prompt, banners, drag/drop
  initPhase3(); // Phase 3 - reading state, selection read, autosave
});
// ==========================
// ASSISTIVE MODE ENHANCEMENTS
// ==========================
function applyAssistiveMode(enabled) {
  assistiveMode = enabled;
  assistiveToggle.checked = enabled;
  readingArea.classList.toggle("assistive-active", enabled);
  localStorage.setItem(ASSIST_MODE_KEY, JSON.stringify(enabled));
}

function toggleAssistiveMode() {
  applyAssistiveMode(assistiveToggle.checked);
}

// Smooth scroll centering for assistive mode
function centerHighlightedWord() {
  if (!assistiveMode) return;
  readingArea.scrollIntoView({ behavior: "smooth", block: "center" });
}

// Override `showWord()` to include smooth scroll
const originalShowWord = showWord;
showWord = function () {
  originalShowWord();
  centerHighlightedWord();
};

// ==========================
// FEEDBACK HELPERS
// ==========================
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  document.body.appendChild(toast);

  // Animate + auto-remove
  setTimeout(() => toast.classList.add("visible"), 50);
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ==========================
// CATEGORY / DOC REFRESH OPTIMIZATION
// ==========================
let categoryRenderPending = false;
function scheduleCategoryRender() {
  if (!categoryRenderPending) {
    categoryRenderPending = true;
    requestAnimationFrame(() => {
      renderCategories();
      categoryRenderPending = false;
    });
  }
}

let docRenderPending = false;
function scheduleRecentDocRender() {
  if (!docRenderPending) {
    docRenderPending = true;
    requestAnimationFrame(() => {
      filterDocumentsByCategory(categoryFilter.value);
      docRenderPending = false;
    });
  }
}

// Hook into save/remove to avoid redundant re-renders
const originalSaveRecentDocs = saveRecentDocs;
saveRecentDocs = function () {
  localStorage.setItem(RECENT_DOCS_KEY, JSON.stringify(recentDocs));
  scheduleRecentDocRender(); // optimize re-render
};

// ==========================
// FILE LOAD IMPROVEMENTS
// ==========================
function loadFileIntoReader(file) {
  if (!file.type.startsWith("text/")) {
    showToast("❌ Please upload a text file.", "error");
    return;
  }
  const reader = new FileReader();
  reader.onload = (evt) => {
    const content = evt.target.result;
    textInput.value = content;
    updateCodeView(content);
    saveRecentDoc(content);
    showToast("✅ File loaded successfully!", "success");
  };
  reader.readAsText(file);
}

// Replace old handler
fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) loadFileIntoReader(file);
  fileInput.value = "";
});

// Drag-drop uses same handler
function handleDroppedFile(file) {
  loadFileIntoReader(file);
}

// ==========================
// MOBILE SAFETY: DISMISS BANNERS
// ==========================
function dismissInstallBanner(banner) {
  banner.remove();
  localStorage.setItem("installPromptDismissed", "true");
}

// Auto-dismiss banners with animation
function autoHideBanner(banner, delay = 10000) {
  setTimeout(() => {
    banner.classList.add("fade-out");
    setTimeout(() => banner.remove(), 500);
  }, delay);
}

// ==========================
// IMPROVED INSTALL PROMPT
// ==========================
function showInstallPrompt() {
  if (isInStandaloneMode() || localStorage.getItem("installPromptDismissed"))
    return;

  const banner = document.createElement("div");
  banner.classList.add("install-banner");

  const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  banner.innerHTML = isIOS
    ? `📲 Add to Home Screen:<br>Tap <strong>Share</strong> → <strong>Add to Home Screen</strong>`
    : `📲 Install this app:<br>Tap <strong>Menu ⋮</strong> → <strong>Add to Home Screen</strong>`;

  const closeBtn = document.createElement("button");
  closeBtn.classList.add("banner-close");
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", () => dismissInstallBanner(banner));

  banner.appendChild(closeBtn);
  document.body.appendChild(banner);

  autoHideBanner(banner, 10000);
}

// ==========================
// SAFETY: FACEBOOK BROWSER WARNING
// ==========================
function showFacebookWarning() {
  if (!isFacebookBrowser()) return;

  const banner = document.createElement("div");
  banner.classList.add("fb-warning");
  banner.innerHTML = `
    ⚠️ You're using Facebook/Instagram in-app browser.<br>
    <b>Open in Chrome/Safari</b> for best experience.`;

  document.body.appendChild(banner);
  autoHideBanner(banner, 8000);
}
function initPhase4() {
  // Assistive toggle setup
  assistiveToggle.addEventListener("change", toggleAssistiveMode);

  // Restore assistive mode from storage
  applyAssistiveMode(
    JSON.parse(localStorage.getItem(ASSIST_MODE_KEY) || "false")
  );

  // Show install prompt if eligible
  if (/android|iphone|ipad|ipod/i.test(window.navigator.userAgent)) {
    showInstallPrompt();
  }

  // Show FB browser warning if needed
  showFacebookWarning();
}
document.addEventListener("DOMContentLoaded", () => {
  init(); // Phase 1 - core setup
  initPhase2(); // Phase 2 - install banners & drag-drop
  initPhase3(); // Phase 3 - reading state & resume
  initPhase4(); // Phase 4 - UX & assistive refinements
});

const darkToggle = document.createElement("button");
darkToggle.textContent = "🌙 Dark Mode";
darkToggle.classList.add("dark-toggle");
darkToggle.style.position = "fixed";
darkToggle.style.top = "20px";
darkToggle.style.left = "20px";
darkToggle.style.padding = "6px 10px";
darkToggle.style.zIndex = "1000";
document.body.appendChild(darkToggle);

// Restore saved theme
if (localStorage.getItem("darkMode") === "true") {
  document.body.classList.add("dark-mode");
  darkToggle.textContent = "☀️ Light Mode";
}

darkToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
  const isDark = document.body.classList.contains("dark-mode");
  darkToggle.textContent = isDark ? "☀️ Light Mode" : "🌙 Dark Mode";
  localStorage.setItem("darkMode", isDark);
});
