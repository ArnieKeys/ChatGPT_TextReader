// Elements
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
let startIndex = 0; // default start at 0
const categoryInput = document.getElementById("category-input");
const addCategoryBtn = document.getElementById("add-category-btn");
const categoryFilter = document.getElementById("category-filter");
let categories = []; // This will hold all the available categories

// State
let words = [];
let currentWord = 0;
let readingInterval = null;
let assistiveMode = false;
let recentDocs = []; // Hold recent documents
let currentDocument = {}; // Hold current document being worked on
let chunkSize = 1;

// Storage Keys
const LAST_POSITION_KEY = "text_reader_last_position";
const LAST_TEXT_KEY = "text_reader_last_text";
const ASSIST_MODE_KEY = "text_reader_assistive_mode";
const RECENT_DOCS_KEY = "text_reader_recent_docs";
const CATEGORIES_KEY = "text_reader_categories";

// document.getElementById("search-input").addEventListener("input", () => {
//   const searchTerm = document
//     .getElementById("search-input")
//     .value.toLowerCase();
//   const filteredDocs = recentDocs.filter((doc) => {
//     return (
//       doc.text.toLowerCase().includes(searchTerm) ||
//       doc.category.toLowerCase().includes(searchTerm) ||
//       doc.tags.some((tag) => tag.toLowerCase().includes(searchTerm))
//     );
//   });
//   renderRecentDocs(filteredDocs);
// });

document.getElementById("read-selection-btn").addEventListener("click", () => {
  const textarea = document.getElementById("text-input");
  const fullText = textarea.value.trim();
  const selectionStart = textarea.selectionStart;
  const selectionEnd = textarea.selectionEnd;

  if (selectionStart === selectionEnd) {
    alert("Please select some text inside the text box.");
    return;
  }

  // Extract the selected text from the textarea
  const selectedText = textarea.value
    .substring(selectionStart, selectionEnd)
    .trim();
  if (!selectedText) {
    alert("Selected text is empty.");
    return;
  }

  // Normalize both full text and selected text
  const normalize = (str) =>
    str
      .replace(/[.,!?;:()\[\]{}"“”‘’]/g, "") // Remove punctuation
      .replace(/[\n\r]+/g, " ") // Replace newlines with space
      .replace(/\s+/g, " ") // Collapse whitespace
      .trim()
      .split(" ")
      .map((w) => w.toLowerCase());

  const allWords = normalize(fullText);
  const selectedWords = normalize(selectedText);

  // Store globally so reading can proceed
  words = allWords;

  // Try to find matching index of selectedWords in allWords
  const index = allWords.findIndex((_, i) =>
    selectedWords.every((word, j) => allWords[i + j] === word)
  );

  if (index !== -1) {
    startReading(index);
  } else {
    alert(
      "Could not match the selected text to the document.\n" +
        "Try selecting a smaller chunk or removing punctuation."
    );
  }
});

document.getElementById("resume-btn").addEventListener("click", () => {
  const savedIndex = parseInt(localStorage.getItem(LAST_POSITION_KEY), 10);
  const text = textInput.value.trim();

  if (!text || isNaN(savedIndex)) {
    alert("No saved position or text to resume from.");
    return;
  }

  // Rebuild words array from current text
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

addCategoryBtn.addEventListener("click", () => {
  const category = categoryInput.value.trim();
  if (category && !categories.includes(category)) {
    categories.push(category);
    updateCategoryDropdown();
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
    categoryInput.value = ""; // Clear input
  } else {
    alert("Please enter a valid or unique category.");
  }
});
// File loading
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

startBtn.addEventListener("click", startReading);
stopBtn.addEventListener("click", stopReading);
textInput.addEventListener("input", () => {
  localStorage.setItem(LAST_TEXT_KEY, textInput.value);
  updateCodeView(textInput.value);
});

categoryFilter.addEventListener("change", () => {
  filterDocumentsByCategory(categoryFilter.value);
});

function filterDocumentsByCategory(category) {
  if (!category) {
    renderRecentDocs(recentDocs); // show all
  } else {
    const filteredDocs = recentDocs.filter((doc) => doc.category === category);
    renderRecentDocs(filteredDocs);
  }
}
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "Enter") startReading();
  if (e.key === "Escape") stopReading();
});

window.addEventListener("DOMContentLoaded", () => {
  loadCategories();
  loadRecentDocs();
});

if (localStorage.getItem(LAST_POSITION_KEY)) {
  document.getElementById("resume-btn").disabled = false;
}
localStorage.removeItem(LAST_POSITION_KEY);
document.getElementById("resume-btn").disabled = true;

// Function to filter documents by selected category
function filterDocumentsByCategory(category) {
  let filteredDocs = recentDocs;
  if (category && category !== "") {
    filteredDocs = recentDocs.filter((doc) => doc.category === category);
  }
  renderRecentDocs(filteredDocs);
}

function loadCategoryFilter() {
  const categoryFilter = document.getElementById("category-filter");
  categoryFilter.innerHTML = '<option value="">All Categories</option>'; // Reset dropdown
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryFilter.appendChild(option);
  });
}

function loadCategories() {
  const data = localStorage.getItem(CATEGORIES_KEY);
  categories = data ? JSON.parse(data) : [];
  updateCategoryDropdown();
}

function saveCategories() {
  localStorage.setItem("categories", JSON.stringify(categories));
}

function saveToLibrary(doc) {
  const selectedCategory = document.querySelector(
    `[data-index="${recentDocs.indexOf(doc)}"] .category-select`
  ).value;
  doc.category = selectedCategory; // Update the category of the document

  // Save the updated document to the local storage
  saveRecentDocs();
  alert(`Document saved to "${selectedCategory}"`);
}

