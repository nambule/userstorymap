const STORAGE_KEY = "user-story-map-v1";
const UI_STORAGE_KEY = "user-story-map-ui-v1";
const DETAIL_STATUS = ["to_analyze", "to_estimate", "ready", "in_progress", "done", "cancelled"];
const DETAIL_STATUS_LABELS = {
  to_analyze: "To analyze",
  to_estimate: "To estimate",
  ready: "Ready",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};
const VALID_FILTERS = ["all", ...DETAIL_STATUS];

const seedData = [
  {
    id: crypto.randomUUID(),
    title: "Check account balance",
    steps: [
      {
        id: crypto.randomUUID(),
        title: "Log in",
        details: ["Enter username or email", "Enter password", "Press login button"].map((text) => ({
          id: crypto.randomUUID(),
          text,
          status: "to_analyze",
        })),
      },
      {
        id: crypto.randomUUID(),
        title: "Access accounts",
        details: ["View account balances", "See pending transactions", "Open new account"].map((text) => ({
          id: crypto.randomUUID(),
          text,
          status: "to_analyze",
        })),
      },
    ],
  },
  {
    id: crypto.randomUUID(),
    title: "Deposit a check",
    steps: [
      {
        id: crypto.randomUUID(),
        title: "Enter mobile deposit details",
        details: ["Choose account", "Enter deposit amount", "View transaction limits"].map((text) => ({
          id: crypto.randomUUID(),
          text,
          status: "to_analyze",
        })),
      },
      {
        id: crypto.randomUUID(),
        title: "Sign check",
        details: ["Read tips for taking check photos"].map((text) => ({
          id: crypto.randomUUID(),
          text,
          status: "to_analyze",
        })),
      },
      {
        id: crypto.randomUUID(),
        title: "Photograph check",
        details: ["Enable camera access", "Turn phone horizontal", "Take photo of front & back"].map((text) => ({
          id: crypto.randomUUID(),
          text,
          status: "to_analyze",
        })),
      },
      {
        id: crypto.randomUUID(),
        title: "Submit deposit",
        details: ["Confirm deposit", "Understand amount available", "Cancel deposit"].map((text) => ({
          id: crypto.randomUUID(),
          text,
          status: "to_analyze",
        })),
      },
      {
        id: crypto.randomUUID(),
        title: "Confirm deposit",
        details: ["View confirmation message", "Receive email confirmation"].map((text) => ({
          id: crypto.randomUUID(),
          text,
          status: "to_analyze",
        })),
      },
    ],
  },
];

let activities = loadState();

const board = document.getElementById("board");
const addActivityBtn = document.getElementById("add-activity");
const toggleLegendBtn = document.getElementById("toggle-legend");
const statusFilter = document.getElementById("status-filter");
const statusFilterButtons = Array.from(document.querySelectorAll(".status-filter-btn"));
const toggleStatusMaskBtn = document.getElementById("toggle-status-mask");
const settingsMenu = document.querySelector(".settings-menu");
const exportCsvBtn = document.getElementById("export-csv");
const exportMdBtn = document.getElementById("export-md");
const exportSvgBtn = document.getElementById("export-svg");
const exportBackupBtn = document.getElementById("export-backup");
const importBackupBtn = document.getElementById("import-backup");
const importBackupFileInput = document.getElementById("import-backup-file");
const mapShell = document.querySelector(".map-shell");
const modal = document.getElementById("editor-modal");
const modalTitle = document.getElementById("modal-title");
const modalLabel = document.querySelector(".modal-label");
const modalInput = document.getElementById("modal-input");
const modalStatusWrap = document.getElementById("modal-status-wrap");
const modalStatus = document.getElementById("modal-status");
const modalError = document.getElementById("modal-error");
const modalSave = document.getElementById("modal-save");
const modalDelete = document.getElementById("modal-delete");
const modalCancel = document.getElementById("modal-cancel");
let modalHandlers = { onSave: null, onDelete: null, deleteConfirmText: "", includeStatus: false };
let dragState = null;
const dropIndicator = document.createElement("div");
dropIndicator.id = "drop-indicator";
document.body.appendChild(dropIndicator);
let uiState = loadUIState();

addActivityBtn.addEventListener("click", () => {
  openEditorModal({
    title: "Add Activity",
    label: "Activity title",
    value: "",
    saveText: "Add",
    onSave: (nextTitle) => {
      activities.push({
        id: crypto.randomUUID(),
        title: nextTitle,
        steps: [],
      });
      persistAndRender();
    },
  });
});

toggleLegendBtn.addEventListener("click", () => {
  uiState.legendCollapsed = !uiState.legendCollapsed;
  persistUIState();
  applyLegendState();
});

