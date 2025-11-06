let currentMode = "single";
const btnSingle = document.getElementById("btnSingle");
const btnMulti = document.getElementById("btnMulti");
const uploadForm = document.getElementById("uploadForm");
const fileInput = document.getElementById("fileInput");
const fileLabel = document.getElementById("fileLabel");
const fileNameSpan = document.getElementById("fileName");
const preview = document.getElementById("preview");
const hintMode = document.getElementById("hintMode");
const errorMsg = document.getElementById("errorMsg");
const btnProcess = document.getElementById("btnProcess");
const resultContainer = document.getElementById("resultContainer");
const dashboardDiv = document.getElementById("dashboard");
const stepsDiv = document.getElementById("steps");
const teamBlock = document.getElementById("teamBlock");
const btnPDF = document.getElementById("btnPDF");

const analyticsSection = document.getElementById("analyticsSection");
const btnCloseGraphs = document.getElementById("btnCloseGraphs");
const btnClearGraphs = document.getElementById("btnClearGraphs");

let chartObjs = [];

// 🧠 Analytics arrays (keeping simple)
function resetAnalyticsData() {}
function clearResultsAndGraphs() {
  resultContainer.classList.add("hidden");
  stepsDiv.innerHTML = "";
  dashboardDiv.innerHTML = "";
  teamBlock.innerHTML = "";
  errorMsg.textContent = "";
  chartObjs.forEach((ch) => ch && ch.destroy());
  chartObjs = [];
  analyticsSection.classList.add("hidden");
}

btnSingle.onclick = () => setMode("single");
btnMulti.onclick = () => setMode("multi");

function setMode(mode) {
  currentMode = mode;
  btnSingle.className = "mode-btn";
  btnMulti.className = "mode-btn";
  (mode === "single" ? btnSingle : btnMulti).className = "mode-btn-active";
  hintMode.textContent =
    mode === "single"
      ? "Single Plate mode: expects exactly one license plate."
      : "Multi-Plate mode: detects all plates in a single image.";

  fileInput.value = "";
  fileLabel.textContent = "Choose image";
  fileNameSpan.textContent = "No file selected";
  preview.classList.add("hidden");
  clearResultsAndGraphs();
}
setMode("single");

// 🖼️ File preview
fileInput.addEventListener("change", () => {
  const f = fileInput.files[0];
  if (!f) {
    fileLabel.textContent = "Choose image";
    fileNameSpan.textContent = "No file selected";
    return;
  }
  fileLabel.textContent = "Change image";
  fileNameSpan.textContent = f.name;
  const reader = new FileReader();
  reader.onload = (e) => {
    preview.src = e.target.result;
    preview.classList.remove("hidden");
  };
  reader.readAsDataURL(f);
});

// 🚀 Form submission
uploadForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!fileInput.files.length) {
    errorMsg.textContent = "Select an image first.";
    return;
  }

  btnProcess.disabled = true;
  const orig = btnProcess.textContent;
  btnProcess.textContent = "Processing...";

  try {
    const formData = new FormData();
    formData.append("file", fileInput.files[0]);
    const url = currentMode === "single" ? "/upload_single" : "/upload_multi";
    const resp = await fetch(url, { method: "POST", body: formData });
    const data = await resp.json();
    renderResults(data);
  } catch (err) {
    console.error(err);
    errorMsg.textContent = "Server error.";
  } finally {
    btnProcess.disabled = false;
    btnProcess.textContent = orig;
  }
});

