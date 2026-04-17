const form = document.getElementById("taskForm");
const templateForm = document.getElementById("templateForm");
const taskList = document.getElementById("adminTaskList");
const templateList = document.getElementById("templateList");
const refreshButton = document.getElementById("refreshButton");
const workDeskEditor = document.getElementById("workDeskEditor");
const addWorkDeskGroupButton = document.getElementById("addWorkDeskGroupButton");
const saveWorkDeskButton = document.getElementById("saveWorkDeskButton");
const quickLinksEditor = document.getElementById("quickLinksEditor");
const addQuickLinkGroupButton = document.getElementById("addQuickLinkGroupButton");
const saveQuickLinksButton = document.getElementById("saveQuickLinksButton");
const pluginCardsEditor = document.getElementById("pluginCardsEditor");
const addPluginCardButton = document.getElementById("addPluginCardButton");
const savePluginCardsButton = document.getElementById("savePluginCardsButton");
const adminModeTabs = document.getElementById("adminModeTabs");
const accessModeTabs = document.getElementById("accessModeTabs");

const taskFormTitle = document.getElementById("taskFormTitle");
const taskEditId = document.getElementById("taskEditId");
const taskSubmitButton = document.getElementById("taskSubmitButton");
const taskCancelButton = document.getElementById("taskCancelButton");

const templateFormTitle = document.getElementById("templateFormTitle");
const templateEditId = document.getElementById("templateEditId");
const templateSubmitButton = document.getElementById("templateSubmitButton");
const templateCancelButton = document.getElementById("templateCancelButton");

let dashboardState = {
  tasks: [],
  templates: [],
  workDesk: [],
  quickLinks: [],
  pluginCards: [],
};

let activeTaskSheet = "today";
let activeAdminMode = "tasks";
let activeAccessMode = "work-desk";

function createPluginCardId() {
  return `plugin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyPluginCard() {
  return {
    id: createPluginCardId(),
    icon: "PL",
    title: "",
    category: "Plugin",
    summary: "",
    pageUrl: "",
    enabled: true,
  };
}

function createEmptyWorkDeskItem() {
  return {
    lead: "",
    note: "",
  };
}

function createEmptyWorkDeskGroup() {
  return {
    title: "",
    items: Array.from({ length: 4 }, () => createEmptyWorkDeskItem()),
  };
}

function moveArrayItem(items, fromIndex, toIndex) {
  if (!Array.isArray(items)) {
    return items;
  }

  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return items;
  }

  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function createEmptyQuickLinkItem() {
  return {
    label: "",
    url: "",
    note: "",
    remark: "",
  };
}

function createEmptyQuickLinkGroup() {
  return {
    title: "",
    items: Array.from({ length: 4 }, () => createEmptyQuickLinkItem()),
  };
}

function normalizeQuickLinks(groups) {
  if (!Array.isArray(groups) || !groups.length) {
    return [createEmptyQuickLinkGroup()];
  }

  return groups.map((group) => ({
    title: String(group.title || "").trim(),
    items:
      Array.isArray(group.items) && group.items.length
        ? group.items.map((item) => ({
            label: String(item.label || "").trim(),
            url: String(item.url || "").trim(),
            note: String(item.note || "").trim(),
            remark: String(item.remark || "").trim(),
          }))
        : [createEmptyQuickLinkItem()],
  }));
}

function normalizeWorkDesk(groups) {
  if (!Array.isArray(groups) || !groups.length) {
    return [createEmptyWorkDeskGroup()];
  }

  return groups.map((group) => ({
    title: String(group.title || "").trim(),
    items:
      Array.isArray(group.items) && group.items.length
        ? group.items.map((item) => ({
            lead: String(item.lead || "").trim(),
            note: String(item.note || "").trim(),
          }))
        : [createEmptyWorkDeskItem()],
  }));
}

function normalizePluginCards(plugins) {
  if (!Array.isArray(plugins) || !plugins.length) {
    return [createEmptyPluginCard()];
  }

  return plugins.map((plugin) => ({
    id: String(plugin.id || createPluginCardId()).trim(),
    icon: String(plugin.icon || "").trim(),
    title: String(plugin.title || "").trim(),
    category: String(plugin.category || "").trim(),
    summary: String(plugin.summary || "").trim(),
    pageUrl: String(plugin.pageUrl || "").trim(),
    enabled: plugin.enabled !== false,
  }));
}

function setAdminMode(mode) {
  activeAdminMode = mode === "quick-access" ? "quick-access" : "tasks";

  adminModeTabs?.querySelectorAll("[data-admin-mode]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.adminMode === activeAdminMode);
  });

  document.querySelectorAll("[data-admin-view]").forEach((view) => {
    view.classList.toggle("is-active", view.dataset.adminView === activeAdminMode);
  });
}

function setAccessMode(mode) {
  if (mode === "quick-links") {
    activeAccessMode = "quick-links";
  } else if (mode === "plugins") {
    activeAccessMode = "plugins";
  } else {
    activeAccessMode = "work-desk";
  }

  accessModeTabs?.querySelectorAll("[data-access-mode]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.accessMode === activeAccessMode);
  });

  document.querySelectorAll("[data-access-view]").forEach((view) => {
    view.classList.toggle("is-active", view.dataset.accessView === activeAccessMode);
  });
}

function formatStatus(status) {
  return {
    today: "今天要完成",
    overdue: "延期任务",
    later: "暂不着急",
    done: "已完成",
  }[status] || status;
}

function parseLocalDateTime(value) {
  if (!value) {
    return null;
  }

  const normalized = value.length === 16 ? `${value}:00` : value;
  return new Date(normalized);
}

function deriveStatus(task) {
  if (task.completed) {
    return "done";
  }

  if (!task.dueAt) {
    return "later";
  }

  const due = parseLocalDateTime(task.dueAt);
  if (!due || Number.isNaN(due.getTime())) {
    return "later";
  }
  const now = new Date();

  if (due.getTime() <= now.getTime()) {
    return "overdue";
  }

  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  const nowDay = new Date(now);
  nowDay.setHours(0, 0, 0, 0);

  if (dueDay.getTime() === nowDay.getTime()) {
    return "today";
  }

  return "later";
}

function formatDueAt(dueAt) {
  if (!dueAt) {
    return "未设置截止时间";
  }

  const value = parseLocalDateTime(dueAt);
  if (!value || Number.isNaN(value.getTime())) {
    return "未设置截止时间";
  }
  const date = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  const time = `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  return `${date} ${time}`;
}

