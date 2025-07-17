// ==========================
// Element References
// ==========================
const $ = (id) => document.getElementById(id);

const textInput = $("text-input");
const fileInput = $("file-input");
const pasteBtn = $("paste-btn");
const startBtn = $("start-btn");
const stopBtn = $("stop-btn");
const readingArea = $("reading-area");
const wpmSlider = $("wpm-slider");
const wpmValue = $("wpm-value");
const chunkSlider = $("chunk-slider");
const chunkValue = $("chunk-value");
const assistiveToggle = $("assistive-toggle");
const recentList = $("recent-list");
const codeDisplay = $("code-display");
const categoryInput = $("category-input");
const addCategoryBtn = $("add-category-btn");
const categoryFilter = $("category-filter");
const categoryList = $("category-list");

// ==========================
// Constants
// ==========================
const LAST_POSITION_KEY = "text_reader_last_position";
const LAST_TEXT_KEY = "text_reader_last_text";
const ASSIST_MODE_KEY = "text_reader_assistive_mode";
const RECENT_DOCS_KEY = "text_reader_recent_docs";
const CATEGORIES_KEY = "text_reader_categories";

// ==========================
// State
// ==========================
let words = [],
  currentWord = 0;
let readingInterval = null;
let isPaused = false;
let assistiveMode = false;
let chunkSize = 1;
let recentDocs = JSON.parse(localStorage.getItem(RECENT_DOCS_KEY) || "[]");
let categories = JSON.parse(localStorage.getItem(CATEGORIES_KEY) || "[]");

// ==========================
// Utility Functions
// ==========================
const escapeHtml = (str) => {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
};

const showToast = (msg, type = "info") => {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("visible"), 50);
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
};

const updateCodeView = (text) => {
  if (!codeDisplay) return;
  codeDisplay.innerHTML = escapeHtml(text);
  if (typeof Prism !== "undefined") Prism.highlightElement(codeDisplay);
};

// ==========================
// Reading Controls
// ==========================
function showWord() {
  const chunk = words.slice(currentWord, currentWord + chunkSize).join(" ");
  readingArea.innerHTML = `<span class="highlight">${chunk}</span>`;
  if (assistiveMode)
    readingArea.scrollIntoView({ behavior: "smooth", block: "center" });
}

function beginReading(text, index = 0) {
  words = text.trim().replace(/\s+/g, " ").split(" ");
  currentWord = index;
  showWord();
  const interval = 60000 / parseInt(wpmSlider.value, 10);
  readingInterval = setInterval(() => {
    currentWord += chunkSize;
    if (currentWord >= words.length) stopReading();
    else showWord();
  }, interval);
  lockClearWhileReading(true);
  startBtn.disabled = true;
  stopBtn.disabled = false;
}

function startReading(startIndex = 0) {
  const text = textInput.value.trim();
  if (!text) return alert("Please enter or load text before reading.");
  beginReading(text, startIndex);
}

function stopReading() {
  clearInterval(readingInterval);
  readingInterval = null;
  readingArea.textContent = textInput.value;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  autoSaveReadingState();
  lockClearWhileReading(false);
}

// ==========================
// Clear Button
// ==========================
const clearBtn = document.createElement("button");
clearBtn.textContent = "🧹 Clear All";
clearBtn.classList.add("clear-btn");
clearBtn.disabled = true;
document.body.appendChild(clearBtn);

clearBtn.addEventListener("click", () => {
  if (!confirm("⚠️ Clear all text?")) return;
  stopReading();
  textInput.value = "";
  readingArea.textContent = "";
  updateCodeView("");
  words = [];
  currentWord = 0;
  localStorage.removeItem(LAST_TEXT_KEY);
  localStorage.removeItem(LAST_POSITION_KEY);
  setClearBtnState(false);
});

function setClearBtnState(enabled) {
  clearBtn.disabled = !enabled;
  clearBtn.classList.toggle("active", enabled);
}

function lockClearWhileReading(lock) {
  setClearBtnState(!lock && textInput.value.trim().length > 0);
}

function enableClearIfNeeded() {
  setClearBtnState(textInput.value.trim().length > 0);
}

// ==========================
// Category Functions
// ==========================
function refreshCategoriesUI() {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  renderCategories();
}

function renderCategories() {
  categoryFilter.innerHTML = `<option value="">All Categories</option>`;
  categories.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    categoryFilter.appendChild(opt);
  });

  categoryList.innerHTML = "";
  categories.forEach((cat) => {
    const li = document.createElement("li");
    li.textContent = cat;
    const delBtn = document.createElement("button");
    delBtn.textContent = "✖";
    delBtn.addEventListener("click", () => {
      categories = categories.filter((c) => c !== cat);
      refreshCategoriesUI();
      showToast(`🗑️ Deleted category "${cat}"`, "info");
    });
    li.appendChild(delBtn);
    categoryList.appendChild(li);
  });
}

// ==========================
// Document Management
// ==========================
function saveRecentDocs() {
  localStorage.setItem(RECENT_DOCS_KEY, JSON.stringify(recentDocs));
  filterDocumentsByCategory(categoryFilter.value);
}

function saveRecentDoc(text) {
  const category = categoryFilter.value || "Uncategorized";
  const doc = { text, ts: Date.now(), category };
  recentDocs = recentDocs.filter((d) => d.text !== text);
  recentDocs.unshift(doc);
  saveRecentDocs();
}

function removeRecentDoc(index) {
  recentDocs.splice(index, 1);
  saveRecentDocs();
}