function renderRecentDocs(docs = recentDocs) {
  recentList.innerHTML = "";

  if (docs.length === 0) {
    recentList.innerHTML = "<li>No documents found for this category</li>";
    return;
  }

  docs.forEach((doc, idx) => {
    const li = document.createElement("li");

    // ✅ Clickable title
    const span = document.createElement("span");
    span.textContent = doc.text.slice(0, 40) + "...";
    span.classList.add("doc-title");
    span.addEventListener("click", () => {
      textInput.value = doc.text;
      updateCodeView(doc.text);
    });

    // ✅ Category label
    const catLabel = document.createElement("span");
    catLabel.classList.add("category-label");
    catLabel.textContent = `(${doc.category || "Uncategorized"})`;

    // ✅ Create a wrapper for buttons (flex row)
    const btnContainer = document.createElement("div");
    btnContainer.classList.add("doc-buttons");

    // ✅ Save button
    const saveBtn = document.createElement("button");
    saveBtn.textContent = "Save to Category";
    saveBtn.addEventListener("click", () => saveDocumentToCategory(doc.text));

    // ✅ Delete button
    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => {
      if (confirm("Delete this document?")) {
        removeRecentDoc(idx);
      }
    });

    // ✅ Append buttons inside container
    btnContainer.appendChild(saveBtn);
    btnContainer.appendChild(delBtn);

    // ✅ Append everything to the list item
    li.appendChild(span);
    li.appendChild(catLabel);
    li.appendChild(btnContainer);

    recentList.appendChild(li);
  });
}

function loadRecentDocs() {
  const data = localStorage.getItem(RECENT_DOCS_KEY);
  recentDocs = data ? JSON.parse(data) : [];
  filterDocumentsByCategory(categoryFilter.value); // render based on selected category
}

function saveRecentDocs() {
  localStorage.setItem(RECENT_DOCS_KEY, JSON.stringify(recentDocs));
  filterDocumentsByCategory(categoryFilter.value); // re-render with current filter
}

function saveRecentDoc(text) {
  const selectedCategory = categoryFilter.value || "Uncategorized"; // fallback
  const doc = {
    text,
    ts: Date.now(),
    category: selectedCategory,
  };

  // Add it to the top (avoid duplicates)
  recentDocs = recentDocs.filter((d) => d.text !== text);
  recentDocs.unshift(doc);

  saveRecentDocs(); // persist & re-render
}

function removeRecentDoc(index) {
  recentDocs.splice(index, 1);
  localStorage.setItem(RECENT_DOCS_KEY, JSON.stringify(recentDocs));
  renderRecentDocs();
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

  // Always start from this index
  startReading(index);
}

function startReading(fromIndex = null) {
  const text = textInput.value.trim();
  if (!text) return;

  // Save to recent docs only if it's a fresh read
  saveRecentDoc(text);

  // Prepare words array
  words = text
    .replace(/[\n\r]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ");

  // Determine starting index
  currentWord =
    fromIndex !== null && fromIndex >= 0 && fromIndex < words.length
      ? fromIndex
      : 0;

  // Show the initial chunk
  showWord();

  // Disable editing while reading
  startBtn.disabled = true;
  stopBtn.disabled = false;
  textInput.disabled = true;
  wpmSlider.disabled = true;

  // ✅ Do NOT lock height or overflow – let normal scrolling continue
  readingArea.style.maxHeight = "none";
  readingArea.style.overflowY = "visible";

  // Reading loop
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

  // ✅ Show the full text again
  showFullText();

  // ✅ Re-enable all controls
  startBtn.disabled = false;
  stopBtn.disabled = true;
  textInput.disabled = false;
  wpmSlider.disabled = false;

  // ✅ Make sure readingArea scrolls normally
  readingArea.style.maxHeight = "none";
  readingArea.style.overflowY = "auto";

  // ✅ Save current position for resume
  localStorage.setItem(LAST_POSITION_KEY, currentWord);
  document.getElementById("resume-btn").disabled = false;
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

function updateCategoryDropdown() {
  const categoryDropdown = document.getElementById("category-filter");
  categoryDropdown.innerHTML = "<option value=''>All Categories</option>";
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryDropdown.appendChild(option);
  });

  renderCategoryList(); // ALSO refresh the manager UI
}

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
function saveDocumentToCategory(text) {
  let selectedCategory = categoryFilter.value || prompt("Enter category name:");
  if (!selectedCategory) return;

  // If it's a NEW category, add to list
  if (!categories.includes(selectedCategory)) {
    categories.push(selectedCategory);
    updateCategoryDropdown(); // refresh dropdown
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
function renderCategoryList() {
  const list = document.getElementById("category-list");
  list.innerHTML = "";

  categories.forEach((cat) => {
    const li = document.createElement("li");
    li.textContent = cat;

    const delBtn = document.createElement("button");
    delBtn.textContent = "Remove";
    delBtn.addEventListener("click", () => {
      removeCategory(cat);
    });

    li.appendChild(delBtn);
    list.appendChild(li);
  });
}

function removeCategory(catToRemove) {
  // Remove from category list
  categories = categories.filter((c) => c !== catToRemove);
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  updateCategoryDropdown();
  renderCategoryList();

  // Reset docs in this category -> Uncategorized
  recentDocs.forEach((doc) => {
    if (doc.category === catToRemove) {
      doc.category = "Uncategorized";
    }
  });
  saveRecentDocs(); // save updates
}
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/service-worker.js")
    .then(() => console.log("✅ Service Worker Registered"))
    .catch((err) => console.log("❌ SW registration failed:", err));
}