statusFilter.addEventListener("click", (event) => {
  const button = event.target.closest(".status-filter-btn");
  if (!button) return;
  const next = button.dataset.status;
  if (!next || !VALID_FILTERS.includes(next)) return;

  if (next === "all") {
    uiState.detailFilter = [...DETAIL_STATUS];
    persistUIState();
    applyFilterState();
    render();
    return;
  }

  const selected = new Set(uiState.detailFilter);
  if (selected.has(next)) selected.delete(next);
  else selected.add(next);

  uiState.detailFilter = DETAIL_STATUS.filter((status) => selected.has(status));
  persistUIState();
  applyFilterState();
  render();
});

toggleStatusMaskBtn.addEventListener("click", () => {
  uiState.maskDetailStatus = !uiState.maskDetailStatus;
  persistUIState();
  applyStatusMaskState();
});

exportCsvBtn.addEventListener("click", () => {
  downloadTextFile("story-map.csv", buildCsvExport());
});

exportMdBtn.addEventListener("click", () => {
  downloadTextFile("story-map.md", buildMarkdownExport());
});

exportSvgBtn.addEventListener("click", () => {
  const svg = buildSvgExport();
  downloadBlob("story-map.svg", new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
});

exportBackupBtn.addEventListener("click", () => {
  const payload = buildBackupExport();
  downloadTextFile("story-map-backup.json", JSON.stringify(payload, null, 2));
});

importBackupBtn.addEventListener("click", () => {
  importBackupFileInput.click();
});

importBackupFileInput.addEventListener("change", async () => {
  const file = importBackupFileInput.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const importedActivities = normalizeImportedActivities(parsed);

    if (!confirm("Import will replace the current story map. Continue?")) return;
    activities = importedActivities;
    persistAndRender();
    alert("Backup imported.");
  } catch (error) {
    alert(`Import failed: ${error.message || "Invalid backup file."}`);
  } finally {
    importBackupFileInput.value = "";
  }
});

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return normalizeData(structuredClone(seedData));

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("Invalid state");
    return normalizeData(parsed);
  } catch {
    return normalizeData(structuredClone(seedData));
  }
}

function loadUIState() {
  try {
    const raw = localStorage.getItem(UI_STORAGE_KEY);
    if (!raw) return { legendCollapsed: false, detailFilter: [...DETAIL_STATUS], maskDetailStatus: false };
    const parsed = JSON.parse(raw);
    const rawFilter = Array.isArray(parsed?.detailFilter) ? parsed.detailFilter : [parsed?.detailFilter].filter(Boolean);
    const normalizedFilter = rawFilter.map((status) => normalizeStatus(status));
    const detailFilter = DETAIL_STATUS.filter((status) => normalizedFilter.includes(status));
    return {
      legendCollapsed: Boolean(parsed?.legendCollapsed),
      detailFilter,
      maskDetailStatus: Boolean(parsed?.maskDetailStatus),
    };
  } catch {
    return { legendCollapsed: false, detailFilter: [...DETAIL_STATUS], maskDetailStatus: false };
  }
}

function applyLegendState() {
  mapShell.classList.toggle("legend-collapsed", uiState.legendCollapsed);
  toggleLegendBtn.textContent = uiState.legendCollapsed ? "Unfold left panel" : "Fold left panel";
}

function applyFilterState() {
  const selected = new Set(uiState.detailFilter);
  statusFilterButtons.forEach((button) => {
    const key = button.dataset.status;
    if (key === "all") {
      button.classList.toggle("active", selected.size === DETAIL_STATUS.length);
      return;
    }
    button.classList.toggle("active", selected.has(key));
  });
}

function applyStatusMaskState() {
  toggleStatusMaskBtn.textContent = uiState.maskDetailStatus ? "Unmask status" : "Mask status";
  board.classList.toggle("mask-detail-status", Boolean(uiState.maskDetailStatus));
}

function persistUIState() {
  localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(uiState));
}

function persistAndRender() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
  render();
}

