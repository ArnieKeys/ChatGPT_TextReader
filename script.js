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
// INITIAL CATEGORY RENDER
// ==========================
function renderCategories() {
  categoryFilter.innerHTML = `<option value="">All Categories</option>`;
  categoryList.innerHTML = ""; // Reset the category list in sidebar

  categories.forEach((cat) => {
    // Dropdown
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    categoryFilter.appendChild(opt);

    // Sidebar list
    const li = document.createElement("li");
    li.textContent = cat;

    const delBtn = createDeleteButton();

    delBtn.textContent = "Delete";
    delBtn.style.background = "#ff4444";

    delBtn.addEventListener("click", () => {
      if (confirm(`Delete category "${cat}"?`)) {
        categories = categories.filter((c) => c !== cat);
        localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
        renderCategories();

        // Reset docs in this category → Uncategorized
        recentDocs.forEach((doc) => {
          if (doc.category === cat) doc.category = "Uncategorized";
        });
        saveRecentDocs();
      }
    });

    li.appendChild(delBtn);
    categoryList.appendChild(li);
  });
}

// ==========================
// DOCUMENTS FILTER & RENDER
// ==========================
function filterDocumentsByCategory(category) {
  let filteredDocs = recentDocs;
  if (category && category !== "") {
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
    saveBtn.classList.add("save-btn");
    btnContainer.appendChild(saveBtn);

    const delBtn = createDeleteButton();
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => removeRecentDoc(idx));
    btnContainer.appendChild(delBtn);

    li.appendChild(span);
    li.appendChild(catLabel);
    li.appendChild(btnContainer);
    recentList.appendChild(li);
  });
}

// ==========================
// DOC STORAGE HANDLERS
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
  localStorage.setItem(RECENT_DOCS_KEY, JSON.stringify(recentDocs));
  renderRecentDocs();
}

