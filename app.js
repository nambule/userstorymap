const STORAGE_KEY = "user-story-map-v1";
const UI_STORAGE_KEY = "user-story-map-ui-v1";
const DEFAULT_MAP_TITLE = "User Story Map Builder";
const DETAIL_STATUS = ["to_analyze", "to_estimate", "ready", "in_progress", "done", "cancelled"];
const DETAIL_STATUS_LABELS = {
  to_analyze: "To analyze",
  to_estimate: "To estimate",
  ready: "Ready",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};
const DETAIL_STATUS_ICONS = {
  to_analyze: "◎",
  to_estimate: "◌",
  ready: "●",
  in_progress: "↻",
  done: "✓",
  cancelled: "×",
};
const VALID_FILTERS = ["all", ...DETAIL_STATUS];

function createDetail(text = "", status = "to_analyze") {
  return {
    id: crypto.randomUUID(),
    text,
    status: normalizeStatus(status),
  };
}

function createVersion(details = []) {
  return {
    id: crypto.randomUUID(),
    details,
  };
}

const seedData = [
  {
    id: crypto.randomUUID(),
    title: "Check account balance",
    steps: [
      {
        id: crypto.randomUUID(),
        title: "Log in",
        versions: [
          createVersion(["Enter username or email", "Enter password", "Press login button"].map((text) => createDetail(text))),
        ],
      },
      {
        id: crypto.randomUUID(),
        title: "Access accounts",
        versions: [
          createVersion(["View account balances", "See pending transactions", "Open new account"].map((text) => createDetail(text))),
        ],
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
        versions: [
          createVersion(["Choose account", "Enter deposit amount", "View transaction limits"].map((text) => createDetail(text))),
        ],
      },
      {
        id: crypto.randomUUID(),
        title: "Sign check",
        versions: [createVersion(["Read tips for taking check photos"].map((text) => createDetail(text)))],
      },
      {
        id: crypto.randomUUID(),
        title: "Photograph check",
        versions: [
          createVersion(["Enable camera access", "Turn phone horizontal", "Take photo of front & back"].map((text) => createDetail(text))),
        ],
      },
      {
        id: crypto.randomUUID(),
        title: "Submit deposit",
        versions: [
          createVersion(["Confirm deposit", "Understand amount available", "Cancel deposit"].map((text) => createDetail(text))),
        ],
      },
      {
        id: crypto.randomUUID(),
        title: "Confirm deposit",
        versions: [createVersion(["View confirmation message", "Receive email confirmation"].map((text) => createDetail(text)))],
      },
    ],
  },
];

let activities = loadState();

const board = document.getElementById("board");
const pageTitle = document.getElementById("page-title");
const addActivityBtn = document.getElementById("add-activity");
const toggleLegendBtn = document.getElementById("toggle-legend");
const statusFilter = document.getElementById("status-filter");
const statusFilterButtons = Array.from(document.querySelectorAll(".status-filter-btn"));
const toggleStatusMaskBtn = document.getElementById("toggle-status-mask");
const addVersionBtn = document.getElementById("add-version");
const deleteLastVersionBtn = document.getElementById("delete-last-version");
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

pageTitle.addEventListener("click", () => {
  openEditorModal({
    title: "Edit Title",
    label: "Page title",
    value: uiState.mapTitle,
    saveText: "Save",
    onSave: (nextTitle) => {
      uiState.mapTitle = nextTitle;
      persistUIState();
      applyMapTitleState();
    },
  });
});

pageTitle.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  pageTitle.click();
});

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

addVersionBtn.addEventListener("click", () => {
  insertVersionRow(getMaxVersionCount() - 1);
  settingsMenu.open = false;
  persistAndRender();
});

deleteLastVersionBtn.addEventListener("click", () => {
  const maxVersionCount = getMaxVersionCount();
  if (maxVersionCount <= 1) return;

  const lastVersionIndex = maxVersionCount - 1;
  if (!confirm(`Delete ${getVersionLabel(lastVersionIndex)}? Its tickets will move into ${getVersionLabel(lastVersionIndex - 1)}.`)) {
    return;
  }

  deleteVersionRow(lastVersionIndex);
  settingsMenu.open = false;
  persistAndRender();
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
    if (!raw) {
      return {
        legendCollapsed: false,
        detailFilter: [...DETAIL_STATUS],
        maskDetailStatus: false,
        mapTitle: DEFAULT_MAP_TITLE,
      };
    }
    const parsed = JSON.parse(raw);
    const rawFilter = Array.isArray(parsed?.detailFilter) ? parsed.detailFilter : [parsed?.detailFilter].filter(Boolean);
    const normalizedFilter = rawFilter.map((status) => normalizeStatus(status));
    const detailFilter = DETAIL_STATUS.filter((status) => normalizedFilter.includes(status));
    return {
      legendCollapsed: Boolean(parsed?.legendCollapsed),
      detailFilter,
      maskDetailStatus: Boolean(parsed?.maskDetailStatus),
      mapTitle: String(parsed?.mapTitle || DEFAULT_MAP_TITLE),
    };
  } catch {
    return {
      legendCollapsed: false,
      detailFilter: [...DETAIL_STATUS],
      maskDetailStatus: false,
      mapTitle: DEFAULT_MAP_TITLE,
    };
  }
}

