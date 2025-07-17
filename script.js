document.addEventListener("DOMContentLoaded", () => {
  /* === DOM ELEMENTS === */
  const readingArea = document.getElementById("reading-area");
  const textInput = document.getElementById("text-input");
  const pasteBtn = document.getElementById("paste-btn");
  const startBtn = document.getElementById("start-btn");
  const stopBtn = document.getElementById("stop-btn");
  const resumeBtn = document.getElementById("resume-btn");
  const readSelectionBtn = document.getElementById("read-selection-btn");

  const wpmSlider = document.getElementById("wpm-slider");
  const chunkSlider = document.getElementById("chunk-slider");
  const wpmValue = document.getElementById("wpm-value");
  const chunkValue = document.getElementById("chunk-value");
  const assistiveToggle = document.getElementById("assistive-toggle");

  const recentList = document.getElementById("recent-list");
  const fileInput = document.getElementById("file-input");

  const addCategoryBtn = document.getElementById("add-category-btn");
  const categoryInput = document.getElementById("category-input");
  const categoryList = document.getElementById("category-list");
  const categoryFilter = document.getElementById("category-filter");

  /* === STATE === */
  let words = [];
  let currentIndex = 0;
  let readingTimer = null;
  let isPaused = false; // FIX for resume button
  let toastLock = false; // Prevent duplicate alerts

  let recentDocs = JSON.parse(localStorage.getItem("recentDocs") || "[]");
  let categories = JSON.parse(localStorage.getItem("categories") || "[]");

  /* === UTILITIES === */
  const showToast = (message, type = "info") => {
    if (toastLock) return; // prevent spamming
    toastLock = true;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type} visible`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.remove("visible");
      setTimeout(() => {
        toast.remove();
        toastLock = false; // unlock after removal
      }, 300);
    }, 2000);
  };

  const saveState = () => {
    localStorage.setItem("recentDocs", JSON.stringify(recentDocs));
    localStorage.setItem("categories", JSON.stringify(categories));
  };

  const renderRecentDocs = () => {
    recentList.innerHTML = "";
    const filter = categoryFilter.value;

    const filteredDocs = filter
      ? recentDocs.filter((doc) => doc.category === filter)
      : recentDocs;

    filteredDocs.forEach((doc, index) => {
      const li = document.createElement("li");
      const titleSpan = document.createElement("span");
      titleSpan.className = "doc-title";
      titleSpan.textContent = doc.title;

      titleSpan.addEventListener("click", () => {
        textInput.value = doc.content;
        showToast(`Loaded: ${doc.title}`, "info");
      });

      const categoryLabel = document.createElement("span");
      categoryLabel.className = "category-label";
      categoryLabel.textContent = doc.category || "Uncategorized";

      const btnGroup = document.createElement("div");
      btnGroup.className = "doc-buttons";

      const saveBtn = document.createElement("button");
      saveBtn.className = "save-btn";
      saveBtn.textContent = "Save to Category";
      saveBtn.addEventListener("click", () => {
        const catName = prompt("Enter a category name:");
        const cleanName = catName ? catName.trim() : "";
        if (!cleanName) {
          showToast("Category name required", "error");
          return;
        }
        doc.category = cleanName;
        if (!categories.includes(cleanName)) {
          categories.push(cleanName);
          renderCategories();
        }
        saveState();
        renderRecentDocs();
        showToast(`Saved to: ${cleanName}`, "success");
      });

      const delBtn = document.createElement("button");
      delBtn.className = "delete-btn";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", () => {
        recentDocs.splice(index, 1);
        saveState();
        renderRecentDocs();
        showToast("Deleted", "info");
      });

      btnGroup.appendChild(saveBtn);
      btnGroup.appendChild(delBtn);

      li.appendChild(titleSpan);
      li.appendChild(categoryLabel);
      li.appendChild(btnGroup);
      recentList.appendChild(li);
    });
  };

  const renderCategories = () => {
    categoryFilter.innerHTML = '<option value="">All Categories</option>';
    categoryList.innerHTML = "";

    categories.forEach((cat) => {
      const option = document.createElement("option");
      option.value = cat;
      option.textContent = cat;
      categoryFilter.appendChild(option);

      const li = document.createElement("li");
      li.textContent = cat;
      const delBtn = document.createElement("button");
      delBtn.textContent = "X";
      delBtn.addEventListener("click", () => {
        categories = categories.filter((c) => c !== cat);
        recentDocs = recentDocs.map((doc) =>
          doc.category === cat ? { ...doc, category: "" } : doc
        );
        saveState();
        renderCategories();
        renderRecentDocs();
        showToast("Category removed", "info");
      });
      li.appendChild(delBtn);
      categoryList.appendChild(li);
    });
  };

  /* === READING LOGIC === */
  const startReading = () => {
    const text = textInput.value.trim();
    if (!text) {
      showToast("Please enter or load text", "error");
      return;
    }
    words = text.split(/\s+/);
    currentIndex = 0;
    isPaused = false;
    runReading();
    toggleButtons(true);
  };

  const runReading = () => {
    clearInterval(readingTimer);

    const wpm = parseInt(wpmSlider.value, 10);
    const chunkSize = parseInt(chunkSlider.value, 10);
    const interval = (60 / wpm) * 1000 * chunkSize;

    readingTimer = setInterval(() => {
      if (currentIndex >= words.length) {
        stopReading();
        return;
      }

      const chunk = words
        .slice(currentIndex, currentIndex + chunkSize)
        .join(" ");
      currentIndex += chunkSize;

      const before = words.slice(0, currentIndex - chunkSize).join(" ");
      const after = words.slice(currentIndex).join(" ");

      readingArea.innerHTML = `${before} <span class="highlight">${chunk}</span> ${after}`;

      if (assistiveToggle.checked) {
        readingArea.classList.add("assistive-active");
      } else {
        readingArea.classList.remove("assistive-active");
      }
    }, interval);
  };

  const stopReading = () => {
    clearInterval(readingTimer);
    isPaused = false;
    toggleButtons(false);
    readingArea.innerHTML = textInput.value;
  };

  const resumeReading = () => {
    if (!words.length || !isPaused) {
      showToast("Nothing to resume", "info");
      return;
    }
    isPaused = false;
    runReading();
    resumeBtn.disabled = true;
    stopBtn.disabled = false;
    showToast("Resumed", "success");
  };

  const toggleButtons = (reading) => {
    startBtn.disabled = reading;
    stopBtn.disabled = !reading;
    resumeBtn.disabled = true;
  };

  /* === FILE LOADING === */
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      textInput.value = ev.target.result;
      showToast(`Loaded file: ${file.name}`, "success");
    };
    reader.readAsText(file);
  });

  /* === EVENTS === */
  pasteBtn.addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        showToast("Clipboard is empty", "error");
        return;
      }
      textInput.value = text;
      showToast("Pasted from clipboard", "success");
    } catch {
      showToast("Clipboard not accessible", "error");
    }
  });

  startBtn.addEventListener("click", startReading);
  stopBtn.addEventListener("click", () => {
    isPaused = true;
    clearInterval(readingTimer);
    resumeBtn.disabled = false;
    stopBtn.disabled = true;
    showToast("Paused", "info");
  });
  resumeBtn.addEventListener("click", resumeReading);

  readSelectionBtn.addEventListener("click", () => {
    const selection = window.getSelection().toString().trim();
    if (!selection) {
      showToast("No selection found", "error");
      return;
    }
    textInput.value = selection;
    startReading();
  });

  wpmSlider.addEventListener(
    "input",
    () => (wpmValue.textContent = wpmSlider.value)
  );
  chunkSlider.addEventListener(
    "input",
    () => (chunkValue.textContent = chunkSlider.value)
  );

  /* === CATEGORY MANAGEMENT === */
  addCategoryBtn.addEventListener("click", () => {
    const newCat = categoryInput.value.trim();
    if (!newCat) {
      showToast("Enter a category name", "error");
      return;
    }
    if (!categories.includes(newCat)) {
      categories.push(newCat);
      saveState();
      renderCategories();
      showToast("Category added", "success");
    }
    categoryInput.value = "";
  });

  categoryFilter.addEventListener("change", renderRecentDocs);

  /* === INIT === */
  renderCategories();
  renderRecentDocs();

  /* === SERVICE WORKER === */
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then(() => console.log("Service Worker registered"))
      .catch(() => console.warn("Service Worker not found"));
  }
});