function todayStamp() {
  const now = new Date();
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${todayStamp()}-${filename}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadTextFile(filename, content) {
  downloadBlob(filename, new Blob([content], { type: "text/plain;charset=utf-8" }));
}

function csvEscape(value) {
  const safe = String(value ?? "");
  if (safe.includes(",") || safe.includes("\"") || safe.includes("\n")) {
    return `"${safe.replaceAll("\"", "\"\"")}"`;
  }
  return safe;
}

function buildCsvExport() {
  const rows = [["activity", "step", "detail", "status"]];
  activities.forEach((activity) => {
    if (!activity.steps.length) {
      rows.push([activity.title, "", "", ""]);
      return;
    }

    activity.steps.forEach((step) => {
      if (!step.details.length) {
        rows.push([activity.title, step.title, "", ""]);
        return;
      }

      step.details.forEach((detail) => {
        rows.push([
          activity.title,
          step.title,
          detail.text,
          DETAIL_STATUS_LABELS[normalizeStatus(detail.status)] || "",
        ]);
      });
    });
  });

  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function buildMarkdownExport() {
  const lines = ["# User Story Map", ""];

  activities.forEach((activity) => {
    lines.push(`## ${activity.title}`);
    if (!activity.steps.length) {
      lines.push("- _No steps_");
      lines.push("");
      return;
    }

    activity.steps.forEach((step) => {
      lines.push(`### ${step.title}`);
      if (!step.details.length) {
        lines.push("- _No details_");
        lines.push("");
        return;
      }

      step.details.forEach((detail) => {
        const status = DETAIL_STATUS_LABELS[normalizeStatus(detail.status)] || "";
        lines.push(`- [${status}] ${detail.text}`);
      });
      lines.push("");
    });
  });

  return lines.join("\n");
}

function buildBackupExport() {
  return {
    format: "user-story-map-backup-v1",
    exportedAt: new Date().toISOString(),
    activities: structuredClone(activities),
  };
}

function xmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapTextLines(text, maxCharsPerLine = 22, maxLines = 5) {
  const words = String(text ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return [""];

  const lines = [];
  let current = words[0];
  for (let i = 1; i < words.length; i += 1) {
    const next = words[i];
    if ((current + " " + next).length <= maxCharsPerLine) {
      current += " " + next;
      continue;
    }
    lines.push(current);
    current = next;
    if (lines.length >= maxLines - 1) break;
  }

  if (lines.length < maxLines) lines.push(current);
  if (lines.length > maxLines) lines.length = maxLines;

  const remainingWords = words.slice(lines.join(" ").split(/\s+/).filter(Boolean).length);
  if (remainingWords.length && lines.length) {
    lines[lines.length - 1] = `${lines[lines.length - 1].slice(0, Math.max(0, maxCharsPerLine - 1))}…`;
  }

  return lines;
}

function textBlock(lines, x, y, lineHeight, attrs = "") {
  if (!lines.length) return "";
  const escaped = lines.map((line) => xmlEscape(line));
  const tspans = escaped
    .map(
      (line, index) =>
        `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${line}</tspan>`,
    )
    .join("");
  return `<text x="${x}" y="${y}" ${attrs}>${tspans}</text>`;
}

function buildSvgExport() {
  const colors = {
    background: "#ffffff",
    text: "#0f1b36",
    activity: "#6f8cf4",
    step: "#8be5b2",
    detail: "#f4ecab",
    emptyBg: "#f0f3f8",
    emptyStroke: "#b2bfd3",
    chip: {
      to_analyze: "#dc2626",
      to_estimate: "#f97316",
      ready: "#2563eb",
      in_progress: "#7c3aed",
      done: "#15803d",
      cancelled: "#6b7280",
    },
  };

  const metrics = {
    padding: 18,
    colWidth: 190,
    gap: 14,
    cardHeight: 104,
    detailCardHeight: 104,
    emptyHeight: 56,
    radius: 8,
    cardPaddingX: 10,
    titleY: 30,
    titleLineHeight: 17,
    chipHeight: 16,
  };

  const row1Y = metrics.padding;
  const row2Y = row1Y + metrics.cardHeight + metrics.gap;
  const row3Y = row2Y + metrics.cardHeight + metrics.gap;

  if (!activities.length) {
    const width = 740;
    const height = 180;
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="User story map">
  <rect width="${width}" height="${height}" fill="${colors.background}" />
  <rect x="${metrics.padding}" y="${metrics.padding}" width="${width - metrics.padding * 2}" height="${height - metrics.padding * 2}" rx="10" ry="10" fill="#f8fafc" stroke="#a2aec4" stroke-dasharray="6 5" />
  <text x="${width / 2}" y="${height / 2 + 5}" fill="${colors.text}" font-family="Avenir Next, Segoe UI, sans-serif" font-size="15" text-anchor="middle">No activities yet. Use + Activity to start your map.</text>
</svg>`;
  }

  const selectedStatuses = new Set(uiState.detailFilter);
  let totalColumns = 0;
  let maxDetailStackHeight = metrics.emptyHeight;
  activities.forEach((activity) => {
    totalColumns += Math.max(activity.steps.length, 1);
    if (!activity.steps.length) return;
    activity.steps.forEach((step) => {
      const stackHeight = step.details.length
        ? step.details.length * metrics.detailCardHeight + (step.details.length - 1) * metrics.gap
        : metrics.emptyHeight;
      if (stackHeight > maxDetailStackHeight) maxDetailStackHeight = stackHeight;
    });
  });

  const width = metrics.padding * 2 + totalColumns * metrics.colWidth + (totalColumns - 1) * metrics.gap;
  const height = row3Y + maxDetailStackHeight + metrics.padding;
  const svg = [];
  svg.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  svg.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="User story map">`,
  );
  svg.push(`<rect width="${width}" height="${height}" fill="${colors.background}" />`);

  let column = 0;
  activities.forEach((activity) => {
    const span = Math.max(activity.steps.length, 1);
    const activityX = metrics.padding + column * (metrics.colWidth + metrics.gap);
    const activityW = span * metrics.colWidth + (span - 1) * metrics.gap;

    svg.push(
      `<rect x="${activityX}" y="${row1Y}" width="${activityW}" height="${metrics.cardHeight}" rx="${metrics.radius}" ry="${metrics.radius}" fill="${colors.activity}" />`,
    );
    svg.push(
      textBlock(
        wrapTextLines(activity.title, Math.max(14, Math.floor((activityW - 20) / 8)), 5),
        activityX + metrics.cardPaddingX,
        row1Y + metrics.titleY,
        metrics.titleLineHeight,
        `fill="${colors.text}" font-family="Avenir Next, Segoe UI, sans-serif" font-size="14" font-weight="650"`,
      ),
    );

    if (!activity.steps.length) {
      const colX = metrics.padding + column * (metrics.colWidth + metrics.gap);
      svg.push(
        `<rect x="${colX}" y="${row2Y}" width="${metrics.colWidth}" height="${metrics.emptyHeight}" rx="${metrics.radius}" ry="${metrics.radius}" fill="${colors.emptyBg}" stroke="${colors.emptyStroke}" stroke-dasharray="4 4" />`,
      );
      svg.push(
        textBlock(
          wrapTextLines("No steps yet. Add one from the activity card.", 24, 3),
          colX + 10,
          row2Y + 24,
          14,
          `fill="#3f4b60" font-family="Avenir Next, Segoe UI, sans-serif" font-size="12"`,
        ),
      );

      svg.push(
        `<rect x="${colX}" y="${row3Y}" width="${metrics.colWidth}" height="${metrics.emptyHeight}" rx="${metrics.radius}" ry="${metrics.radius}" fill="${colors.emptyBg}" stroke="${colors.emptyStroke}" stroke-dasharray="4 4" />`,
      );
      svg.push(
        `<text x="${colX + 10}" y="${row3Y + 24}" fill="#3f4b60" font-family="Avenir Next, Segoe UI, sans-serif" font-size="12">No details yet.</text>`,
      );
      column += 1;
      return;
    }

    activity.steps.forEach((step) => {
      const colX = metrics.padding + column * (metrics.colWidth + metrics.gap);
      svg.push(
        `<rect x="${colX}" y="${row2Y}" width="${metrics.colWidth}" height="${metrics.cardHeight}" rx="${metrics.radius}" ry="${metrics.radius}" fill="${colors.step}" />`,
      );
      svg.push(
        textBlock(
          wrapTextLines(step.title, 22, 5),
          colX + metrics.cardPaddingX,
          row2Y + metrics.titleY,
          metrics.titleLineHeight,
          `fill="${colors.text}" font-family="Avenir Next, Segoe UI, sans-serif" font-size="14" font-weight="650"`,
        ),
      );

      if (!step.details.length) {
        svg.push(
          `<rect x="${colX}" y="${row3Y}" width="${metrics.colWidth}" height="${metrics.emptyHeight}" rx="${metrics.radius}" ry="${metrics.radius}" fill="${colors.emptyBg}" stroke="${colors.emptyStroke}" stroke-dasharray="4 4" />`,
        );
        svg.push(
          `<text x="${colX + 10}" y="${row3Y + 24}" fill="#3f4b60" font-family="Avenir Next, Segoe UI, sans-serif" font-size="12">No details yet.</text>`,
        );
        column += 1;
        return;
      }

      step.details.forEach((detail, index) => {
        const status = normalizeStatus(detail.status);
        const y = row3Y + index * (metrics.detailCardHeight + metrics.gap);
        const muted = !selectedStatuses.has(status);
        const opacity = muted ? 0.35 : 1;
        svg.push(
          `<rect x="${colX}" y="${y}" width="${metrics.colWidth}" height="${metrics.detailCardHeight}" rx="${metrics.radius}" ry="${metrics.radius}" fill="${colors.detail}" opacity="${opacity}" />`,
        );
        svg.push(
          textBlock(
            wrapTextLines(detail.text, 22, 4),
            colX + metrics.cardPaddingX,
            y + metrics.titleY,
            metrics.titleLineHeight,
            `fill="${colors.text}" font-family="Avenir Next, Segoe UI, sans-serif" font-size="14" font-weight="650" opacity="${opacity}"`,
          ),
        );

        if (!uiState.maskDetailStatus) {
          const chipLabel = xmlEscape(DETAIL_STATUS_LABELS[status] || DETAIL_STATUS_LABELS.to_analyze);
          const chipW = Math.max(52, chipLabel.length * 5.2 + 12);
          const chipX = colX + metrics.colWidth - chipW - 8;
          const chipY = y + metrics.detailCardHeight - metrics.chipHeight - 8;
          const chipColor = colors.chip[status] || colors.chip.to_analyze;
          svg.push(
            `<rect x="${chipX}" y="${chipY}" width="${chipW}" height="${metrics.chipHeight}" rx="8" ry="8" fill="${chipColor}" opacity="${opacity}" />`,
          );
          svg.push(
            `<text x="${chipX + chipW / 2}" y="${chipY + 11}" fill="#ffffff" font-family="Avenir Next, Segoe UI, sans-serif" font-size="9" font-weight="500" text-anchor="middle" opacity="${opacity}">${chipLabel}</text>`,
          );
        }
      });
      column += 1;
    });
  });

  svg.push("</svg>");
  return svg.filter(Boolean).join("\n");
}

function normalizeImportedActivities(parsed) {
  const incoming = Array.isArray(parsed) ? parsed : parsed?.activities;
  if (!Array.isArray(incoming)) {
    throw new Error("Backup must contain an activities array.");
  }

  const normalized = incoming.map((activity) => ({
    id: activity?.id || crypto.randomUUID(),
    title: String(activity?.title || "Untitled activity"),
    steps: Array.isArray(activity?.steps)
      ? activity.steps.map((step) => ({
          id: step?.id || crypto.randomUUID(),
          title: String(step?.title || "Untitled step"),
          details: Array.isArray(step?.details)
            ? step.details.map((detail) => ({
                id: detail?.id || crypto.randomUUID(),
                text: String(detail?.text || ""),
                status: normalizeStatus(detail?.status),
              }))
            : [],
        }))
      : [],
  }));

  return normalizeData(normalized);
}

function normalizeData(data) {
  data.forEach((activity) => {
    if (!Array.isArray(activity.steps)) activity.steps = [];
    activity.steps.forEach((step) => {
      if (!Array.isArray(step.details)) step.details = [];
      step.details.forEach((detail) => {
        detail.status = normalizeStatus(detail.status);
      });
    });
  });
  return data;
}

function normalizeStatus(status) {
  if (status === "todo") return "to_analyze";
  if (status === "blocked") return "cancelled";
  return DETAIL_STATUS.includes(status) ? status : "to_analyze";
}

function removeAt(arr, id) {
  const index = arr.findIndex((item) => item.id === id);
  if (index >= 0) arr.splice(index, 1);
}

function repositionInArray(arr, fromIndex, targetIndex, placeAfter) {
  if (fromIndex < 0 || targetIndex < 0 || fromIndex === targetIndex) return;
  let insertIndex = targetIndex + (placeAfter ? 1 : 0);
  if (fromIndex < insertIndex) insertIndex -= 1;
  if (fromIndex === insertIndex) return;

  const [moved] = arr.splice(fromIndex, 1);
  arr.splice(insertIndex, 0, moved);
}

function findStep(activityId, stepId) {
  const activity = activities.find((item) => item.id === activityId);
  if (!activity) return null;
  return activity.steps.find((item) => item.id === stepId) || null;
}

function hideDropIndicator() {
  dropIndicator.classList.remove("visible", "x", "y");
}

function showDropIndicator(axis, targetRect, placeAfter) {
  const gapOffset = 7;
  if (axis === "x") {
    const x = placeAfter ? targetRect.right + gapOffset : targetRect.left - gapOffset;
    dropIndicator.style.left = `${x - 2}px`;
    dropIndicator.style.top = `${targetRect.top}px`;
    dropIndicator.style.width = "4px";
    dropIndicator.style.height = `${targetRect.height}px`;
    dropIndicator.className = "visible x";
    return;
  }

  const y = placeAfter ? targetRect.bottom + gapOffset : targetRect.top - gapOffset;
  dropIndicator.style.left = `${targetRect.left}px`;
  dropIndicator.style.top = `${y - 2}px`;
  dropIndicator.style.width = `${targetRect.width}px`;
  dropIndicator.style.height = "4px";
  dropIndicator.className = "visible y";
}

function makeNote(
  title,
  type,
  { onOpen = null, quickAdd = null, drag = null, detailStatus = null, muted = false } = {},
) {
  const note = document.createElement("article");
  note.className = `note ${type}`;
  if (muted) note.classList.add("muted");
  if (onOpen) {
    note.addEventListener("click", onOpen);
    note.setAttribute("role", "button");
    note.tabIndex = 0;
    note.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onOpen();
      }
    });
  }

  const titleEl = document.createElement("div");
  titleEl.className = "note-title";
  titleEl.textContent = title;
  note.appendChild(titleEl);

  if (detailStatus) {
    note.classList.add(`detail-status-${detailStatus}`);
    const chip = document.createElement("div");
    chip.className = `detail-status-chip status-${detailStatus}`;
    chip.textContent = DETAIL_STATUS_LABELS[detailStatus] || DETAIL_STATUS_LABELS.to_analyze;
    note.appendChild(chip);
  }

  if (drag) {
    note.draggable = true;
    note.classList.add("draggable");

    note.addEventListener("dragstart", (event) => {
      dragState = drag.getData();
      note.classList.add("dragging");
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", "story-map-drag");
      }
    });

    note.addEventListener("dragend", () => {
      dragState = null;
      note.classList.remove("dragging");
      hideDropIndicator();
    });

    note.addEventListener("dragover", (event) => {
      if (!dragState || !drag.accepts(dragState)) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = note.getBoundingClientRect();
      const placeAfter =
        drag.axis === "y"
          ? event.clientY > rect.top + rect.height / 2
          : event.clientX > rect.left + rect.width / 2;
      showDropIndicator(drag.axis, rect, placeAfter);
    });

    note.addEventListener("drop", (event) => {
      if (!dragState || !drag.accepts(dragState)) return;
      event.preventDefault();
      event.stopPropagation();
      drag.onDrop(dragState, event, note.getBoundingClientRect());
      dragState = null;
      hideDropIndicator();
    });
  }

  if (quickAdd) {
    const quick = document.createElement("button");
    quick.className = "note-quick-action";
    quick.type = "button";
    quick.draggable = false;
    quick.textContent = quickAdd.label;
    quick.addEventListener("click", (event) => {
      event.stopPropagation();
      quickAdd.onClick();
    });
    note.appendChild(quick);
  }

  return note;
}