function applyMapTitleState() {
  pageTitle.textContent = uiState.mapTitle;
  document.title = uiState.mapTitle;
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

function getStepVersions(step) {
  return Array.isArray(step?.versions) ? step.versions : [];
}

function getAllSteps() {
  return activities.flatMap((activity) => activity.steps);
}

function getMaxVersionCount() {
  return Math.max(1, ...getAllSteps().map((step) => getStepVersions(step).length));
}

function getVersionLabel(index) {
  return `Version ${index + 1}`;
}

function ensureVersionAt(step, versionIndex) {
  if (!Array.isArray(step.versions)) step.versions = [];
  while (step.versions.length <= versionIndex) {
    step.versions.push(createVersion());
  }
  return step.versions[versionIndex];
}

function pruneEmptyTrailingVersions(step) {
  if (!Array.isArray(step.versions)) return;
  while (step.versions.length > 1 && !step.versions[step.versions.length - 1].details.length) {
    step.versions.pop();
  }
}

function insertVersionRow(afterIndex) {
  getAllSteps().forEach((step) => {
    const versions = getStepVersions(step);
    while (versions.length <= afterIndex) versions.push(createVersion());
    versions.splice(afterIndex + 1, 0, createVersion());
  });
}

function deleteVersionRow(versionIndex) {
  if (getMaxVersionCount() <= 1) return false;

  getAllSteps().forEach((step) => {
    const versions = getStepVersions(step);
    if (!versions.length || versionIndex >= versions.length) return;

    if (versionIndex === 0) {
      const target = versions[1];
      if (target) {
        target.details = [...versions[0].details, ...target.details];
      }
      versions.splice(0, 1);
    } else {
      const target = versions[versionIndex - 1];
      target.details.push(...versions[versionIndex].details);
      versions.splice(versionIndex, 1);
    }

    if (!versions.length) versions.push(createVersion());
    pruneEmptyTrailingVersions(step);
  });

  return true;
}

function buildCsvExport() {
  const rows = [["activity", "step", "version", "detail", "status"]];
  activities.forEach((activity) => {
    if (!activity.steps.length) {
      rows.push([activity.title, "", "", "", ""]);
      return;
    }

    activity.steps.forEach((step) => {
      const versions = getStepVersions(step);
      if (!versions.length) {
        rows.push([activity.title, step.title, "", "", ""]);
        return;
      }

      versions.forEach((version, versionIndex) => {
        if (!version.details.length) {
          rows.push([activity.title, step.title, getVersionLabel(versionIndex), "", ""]);
          return;
        }

        version.details.forEach((detail) => {
          rows.push([
            activity.title,
            step.title,
            getVersionLabel(versionIndex),
            detail.text,
            DETAIL_STATUS_LABELS[normalizeStatus(detail.status)] || "",
          ]);
        });
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
      const versions = getStepVersions(step);
      if (!versions.length) {
        lines.push("- _No details_");
        lines.push("");
        return;
      }

      versions.forEach((version, versionIndex) => {
        lines.push(`#### ${getVersionLabel(versionIndex)}`);
        if (!version.details.length) {
          lines.push("- _No details_");
          lines.push("");
          return;
        }

        version.details.forEach((detail) => {
          const status = DETAIL_STATUS_LABELS[normalizeStatus(detail.status)] || "";
          lines.push(`- [${status}] ${detail.text}`);
        });
        lines.push("");
      });
    });
  });

  return lines.join("\n");
}

function buildBackupExport() {
  return {
    format: "user-story-map-backup-v2",
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

function getVersionContentHeight(version, metrics) {
  if (!version) return 0;
  if (!version.details.length) return metrics.emptyHeight;
  return version.details.length * metrics.detailCardHeight + (version.details.length - 1) * metrics.gap;
}

function getBoardColumns() {
  const columns = [];
  activities.forEach((activity) => {
    if (!activity.steps.length) {
      columns.push({ activity, step: null });
      return;
    }

    activity.steps.forEach((step) => {
      columns.push({ activity, step });
    });
  });
  return columns;
}

function getBoardVersionLayout(columns, metrics) {
  const maxVersionCount = Math.max(
    1,
    ...columns.map((column) => (column.step ? getStepVersions(column.step).length : 0)),
  );
  const rowHeights = Array.from({ length: maxVersionCount }, (_, versionIndex) => {
    let maxHeight = 0;
    columns.forEach((column) => {
      if (!column.step) return;
      const version = getStepVersions(column.step)[versionIndex];
      maxHeight = Math.max(maxHeight, getVersionContentHeight(version, metrics));
    });
    return Math.max(maxHeight, versionIndex === 0 ? metrics.emptyHeight : 0);
  });

  return { maxVersionCount, rowHeights };
}

function buildSvgExport() {
  const colors = {
    background: "#f4f5f7",
    text: "#172b4d",
    activity: "#deebff",
    step: "#def6ea",
    detail: "#ffffff",
    emptyBg: "#fafbfc",
    emptyStroke: "#c1c7d0",
    divider: "#85b8ff",
    chip: {
      to_analyze: "#c9372c",
      to_estimate: "#f79009",
      ready: "#0c66e4",
      in_progress: "#6554c0",
      done: "#1f845a",
      cancelled: "#758195",
    },
  };

  const metrics = {
    padding: 18,
    colWidth: 190,
    gap: 14,
    cardHeight: 104,
    detailCardHeight: 104,
    emptyHeight: 56,
    versionDividerGap: 28,
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
  const columns = getBoardColumns();
  const totalColumns = columns.length;
  const { maxVersionCount, rowHeights } = getBoardVersionLayout(columns, metrics);
  const detailAreaHeight = rowHeights.reduce(
    (sum, height, versionIndex) => sum + height + (versionIndex === 0 ? 0 : metrics.versionDividerGap),
    0,
  );

  const width = metrics.padding * 2 + totalColumns * metrics.colWidth + (totalColumns - 1) * metrics.gap;
  const height = row3Y + detailAreaHeight + metrics.padding;
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

      column += 1;
    });
  });

  let currentY = row3Y;
  rowHeights.forEach((rowHeight, versionIndex) => {
    if (versionIndex > 0) {
      const separatorY = currentY + metrics.versionDividerGap / 2;
      const versionLabel = getVersionLabel(versionIndex);
      const labelW = Math.max(64, versionLabel.length * 6 + 18);
      svg.push(
        `<line x1="${metrics.padding}" y1="${separatorY}" x2="${width - metrics.padding}" y2="${separatorY}" stroke="${colors.divider}" stroke-width="3" />`,
      );
      svg.push(
        `<rect x="${metrics.padding + 10}" y="${separatorY - 11}" width="${labelW}" height="22" rx="11" ry="11" fill="${colors.background}" />`,
      );
      svg.push(
        `<text x="${metrics.padding + 19}" y="${separatorY + 4}" fill="${colors.text}" font-family="Avenir Next, Segoe UI, sans-serif" font-size="11" font-weight="650">${xmlEscape(versionLabel)}</text>`,
      );
      currentY += metrics.versionDividerGap;
    }

    const contentY = currentY;

    columns.forEach((columnData, columnIndex) => {
      if (!columnData.step) return;
      const version = getStepVersions(columnData.step)[versionIndex];
      if (!version) return;

      const colX = metrics.padding + columnIndex * (metrics.colWidth + metrics.gap);
      if (!version.details.length) {
        if (versionIndex === 0) {
          svg.push(
            `<rect x="${colX}" y="${contentY}" width="${metrics.colWidth}" height="${metrics.emptyHeight}" rx="${metrics.radius}" ry="${metrics.radius}" fill="${colors.emptyBg}" stroke="${colors.emptyStroke}" stroke-dasharray="4 4" />`,
          );
          svg.push(
            `<text x="${colX + 10}" y="${contentY + 24}" fill="#3f4b60" font-family="Avenir Next, Segoe UI, sans-serif" font-size="12">No details yet.</text>`,
          );
        }
        return;
      }

      version.details.forEach((detail, index) => {
        const status = normalizeStatus(detail.status);
        const y = contentY + index * (metrics.detailCardHeight + metrics.gap);
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
    });
    currentY = contentY + rowHeight;
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
    steps: Array.isArray(activity?.steps) ? activity.steps.map((step) => normalizeStep(step)) : [],
  }));

  return normalizeData(normalized);
}

function normalizeStep(step) {
  const rawVersions = Array.isArray(step?.versions)
    ? step.versions
    : Array.isArray(step?.details)
      ? [createVersion(step.details)]
      : [createVersion()];

  return {
    id: step?.id || crypto.randomUUID(),
    title: String(step?.title || "Untitled step"),
    versions: rawVersions.map((version) => normalizeVersion(version)),
  };
}

function normalizeVersion(version) {
  return {
    id: version?.id || crypto.randomUUID(),
    details: Array.isArray(version?.details)
      ? version.details.map((detail) => ({
          id: detail?.id || crypto.randomUUID(),
          text: String(detail?.text || ""),
          status: normalizeStatus(detail?.status),
        }))
      : [],
  };
}

function normalizeData(data) {
  data.forEach((activity) => {
    if (!Array.isArray(activity.steps)) activity.steps = [];
    activity.steps = activity.steps.map((step) => normalizeStep(step));
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

function findVersion(activityId, stepId, versionId) {
  const step = findStep(activityId, stepId);
  if (!step) return null;
  return getStepVersions(step).find((version) => version.id === versionId) || null;
}

function moveDetailToVersion(incoming, targetVersion, targetDetailId = null, placeAfter = false) {
  const sourceVersion = findVersion(incoming.activityId, incoming.stepId, incoming.versionId);
  if (!sourceVersion) return false;

  const fromIndex = sourceVersion.details.findIndex((item) => item.id === incoming.detailId);
  if (fromIndex < 0) return false;

  const [movedDetail] = sourceVersion.details.splice(fromIndex, 1);
  let insertIndex = targetVersion.details.length;

  if (targetDetailId) {
    const targetIndex = targetVersion.details.findIndex((item) => item.id === targetDetailId);
    if (targetIndex < 0) {
      sourceVersion.details.splice(fromIndex, 0, movedDetail);
      return false;
    }
    insertIndex = targetIndex + (placeAfter ? 1 : 0);
    if (sourceVersion.id === targetVersion.id && fromIndex < insertIndex) insertIndex -= 1;
  }

  targetVersion.details.splice(insertIndex, 0, movedDetail);
  return true;
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
    chip.setAttribute("aria-label", DETAIL_STATUS_LABELS[detailStatus] || DETAIL_STATUS_LABELS.to_analyze);

    const chipIcon = document.createElement("span");
    chipIcon.className = "detail-status-chip-icon";
    chipIcon.setAttribute("aria-hidden", "true");
    chipIcon.textContent = DETAIL_STATUS_ICONS[detailStatus] || DETAIL_STATUS_ICONS.to_analyze;

    const chipLabel = document.createElement("span");
    chipLabel.className = "detail-status-chip-label";
    chipLabel.textContent = DETAIL_STATUS_LABELS[detailStatus] || DETAIL_STATUS_LABELS.to_analyze;

    chip.append(chipIcon, chipLabel);
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

function createVersionSeparatorRow(columns, totalColumns, versionIndex) {
  const separatorRow = document.createElement("div");
  separatorRow.className = "version-separator-row";
  separatorRow.style.gridColumn = `1 / span ${totalColumns}`;
  separatorRow.style.gridTemplateColumns = `repeat(${totalColumns}, var(--col-width))`;

  const label = document.createElement("div");
  label.className = "version-separator-label";
  label.textContent = getVersionLabel(versionIndex);
  separatorRow.appendChild(label);

  columns.forEach((column) => {
    const cell = document.createElement("div");
    cell.className = "version-separator-cell";
    if (!column.step) {
      separatorRow.appendChild(cell);
      return;
    }

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "version-separator-add";
    addBtn.textContent = "+ Detail";
    addBtn.addEventListener("click", () => {
      openEditorModal({
        title: "Add Detail",
        label: `Detail text for "${column.step.title}" in ${getVersionLabel(versionIndex)}`,
        value: "",
        saveText: "Add",
        onSave: (detailText, detailStatus) => {
          ensureVersionAt(column.step, versionIndex).details.push(createDetail(detailText, detailStatus));
          persistAndRender();
        },
        status: "to_analyze",
      });
    });
    cell.appendChild(addBtn);

    cell.addEventListener("dragover", (event) => {
      if (!dragState || dragState.type !== "detail") return;
      event.preventDefault();
      const rect = cell.getBoundingClientRect();
      showDropIndicator("y", rect, true);
    });

    cell.addEventListener("drop", (event) => {
      if (!dragState || dragState.type !== "detail") return;
      event.preventDefault();
      event.stopPropagation();
      const version = ensureVersionAt(column.step, versionIndex);
      if (moveDetailToVersion(dragState, version)) {
        pruneEmptyTrailingVersions(findStep(dragState.activityId, dragState.stepId));
        pruneEmptyTrailingVersions(column.step);
        dragState = null;
        hideDropIndicator();
        persistAndRender();
      }
    });

    separatorRow.appendChild(cell);
  });

  return separatorRow;
}

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

  const columns = getBoardColumns();
  const totalColumns = columns.length;
  const layoutMetrics = { detailCardHeight: 104, gap: 10, emptyHeight: 56 };
  const { maxVersionCount, rowHeights } = getBoardVersionLayout(columns, layoutMetrics);
  grid.style.gridTemplateColumns = `repeat(${totalColumns}, var(--col-width))`;
  grid.style.gridTemplateRows = [
    "auto",
    "auto",
    `${rowHeights[0]}px`,
    ...rowHeights.slice(1).flatMap((height) => ["var(--version-separator-height)", `${height}px`]),
  ].join(" ");

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
                activity.steps.push({ id: crypto.randomUUID(), title: stepTitle, versions: [createVersion()] });
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
                label: `Detail text for "${step.title}" in ${getVersionLabel(0)}`,
                value: "",
                saveText: "Add",
                onSave: (detailText, detailStatus) => {
                  ensureVersionAt(step, 0).details.push(createDetail(detailText, detailStatus));
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

      col += 1;
    });
  });

  columns.forEach((column, columnIndex) => {
    if (!column.step) return;
    const versions = getStepVersions(column.step);
    const selectedStatuses = new Set(uiState.detailFilter);

    rowHeights.forEach((rowHeight, versionIndex) => {
      const detailCell = document.createElement("div");
      detailCell.className = "detail-column";
      detailCell.style.gridColumn = `${columnIndex + 1}`;
      detailCell.style.gridRow = `${versionIndex === 0 ? 3 : 3 + versionIndex * 2}`;

      const version = versions[versionIndex];
      if (!version || !version.details.length) {
        if (versionIndex === 0) {
          const empty = document.createElement("div");
          empty.className = "empty-note";
          empty.textContent = "No details yet.";
          detailCell.appendChild(empty);
        }
      } else {
        version.details.forEach((detail) => {
          const normalizedStatus = normalizeStatus(detail.status);
          const isMuted = !selectedStatuses.has(normalizedStatus);
          detailCell.appendChild(
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
                    removeAt(version.details, detail.id);
                    pruneEmptyTrailingVersions(column.step);
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
                  activityId: column.activity.id,
                  stepId: column.step.id,
                  versionId: version.id,
                  detailId: detail.id,
                }),
                accepts: (incoming) => incoming.type === "detail" && incoming.detailId !== detail.id,
                onDrop: (incoming, event, rect) => {
                  const placeAfter = event.clientY > rect.top + rect.height / 2;
                  if (moveDetailToVersion(incoming, version, detail.id, placeAfter)) {
                    pruneEmptyTrailingVersions(findStep(incoming.activityId, incoming.stepId));
                    pruneEmptyTrailingVersions(column.step);
                    persistAndRender();
                  }
                },
              },
            }),
          );
        });
      }

      detailCell.addEventListener("dragover", (event) => {
        if (!dragState || dragState.type !== "detail") return;
        event.preventDefault();
        const rect = detailCell.getBoundingClientRect();
        showDropIndicator("y", rect, true);
      });

      detailCell.addEventListener("drop", (event) => {
        if (!dragState || dragState.type !== "detail") return;
        event.preventDefault();
        event.stopPropagation();
        const targetVersion = ensureVersionAt(column.step, versionIndex);
        if (moveDetailToVersion(dragState, targetVersion)) {
          pruneEmptyTrailingVersions(findStep(dragState.activityId, dragState.stepId));
          pruneEmptyTrailingVersions(column.step);
          dragState = null;
          hideDropIndicator();
          persistAndRender();
        }
      });

      grid.appendChild(detailCell);
    });
  });

  for (let versionIndex = 1; versionIndex < maxVersionCount; versionIndex += 1) {
    const separatorRow = createVersionSeparatorRow(columns, totalColumns, versionIndex);
    separatorRow.style.gridRow = `${2 + versionIndex * 2}`;
    grid.appendChild(separatorRow);
  }

  board.appendChild(grid);
}

render();
applyMapTitleState();
applyLegendState();
applyFilterState();
applyStatusMaskState();