// ==========================
// CATEGORY SAVE
// ==========================
function saveDocumentToCategory(text) {
  let selectedCategory = categoryFilter.value || prompt("Enter category name:");
  if (!selectedCategory) return;

  if (!categories.includes(selectedCategory)) {
    categories.push(selectedCategory);
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
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
// FILE HANDLERS
// ==========================
function loadFileIntoCategory(fileContent) {
  const selectedCategory = categoryFilter.value;
  const newDoc = {
    text: fileContent,
    ts: Date.now(),
    category: selectedCategory || "Uncategorized",
  };
  recentDocs.unshift(newDoc);
  saveRecentDocs();
}

// ==========================
// READER CONTROLS
// ==========================
function startReading(fromIndex = null) {
  const text = textInput.value.trim();
  if (!text) {
    alert("Please enter or load text before reading.");
    return;
  }

  words = text
    .replace(/[\n\r]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ");
  currentWord =
    fromIndex !== null && fromIndex >= 0 && fromIndex < words.length
      ? fromIndex
      : 0;

  showWord();

  startBtn.disabled = true;
  stopBtn.disabled = false;
  wpmSlider.disabled = true;

  readingArea.style.maxHeight = "none";
  readingArea.style.overflowY = "auto";

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
}

function stopReading() {
  clearInterval(readingInterval);
  readingInterval = null;

  showFullText();

  startBtn.disabled = false;
  stopBtn.disabled = true;
  textInput.disabled = false;
  wpmSlider.disabled = false;

  localStorage.setItem(LAST_POSITION_KEY, currentWord);
  document.getElementById("resume-btn").disabled = false;
}

function startReadingFromIndex(index) {
  if (!words.length) {
    const text = textInput.value.trim();
    if (!text) return;
    words = text
      .replace(/[\n\r]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ");
  }
  if (index < 0 || index >= words.length) return;
  startReading(index);
}

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

// ==========================
// UTILS
// ==========================
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
// EVENT LISTENERS
// ==========================
document.addEventListener("DOMContentLoaded", () => {
  loadCategories();
  renderCategories();
  loadRecentDocs();

  // Resume state
  if (localStorage.getItem(LAST_POSITION_KEY)) {
    document.getElementById("resume-btn").disabled = false;
  }
  localStorage.removeItem(LAST_POSITION_KEY);
  document.getElementById("resume-btn").disabled = true;
});

// Category filter change
categoryFilter.addEventListener("change", () => {
  filterDocumentsByCategory(categoryFilter.value);
});

// Category add
addCategoryBtn.addEventListener("click", () => {
  const category = categoryInput.value.trim();
  if (category && !categories.includes(category)) {
    categories.push(category);
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
    categoryInput.value = "";
    renderCategories();
  } else {
    alert("Please enter a valid or unique category.");
  }
});

// File input
fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (evt) {
    textInput.value = evt.target.result;
    saveRecentDoc(textInput.value);
    updateCodeView(textInput.value);
  };
  reader.readAsText(file);
  fileInput.value = "";
});

// Chunk slider
chunkSlider.addEventListener("input", () => {
  chunkSize = parseInt(chunkSlider.value, 10);
  chunkValue.textContent = chunkSize;
});

// Paste text
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

// WPM slider
wpmSlider.addEventListener("input", () => {
  wpmValue.textContent = wpmSlider.value;
});

// Assistive toggle
assistiveToggle.addEventListener("change", () => {
  assistiveMode = assistiveToggle.checked;
  readingArea.style.background = assistiveMode ? "#e0f7fa" : "#fff";
  localStorage.setItem(ASSIST_MODE_KEY, assistiveMode);
});

// Resume reading
document.getElementById("resume-btn").addEventListener("click", () => {
  const savedIndex = parseInt(localStorage.getItem(LAST_POSITION_KEY), 10);
  const text = textInput.value.trim();

  if (!text || isNaN(savedIndex)) {
    alert("No saved position or text to resume from.");
    return;
  }

  words = text
    .replace(/[\n\r]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ");

  if (savedIndex >= words.length) {
    alert("Saved position is beyond the current text length.");
    return;
  }

  startReading(savedIndex);
});

// Selection read
document.getElementById("read-selection-btn").addEventListener("click", () => {
  const textarea = document.getElementById("text-input");
  const selectionStart = textarea.selectionStart;
  const selectionEnd = textarea.selectionEnd;

  if (selectionStart === selectionEnd) {
    alert("Please select some text inside the text box.");
    return;
  }

  const selectedText = textarea.value
    .substring(selectionStart, selectionEnd)
    .trim();
  if (!selectedText) {
    alert("Selected text is empty.");
    return;
  }

  words = selectedText
    .replace(/[\n\r]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ");
  currentWord = 0;
  showWord();

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
});

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "Enter") startReading();
  if (e.key === "Escape") stopReading();
});

// Text input changes
textInput.addEventListener("input", () => {
  localStorage.setItem(LAST_TEXT_KEY, textInput.value);
  updateCodeView(textInput.value);
});

// Start/Stop buttons
startBtn.addEventListener("click", startReading);
stopBtn.addEventListener("click", stopReading);

// ✅ Update categories live after add/delete
function refreshCategoriesUI() {
  // Save categories persistently
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  // Update dropdown & category list dynamically
  renderCategories();
  categoryList.innerHTML = "";
  categories.forEach((cat) => {
    const li = document.createElement("li");
    li.textContent = cat;

    const delBtn = createDeleteButton();
    delBtn.textContent = "Delete";
    delBtn.style.background = "#ff4444";
    delBtn.addEventListener("click", () => {
      if (confirm(`Delete category "${cat}"?`)) {
        categories = categories.filter((c) => c !== cat);
        // Move orphaned docs → Uncategorized
        recentDocs.forEach((doc) => {
          if (doc.category === cat) doc.category = "Uncategorized";
        });
        saveRecentDocs(); // persist updated docs
        refreshCategoriesUI(); // refresh live
      }
    });

    li.appendChild(delBtn);
    categoryList.appendChild(li);
  });
}
function createDeleteButton(label = "Delete") {
  const btn = document.createElement("button");
  btn.textContent = label;
  btn.style.background = "#ff4444"; // Always red
  btn.style.color = "#fff";
  btn.style.border = "none";
  btn.style.padding = "4px 8px";
  btn.style.marginLeft = "8px";
  btn.style.borderRadius = "4px";
  btn.style.cursor = "pointer";
  return btn;
}

// ✅ Modify addCategoryBtn to auto-refresh UI
addCategoryBtn.addEventListener("click", () => {
  const category = categoryInput.value.trim();
  if (category && !categories.includes(category)) {
    categories.push(category);
    categoryInput.value = ""; // Clear input
    refreshCategoriesUI(); // ✅ Auto-refresh after adding
  } else {
    alert("Please enter a valid or unique category.");
  }
});

// ✅ Update saveDocumentToCategory to auto-refresh
function saveDocumentToCategory(text) {
  let selectedCategory = categoryFilter.value || prompt("Enter category name:");
  if (!selectedCategory) return;

  // If it's a NEW category, auto-add
  if (!categories.includes(selectedCategory)) {
    categories.push(selectedCategory);
    refreshCategoriesUI(); // ✅ Live refresh
  }

  const docIndex = recentDocs.findIndex((doc) => doc.text === text);
  if (docIndex !== -1) {
    recentDocs[docIndex].category = selectedCategory;
    saveRecentDocs(); // ✅ Auto-refresh recent docs
  } else {
    alert("Document not found.");
  }
}

// ✅ Modify removeRecentDoc to instantly refresh UI
function removeRecentDoc(index) {
  recentDocs.splice(index, 1);
  saveRecentDocs(); // ✅ re-renders automatically
}

// Auto-save text and position every 10 seconds while reading
setInterval(() => {
  if (readingInterval) {
    localStorage.setItem(LAST_POSITION_KEY, currentWord);
    localStorage.setItem(LAST_TEXT_KEY, textInput.value);
  }
}, 10000);

let deferredPrompt;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;

  // Show your own install button
  const installBtn = document.createElement("button");
  installBtn.textContent = "📲 Install App";
  installBtn.style.position = "fixed";
  installBtn.style.bottom = "20px";
  installBtn.style.right = "20px";
  installBtn.style.padding = "10px";
  installBtn.style.background = "#007bff";
  installBtn.style.color = "#fff";
  installBtn.style.border = "none";
  installBtn.style.borderRadius = "8px";
  installBtn.style.zIndex = "10000";

  installBtn.addEventListener("click", async () => {
    installBtn.remove();
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      console.log("User installed app");
    } else {
      console.log("User dismissed install");
    }
    deferredPrompt = null;
  });

  document.body.appendChild(installBtn);
});
window.addEventListener("DOMContentLoaded", () => {
  assistiveMode = JSON.parse(localStorage.getItem(ASSIST_MODE_KEY) || "false");
  assistiveToggle.checked = assistiveMode;
  readingArea.style.background = assistiveMode ? "#e0f7fa" : "#fff";
});