function openEditorModal({
  title,
  label,
  value,
  saveText,
  onSave,
  onDelete = null,
  deleteConfirmText = "",
  status = null,
}) {
  modalTitle.textContent = title;
  modalLabel.textContent = label;
  modalInput.value = value;
  modalSave.textContent = saveText;
  modalError.classList.add("hidden");

  const includeStatus = Boolean(status);
  modalStatusWrap.classList.toggle("hidden", !includeStatus);
  modalStatus.value = includeStatus ? normalizeStatus(status) : "to_analyze";
  modalHandlers = { onSave, onDelete, deleteConfirmText, includeStatus };
  modalDelete.classList.toggle("hidden", !onDelete);
  modal.classList.remove("hidden");

  requestAnimationFrame(() => {
    modalInput.focus();
    modalInput.select();
  });
}

function closeEditorModal() {
  modal.classList.add("hidden");
  modalHandlers = { onSave: null, onDelete: null, deleteConfirmText: "", includeStatus: false };
}

function handleModalSave() {
  const value = modalInput.value.trim();
  if (!value) {
    modalError.classList.remove("hidden");
    modalInput.focus();
    return;
  }

  if (modalHandlers.onSave) {
    const status = modalHandlers.includeStatus ? normalizeStatus(modalStatus.value) : null;
    modalHandlers.onSave(value, status);
  }
  closeEditorModal();
}