function renderRecentDocs(docs = recentDocs) {
  recentList.innerHTML = "";
  if (docs.length === 0) {
    recentList.innerHTML = "<li>No documents found</li>";
    return;
  }

  docs.forEach((doc, i) => {
    const li = document.createElement("li");
    const title = document.createElement("span");
    title.textContent = doc.text.slice(0, 40) + "...";
    title.classList.add("doc-title");
    title.addEventListener("click", () => {
      textInput.value = doc.text;
      updateCodeView(doc.text);
      enableClearIfNeeded();
    });

    const cat = document.createElement("span");
    cat.classList.add("category-label");
    cat.textContent = `(${doc.category})`;

    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => removeRecentDoc(i));

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "Save to Category";
    saveBtn.addEventListener("click", () => {
      let cat = prompt("Enter category name:");
      if (!cat) return showToast("⚠️ No category entered", "error");
      if (!categories.includes(cat)) {
        categories.push(cat);
        refreshCategoriesUI();
      }
      doc.category = cat;
      saveRecentDocs();
      showToast(`📂 Saved to "${cat}"`, "success");
    });

    const btns = document.createElement("div");
    btns.className = "doc-buttons";
    btns.append(saveBtn, delBtn);

    li.append(title, cat, btns);
    recentList.appendChild(li);
  });
}

function filterDocumentsByCategory(cat) {
  const docs = cat
    ? recentDocs.filter((doc) => doc.category === cat)
    : recentDocs;
  renderRecentDocs(docs);
}

// ==========================
// File Handling
// ==========================
fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    textInput.value = evt.target.result;
    updateCodeView(evt.target.result);
    saveRecentDoc(evt.target.result);
    enableClearIfNeeded();
  };
  reader.readAsText(file);
  fileInput.value = "";
});

// ==========================
// Clipboard / Drag & Drop
// ==========================
pasteBtn.addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      textInput.value = text;
      updateCodeView(text);
      saveRecentDoc(text);
      enableClearIfNeeded();
    }
  } catch {
    alert("Clipboard access denied.");
  }
});

function setupDragDrop() {
  document.addEventListener("dragover", (e) => {
    e.preventDefault();
    document.body.classList.add("drag-over");
  });

  document.addEventListener("dragleave", () => {
    document.body.classList.remove("drag-over");
  });

  document.addEventListener("drop", (e) => {
    e.preventDefault();
    document.body.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        textInput.value = evt.target.result;
        updateCodeView(evt.target.result);
        saveRecentDoc(evt.target.result);
        enableClearIfNeeded();
      };
      reader.readAsText(file);
    }
  });
}

// ==========================
// Assistive & State Restore
// ==========================
function applyAssistiveMode(enabled) {
  assistiveMode = enabled;
  assistiveToggle.checked = enabled;
  readingArea.classList.toggle("assistive-active", enabled);
  localStorage.setItem(ASSIST_MODE_KEY, JSON.stringify(enabled));
}

function autoSaveReadingState() {
  if (readingInterval) {
    localStorage.setItem(LAST_TEXT_KEY, textInput.value);
    localStorage.setItem(LAST_POSITION_KEY, currentWord);
  }
}

function restoreSavedText() {
  const saved = localStorage.getItem(LAST_TEXT_KEY);
  const pos = parseInt(localStorage.getItem(LAST_POSITION_KEY), 10);
  if (saved) {
    textInput.value = saved;
    updateCodeView(saved);
    if (!isNaN(pos)) {
      $("resume-btn").disabled = false;
      $("resume-btn").addEventListener("click", () => startReading(pos));
    }
  }
}

// ==========================
// Init Function
// ==========================
function init() {
  assistiveMode = JSON.parse(localStorage.getItem(ASSIST_MODE_KEY) || "false");
  applyAssistiveMode(assistiveMode);
  restoreSavedText();
  refreshCategoriesUI();
  renderRecentDocs();

  categoryFilter.addEventListener("change", () => {
    filterDocumentsByCategory(categoryFilter.value);
  });

  addCategoryBtn.addEventListener("click", () => {
    const cat = categoryInput.value.trim();
    if (!cat) return showToast("⚠️ Please enter a category", "error");
    if (!categories.includes(cat)) {
      categories.push(cat);
      refreshCategoriesUI();
      showToast(`✅ Added "${cat}"`, "success");
    } else {
      showToast(`ℹ️ "${cat}" already exists`, "info");
    }
    categoryInput.value = "";
  });

  assistiveToggle.addEventListener("change", () =>
    applyAssistiveMode(assistiveToggle.checked)
  );

  wpmSlider.addEventListener("input", () => {
    wpmValue.textContent = wpmSlider.value;
  });

  chunkSlider.addEventListener("input", () => {
    chunkSize = parseInt(chunkSlider.value, 10);
    chunkValue.textContent = chunkSize;
  });

  textInput.addEventListener("input", () => {
    if (!readingInterval) enableClearIfNeeded();
  });

  startBtn.addEventListener("click", () => startReading());
  stopBtn.addEventListener("click", () => stopReading());

  setupDragDrop();
  setInterval(autoSaveReadingState, 10000);
}

// ==========================
// Dark Mode Toggle
// ==========================
const darkToggle = document.createElement("button");
darkToggle.textContent = "🌙 Dark Mode";
darkToggle.classList.add("dark-toggle");
Object.assign(darkToggle.style, {
  position: "fixed",
  top: "20px",
  left: "20px",
  zIndex: 1000,
});
document.body.appendChild(darkToggle);

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

// ==========================
// DOM Ready
// ==========================
document.addEventListener("DOMContentLoaded", init);