setTimeout(() => {
  const fbBanner = document.querySelector("#fb-warning-banner");
  if (fbBanner) fbBanner.remove();
}, 15000);

function isInStandaloneMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function showInstallPrompt() {
  // Don't show if already installed or previously dismissed
  if (isInStandaloneMode() || localStorage.getItem("installPromptDismissed"))
    return;

  const banner = document.createElement("div");
  banner.style.position = "fixed";
  banner.style.bottom = "10px";
  banner.style.left = "50%";
  banner.style.transform = "translateX(-50%)";
  banner.style.background = "#333";
  banner.style.color = "#fff";
  banner.style.padding = "10px 15px";
  banner.style.borderRadius = "8px";
  banner.style.zIndex = "9999";
  banner.style.textAlign = "center";
  banner.style.fontSize = "14px";

  const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  banner.innerHTML = isIOS
    ? `📲 Add this app to your Home Screen: <br>Tap <strong>Share</strong> → <strong>Add to Home Screen</strong>`
    : `📲 Install this app: <br>Tap <strong>Menu ⋮</strong> → <strong>Add to Home screen</strong>`;

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  closeBtn.style.marginLeft = "10px";
  closeBtn.style.background = "transparent";
  closeBtn.style.color = "#fff";
  closeBtn.style.border = "none";
  closeBtn.style.fontSize = "16px";
  closeBtn.style.cursor = "pointer";

  closeBtn.addEventListener("click", () => {
    banner.remove();
    localStorage.setItem("installPromptDismissed", "true"); // Don't show again
  });

  banner.appendChild(closeBtn);
  document.body.appendChild(banner);

  // Auto-hide after 10 seconds (optional)
  setTimeout(() => banner.remove(), 10000);
}

// Show only on mobile browsers
if (/android|iphone|ipad|ipod/i.test(window.navigator.userAgent)) {
  window.addEventListener("DOMContentLoaded", showInstallPrompt);
}

// ✅ Detect Facebook/Instagram in-app browser
function isFacebookBrowser() {
  const ua = navigator.userAgent || navigator.vendor || window.opera;
  return ua.includes("FBAN") || ua.includes("FBAV") || ua.includes("Instagram");
}