function handleModalDelete() {
  if (!modalHandlers.onDelete) return;
  const confirmText = modalHandlers.deleteConfirmText || "Delete this item?";
  if (!confirm(confirmText)) return;
  modalHandlers.onDelete();
  closeEditorModal();
}

modalSave.addEventListener("click", handleModalSave);
modalDelete.addEventListener("click", handleModalDelete);
modalCancel.addEventListener("click", closeEditorModal);
modal.addEventListener("click", (event) => {
  if (event.target === modal) closeEditorModal();
});
modalInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") handleModalSave();
  if (event.key === "Escape") closeEditorModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.classList.contains("hidden")) {
    closeEditorModal();
  }
  if (event.key === "Escape" && settingsMenu?.open) {
    settingsMenu.open = false;
  }
});

document.addEventListener("click", (event) => {
  if (!settingsMenu?.open) return;
  if (!settingsMenu.contains(event.target)) {
    settingsMenu.open = false;
  }
});

function render() {
  board.innerHTML = "";

  if (!activities.length) {
    const empty = document.createElement("div");
    empty.className = "empty-board";
    empty.textContent = "No activities yet. Use + Activity to start your map.";
    board.appendChild(empty);
    return;
  }

  const grid = document.createElement("div");
  grid.className = "story-grid";

  const totalColumns = activities.reduce((sum, activity) => sum + Math.max(activity.steps.length, 1), 0);
  grid.style.gridTemplateColumns = `repeat(${totalColumns}, var(--col-width))`;

  let col = 1;
  activities.forEach((activity) => {
    const span = Math.max(activity.steps.length, 1);

    const activityBox = document.createElement("div");
    activityBox.className = "activity-box";
    activityBox.style.gridColumn = `${col} / span ${span}`;
    activityBox.style.gridRow = "1";

    activityBox.appendChild(
      makeNote(activity.title, "activity", {
        onOpen: () => {
          openEditorModal({
            title: "Edit Activity",
            label: "Activity title",
            value: activity.title,
            saveText: "Save",
            onSave: (nextTitle) => {
              activity.title = nextTitle;
              persistAndRender();
            },
            onDelete: () => {
              removeAt(activities, activity.id);
              persistAndRender();
            },
            deleteConfirmText: `Delete activity "${activity.title}" and all nested steps/details?`,
          });
        },
        quickAdd: {
          label: "+ Step",
          onClick: () => {
            openEditorModal({
              title: "Add Step",
              label: `Step title for "${activity.title}"`,
              value: "",
              saveText: "Add",
              onSave: (stepTitle) => {
                activity.steps.push({ id: crypto.randomUUID(), title: stepTitle, details: [] });
                persistAndRender();
              },
            });
          },
        },
        drag: {
          axis: "x",
          getData: () => ({ type: "activity", activityId: activity.id }),
          accepts: (incoming) => incoming.type === "activity" && incoming.activityId !== activity.id,
          onDrop: (incoming, event, rect) => {
            const fromIndex = activities.findIndex((item) => item.id === incoming.activityId);
            const targetIndex = activities.findIndex((item) => item.id === activity.id);
            const placeAfter = event.clientX > rect.left + rect.width / 2;
            repositionInArray(activities, fromIndex, targetIndex, placeAfter);
            persistAndRender();
          },
        },
      }),
    );
    grid.appendChild(activityBox);

    if (!activity.steps.length) {
      const emptyStep = document.getElementById("empty-step-template").content.firstElementChild.cloneNode(true);
      emptyStep.classList.add("step-box");
      emptyStep.style.gridColumn = `${col}`;
      emptyStep.style.gridRow = "2";
      grid.appendChild(emptyStep);

      const emptyDetailCol = document.createElement("div");
      emptyDetailCol.className = "detail-column";
      emptyDetailCol.style.gridColumn = `${col}`;
      emptyDetailCol.style.gridRow = "3";

      const emptyDetail = document.createElement("div");
      emptyDetail.className = "empty-note";
      emptyDetail.textContent = "No details yet.";
      emptyDetailCol.appendChild(emptyDetail);
      grid.appendChild(emptyDetailCol);
      col += 1;
      return;
    }

    activity.steps.forEach((step) => {
      const stepBox = document.createElement("div");
      stepBox.className = "step-box";
      stepBox.style.gridColumn = `${col}`;
      stepBox.style.gridRow = "2";

      stepBox.appendChild(
        makeNote(step.title, "step", {
          onOpen: () => {
            openEditorModal({
              title: "Edit Step",
              label: "Step title",
              value: step.title,
              saveText: "Save",
              onSave: (nextTitle) => {
                step.title = nextTitle;
                persistAndRender();
              },
              onDelete: () => {
                removeAt(activity.steps, step.id);
                persistAndRender();
              },
              deleteConfirmText: `Delete step "${step.title}" and all its details?`,
            });
          },
          quickAdd: {
            label: "+ Detail",
            onClick: () => {
              openEditorModal({
                title: "Add Detail",
                label: `Detail text for "${step.title}"`,
                value: "",
                saveText: "Add",
                onSave: (detailText, detailStatus) => {
                  const status = normalizeStatus(detailStatus);
                  step.details.push({ id: crypto.randomUUID(), text: detailText, status });
                  persistAndRender();
                },
                status: "to_analyze",
              });
            },
          },
        drag: {
            axis: "x",
            getData: () => ({ type: "step", activityId: activity.id, stepId: step.id }),
            accepts: (incoming) =>
              incoming.type === "step" &&
              incoming.activityId === activity.id &&
              incoming.stepId !== step.id,
            onDrop: (incoming, event, rect) => {
              const fromIndex = activity.steps.findIndex((item) => item.id === incoming.stepId);
              const targetIndex = activity.steps.findIndex((item) => item.id === step.id);
              const placeAfter = event.clientX > rect.left + rect.width / 2;
              repositionInArray(activity.steps, fromIndex, targetIndex, placeAfter);
              persistAndRender();
            },
          },
        }),
      );
      grid.appendChild(stepBox);

      const detailColumn = document.createElement("div");
      detailColumn.className = "detail-column";
      detailColumn.style.gridColumn = `${col}`;
      detailColumn.style.gridRow = "3";

      if (!step.details.length) {
        const empty = document.createElement("div");
        empty.className = "empty-note";
        empty.textContent = "No details yet.";
        detailColumn.appendChild(empty);
      }

      const selectedStatuses = new Set(uiState.detailFilter);
      step.details.forEach((detail) => {
        const normalizedStatus = normalizeStatus(detail.status);
        const isMuted = !selectedStatuses.has(normalizedStatus);
        detailColumn.appendChild(
          makeNote(detail.text, "detail", {
            detailStatus: normalizedStatus,
            muted: isMuted,
            onOpen: () => {
              openEditorModal({
                title: "Edit Detail",
                label: "Detail text",
                value: detail.text,
                saveText: "Save",
                onSave: (nextText, nextStatus) => {
                  detail.text = nextText;
                  detail.status = normalizeStatus(nextStatus);
                  persistAndRender();
                },
                onDelete: () => {
                  removeAt(step.details, detail.id);
                  persistAndRender();
                },
                deleteConfirmText: `Delete detail "${detail.text}"?`,
                status: normalizedStatus,
              });
            },
            drag: {
              axis: "y",
              getData: () => ({
                type: "detail",
                activityId: activity.id,
                stepId: step.id,
                detailId: detail.id,
              }),
              accepts: (incoming) =>
                incoming.type === "detail" &&
                incoming.detailId !== detail.id,
              onDrop: (incoming, event, rect) => {
                const sourceStep = findStep(incoming.activityId, incoming.stepId);
                if (!sourceStep) return;
                const fromIndex = sourceStep.details.findIndex((item) => item.id === incoming.detailId);
                const targetIndex = step.details.findIndex((item) => item.id === detail.id);
                if (fromIndex < 0 || targetIndex < 0) return;
                const placeAfter = event.clientY > rect.top + rect.height / 2;
                if (sourceStep.id === step.id) {
                  repositionInArray(step.details, fromIndex, targetIndex, placeAfter);
                  persistAndRender();
                  return;
                }

                const [movedDetail] = sourceStep.details.splice(fromIndex, 1);
                const insertIndex = targetIndex + (placeAfter ? 1 : 0);
                step.details.splice(insertIndex, 0, movedDetail);
                persistAndRender();
              },
            },
          }),
        );
      });

      detailColumn.addEventListener("dragover", (event) => {
        if (!dragState || dragState.type !== "detail") return;
        if (event.target !== detailColumn) return;
        event.preventDefault();
        const rect = detailColumn.getBoundingClientRect();
        showDropIndicator("y", rect, true);
      });

      detailColumn.addEventListener("drop", (event) => {
        if (!dragState || dragState.type !== "detail") return;
        if (event.target !== detailColumn) return;
        event.preventDefault();
        const sourceStep = findStep(dragState.activityId, dragState.stepId);
        if (!sourceStep) return;
        const fromIndex = sourceStep.details.findIndex((item) => item.id === dragState.detailId);
        if (fromIndex < 0) return;

        if (sourceStep.id === step.id) {
          const [movedDetail] = sourceStep.details.splice(fromIndex, 1);
          sourceStep.details.push(movedDetail);
        } else {
          const [movedDetail] = sourceStep.details.splice(fromIndex, 1);
          step.details.push(movedDetail);
        }
        dragState = null;
        hideDropIndicator();
        persistAndRender();
      });

      grid.appendChild(detailColumn);
      col += 1;
    });
  });

  board.appendChild(grid);
}

render();
applyLegendState();
applyFilterState();
applyStatusMaskState();