function formatWeekdays(weekdays) {
  if (weekdays === "all_workday") {
    return "工作日（排除周末和节假日）";
  }

  if (!Array.isArray(weekdays) || weekdays.length === 0) {
    return "未设置";
  }

  const labels = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return weekdays.map((day) => labels[day]).join("、");
}

function toDatetimeLocal(isoString) {
  if (!isoString) {
    return "";
  }

  const value = parseLocalDateTime(isoString);
  if (!value || Number.isNaN(value.getTime())) {
    return "";
  }
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}T${hours}:${minutes}`;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: "请求失败" }));
    throw new Error(data.error || "请求失败");
  }

  return response.json();
}

function sortTasksByDueDate(tasks) {
  return [...tasks].sort((left, right) => {
    if (!left.dueAt && !right.dueAt) return 0;
    if (!left.dueAt) return 1;
    if (!right.dueAt) return -1;
    return parseLocalDateTime(left.dueAt) - parseLocalDateTime(right.dueAt);
  });
}

function sortTodayBucket(tasks) {
  return [...tasks].sort((left, right) => {
    const leftStatus = deriveStatus(left);
    const rightStatus = deriveStatus(right);

    if (leftStatus !== rightStatus) {
      return leftStatus === "overdue" ? -1 : 1;
    }

    const leftTime = parseLocalDateTime(left.dueAt);
    const rightTime = parseLocalDateTime(right.dueAt);
    if (!leftTime && !rightTime) return 0;
    if (!leftTime) return 1;
    if (!rightTime) return -1;

    if (leftStatus === "overdue") {
      return rightTime - leftTime;
    }

    return leftTime - rightTime;
  });
}

function collapseRecurringTasks(tasks) {
  const grouped = new Map();

  tasks.forEach((task) => {
    const key = task.templateId || `manual:${task.title}`;
    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, task);
      return;
    }

    const currentTime = current.dueAt ? parseLocalDateTime(current.dueAt) : null;
    const nextTime = task.dueAt ? parseLocalDateTime(task.dueAt) : null;

    if (!currentTime) {
      grouped.set(key, task);
      return;
    }

    if (nextTime && nextTime < currentTime) {
      grouped.set(key, task);
    }
  });

  return [...grouped.values()];
}

function renderTasks(tasks, sheetKey = "today") {
  taskList.innerHTML = "";

  // 分类任务
  const todayTasks = [];
  const overdueTasks = [];
  const recurringTasks = [];
  const laterTasks = [];
  const doneTasks = [];

  tasks.forEach((task) => {
    const status = deriveStatus(task);

    if (task.completed) {
      doneTasks.push(task);
    } else if (task.recurring) {
      recurringTasks.push(task);
    } else if (status === "overdue" || status === "today") {
      if (status === "overdue") {
        overdueTasks.push(task);
      } else {
        todayTasks.push(task);
      }
    } else {
      laterTasks.push(task);
    }
  });

  // 按时间排序
  const orderedToday = sortTodayBucket(overdueTasks.concat(todayTasks));
  const orderedRecurring = sortTasksByDueDate(collapseRecurringTasks(recurringTasks));
  const orderedLater = sortTasksByDueDate(laterTasks);
  const orderedDone = [...doneTasks].sort((left, right) => {
    return new Date(right.completedAt || right.updatedAt || 0) - new Date(left.completedAt || left.updatedAt || 0);
  });

  const sheetMap = {
    today: { title: "今天要完成任务", tasks: orderedToday, empty: "今天没有需要完成的任务。" },
    recurring: { title: "周期任务", tasks: orderedRecurring, empty: "没有周期任务。" },
    later: { title: "暂不紧急", tasks: orderedLater, empty: "没有暂不紧急的任务。" },
    done: { title: "已完成", tasks: orderedDone, empty: "还没有完成记录。" },
  };

  const sheet = sheetMap[sheetKey];
  if (!sheet) return;

  const section = document.createElement("section");
  section.className = "task-group-section";

  const header = document.createElement("div");
  header.className = "task-group-header";
  header.innerHTML = `
    <span class="task-group-title">${sheet.title}</span>
    <span class="task-group-count">${sheet.tasks.length}</span>
  `;
  section.appendChild(header);

  const list = document.createElement("div");
  list.className = "admin-task-list";

  if (sheet.tasks.length === 0) {
    const emptyItem = document.createElement("div");
    emptyItem.className = "empty-message";
    emptyItem.textContent = sheet.empty;
    list.appendChild(emptyItem);
  } else {
    sheet.tasks.forEach((task) => {
      const status = deriveStatus(task);
      const card = document.createElement("article");
      card.className = "admin-task-card";
      card.innerHTML = `
        <div class="admin-task-head">
          <div class="admin-task-content">
            <div class="admin-task-title">${task.title}</div>
            <div class="admin-task-due">${formatDueAt(task.dueAt)}</div>
            <div class="admin-task-note">${task.note || "无补充说明"}</div>
            <div class="admin-task-pills">
              <span class="pill ${status}">${formatStatus(status)}</span>
              ${task.recurring ? '<span class="pill">周期任务实例</span>' : ""}
              ${task.completed ? '<span class="pill">已完成</span>' : ""}
            </div>
          </div>
          <div class="admin-task-actions">
            <button type="button" data-action="edit" data-id="${task.id}">编辑</button>
            <button type="button" data-action="toggle" data-id="${task.id}">${task.completed ? "撤销完成" : "标记完成"}</button>
            <button type="button" class="danger" data-action="delete" data-id="${task.id}">删除</button>
          </div>
        </div>
      `;
      list.appendChild(card);
    });
  }

  section.appendChild(list);
  taskList.appendChild(section);
}

function renderTemplates(templates) {
  templateList.innerHTML = "";

  templates.forEach((template) => {
    const card = document.createElement("article");
    card.className = "admin-task-card";
    card.innerHTML = `
      <div class="admin-task-head">
        <div class="admin-task-content">
          <div class="admin-task-title">${template.title}</div>
          <div class="template-meta">
            ${formatWeekdays(template.weekdays)} ${template.time} | 提前 ${template.reminderMinutes} 分钟提醒
          </div>
          <div class="admin-task-meta">${template.note || "无补充说明"}</div>
          <div class="admin-task-pills">
            <span class="pill">${template.active ? "启用中" : "已停用"}</span>
          </div>
        </div>
        <div class="admin-task-actions">
          <button type="button" data-template-action="edit" data-id="${template.id}">编辑</button>
          <button type="button" data-template-action="toggle" data-id="${template.id}">${template.active ? "停用" : "启用"}</button>
          <button type="button" class="danger" data-template-action="delete" data-id="${template.id}">删除</button>
        </div>
      </div>
    `;
    templateList.appendChild(card);
  });
}

function resetTaskForm() {
  form.reset();
  taskEditId.value = "";
  taskFormTitle.textContent = "新增单次任务";
  taskSubmitButton.textContent = "保存任务";
  taskCancelButton.classList.add("is-hidden");
  document.getElementById("taskReminderInput").value = "15";
}

function resetTemplateForm() {
  templateForm.reset();
  templateEditId.value = "";
  templateFormTitle.textContent = "新增周期任务";
  templateSubmitButton.textContent = "保存周期规则";
  templateCancelButton.classList.add("is-hidden");
  document.getElementById("templateTimeInput").value = "12:00";
  document.getElementById("templateReminderInput").value = "15";
  // 重置全工作日选项
  const allWorkdayCheckbox = document.getElementById("allWorkdayCheckbox");
  if (allWorkdayCheckbox) {
    allWorkdayCheckbox.checked = false;
  }
  // 显示星期选择
  const weekdayGrid = document.querySelector(".weekday-grid");
  if (weekdayGrid) {
    weekdayGrid.classList.remove("is-hidden");
  }
}

async function loadDashboardData() {
  const [{ tasks }, { templates }, { groups: workDeskGroups }, { groups: quickLinkGroups }, { plugins }] = await Promise.all([
    api("/api/tasks"),
    api("/api/templates"),
    api("/api/work-desk"),
    api("/api/quick-links"),
    api("/api/plugin-cards"),
  ]);

  dashboardState = {
    tasks,
    templates,
    workDesk: normalizeWorkDesk(workDeskGroups),
    quickLinks: normalizeQuickLinks(quickLinkGroups),
    pluginCards: normalizePluginCards(plugins),
  };

  const orderedTasks = [...tasks].sort((left, right) => {
    if (left.completed !== right.completed) {
      return left.completed ? 1 : -1;
    }
    return new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0);
  });

  const orderedTemplates = [...templates].sort((left, right) => {
    if (left.active !== right.active) {
      return left.active ? -1 : 1;
    }
    return new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0);
  });

  renderTasks(orderedTasks, activeTaskSheet);
  renderTemplates(orderedTemplates);
  renderWorkDeskEditor(dashboardState.workDesk);
  renderQuickLinksEditor(dashboardState.quickLinks);
  renderPluginCardsEditor(dashboardState.pluginCards);
}

function buildWorkDeskItemRow(item, groupIndex, itemIndex) {
  const row = document.createElement("div");
  row.className = "access-item-row work-desk-item-row";

  const leadLabel = document.createElement("label");
  const leadText = document.createElement("span");
  leadText.textContent = "主项";
  const leadInput = document.createElement("input");
  leadInput.type = "text";
  leadInput.value = item.lead || "";
  leadInput.dataset.field = "lead";
  leadInput.dataset.groupIndex = String(groupIndex);
  leadInput.dataset.itemIndex = String(itemIndex);
  leadLabel.append(leadText, leadInput);

  const noteLabel = document.createElement("label");
  const noteText = document.createElement("span");
  noteText.textContent = "说明";
  const noteInput = document.createElement("input");
  noteInput.type = "text";
  noteInput.value = item.note || "";
  noteInput.dataset.field = "note";
  noteInput.dataset.groupIndex = String(groupIndex);
  noteInput.dataset.itemIndex = String(itemIndex);
  noteLabel.append(noteText, noteInput);

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "ghost-button danger-outline";
  removeButton.dataset.workDeskAction = "remove-item";
  removeButton.dataset.groupIndex = String(groupIndex);
  removeButton.dataset.itemIndex = String(itemIndex);
  removeButton.textContent = "删除";

  const buttonGroup = document.createElement("div");
  buttonGroup.className = "sort-button-group";

  const moveTopButton = document.createElement("button");
  moveTopButton.type = "button";
  moveTopButton.className = "ghost-button sort-button top-button";
  moveTopButton.dataset.workDeskAction = "move-item-top";
  moveTopButton.dataset.groupIndex = String(groupIndex);
  moveTopButton.dataset.itemIndex = String(itemIndex);
  moveTopButton.textContent = "置顶";

  const moveUpButton = document.createElement("button");
  moveUpButton.type = "button";
  moveUpButton.className = "ghost-button sort-button";
  moveUpButton.dataset.workDeskAction = "move-item-up";
  moveUpButton.dataset.groupIndex = String(groupIndex);
  moveUpButton.dataset.itemIndex = String(itemIndex);
  moveUpButton.textContent = "↑";

  const moveDownButton = document.createElement("button");
  moveDownButton.type = "button";
  moveDownButton.className = "ghost-button sort-button";
  moveDownButton.dataset.workDeskAction = "move-item-down";
  moveDownButton.dataset.groupIndex = String(groupIndex);
  moveDownButton.dataset.itemIndex = String(itemIndex);
  moveDownButton.textContent = "↓";

  buttonGroup.append(moveTopButton, moveUpButton, moveDownButton, removeButton);
  row.append(leadLabel, noteLabel, buttonGroup);
  return row;
}

function renderWorkDeskEditor(groups) {
  if (!workDeskEditor) {
    return;
  }

  workDeskEditor.innerHTML = "";

  normalizeWorkDesk(groups).forEach((group, groupIndex) => {
    const card = document.createElement("section");
    card.className = "access-group-card";

    const header = document.createElement("div");
    header.className = "access-group-head";

    const titleLabel = document.createElement("label");
    titleLabel.className = "access-group-title-field";
    const titleText = document.createElement("span");
    titleText.textContent = "分类标题";
    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.value = group.title || "";
    titleInput.dataset.workDeskField = "group-title";
    titleInput.dataset.groupIndex = String(groupIndex);
    titleLabel.append(titleText, titleInput);

    const actions = document.createElement("div");
    actions.className = "access-group-actions";

    const moveUpButton = document.createElement("button");
    moveUpButton.type = "button";
    moveUpButton.className = "ghost-button sort-button";
    moveUpButton.dataset.workDeskAction = "move-group-up";
    moveUpButton.dataset.groupIndex = String(groupIndex);
    moveUpButton.textContent = "↑";

    const moveDownButton = document.createElement("button");
    moveDownButton.type = "button";
    moveDownButton.className = "ghost-button sort-button";
    moveDownButton.dataset.workDeskAction = "move-group-down";
    moveDownButton.dataset.groupIndex = String(groupIndex);
    moveDownButton.textContent = "↓";

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "ghost-button";
    addButton.dataset.workDeskAction = "add-item";
    addButton.dataset.groupIndex = String(groupIndex);
    addButton.textContent = "新增内容";

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "ghost-button danger-outline";
    removeButton.dataset.workDeskAction = "remove-group";
    removeButton.dataset.groupIndex = String(groupIndex);
    removeButton.textContent = "删除分类";

    actions.append(moveUpButton, moveDownButton, addButton, removeButton);
    header.append(titleLabel, actions);

    const list = document.createElement("div");
    list.className = "access-items";
    group.items.forEach((item, itemIndex) => {
      list.appendChild(buildWorkDeskItemRow(item, groupIndex, itemIndex));
    });

    card.append(header, list);
    workDeskEditor.appendChild(card);
  });
}

function collectWorkDeskFromEditor() {
  const groups = [];

  workDeskEditor.querySelectorAll(".access-group-card").forEach((card) => {
    const title = String(card.querySelector('[data-work-desk-field="group-title"]')?.value || "").trim();
    const items = [];

    card.querySelectorAll(".work-desk-item-row").forEach((row) => {
      const lead = String(row.querySelector('[data-field="lead"]')?.value || "").trim();
      const note = String(row.querySelector('[data-field="note"]')?.value || "").trim();

      if (!lead && !note) {
        return;
      }

      items.push({ lead, note });
    });

    groups.push({ title, items });
  });

  return groups;
}

function buildQuickLinkItemRow(item, groupIndex, itemIndex) {
  const row = document.createElement("div");
  row.className = "access-item-row quick-link-item-row";

  const titleLabel = document.createElement("label");
  const titleText = document.createElement("span");
  titleText.textContent = "标题";
  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.value = item.label || "";
  titleInput.dataset.field = "label";
  titleInput.dataset.groupIndex = String(groupIndex);
  titleInput.dataset.itemIndex = String(itemIndex);
  titleLabel.append(titleText, titleInput);

  const urlLabel = document.createElement("label");
  const urlText = document.createElement("span");
  urlText.textContent = "链接";
  const urlInput = document.createElement("input");
  urlInput.type = "url";
  urlInput.value = item.url || "";
  urlInput.placeholder = "https://example.com";
  urlInput.dataset.field = "url";
  urlInput.dataset.groupIndex = String(groupIndex);
  urlInput.dataset.itemIndex = String(itemIndex);
  urlLabel.append(urlText, urlInput);

  const noteLabel = document.createElement("label");
  const noteText = document.createElement("span");
  noteText.textContent = "描述";
  const noteInput = document.createElement("input");
  noteInput.type = "text";
  noteInput.value = item.note || "";
  noteInput.dataset.field = "note";
  noteInput.dataset.groupIndex = String(groupIndex);
  noteInput.dataset.itemIndex = String(itemIndex);
  noteLabel.append(noteText, noteInput);

  const remarkLabel = document.createElement("label");
  const remarkText = document.createElement("span");
  remarkText.textContent = "说明";
  const remarkInput = document.createElement("input");
  remarkInput.type = "text";
  remarkInput.value = item.remark || "";
  remarkInput.dataset.field = "remark";
  remarkInput.dataset.groupIndex = String(groupIndex);
  remarkInput.dataset.itemIndex = String(itemIndex);
  remarkLabel.append(remarkText, remarkInput);

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "ghost-button danger-outline quick-link-remove";
  removeButton.dataset.quickLinkAction = "remove-item";
  removeButton.dataset.groupIndex = String(groupIndex);
  removeButton.dataset.itemIndex = String(itemIndex);
  removeButton.textContent = "删除";

  const buttonGroup = document.createElement("div");
  buttonGroup.className = "sort-button-group";

  const moveTopButton = document.createElement("button");
  moveTopButton.type = "button";
  moveTopButton.className = "ghost-button sort-button top-button";
  moveTopButton.dataset.quickLinkAction = "move-item-top";
  moveTopButton.dataset.groupIndex = String(groupIndex);
  moveTopButton.dataset.itemIndex = String(itemIndex);
  moveTopButton.textContent = "置顶";

  const moveUpButton = document.createElement("button");
  moveUpButton.type = "button";
  moveUpButton.className = "ghost-button sort-button";
  moveUpButton.dataset.quickLinkAction = "move-item-up";
  moveUpButton.dataset.groupIndex = String(groupIndex);
  moveUpButton.dataset.itemIndex = String(itemIndex);
  moveUpButton.textContent = "↑";

  const moveDownButton = document.createElement("button");
  moveDownButton.type = "button";
  moveDownButton.className = "ghost-button sort-button";
  moveDownButton.dataset.quickLinkAction = "move-item-down";
  moveDownButton.dataset.groupIndex = String(groupIndex);
  moveDownButton.dataset.itemIndex = String(itemIndex);
  moveDownButton.textContent = "↓";

  buttonGroup.append(moveTopButton, moveUpButton, moveDownButton, removeButton);
  row.append(titleLabel, urlLabel, noteLabel, remarkLabel, buttonGroup);
  return row;
}

function renderQuickLinksEditor(groups) {
  if (!quickLinksEditor) {
    return;
  }

  quickLinksEditor.innerHTML = "";

  normalizeQuickLinks(groups).forEach((group, groupIndex) => {
    const card = document.createElement("section");
    card.className = "access-group-card";

    const header = document.createElement("div");
    header.className = "access-group-head";

    const titleLabel = document.createElement("label");
    titleLabel.className = "access-group-title-field";
    const titleText = document.createElement("span");
    titleText.textContent = "分类标题";
    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.value = group.title || "";
    titleInput.dataset.quickLinkField = "group-title";
    titleInput.dataset.groupIndex = String(groupIndex);
    titleLabel.append(titleText, titleInput);

    const actions = document.createElement("div");
    actions.className = "access-group-actions";

    const moveUpButton = document.createElement("button");
    moveUpButton.type = "button";
    moveUpButton.className = "ghost-button sort-button";
    moveUpButton.dataset.quickLinkAction = "move-group-up";
    moveUpButton.dataset.groupIndex = String(groupIndex);
    moveUpButton.textContent = "↑";

    const moveDownButton = document.createElement("button");
    moveDownButton.type = "button";
    moveDownButton.className = "ghost-button sort-button";
    moveDownButton.dataset.quickLinkAction = "move-group-down";
    moveDownButton.dataset.groupIndex = String(groupIndex);
    moveDownButton.textContent = "↓";

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "ghost-button";
    addButton.dataset.quickLinkAction = "add-item";
    addButton.dataset.groupIndex = String(groupIndex);
    addButton.textContent = "新增链接";

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "ghost-button danger-outline";
    removeButton.dataset.quickLinkAction = "remove-group";
    removeButton.dataset.groupIndex = String(groupIndex);
    removeButton.textContent = "删除分类";

    actions.append(moveUpButton, moveDownButton, addButton, removeButton);
    header.append(titleLabel, actions);

    const list = document.createElement("div");
    list.className = "access-items";
    group.items.forEach((item, itemIndex) => {
      list.appendChild(buildQuickLinkItemRow(item, groupIndex, itemIndex));
    });

    card.append(header, list);
    quickLinksEditor.appendChild(card);
  });
}

function collectQuickLinksFromEditor() {
  const groups = [];

  quickLinksEditor.querySelectorAll(".access-group-card").forEach((card) => {
    const title = String(card.querySelector('[data-quick-link-field="group-title"]')?.value || "").trim();
    const items = [];

    card.querySelectorAll(".quick-link-item-row").forEach((row) => {
      const label = String(row.querySelector('[data-field="label"]')?.value || "").trim();
      const url = String(row.querySelector('[data-field="url"]')?.value || "").trim();
      const note = String(row.querySelector('[data-field="note"]')?.value || "").trim();
      const remark = String(row.querySelector('[data-field="remark"]')?.value || "").trim();

      if (!label && !url && !note && !remark) {
        return;
      }

      items.push({ label, url, note, remark });
    });

    groups.push({ title, items });
  });

  return groups;
}

function buildPluginCardRow(plugin, pluginIndex) {
  const row = document.createElement("div");
  row.className = "access-item-row plugin-card-row";

  const iconLabel = document.createElement("label");
  const iconText = document.createElement("span");
  iconText.textContent = "图标";
  const iconInput = document.createElement("input");
  iconInput.type = "text";
  iconInput.value = plugin.icon || "";
  iconInput.dataset.field = "icon";
  iconInput.dataset.pluginIndex = String(pluginIndex);
  iconLabel.append(iconText, iconInput);

  const categoryLabel = document.createElement("label");
  const categoryText = document.createElement("span");
  categoryText.textContent = "分类";
  const categoryInput = document.createElement("input");
  categoryInput.type = "text";
  categoryInput.value = plugin.category || "";
  categoryInput.dataset.field = "category";
  categoryInput.dataset.pluginIndex = String(pluginIndex);
  categoryLabel.append(categoryText, categoryInput);

  const titleLabel = document.createElement("label");
  const titleText = document.createElement("span");
  titleText.textContent = "标题";
  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.value = plugin.title || "";
  titleInput.dataset.field = "title";
  titleInput.dataset.pluginIndex = String(pluginIndex);
  titleLabel.append(titleText, titleInput);

  const summaryLabel = document.createElement("label");
  const summaryText = document.createElement("span");
  summaryText.textContent = "描述";
  const summaryInput = document.createElement("textarea");
  summaryInput.value = plugin.summary || "";
  summaryInput.dataset.field = "summary";
  summaryInput.dataset.pluginIndex = String(pluginIndex);
  summaryLabel.append(summaryText, summaryInput);

  const urlLabel = document.createElement("label");
  const urlText = document.createElement("span");
  urlText.textContent = "入口地址";
  const urlInput = document.createElement("input");
  urlInput.type = "text";
  urlInput.value = plugin.pageUrl || "";
  urlInput.dataset.field = "pageUrl";
  urlInput.dataset.pluginIndex = String(pluginIndex);
  urlLabel.append(urlText, urlInput);

  const actions = document.createElement("div");
  actions.className = "sort-button-group";

  const toggleButton = document.createElement("button");
  toggleButton.type = "button";
  toggleButton.className = `plugin-toggle-button${plugin.enabled ? " is-enabled" : ""}`;
  toggleButton.dataset.pluginCardAction = "toggle-enabled";
  toggleButton.dataset.pluginIndex = String(pluginIndex);
  toggleButton.textContent = plugin.enabled ? "已开启" : "已关闭";

  const moveUpButton = document.createElement("button");
  moveUpButton.type = "button";
  moveUpButton.className = "ghost-button sort-button";
  moveUpButton.dataset.pluginCardAction = "move-up";
  moveUpButton.dataset.pluginIndex = String(pluginIndex);
  moveUpButton.textContent = "↑";

  const moveDownButton = document.createElement("button");
  moveDownButton.type = "button";
  moveDownButton.className = "ghost-button sort-button";
  moveDownButton.dataset.pluginCardAction = "move-down";
  moveDownButton.dataset.pluginIndex = String(pluginIndex);
  moveDownButton.textContent = "↓";

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "ghost-button danger-outline";
  removeButton.dataset.pluginCardAction = "remove";
  removeButton.dataset.pluginIndex = String(pluginIndex);
  removeButton.textContent = "删除";

  actions.append(toggleButton, moveUpButton, moveDownButton, removeButton);
  row.append(iconLabel, categoryLabel, titleLabel, summaryLabel, urlLabel, actions);
  return row;
}

function renderPluginCardsEditor(plugins) {
  if (!pluginCardsEditor) {
    return;
  }

  pluginCardsEditor.innerHTML = "";

  normalizePluginCards(plugins).forEach((plugin, pluginIndex) => {
    pluginCardsEditor.appendChild(buildPluginCardRow(plugin, pluginIndex));
  });
}

function collectPluginCardsFromEditor() {
  const plugins = [];

  pluginCardsEditor.querySelectorAll(".plugin-card-row").forEach((row, pluginIndex) => {
    const current = dashboardState.pluginCards[pluginIndex] || createEmptyPluginCard();
    plugins.push({
      id: current.id,
      icon: String(row.querySelector('[data-field="icon"]')?.value || "").trim(),
      category: String(row.querySelector('[data-field="category"]')?.value || "").trim(),
      title: String(row.querySelector('[data-field="title"]')?.value || "").trim(),
      summary: String(row.querySelector('[data-field="summary"]')?.value || "").trim(),
      pageUrl: String(row.querySelector('[data-field="pageUrl"]')?.value || "").trim(),
      enabled: current.enabled !== false,
    });
  });

  return plugins;
}

// Sheet 页签切换
function initSheetTabs() {
  const tabs = document.querySelectorAll(".sheet-tab");
  const recurringPanel = document.getElementById("recurringTemplatesPanel");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const sheetKey = tab.dataset.sheet;
      if (!sheetKey || sheetKey === activeTaskSheet) {
        return;
      }

      activeTaskSheet = sheetKey;

      tabs.forEach((t) => t.classList.remove("is-active"));
      tab.classList.add("is-active");

      // 周期任务 sheet 显示周期规则面板
      if (recurringPanel) {
        if (sheetKey === "recurring") {
          recurringPanel.classList.remove("is-hidden");
        } else {
          recurringPanel.classList.add("is-hidden");
        }
      }

      renderTasks(dashboardState.tasks, activeTaskSheet);
    });
  });
}

function initAdminModeTabs() {
  adminModeTabs?.querySelectorAll("[data-admin-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.adminMode;
      if (!mode || mode === activeAdminMode) {
        return;
      }

      setAdminMode(mode);
    });
  });
}

function initAccessModeTabs() {
  accessModeTabs?.querySelectorAll("[data-access-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.accessMode;
      if (!mode || mode === activeAccessMode) {
        return;
      }

      setAccessMode(mode);
    });
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const payload = {
    title: String(formData.get("title") || "").trim(),
    dueAt: String(formData.get("dueAt") || "").trim(),
    note: String(formData.get("note") || "").trim(),
    reminderMinutes: Number(formData.get("reminderMinutes") || 15),
    recurring: false,
    completed: false,
  };

  const editId = taskEditId.value.trim();
  if (editId) {
    const current = dashboardState.tasks.find((task) => task.id === editId);
    await api(`/api/tasks/${editId}`, {
      method: "PATCH",
      body: JSON.stringify({
        ...current,
        ...payload,
        completed: current?.completed ?? false,
      }),
    });
  } else {
    await api("/api/tasks", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  resetTaskForm();
  await loadDashboardData();
});

templateForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(templateForm);

  // 检查是否选中全工作日
  const allWorkdayCheckbox = document.getElementById("allWorkdayCheckbox");
  const isAllWorkday = allWorkdayCheckbox && allWorkdayCheckbox.checked;

  let weekdays;
  if (isAllWorkday) {
    // 全工作日：自动识别工作日（排除周末和节假日）
    weekdays = "all_workday";
  } else {
    weekdays = formData.getAll("weekdays").map((value) => Number(value));
    // 如果没有选中任何星期，保留原来的值（编辑时）
  }

  const payload = {
    title: String(formData.get("title") || "").trim(),
    weekdays,
    time: String(formData.get("time") || "12:00"),
    reminderMinutes: Number(formData.get("reminderMinutes") || 15),
    note: String(formData.get("note") || "").trim(),
    allWorkday: isAllWorkday,
  };

  const editId = templateEditId.value.trim();
  if (editId) {
    const current = dashboardState.templates.find((template) => template.id === editId);
    await api(`/api/templates/${editId}`, {
      method: "PATCH",
      body: JSON.stringify({
        ...current,
        ...payload,
      }),
    });
  } else {
    await api("/api/templates", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  resetTemplateForm();
  await loadDashboardData();
});

taskCancelButton.addEventListener("click", resetTaskForm);
templateCancelButton.addEventListener("click", resetTemplateForm);

refreshButton.addEventListener("click", () => {
  loadDashboardData().catch((error) => {
    window.alert(error.message);
  });
});

addWorkDeskGroupButton?.addEventListener("click", () => {
  dashboardState.workDesk = normalizeWorkDesk(dashboardState.workDesk);
  dashboardState.workDesk.push(createEmptyWorkDeskGroup());
  renderWorkDeskEditor(dashboardState.workDesk);
});

saveWorkDeskButton?.addEventListener("click", async () => {
  const groups = collectWorkDeskFromEditor();

  try {
    await api("/api/work-desk", {
      method: "PUT",
      body: JSON.stringify({ groups }),
    });
    await loadDashboardData();
    window.alert("Work Desk 配置已保存。");
  } catch (error) {
    window.alert(error.message);
  }
});

addQuickLinkGroupButton?.addEventListener("click", () => {
  dashboardState.quickLinks = normalizeQuickLinks(dashboardState.quickLinks);
  dashboardState.quickLinks.push(createEmptyQuickLinkGroup());
  renderQuickLinksEditor(dashboardState.quickLinks);
});

saveQuickLinksButton?.addEventListener("click", async () => {
  const groups = collectQuickLinksFromEditor();

  try {
    await api("/api/quick-links", {
      method: "PUT",
      body: JSON.stringify({ groups }),
    });
    await loadDashboardData();
    window.alert("Quick Access 配置已保存。");
  } catch (error) {
    window.alert(error.message);
  }
});

addPluginCardButton?.addEventListener("click", () => {
  dashboardState.pluginCards = normalizePluginCards(dashboardState.pluginCards);
  dashboardState.pluginCards.push(createEmptyPluginCard());
  renderPluginCardsEditor(dashboardState.pluginCards);
});

savePluginCardsButton?.addEventListener("click", async () => {
  const plugins = collectPluginCardsFromEditor();

  try {
    await api("/api/plugin-cards", {
      method: "PUT",
      body: JSON.stringify({ plugins }),
    });
    await loadDashboardData();
    window.alert("Plugins 配置已保存。");
  } catch (error) {
    window.alert(error.message);
  }
});

workDeskEditor?.addEventListener("click", (event) => {
  const target = event.target.closest("[data-work-desk-action]");
  if (!target) {
    return;
  }

  const groups = normalizeWorkDesk(collectWorkDeskFromEditor());
  const groupIndex = Number(target.dataset.groupIndex);
  const itemIndex = Number(target.dataset.itemIndex);

  if (!Number.isInteger(groupIndex) || !groups[groupIndex]) {
    return;
  }

  const action = target.dataset.workDeskAction;

  if (action === "add-item") {
    groups[groupIndex].items.push(createEmptyWorkDeskItem());
  }

  if (action === "move-item-up") {
    groups[groupIndex].items = moveArrayItem(groups[groupIndex].items, itemIndex, itemIndex - 1);
  }

  if (action === "move-item-down") {
    groups[groupIndex].items = moveArrayItem(groups[groupIndex].items, itemIndex, itemIndex + 1);
  }

  if (action === "move-item-top") {
    groups[groupIndex].items = moveArrayItem(groups[groupIndex].items, itemIndex, 0);
  }

  if (action === "remove-item") {
    if (groups[groupIndex].items.length === 1) {
      groups[groupIndex].items[0] = createEmptyWorkDeskItem();
    } else {
      groups[groupIndex].items.splice(itemIndex, 1);
    }
  }

  if (action === "remove-group") {
    if (groups.length === 1) {
      groups[0] = createEmptyWorkDeskGroup();
    } else {
      groups.splice(groupIndex, 1);
    }
  }

  if (action === "move-group-up") {
    dashboardState.workDesk = moveArrayItem(groups, groupIndex, groupIndex - 1);
    renderWorkDeskEditor(dashboardState.workDesk);
    return;
  }

  if (action === "move-group-down") {
    dashboardState.workDesk = moveArrayItem(groups, groupIndex, groupIndex + 1);
    renderWorkDeskEditor(dashboardState.workDesk);
    return;
  }

  dashboardState.workDesk = groups;
  renderWorkDeskEditor(dashboardState.workDesk);
});

quickLinksEditor?.addEventListener("click", (event) => {
  const target = event.target.closest("[data-quick-link-action]");
  if (!target) {
    return;
  }

  const groups = normalizeQuickLinks(collectQuickLinksFromEditor());
  const groupIndex = Number(target.dataset.groupIndex);
  const itemIndex = Number(target.dataset.itemIndex);

  if (!Number.isInteger(groupIndex) || !groups[groupIndex]) {
    return;
  }

  const action = target.dataset.quickLinkAction;

  if (action === "add-item") {
    groups[groupIndex].items.push(createEmptyQuickLinkItem());
  }

  if (action === "move-item-up") {
    groups[groupIndex].items = moveArrayItem(groups[groupIndex].items, itemIndex, itemIndex - 1);
  }

  if (action === "move-item-down") {
    groups[groupIndex].items = moveArrayItem(groups[groupIndex].items, itemIndex, itemIndex + 1);
  }

  if (action === "move-item-top") {
    groups[groupIndex].items = moveArrayItem(groups[groupIndex].items, itemIndex, 0);
  }

  if (action === "remove-item") {
    if (groups[groupIndex].items.length === 1) {
      groups[groupIndex].items[0] = createEmptyQuickLinkItem();
    } else {
      groups[groupIndex].items.splice(itemIndex, 1);
    }
  }

  if (action === "remove-group") {
    if (groups.length === 1) {
      groups[0] = createEmptyQuickLinkGroup();
    } else {
      groups.splice(groupIndex, 1);
    }
  }

  if (action === "move-group-up") {
    dashboardState.quickLinks = moveArrayItem(groups, groupIndex, groupIndex - 1);
    renderQuickLinksEditor(dashboardState.quickLinks);
    return;
  }

  if (action === "move-group-down") {
    dashboardState.quickLinks = moveArrayItem(groups, groupIndex, groupIndex + 1);
    renderQuickLinksEditor(dashboardState.quickLinks);
    return;
  }

  dashboardState.quickLinks = groups;
  renderQuickLinksEditor(dashboardState.quickLinks);
});

pluginCardsEditor?.addEventListener("click", (event) => {
  const target = event.target.closest("[data-plugin-card-action]");
  if (!target) {
    return;
  }

  const plugins = normalizePluginCards(collectPluginCardsFromEditor());
  const pluginIndex = Number(target.dataset.pluginIndex);
  if (!Number.isInteger(pluginIndex) || !plugins[pluginIndex]) {
    return;
  }

  const action = target.dataset.pluginCardAction;

  if (action === "toggle-enabled") {
    plugins[pluginIndex].enabled = !plugins[pluginIndex].enabled;
  }

  if (action === "move-up") {
    dashboardState.pluginCards = moveArrayItem(plugins, pluginIndex, pluginIndex - 1);
    renderPluginCardsEditor(dashboardState.pluginCards);
    return;
  }

  if (action === "move-down") {
    dashboardState.pluginCards = moveArrayItem(plugins, pluginIndex, pluginIndex + 1);
    renderPluginCardsEditor(dashboardState.pluginCards);
    return;
  }

  if (action === "remove") {
    if (plugins.length === 1) {
      plugins[0] = createEmptyPluginCard();
    } else {
      plugins.splice(pluginIndex, 1);
    }
  }

  dashboardState.pluginCards = plugins;
  renderPluginCardsEditor(dashboardState.pluginCards);
});

taskList.addEventListener("click", async (event) => {
  const target = event.target.closest("button[data-action]");
  if (!target) {
    return;
  }

  const action = target.dataset.action;
  const id = target.dataset.id;
  if (!id) {
    return;
  }

  const current = dashboardState.tasks.find((task) => task.id === id);
  if (!current) {
    return;
  }

  if (action === "edit") {
    taskEditId.value = current.id;
    taskFormTitle.textContent = "编辑单次任务";
    taskSubmitButton.textContent = "保存修改";
    taskCancelButton.classList.remove("is-hidden");
    document.getElementById("titleInput").value = current.title || "";
    document.getElementById("dueAtInput").value = toDatetimeLocal(current.dueAt);
    document.getElementById("taskReminderInput").value = String(current.reminderMinutes || 15);
    document.getElementById("noteInput").value = current.note || "";
    document.getElementById("titleInput").focus();
    return;
  }

  if (action === "delete") {
    await api(`/api/tasks/${id}`, { method: "DELETE" });
    await loadDashboardData();
    return;
  }

  if (action === "toggle") {
    await api(`/api/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        ...current,
        completed: !current.completed,
      }),
    });
    await loadDashboardData();
  }
});