// ✅ Show special message if inside Facebook/Instagram browser
window.addEventListener("DOMContentLoaded", () => {
  if (isFacebookBrowser()) {
    const banner = document.createElement("div");
    banner.style.position = "fixed";
    banner.style.bottom = "0";
    banner.style.left = "0";
    banner.style.right = "0";
    banner.style.background = "#ffcc00";
    banner.style.color = "#000";
    banner.style.padding = "12px";
    banner.style.textAlign = "center";
    banner.style.fontSize = "14px";
    banner.style.zIndex = "9999";

    banner.innerHTML = `
      ⚠️ You’re viewing this inside Facebook.  
      <br>For the best experience, <b>tap ⋮ or "Open in Browser"</b> to open in Safari/Chrome,  
      then add to Home Screen.
    `;

    document.body.appendChild(banner);
  }
});

// ==========================
// DRAG & DROP FILE SUPPORT
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
    saveRecentDoc(text); // Auto-save to recent docs
    updateCodeView(text); // Update code preview
  };
  reader.readAsText(file);
}

// Highlight drop area when dragging
document.addEventListener("dragover", (e) => {
  e.preventDefault();
  document.body.style.border = "3px dashed #007bff";
});

// Remove highlight when leaving drop area
document.addEventListener("dragleave", (e) => {
  e.preventDefault();
  document.body.style.border = "";
});

// Handle actual drop
document.addEventListener("drop", (e) => {
  e.preventDefault();
  document.body.style.border = ""; // Remove highlight

  const file = e.dataTransfer.files[0];
  if (file) {
    handleDroppedFile(file);
  }
});
// ==========================
// FIXED "CLEAR ALL" BUTTON (with reading lock)
// ==========================
const clearBtn = document.createElement("button");
clearBtn.textContent = "🧹 Clear All";

Object.assign(clearBtn.style, {
  position: "fixed",
  bottom: "80px",
  right: "20px",
  background: "#999",
  color: "#fff",
  border: "none",
  padding: "10px 14px",
  borderRadius: "8px",
  cursor: "not-allowed",
  zIndex: "9999",
  opacity: "0.6",
  boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
});

clearBtn.disabled = true; // initial state

// ✅ Toggle visual + functional state
function setClearBtnState(enable) {
  if (enable) {
    clearBtn.disabled = false;
    clearBtn.style.background = "#666";
    clearBtn.style.cursor = "pointer";
    clearBtn.style.opacity = "1";
  } else {
    clearBtn.disabled = true;
    clearBtn.style.background = "#999";
    clearBtn.style.cursor = "not-allowed";
    clearBtn.style.opacity = "0.6";
  }
}

// ✅ Clear logic with safeguard
clearBtn.addEventListener("click", () => {
  if (clearBtn.disabled) return;

  const confirmed = confirm(
    "⚠️ This will clear all text from the reader. Are you sure?"
  );
  if (confirmed) {
    stopReading();
    textInput.value = "";
    readingArea.textContent = "";
    updateCodeView("");
    words = [];
    currentWord = 0;
    localStorage.removeItem(LAST_TEXT_KEY);
    localStorage.removeItem(LAST_POSITION_KEY);
    setClearBtnState(false); // disable again after clearing
  }
});

// ✅ Enable/disable on text input
textInput.addEventListener("input", () => {
  const hasText = textInput.value.trim().length > 0;
  if (!readingInterval) setClearBtnState(hasText); // only allow if NOT reading
});

// ✅ Lock clear while reading
function lockClearWhileReading(lock) {
  if (lock) {
    setClearBtnState(false); // disable during reading
  } else {
    const hasText = textInput.value.trim().length > 0;
    setClearBtnState(hasText); // restore based on text availability
  }
}

// ✅ Hook into start/stop reading
const originalStartReading = startReading;
startReading = function (...args) {
  lockClearWhileReading(true);
  originalStartReading.apply(this, args);
};

const originalStopReading = stopReading;
stopReading = function (...args) {
  originalStopReading.apply(this, args);
  lockClearWhileReading(false);
};

// ✅ Add to page
document.body.appendChild(clearBtn);

// ==========================
// Service Worker
// ==========================
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => {
      for (let reg of registrations) reg.unregister(); // Force unregister for dev testing
    })
    .finally(() => {
      navigator.serviceWorker.register("/service-worker.js");
    });
}

/* 
--------------------------------------------
Text Reader App - v1.1 AutoSave Edition
Enhancements:
✅ Live category refresh on add/delete
✅ Auto-save recent docs after updates
✅ Dynamic dropdown/category list sync
✅ Improved UX without manual reloads
--------------------------------------------
*/