// 🧩 Render results
function renderResults(data) {
  clearResultsAndGraphs();

  if (!data.success && data.message) {
    errorMsg.textContent = data.message;
  } else {
    errorMsg.textContent = "";
  }

  resultContainer.classList.remove("hidden");
  const d = data.dashboard || {};

  dashboardDiv.innerHTML = `
    <div class="panel">
      <h2 class="text-xl font-semibold text-white mb-3">Dashboard</h2>
      <div class="kv">
        <div>Image Name</div><div>${d.image_name || "-"}</div>
        <div>Resolution</div><div>${d.resolution || "-"}</div>
        <div>Total Contours</div><div>${d.total_contours ?? "-"}</div>
        <div>Plate Candidates</div><div>${d.plate_candidates ?? "-"}</div>
        ${
          currentMode === "multi"
            ? `<div>Plates Detected</div><div>${d.plates_detected ?? "-"}</div>`
            : ""
        }
        <div>Processing Time</div><div>${d.processing_time ?? "-"}s</div>
        ${
          typeof d.plate_area_percent === "number"
            ? `<div>Plate Area</div><div>${d.plate_area_percent}%</div>`
            : ""
        }
      </div>
    </div>
  `;

  const stepDescriptions = [
    "Converts to grayscale to simplify computation and focus on intensity.",
    "Applies Gaussian blur to reduce noise before edge detection.",
    "Detects edges using Canny operator.",
    "Performs morphological closing to join fragmented edges.",
    "Finds contours in the binary image."
  ];

  (data.steps || []).forEach((s, i) => {
    const card = document.createElement("div");
    card.className = "panel";
    card.innerHTML = `
      <h3 class="text-lg font-medium text-neutral-100 mb-2">${i + 1}. ${
      s.name
    }</h3>
      <img src="${s.url}" class="rounded-md border border-neutral-800 w-full">
      <p class="text-sm text-neutral-400 mt-2">${stepDescriptions[i] || ""}</p>
    `;
    stepsDiv.appendChild(card);
  });

  // Multi-plate mode: show cropped plates
  if (currentMode === "multi" && data.plates && data.plates.length > 0) {
    const multiPanel = document.createElement("div");
    multiPanel.className = "panel";
    multiPanel.innerHTML = `<h3 class="text-lg font-semibold text-sky-400 mb-3">Detected Plates (Cropped)</h3>`;
    const grid = document.createElement("div");
    grid.className = "grid md:grid-cols-3 gap-4";
    data.plates.forEach((p, idx) => {
      const img = document.createElement("img");
      img.src = p;
      img.className = "rounded-md border border-neutral-800 w-full";
      const div = document.createElement("div");
      div.innerHTML = `<p class='text-sm text-neutral-400 mb-1'>Plate ${idx + 1}</p>`;
      div.appendChild(img);
      grid.appendChild(div);
    });
    multiPanel.appendChild(grid);
    stepsDiv.appendChild(multiPanel);
  }

  // Team
  teamBlock.innerHTML = `
    <div class="panel">
      <h3 class="text-lg font-semibold text-white mb-2">Team Members</h3>
      <ul class="list-disc list-inside text-neutral-300">
        ${(data.team || []).map((t) => `<li>${t}</li>`).join("")}
      </ul>
      <div class="mt-4 flex gap-3">
        <button id="btnShowGraphs" class="btn-secondary">📈 Show Graphs</button>
        <button id="btnReset" class="btn-secondary">🗑 Clear Workspace</button>
      </div>
    </div>
  `;

  document.getElementById("btnShowGraphs").onclick = () => showGraphs(d);
  document.getElementById("btnReset").onclick = () => {
    fileInput.value = "";
    fileLabel.textContent = "Choose image";
    fileNameSpan.textContent = "No file selected";
    preview.classList.add("hidden");
    clearResultsAndGraphs();
  };
}

// 📊 Graph buttons
btnCloseGraphs.addEventListener("click", () => {
  analyticsSection.classList.add("hidden");
  chartObjs.forEach((ch) => ch && ch.destroy());
  chartObjs = [];
});

btnClearGraphs.addEventListener("click", () => {
  chartObjs.forEach((ch) => ch && ch.destroy());
  chartObjs = [];
  ["chartSteps", "chartContours"].forEach((id) => {
    const c = document.getElementById(id).getContext("2d");
    c.clearRect(0, 0, c.canvas.width, c.canvas.height);
  });
});

// 📊 Show only Graph 1 & 2
function showGraphs(dash) {
  analyticsSection.classList.remove("hidden");
  chartObjs.forEach((ch) => ch && ch.destroy());
  chartObjs = [];

  // Graph 1: Step timings
  const labels = dash.step_times?.map((s) => s[0]) || [];
  const values = dash.step_times?.map((s) => s[1]) || [];
  chartObjs.push(
    new Chart(document.getElementById("chartSteps"), {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "Time (ms)", data: values, backgroundColor: "#0ea5e9" },
        ],
      },
      options: { scales: { y: { beginAtZero: true } } },
    })
  );

  // Graph 2: Contour distribution
  const cont = dash.contour_data || { total: 0, candidates: 0, plates: 0 };
  chartObjs.push(
    new Chart(document.getElementById("chartContours"), {
      type: "pie",
      data: {
        labels: ["Total", "Candidates", "Plates"],
        datasets: [
          {
            data: [cont.total, cont.candidates, cont.plates],
            backgroundColor: ["#38bdf8", "#a78bfa", "#22c55e"],
          },
        ],
      },
    })
  );
}

// 📄 PDF generation (same)
document.getElementById("btnPDF").addEventListener("click", async () => {
  if (analyticsSection.classList.contains("hidden")) {
    analyticsSection.classList.remove("hidden");
  }
  await new Promise((r) => setTimeout(r, 300));
  generatePDF();
});