templateList.addEventListener("click", async (event) => {
  const target = event.target.closest("button[data-template-action]");
  if (!target) {
    return;
  }

  const action = target.dataset.templateAction;
  const id = target.dataset.id;
  if (!id) {
    return;
  }

  const current = dashboardState.templates.find((template) => template.id === id);
  if (!current) {
    return;
  }

  if (action === "edit") {
    resetTemplateForm();
    templateEditId.value = current.id;
    templateFormTitle.textContent = "编辑周期任务";
    templateSubmitButton.textContent = "保存修改";
    templateCancelButton.classList.remove("is-hidden");
    document.getElementById("templateTitleInput").value = current.title || "";
    document.getElementById("templateTimeInput").value = current.time || "12:00";
    document.getElementById("templateReminderInput").value = String(current.reminderMinutes || 15);
    document.getElementById("templateNoteInput").value = current.note || "";

    // 处理全工作日选项
    const allWorkdayCheckbox = document.getElementById("allWorkdayCheckbox");
    const weekdayGrid = document.querySelector(".weekday-grid");
    const isAllWorkday = current.allWorkday === true || current.weekdays === "all_workday";

    if (allWorkdayCheckbox) {
      allWorkdayCheckbox.checked = isAllWorkday;
    }

    if (weekdayGrid) {
      weekdayGrid.classList.toggle("is-hidden", isAllWorkday);
    }

    templateForm.querySelectorAll('input[name="weekdays"]').forEach((input) => {
      input.checked = !isAllWorkday && Array.isArray(current.weekdays)
        ? current.weekdays.includes(Number(input.value))
        : false;
    });

    document.getElementById("templateTitleInput").focus();
    return;
  }

  if (action === "delete") {
    await api(`/api/templates/${id}`, { method: "DELETE" });
    await loadDashboardData();
    return;
  }

  if (action === "toggle") {
    await api(`/api/templates/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        ...current,
        active: !current.active,
      }),
    });
    await loadDashboardData();
  }
});

// 全工作日选项切换时显示/隐藏星期选择
function initAllWorkdayToggle() {
  const allWorkdayCheckbox = document.getElementById("allWorkdayCheckbox");
  const weekdayGrid = document.querySelector(".weekday-grid");

  if (allWorkdayCheckbox && weekdayGrid) {
    allWorkdayCheckbox.addEventListener("change", () => {
      if (allWorkdayCheckbox.checked) {
        weekdayGrid.classList.add("is-hidden");
      } else {
        weekdayGrid.classList.remove("is-hidden");
      }
    });
  }
}

resetTaskForm();
resetTemplateForm();
initAllWorkdayToggle();
initSheetTabs();
initAdminModeTabs();
initAccessModeTabs();
setAdminMode("tasks");
setAccessMode("work-desk");

loadDashboardData().catch((error) => {
  window.alert(error.message);
});
