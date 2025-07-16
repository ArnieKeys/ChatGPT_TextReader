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

    const delBtn = document.createElement("button");
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

    const delBtn = document.createElement("button");
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

    const delBtn = document.createElement("button");
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
