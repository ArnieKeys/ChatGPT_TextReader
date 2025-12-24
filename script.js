document.addEventListener("DOMContentLoaded", () => {
  /* === DOM Elements === */
  const textInput = document.getElementById("text-input");
  const readingArea = document.getElementById("reading-area");
  const startBtn = document.getElementById("start-btn");
  const stopBtn = document.getElementById("stop-btn");
  const resumeBtn = document.getElementById("resume-btn");
  const readSelectionBtn = document.getElementById("read-selection-btn");
  const pasteBtn = document.getElementById("paste-btn");
  const wpmSlider = document.getElementById("wpm-slider");
  const wpmValue = document.getElementById("wpm-value");
  const chunkSlider = document.getElementById("chunk-slider");
  const chunkValue = document.getElementById("chunk-value");
  const fileInput = document.getElementById("file-input");
  const codeDisplay = document.getElementById("code-display");
  const recentList = document.getElementById("recent-list");
  const categoryInput = document.getElementById("category-input");
  const addCategoryBtn = document.getElementById("add-category-btn");
  const categoryFilter = document.getElementById("category-filter");
  const categoryList = document.getElementById("category-list");
  const clearAllBtn = document.getElementById("clear-all-btn");

  let recentDocs = JSON.parse(localStorage.getItem("recentDocs") || "[]");
  let categories = JSON.parse(localStorage.getItem("categories") || "[]");

  /* === Dark Mode Toggle === */
  const header = document.querySelector("header");
  const darkToggle = document.createElement("button");
  darkToggle.textContent = "🌙 Dark Mode";
  darkToggle.style.marginLeft = "auto";
  header.appendChild(darkToggle);

  /* === State Variables === */
  let words = [];
  let currentIndex = 0;
  let readingTimer = null;
  let state = "stopped"; // 'stopped', 'reading', 'paused'

  /* === Utility: Toast Notifications === */
  const showToast = (msg, type = "info") => {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type} visible`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.remove("visible"), 2000);
    setTimeout(() => toast.remove(), 2500);
  };

  /* === Utility: Save & Render Recent Docs === */
  const saveRecentDoc = (title, text, category = "") => {
    if (!text.trim()) return;
    recentDocs.unshift({ title, text, category, date: Date.now() });
    recentDocs = recentDocs.slice(0, 10);
    localStorage.setItem("recentDocs", JSON.stringify(recentDocs));
    renderRecentDocs();
  };

  const renderRecentDocs = () => {
    recentList.innerHTML = "";
    const filter = categoryFilter.value;
    recentDocs
      .filter((doc) => !filter || doc.category === filter)
      .forEach((doc, idx) => {
        const li = document.createElement("li");

        const titleSpan = document.createElement("span");
        titleSpan.textContent = doc.title;
        titleSpan.className = "doc-title";
        titleSpan.addEventListener("click", () => {
          textInput.value = doc.text;
          updateCodeViewer(doc.text);
        });

        const categorySpan = document.createElement("span");
        categorySpan.textContent = doc.category ? `(${doc.category})` : "";
        categorySpan.className = "category-label";

        const btnGroup = document.createElement("div");
        btnGroup.className = "doc-buttons";

        const saveBtn = document.createElement("button");
        saveBtn.textContent = "Save→Category";
        saveBtn.className = "save-btn";
        saveBtn.addEventListener("click", () => {
          const catName = prompt("Enter category name:");
          if (catName) {
            doc.category = catName;
            if (!categories.includes(catName)) {
              categories.push(catName);
              localStorage.setItem("categories", JSON.stringify(categories));
              renderCategories();
            }
            localStorage.setItem("recentDocs", JSON.stringify(recentDocs));
            renderRecentDocs();
          }
        });

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "Delete";
        deleteBtn.className = "delete-btn";
        deleteBtn.addEventListener("click", () => {
          recentDocs.splice(idx, 1);
          localStorage.setItem("recentDocs", JSON.stringify(recentDocs));
          renderRecentDocs();
        });

        btnGroup.append(saveBtn, deleteBtn);
        li.append(titleSpan, categorySpan, btnGroup);
        recentList.appendChild(li);
      });
  };

  const renderCategories = () => {
    categoryList.innerHTML = "";
    categoryFilter.innerHTML = `<option value="">All Categories</option>`;
    categories.forEach((cat) => {
      const li = document.createElement("li");
      li.textContent = cat;

      const delBtn = document.createElement("button");
      delBtn.textContent = "×";
      delBtn.addEventListener("click", () => {
        categories = categories.filter((c) => c !== cat);
        localStorage.setItem("categories", JSON.stringify(categories));
        renderCategories();
      });

      li.appendChild(delBtn);
      categoryList.appendChild(li);

      const option = document.createElement("option");
      option.value = cat;
      option.textContent = cat;
      categoryFilter.appendChild(option);
    });
  };

  const updateCodeViewer = (code) => {
    codeDisplay.textContent = code.trim();
    Prism.highlightElement(codeDisplay);
  };

  /* === Reading Logic === */
  const getInterval = () => (60 / parseInt(wpmSlider.value, 10)) * 1000;

  function resetButtons() {
    if (state === "reading") {
      startBtn.textContent = "Stop Reading";
      startBtn.disabled = false;
      stopBtn.disabled = false;
      resumeBtn.disabled = true;
    } else if (state === "paused") {
      startBtn.textContent = "Start Reading";
      startBtn.disabled = true;
      stopBtn.disabled = true;
      resumeBtn.disabled = false;
    } else {
      startBtn.textContent = "Start Reading";
      startBtn.disabled = false;
      stopBtn.disabled = true;
      resumeBtn.disabled = true;
    }
  }

  function stopReading() {
    if (readingTimer) clearTimeout(readingTimer);
    state = "paused";
    resetButtons();
  }

  function startReading(fromIndex = 0) {
    if (state === "reading") {
      stopReading();
      state = "stopped";
      resetButtons();
      return;
    }

    const getSourceText = () => codeDisplay.textContent.trim();
    // const getSourceText = () => codeDisplay.textContent || "";
    const text = getSourceText().trim();
    if (!text) return showToast("No text to read!", "error");

    if (!text) return showToast("No text to read!", "error");

    words = text.split(/\s+/);
    currentIndex = fromIndex;
    state = "reading";
    resetButtons();

    function readChunk() {
      if (currentIndex >= words.length || state !== "reading") {
        state = "stopped";
        resetButtons();
        return;
      }

      const chunkSize = parseInt(chunkSlider.value, 10);
      const chunkWords = words.slice(currentIndex, currentIndex + chunkSize);
      const chunkText = chunkWords.join(" ");

      readingArea.innerHTML = `<pre style="white-space: pre-wrap; word-wrap: break-word;">${
        words.slice(0, currentIndex).join(" ") +
        ' <span class="highlight">' +
        chunkText +
        "</span> " +
        words.slice(currentIndex + chunkSize).join(" ")
      }</pre>`;

      currentIndex += chunkSize;
      readingTimer = setTimeout(readChunk, getInterval());
    }

    readChunk();
  }
  //   <pre>
  //   <code
  //     id="code-display"
  //     class="language-html"
  //     contenteditable="true"
  //     spellcheck="false">
  //   </code>
  // </pre>

  function resumeReading() {
    if (state !== "paused") return;
    state = "reading";
    resetButtons();
    startReading(currentIndex);
  }

  // function readFromSelection() {
  //   const selected = window.getSelection().toString().trim();
  //   if (!selected) return showToast("No text selected!", "error");
  //   textInput.value = selected;
  //   updateCodeViewer(selected);
  //   startReading(0);
  // }
  const readFromSelection = () => {
    const selected = window.getSelection().toString().trim();
    if (!selected) return showToast("No text selected!", "error");

    words = selected.split(/\s+/);
    currentIndex = 0;
    state = "reading";
    resetButtons();
    startReading(0);
  };

  /* === Clear All === */
  // function clearAll() {
  //   if (readingTimer) clearTimeout(readingTimer);

  //   words = [];
  //   currentIndex = 0;
  //   state = "stopped";

  //   textInput.value = "";
  //   readingArea.innerHTML = "";
  //   codeDisplay.textContent = "";

  //   resetButtons();
  //   showToast("All cleared!");
  // }
  function clearAll() {
    if (readingTimer) clearTimeout(readingTimer);

    words = [];
    currentIndex = 0;
    state = "stopped";

    readingArea.innerHTML = "";
    codeDisplay.textContent = "";

    resetButtons();
    showToast("All cleared!");
  }

  /* === Event Listeners === */
  codeDisplay.addEventListener("input", () => {
    Prism.highlightElement(codeDisplay);
  });

  startBtn.addEventListener("click", () => {
    if (state === "reading") stopReading();
    else startReading(currentIndex);
  });

  stopBtn.addEventListener("click", stopReading);
  resumeBtn.addEventListener("click", resumeReading);
  clearAllBtn.addEventListener("click", clearAll);

  readSelectionBtn.addEventListener("click", readFromSelection);

  pasteBtn.addEventListener("click", async () => {
    const clip = await navigator.clipboard.readText();
    if (clip.trim()) {
      // textInput.value = clip.trim();
      // updateCodeViewer(clip.trim());
      updateCodeViewer(clip.trim());
      saveRecentDoc("Clipboard Text", clip.trim());
      saveRecentDoc("Clipboard Text", clip.trim());
    }
  });

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      // textInput.value = ev.target.result;
      updateCodeViewer(ev.target.result);
      saveRecentDoc(file.name, ev.target.result);
    };
    reader.readAsText(file);
  });

  /* === Safe slider value update === */
  if (wpmSlider && wpmValue) {
    wpmSlider.addEventListener("input", () => {
      wpmValue.textContent = wpmSlider.value;
    });
  }
  if (chunkSlider && chunkValue) {
    chunkSlider.addEventListener("input", () => {
      chunkValue.textContent = chunkSlider.value;
    });
  }

  addCategoryBtn.addEventListener("click", () => {
    const cat = categoryInput.value.trim();
    if (!cat) return;
    if (!categories.includes(cat)) {
      categories.push(cat);
      localStorage.setItem("categories", JSON.stringify(categories));
      renderCategories();
    }
    categoryInput.value = "";
  });

  categoryFilter.addEventListener("change", renderRecentDocs);

  darkToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
  });

  /* === Init === */
  renderCategories();
  renderRecentDocs();
  updateCodeViewer("");
  resetButtons();

  // Drag & Drop highlight
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
    if (file && file.type === "text/plain") {
      const reader = new FileReader();
      reader.onload = (ev) => {
        textInput.value = ev.target.result;
        updateCodeViewer(ev.target.result);
        saveRecentDoc(file.name, ev.target.result);
      };
      reader.readAsText(file);
    }
  });
});
