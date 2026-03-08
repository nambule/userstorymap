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
const toggleStatusMask = document.getElementById("toggle-status-mask");
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

toggleStatusMask.addEventListener("change", () => {
  uiState.maskDetailStatus = toggleStatusMask.checked;
  persistUIState();
  applyStatusMaskState();
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
  toggleStatusMask.checked = Boolean(uiState.maskDetailStatus);
  board.classList.toggle("mask-detail-status", Boolean(uiState.maskDetailStatus));
}

function persistUIState() {
  localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(uiState));
}

function persistAndRender() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
  render();
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
