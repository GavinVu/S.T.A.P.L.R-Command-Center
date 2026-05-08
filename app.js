const storageKey = "project-staplr-dashboard";
const appVersion = 4;
const adminUsername = "Admin";
const adminPassword = "STAPLRPr0jects!?";

const initialState = {
  version: appVersion,
  currentUser: null,
  funds: { balance: 0, logs: [] },
  projects: [],
  users: [
    {
      username: adminUsername,
      displayName: "Project S.T.A.P.L.R. Admin",
      password: adminPassword,
      role: "admin",
      approved: true,
      createdAt: new Date().toISOString()
    }
  ],
  globalChat: []
};

let state = loadState();
let activePage = "dashboard";
let activeFilter = "active";
let selectedProjectId = null;
let editorProjectId = null;
let completionProjectId = null;

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

const $ = (selector) => document.querySelector(selector);

$("#loginForm").addEventListener("submit", handleLogin);
$("#signupForm").addEventListener("submit", handleSignup);
$("#logoutBtn").addEventListener("click", handleLogout);
$("#addProjectBtn").addEventListener("click", openProjectDialog);
$("#closeProjectDialog").addEventListener("click", closeProjectDialog);
$("#cancelProjectDialog").addEventListener("click", closeProjectDialog);
$("#projectForm").addEventListener("submit", handleProjectSubmit);
$("#closeDetailBtn").addEventListener("click", closeProjectDetail);
$("#projectEditForm").addEventListener("submit", handleProjectEdit);
$("#completeProjectForm").addEventListener("submit", handleCompleteProject);
$("#updateLogForm").addEventListener("submit", handleAddUpdate);
$("#chatForm").addEventListener("submit", handleAddChat);
$("#globalChatForm").addEventListener("submit", handleGlobalChat);
$("#openFundingEditorBtn").addEventListener("click", openFundingEditor);
$("#addCollaboratorBtn").addEventListener("click", handleAddCollaborator);
$("#addStageBtn").addEventListener("click", handleAddStage);
$("#addFundingPartBtn").addEventListener("click", handleAddFundingPart);

document.querySelectorAll("[data-page-link]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    showPage(button.dataset.pageLink);
  });
});

document.querySelectorAll("[data-admin-open]").forEach((button) => {
  button.addEventListener("click", () => $("#adminDialog").showModal());
});

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => $(`#${button.dataset.closeDialog}`).close());
});

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("active", item === button));
    renderProjects();
  });
});

document.querySelectorAll("[data-funding-action]").forEach((button) => {
  button.addEventListener("click", () => handleFundingAction(button.dataset.fundingAction));
});

$("#fundingProjectSelect").addEventListener("change", renderFundingPartChoices);

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return structuredClone(initialState);
  try {
    return migrateState(JSON.parse(saved));
  } catch {
    return structuredClone(initialState);
  }
}

function migrateState(saved) {
  const next = {
    ...structuredClone(initialState),
    ...saved,
    version: appVersion,
    funds: {
      balance: Number(saved.funds?.balance || 0),
      logs: saved.funds?.logs || []
    },
    users: saved.users?.length ? saved.users : structuredClone(initialState.users),
    projects: (saved.projects || []).map(normalizeProject),
    globalChat: saved.globalChat || []
  };

  if (!next.users.some((user) => user.username === adminUsername)) next.users.unshift(structuredClone(initialState.users[0]));
  localStorage.setItem(storageKey, JSON.stringify(next));
  return next;
}

function normalizeProject(project) {
  const manager = project.manager || project.submittedBy || adminUsername;
  const createdAt = project.createdAt || new Date().toISOString();
  const stages = project.stages?.length
    ? project.stages
    : project.milestone
      ? [{ id: crypto.randomUUID(), name: project.milestone, date: project.deadline, completed: false, completedAt: null, skipped: false }]
      : [];

  return {
    id: project.id || crypto.randomUUID(),
    name: project.name || "Untitled project",
    lead: project.lead || manager,
    manager,
    status: project.status || "On track",
    statusFlag: project.statusFlag || "More funding needed",
    progress: Number(project.progress || 0),
    budget: Number(project.budget || 0),
    fundsLeft: Number(project.fundsLeft || 0),
    deadline: project.deadline || todayString(),
    milestone: project.milestone || "Project kickoff",
    about: project.about || "No project description has been added yet.",
    approved: Boolean(project.approved),
    completed: Boolean(project.completed),
    completedAt: project.completedAt || null,
    submittedBy: project.submittedBy || manager,
    createdAt,
    collaborators: Array.from(new Set([manager, ...(project.collaborators || [])])),
    editors: Array.from(new Set(project.editors || [])),
    fundingParts: project.fundingParts?.length ? project.fundingParts : [],
    stages: stages.map((stage) => ({
      id: stage.id || crypto.randomUUID(),
      name: stage.name || "Project stage",
      date: stage.date || project.deadline,
      completed: Boolean(stage.completed),
      completedAt: stage.completedAt || null,
      skipped: Boolean(stage.skipped)
    })),
    updateLog: project.updateLog || [{ id: crypto.randomUUID(), username: project.submittedBy || manager, message: "Project record created.", createdAt }],
    chat: project.chat || []
  };
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function currentUser() {
  return state.users.find((user) => user.username === state.currentUser) || null;
}

function isAdmin() {
  return currentUser()?.role === "admin";
}

function approvedProjects() {
  return state.projects.filter((project) => project.approved);
}

function activeProjects() {
  return approvedProjects().filter((project) => !project.completed);
}

function completedProjects() {
  return approvedProjects().filter((project) => project.completed);
}

function pendingProjects() {
  return state.projects.filter((project) => !project.approved);
}

function selectedProject() {
  return state.projects.find((project) => project.id === selectedProjectId) || null;
}

function editorProject() {
  return state.projects.find((project) => project.id === editorProjectId) || null;
}

function displayName(username) {
  return state.users.find((user) => user.username === username)?.displayName || username;
}

function canManageProject(project) {
  return Boolean(project && currentUser() && (isAdmin() || project.manager === currentUser().username));
}

function canEditProject(project) {
  return Boolean(project && currentUser() && (canManageProject(project) || project.editors.includes(currentUser().username)));
}

function canUseProject(project) {
  return Boolean(project && currentUser() && (canEditProject(project) || project.collaborators.includes(currentUser().username)));
}

function showLoading() {
  $("#loadingScreen").hidden = false;
}

function hideLoading() {
  $("#loadingScreen").hidden = true;
}

function handleLogin(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const username = data.get("username").trim();
  const password = data.get("password");
  const user = state.users.find((account) => account.username.toLowerCase() === username.toLowerCase());
  const message = $("#loginMessage");

  if (!user || user.password !== password) {
    message.textContent = "Username or password is incorrect.";
    return;
  }
  if (!user.approved) {
    message.textContent = "This account is waiting for admin approval.";
    return;
  }

  showLoading();
  setTimeout(() => {
    state.currentUser = user.username;
    saveState();
    event.currentTarget.reset();
    message.textContent = "";
    hideLoading();
    render();
  }, 550);
}

function handleSignup(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const username = data.get("username").trim();
  const displayNameValue = data.get("displayName").trim();
  const password = data.get("password");
  const message = $("#signupMessage");

  if (state.users.some((user) => user.username.toLowerCase() === username.toLowerCase())) {
    message.textContent = "That username already exists.";
    return;
  }

  state.users.push({ username, displayName: displayNameValue, password, role: "member", approved: false, createdAt: new Date().toISOString() });
  saveState();
  event.currentTarget.reset();
  message.textContent = "Account requested. An admin must approve it before login.";
  renderAdmin();
}

function handleLogout() {
  state.currentUser = null;
  selectedProjectId = null;
  saveState();
  render();
}

function showPage(page) {
  activePage = page;
  document.querySelectorAll(".page-section").forEach((section) => section.classList.toggle("active-page", section.dataset.page === page));
  document.querySelectorAll("[data-page-link]").forEach((button) => button.classList.toggle("active", button.dataset.pageLink === page));
  if (page !== "projects") selectedProjectId = null;
  render();
}

function openProjectDialog() {
  $("#projectForm").reset();
  $("#projectForm").elements.deadline.value = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  $("#projectForm").elements.lead.value = currentUser()?.displayName || "";
  $("#projectDialog").showModal();
}

function closeProjectDialog() {
  $("#projectDialog").close();
}

function handleProjectSubmit(event) {
  event.preventDefault();
  const user = currentUser();
  const data = new FormData(event.currentTarget);
  const createdAt = new Date().toISOString();
  const approved = isAdmin();
  const project = normalizeProject({
    id: crypto.randomUUID(),
    name: data.get("name").trim(),
    lead: data.get("lead").trim(),
    manager: user.username,
    status: data.get("status"),
    statusFlag: data.get("statusFlag"),
    progress: Number(data.get("progress")),
    budget: moneyValue(data.get("budget")),
    deadline: data.get("deadline"),
    milestone: data.get("milestone").trim(),
    about: data.get("about").trim(),
    approved,
    submittedBy: user.username,
    createdAt,
    collaborators: [user.username],
    stages: [{ id: crypto.randomUUID(), name: data.get("milestone").trim(), date: data.get("deadline"), completed: false, completedAt: null, skipped: false }],
    updateLog: [{ id: crypto.randomUUID(), username: user.username, message: "Project submitted.", createdAt }]
  });

  state.projects.push(project);
  selectedProjectId = approved ? project.id : null;
  saveState();
  $("#projectDialog").close();
  if (approved) showPage("projects");
  render();
}

function render() {
  const user = currentUser();
  const signedIn = Boolean(user);
  $("#authPanel").hidden = signedIn;
  $("#dashboardPanel").hidden = !signedIn;
  document.querySelectorAll("[data-admin-open]").forEach((button) => button.hidden = !isAdmin());
  $("#openFundingEditorBtn").hidden = !isAdmin();
  $("#sessionName").textContent = signedIn ? user.displayName : "Signed out";
  $("#sessionRole").textContent = signedIn ? `${user.role === "admin" ? "Admin" : "Member"} account` : "Log in to view the dashboard";
  if (!signedIn) return;

  renderStats();
  renderProjects();
  renderFunds();
  renderTimeline();
  renderProjectDetail();
  renderGlobalChat();
  renderAdmin();
}

function renderStats() {
  const next = nextTimelineProject(activeProjects());
  $("#activeProjectCount").textContent = activeProjects().length;
  $("#completedProjectCount").textContent = `${completedProjects().length} completed`;
  $("#availableFunds").textContent = currency.format(state.funds.balance);
  $("#fundingLogCount").textContent = `${state.funds.logs.length} funding records`;
  $("#pendingProjectCount").textContent = pendingProjects().length;
  $("#nextDeadline").textContent = next ? formatDate(next.date) : "--";
  $("#nextDeadlineProject").textContent = next ? next.project.name : "No milestone";
}

function renderProjects() {
  const projects = activeFilter === "completed" ? completedProjects() : activeFilter === "all" ? approvedProjects() : activeProjects();
  $("#projectEmpty").hidden = projects.length > 0;
  $("#projectList").innerHTML = projects.map((project) => `
    <article class="project-card ${selectedProjectId === project.id ? "selected" : ""}" data-open-project="${project.id}" tabindex="0" role="button">
      <div>
        <h3>${escapeHtml(project.name)}</h3>
        <div class="project-meta">
          <span>PM: ${escapeHtml(displayName(project.manager))}</span>
          <span>${project.completed ? `Completed ${formatDate(project.completedAt)}` : `Due ${formatDate(project.deadline)}`}</span>
          <span class="badge ${project.completed ? "complete" : statusClass(project.status)}">${project.completed ? "Completed" : project.status}</span>
        </div>
        <p class="project-milestone">${escapeHtml(project.about)}</p>
        <div class="status-strip compact-strip">${statusBadge(project.statusFlag)}</div>
      </div>
      <div class="project-budget">
        <strong>${currency.format(project.fundsLeft)}</strong>
        <small>funds left</small>
        <button class="secondary-action" type="button" data-open-project="${project.id}">Details</button>
      </div>
    </article>
  `).join("");

  document.querySelectorAll("[data-open-project]").forEach((item) => {
    item.addEventListener("click", () => openProjectDetail(item.dataset.openProject));
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") openProjectDetail(item.dataset.openProject);
    });
  });
}

function renderFunds() {
  const allocated = approvedProjects().reduce((sum, project) => sum + project.fundingParts.reduce((partSum, part) => partSum + part.funded, 0), 0);
  const percent = state.funds.balance + allocated ? Math.round((state.funds.balance / (state.funds.balance + allocated)) * 100) : 0;
  $("#fundPercent").textContent = `${percent}%`;
  $("#fundProgressCircle").style.strokeDashoffset = String(289 - (percent / 100) * 289);
  $("#fundEmpty").hidden = state.funds.balance > 0 || state.funds.logs.length > 0;
  $("#fundBreakdown").innerHTML = `
    <div class="fund-row"><strong>Available</strong><span>${currency.format(state.funds.balance)}</span><div class="bar"><span style="width:${percent}%; background:var(--green)"></span></div></div>
    <div class="fund-row"><strong>Distributed to projects</strong><span>${currency.format(allocated)}</span><div class="bar"><span style="width:${100 - percent}%; background:var(--gold)"></span></div></div>
  `;

  $("#fundingProjectList").innerHTML = approvedProjects().length
    ? approvedProjects().map((project) => `
      <article class="funding-project-card">
        <div class="section-heading compact">
          <div><h3>${escapeHtml(project.name)}</h3><p class="muted-note">${currency.format(project.fundsLeft)} left</p></div>
        </div>
        <div class="funding-parts-grid">${renderFundingParts(project)}</div>
      </article>
    `).join("")
    : `<p class="muted-note">No approved projects have funding parts yet.</p>`;

  $("#fundingLogList").innerHTML = state.funds.logs.length
    ? state.funds.logs.map((log) => `
      <article class="admin-item">
        <div>
          <strong>${log.kind === "subtract" ? "-" : "+"}${currency.format(log.amount)}</strong>
          <small>${escapeHtml(log.reason)} - ${escapeHtml(displayName(log.username))} - ${formatDate(log.createdAt.slice(0, 10))}</small>
          <small>${log.projectId ? escapeHtml(state.projects.find((project) => project.id === log.projectId)?.name || "Deleted project") : "General fund"}</small>
        </div>
        ${isAdmin() ? `<button class="danger-action" type="button" data-delete-funding-log="${log.id}">Delete log</button>` : ""}
      </article>
    `).join("")
    : `<p class="muted-note">No funding logs yet.</p>`;
  document.querySelectorAll("[data-delete-funding-log]").forEach((button) => button.addEventListener("click", () => deleteFundingLog(button.dataset.deleteFundingLog)));
}

function renderTimeline() {
  const items = approvedProjects().flatMap((project) => project.stages.map((stage) => ({ project, stage, date: stage.date }))).sort((a, b) => dateValue(a.date) - dateValue(b.date));
  $("#timelineEmpty").hidden = items.length > 0;
  renderGlobalRail(items);
  $("#timelineList").innerHTML = items.map(({ project, stage }) => `
    <article class="timeline-item">
      <div class="timeline-date">${formatDate(stage.date)}</div>
      <div class="timeline-content ${stageState(stage)}">
        <h3>${escapeHtml(stage.name)}</h3>
        <div class="timeline-meta">
          <span>${escapeHtml(project.name)}</span>
          <span>${stageStateLabel(stage)}</span>
          <span>${formatDate(stage.date)}</span>
        </div>
      </div>
    </article>
  `).join("");
}

function renderGlobalRail(items) {
  const rail = $("#globalTimelineRail");
  if (!items.length) {
    rail.innerHTML = "";
    return;
  }
  const dates = items.map((item) => item.date);
  const min = Math.min(...dates.map(dateValue), dateValue(todayString()));
  const max = Math.max(...dates.map(dateValue), dateValue(todayString()));
  const span = Math.max(max - min, 1);
  rail.innerHTML = `
    <div class="rail-line"></div>
    <div class="today-marker" style="left:${timelinePosition(todayString(), min, span)}%"><span>Today<br>${formatDate(todayString())}</span></div>
    ${items.map(({ project, stage }) => `
      <div class="stage-dot ${stageState(stage)}" style="left:${timelinePosition(stage.date, min, span)}%">
        <span>${escapeHtml(stage.name)}</span>
        <small>${formatDate(stage.date)} - ${escapeHtml(project.name)}</small>
      </div>
    `).join("")}
  `;
}

function renderProjectDetail() {
  const project = selectedProject();
  const section = $("#projectDetail");
  if (!project) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  const canManage = canManageProject(project);
  const canEdit = canEditProject(project);
  const canUse = canUseProject(project);

  $("#detailTitle").textContent = project.name;
  $("#detailProjectName").textContent = project.name;
  $("#detailFacts").innerHTML = `
    <div><dt>Date created</dt><dd>${formatDate(project.createdAt.slice(0, 10))}</dd></div>
    <div><dt>Date due</dt><dd>${formatDate(project.deadline)}</dd></div>
    <div><dt>Project manager</dt><dd>${escapeHtml(displayName(project.manager))}</dd></div>
    <div><dt>Funds left</dt><dd>${currency.format(project.fundsLeft)}</dd></div>
  `;
  $("#detailStatusStrip").innerHTML = `${statusBadge(project.statusFlag)} <span class="badge ${project.completed ? "complete" : statusClass(project.status)}">${project.completed ? "Completed" : project.status}</span>`;
  $("#detailAbout").textContent = project.about;
  $("#detailActions").innerHTML = `
    ${canEdit ? `<button class="secondary-action" type="button" data-edit-selected-project>Edit</button>` : ""}
    ${canManage && !project.completed ? `<button class="primary-action" type="button" data-complete-selected-project>Complete</button>` : ""}
    ${canManage && project.completed ? `<button class="secondary-action" type="button" data-reactivate-selected-project>Reactivate</button>` : ""}
    ${canManage ? `<button class="danger-action" type="button" data-delete-selected-project>Delete</button>` : ""}
  `;
  $("[data-edit-selected-project]")?.addEventListener("click", () => openProjectEditor(project.id));
  $("[data-complete-selected-project]")?.addEventListener("click", () => openCompleteProject(project.id));
  $("[data-reactivate-selected-project]")?.addEventListener("click", () => reactivateProject(project.id));
  $("[data-delete-selected-project]")?.addEventListener("click", () => deleteProject(project.id));
  $("#collaboratorList").innerHTML = project.collaborators.map((username) => `<article class="admin-item"><strong>${escapeHtml(displayName(username))}</strong><small>${username === project.manager ? "Project manager" : project.editors.includes(username) ? "Editor" : "Collaborator"}</small></article>`).join("");
  $("#detailFundingParts").innerHTML = renderFundingParts(project) || `<p class="muted-note">No funding parts defined yet.</p>`;
  renderProjectRail(project);
  renderStageList(project, canEdit, canManage);
  renderUpdateLog(project, canUse);
  renderProjectChat(project, canUse);
}

function renderFundingParts(project) {
  return project.fundingParts.map((part) => {
    const percent = part.goal ? Math.min(100, Math.round((part.funded / part.goal) * 100)) : 0;
    return `
      <article class="mini-fund-card">
        <div class="mini-ring" style="--percent:${percent}"><strong>${percent}%</strong></div>
        <div><strong>${escapeHtml(part.name)}</strong><small>${currency.format(part.funded)} / ${currency.format(part.goal)}</small></div>
      </article>
    `;
  }).join("");
}

function renderProjectRail(project) {
  const rail = $("#projectTimelineRail");
  const stages = sortedStages(project.stages);
  if (!stages.length) {
    rail.innerHTML = `<p class="muted-note">No stages yet.</p>`;
    return;
  }
  const dates = [project.createdAt.slice(0, 10), project.deadline, todayString(), ...stages.map((stage) => stage.date)];
  const min = Math.min(...dates.map(dateValue));
  const max = Math.max(...dates.map(dateValue));
  const span = Math.max(max - min, 1);
  rail.innerHTML = `
    <div class="rail-line"></div>
    <div class="rail-edge rail-start">${formatDate(new Date(min).toISOString().slice(0, 10))}</div>
    <div class="rail-edge rail-end">${formatDate(new Date(max).toISOString().slice(0, 10))}</div>
    <div class="today-marker" style="left:${timelinePosition(todayString(), min, span)}%"><span>Today<br>${formatDate(todayString())}</span></div>
    ${stages.map((stage) => `
      <div class="stage-dot ${stageState(stage)}" style="left:${timelinePosition(stage.date, min, span)}%">
        <span>${escapeHtml(stage.name)}</span>
        <small>${formatDate(stage.date)} - ${stageStateLabel(stage)}</small>
      </div>
    `).join("")}
  `;
}

function renderStageList(project, canEdit, canManage) {
  $("#stageList").innerHTML = sortedStages(project.stages).map((stage) => `
    <article class="admin-item">
      <div><strong>${escapeHtml(stage.name)}</strong><small>${formatDate(stage.date)} - ${stageStateLabel(stage)}</small></div>
      ${canEdit ? `<div class="button-row">
        <button type="button" data-complete-stage="${stage.id}">Verify done</button>
        ${canManage ? `<button type="button" data-skip-stage="${stage.id}">Skip</button>` : ""}
        <button class="danger-action" type="button" data-delete-stage="${stage.id}">Delete</button>
      </div>` : ""}
    </article>
  `).join("");
  document.querySelectorAll("[data-complete-stage]").forEach((button) => button.addEventListener("click", () => completeStage(project.id, button.dataset.completeStage)));
  document.querySelectorAll("[data-skip-stage]").forEach((button) => button.addEventListener("click", () => skipStage(project.id, button.dataset.skipStage)));
  document.querySelectorAll("[data-delete-stage]").forEach((button) => button.addEventListener("click", () => deleteStage(project.id, button.dataset.deleteStage)));
}

function renderUpdateLog(project, canUse) {
  $("#updateLogForm").hidden = !canUse || project.completed;
  $("#updateLogList").innerHTML = project.updateLog.length
    ? project.updateLog.map((entry) => `<article class="admin-item"><strong>${escapeHtml(displayName(entry.username))}</strong><small>${formatDate(entry.createdAt.slice(0, 10))}</small><p class="muted-note">${escapeHtml(entry.message)}</p></article>`).join("")
    : `<p class="muted-note">No updates yet.</p>`;
}

function renderProjectChat(project, canUse) {
  $("#chatForm").hidden = !canUse || project.completed;
  $("#chatList").innerHTML = project.chat.length
    ? project.chat.map((msg) => `<article class="chat-message ${msg.username === currentUser().username ? "own-message" : ""}"><strong>${escapeHtml(msg.username)}</strong><p>${escapeHtml(msg.message)}</p><small>${formatDate(msg.createdAt.slice(0, 10))}</small></article>`).join("")
    : `<p class="muted-note">No chat messages yet.</p>`;
}

function openProjectDetail(projectId) {
  selectedProjectId = projectId;
  activePage = "projects";
  showPage("projects");
}

function closeProjectDetail() {
  selectedProjectId = null;
  render();
}

function openProjectEditor(projectId) {
  editorProjectId = projectId;
  const project = editorProject();
  if (!canEditProject(project)) return;
  const form = $("#projectEditForm");
  form.elements.name.value = project.name;
  form.elements.about.value = project.about;
  form.elements.deadline.value = project.deadline;
  form.elements.budget.value = project.budget;
  form.elements.fundsLeft.value = project.fundsLeft;
  form.elements.statusFlag.value = project.statusFlag;
  renderEditorLists();
  $("#projectEditorDialog").showModal();
}

function renderEditorLists() {
  const project = editorProject();
  if (!project) return;
  const canManage = canManageProject(project);
  $("#editorCollaboratorList").innerHTML = project.collaborators.map((username) => `
    <article class="admin-item">
      <strong>${escapeHtml(displayName(username))}</strong><small>${username === project.manager ? "Project manager" : project.editors.includes(username) ? "Editor" : "Collaborator"}</small>
      ${canManage && username !== project.manager ? `<div class="button-row"><button type="button" data-toggle-editor="${username}">${project.editors.includes(username) ? "Remove edit access" : "Allow edits"}</button><button class="danger-action" type="button" data-remove-collaborator="${username}">Remove</button></div>` : ""}
    </article>
  `).join("");
  $("#collaboratorSelect").innerHTML = state.users.filter((user) => user.approved && !project.collaborators.includes(user.username)).map((user) => `<option value="${escapeHtml(user.username)}">${escapeHtml(user.displayName)} (${escapeHtml(user.username)})</option>`).join("") || `<option value="">No approved users available</option>`;
  $("#editorStageList").innerHTML = sortedStages(project.stages).map((stage) => `<article class="admin-item"><strong>${escapeHtml(stage.name)}</strong><small>${formatDate(stage.date)} - ${stageStateLabel(stage)}</small></article>`).join("") || `<p class="muted-note">No stages.</p>`;
  $("#editorFundingPartsList").innerHTML = project.fundingParts.map((part) => `<article class="admin-item"><strong>${escapeHtml(part.name)}</strong><small>${currency.format(part.funded)} / ${currency.format(part.goal)}</small><button class="danger-action" type="button" data-delete-part="${part.id}">Delete</button></article>`).join("") || `<p class="muted-note">No parts.</p>`;
  document.querySelectorAll("[data-toggle-editor]").forEach((button) => button.addEventListener("click", () => toggleProjectEditor(project.id, button.dataset.toggleEditor)));
  document.querySelectorAll("[data-remove-collaborator]").forEach((button) => button.addEventListener("click", () => removeCollaborator(project.id, button.dataset.removeCollaborator)));
  document.querySelectorAll("[data-delete-part]").forEach((button) => button.addEventListener("click", () => deleteFundingPart(project.id, button.dataset.deletePart)));
}

function handleProjectEdit(event) {
  event.preventDefault();
  const project = editorProject();
  if (!canEditProject(project)) return;
  const data = new FormData(event.currentTarget);
  project.name = data.get("name").trim();
  project.about = data.get("about").trim();
  project.deadline = data.get("deadline");
  project.budget = moneyValue(data.get("budget"));
  project.fundsLeft = moneyValue(data.get("fundsLeft"));
  project.statusFlag = data.get("statusFlag");
  logProject(project, "Project details changed.");
  saveState();
  $("#projectEditorDialog").close();
  render();
}

function handleAddCollaborator() {
  const project = editorProject();
  if (!canManageProject(project)) return;
  const form = $("#projectEditForm");
  const username = form.elements.collaborator.value;
  if (!username || project.collaborators.includes(username)) return;
  project.collaborators.push(username);
  if (form.elements.canEdit.checked) project.editors.push(username);
  logProject(project, `${displayName(username)} added as a collaborator.`);
  saveState();
  renderEditorLists();
  render();
}

function handleAddStage() {
  const project = editorProject();
  if (!canEditProject(project)) return;
  const form = $("#projectEditForm");
  const name = form.elements.stageName.value.trim();
  const date = form.elements.stageDate.value;
  if (!name || !date) return;
  project.stages.push({ id: crypto.randomUUID(), name, date, completed: false, completedAt: null, skipped: false });
  form.elements.stageName.value = "";
  form.elements.stageDate.value = "";
  logProject(project, `Timeline stage added: ${name}.`);
  saveState();
  renderEditorLists();
  render();
}

function handleAddFundingPart() {
  const project = editorProject();
  if (!canEditProject(project)) return;
  const form = $("#projectEditForm");
  const name = form.elements.partName.value.trim();
  const goal = moneyValue(form.elements.partGoal.value);
  if (!name || !goal) return;
  project.fundingParts.push({ id: crypto.randomUUID(), name, goal, funded: 0 });
  form.elements.partName.value = "";
  form.elements.partGoal.value = "";
  logProject(project, `Funding part added: ${name}.`);
  saveState();
  renderEditorLists();
  render();
}

function openCompleteProject(projectId) {
  completionProjectId = projectId;
  $("#completeProjectForm").reset();
  $("#completeProjectDialog").showModal();
}

function handleCompleteProject(event) {
  event.preventDefault();
  const project = state.projects.find((item) => item.id === completionProjectId);
  if (!canManageProject(project)) return;
  const message = new FormData(event.currentTarget).get("message").trim();
  project.completed = true;
  project.completedAt = todayString();
  project.progress = 100;
  logProject(project, `Project completed. ${message}`);
  saveState();
  $("#completeProjectDialog").close();
  render();
}

function reactivateProject(projectId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!canManageProject(project)) return;
  project.completed = false;
  project.completedAt = null;
  logProject(project, "Project reactivated.");
  saveState();
  render();
}

function openFundingEditor() {
  renderFundingProjectChoices();
  $("#fundingEditorForm").reset();
  $("#fundingEditorDialog").showModal();
}

function renderFundingProjectChoices() {
  $("#fundingProjectSelect").innerHTML = `<option value="">General fund</option>${approvedProjects().map((project) => `<option value="${project.id}">${escapeHtml(project.name)}</option>`).join("")}`;
  renderFundingPartChoices();
}

function renderFundingPartChoices() {
  const project = state.projects.find((item) => item.id === $("#fundingProjectSelect").value);
  $("#fundingPartSelect").innerHTML = project?.fundingParts.length
    ? project.fundingParts.map((part) => `<option value="${part.id}">${escapeHtml(part.name)}</option>`).join("")
    : `<option value="">No project part</option>`;
}

function handleFundingAction(kind) {
  if (!isAdmin()) return;
  const form = $("#fundingEditorForm");
  const data = new FormData(form);
  const amount = moneyValue(data.get("amount"));
  const reason = data.get("reason").trim();
  const projectId = data.get("projectId");
  const partId = data.get("partId");
  if (!amount || !reason) return;

  const project = state.projects.find((item) => item.id === projectId);
  const part = project?.fundingParts.find((item) => item.id === partId);
  if (kind === "add") state.funds.balance += amount;
  if (kind === "subtract") state.funds.balance = Math.max(0, state.funds.balance - amount);
  if (kind === "fund" && project && part) {
    state.funds.balance = Math.max(0, state.funds.balance - amount);
    part.funded += amount;
    project.fundsLeft += amount;
    logProject(project, `${currency.format(amount)} distributed to ${part.name}.`);
  }

  state.funds.logs.unshift({ id: crypto.randomUUID(), kind, amount, reason, projectId: projectId || null, partId: partId || null, username: currentUser().username, createdAt: new Date().toISOString() });
  saveState();
  form.reset();
  renderFundingProjectChoices();
  render();
}

function handleAddUpdate(event) {
  event.preventDefault();
  const project = selectedProject();
  if (!canUseProject(project)) return;
  const message = new FormData(event.currentTarget).get("message").trim();
  project.updateLog.unshift({ id: crypto.randomUUID(), username: currentUser().username, message, createdAt: new Date().toISOString() });
  event.currentTarget.reset();
  saveState();
  renderProjectDetail();
}

function handleAddChat(event) {
  event.preventDefault();
  const project = selectedProject();
  if (!canUseProject(project)) return;
  const message = new FormData(event.currentTarget).get("message").trim();
  project.chat.push({ id: crypto.randomUUID(), username: currentUser().username, message, createdAt: new Date().toISOString() });
  event.currentTarget.reset();
  saveState();
  renderProjectDetail();
}

function handleGlobalChat(event) {
  event.preventDefault();
  const message = new FormData(event.currentTarget).get("message").trim();
  state.globalChat.push({ id: crypto.randomUUID(), username: currentUser().username, message, createdAt: new Date().toISOString() });
  event.currentTarget.reset();
  saveState();
  renderGlobalChat();
}

function renderGlobalChat() {
  $("#globalChatList").innerHTML = state.globalChat.length
    ? state.globalChat.map((msg) => `<article class="chat-message ${msg.username === currentUser().username ? "own-message" : ""}"><strong>${escapeHtml(msg.username)}</strong><p>${escapeHtml(msg.message)}</p><small>${formatDate(msg.createdAt.slice(0, 10))}</small></article>`).join("")
    : `<p class="muted-note">No global messages yet.</p>`;
}

function renderAdmin() {
  if (!isAdmin()) return;
  renderAccountAdmin();
  renderProjectAdmin();
}

function renderAccountAdmin() {
  $("#accountList").innerHTML = state.users.map((user) => `
    <article class="admin-item">
      <div><strong>${escapeHtml(user.displayName)}</strong><small>${escapeHtml(user.username)} - ${user.approved ? user.role : "pending approval"}</small></div>
      <div class="button-row">
        ${!user.approved ? `<button type="button" data-approve-user="${user.username}">Approve</button>` : ""}
        ${user.username !== adminUsername ? `<button type="button" data-toggle-admin="${user.username}">${user.role === "admin" ? "Remove admin" : "Make admin"}</button>` : ""}
        ${user.username !== adminUsername ? `<button class="danger-action" type="button" data-delete-user="${user.username}">Delete</button>` : ""}
      </div>
    </article>
  `).join("");
  document.querySelectorAll("[data-approve-user]").forEach((button) => button.addEventListener("click", () => approveUser(button.dataset.approveUser)));
  document.querySelectorAll("[data-toggle-admin]").forEach((button) => button.addEventListener("click", () => toggleAdmin(button.dataset.toggleAdmin)));
  document.querySelectorAll("[data-delete-user]").forEach((button) => button.addEventListener("click", () => deleteUser(button.dataset.deleteUser)));
}

function renderProjectAdmin() {
  const pending = pendingProjects();
  $("#approvalList").innerHTML = pending.length
    ? pending.map((project) => `<article class="admin-item"><div><strong>${escapeHtml(project.name)}</strong><small>Submitted by ${escapeHtml(project.submittedBy)} - Due ${formatDate(project.deadline)}</small></div><div class="button-row"><button type="button" data-approve-project="${project.id}">Approve</button><button class="danger-action" type="button" data-delete-project="${project.id}">Reject</button></div></article>`).join("")
    : `<p class="muted-note">No projects are waiting for approval.</p>`;
  document.querySelectorAll("[data-approve-project]").forEach((button) => button.addEventListener("click", () => approveProject(button.dataset.approveProject)));
  document.querySelectorAll("[data-delete-project]").forEach((button) => button.addEventListener("click", () => deleteProject(button.dataset.deleteProject)));
}

function approveUser(username) {
  const user = state.users.find((account) => account.username === username);
  if (!user || !isAdmin()) return;
  user.approved = true;
  saveState();
  render();
}

function toggleAdmin(username) {
  const user = state.users.find((account) => account.username === username);
  if (!user || !isAdmin() || user.username === adminUsername) return;
  user.role = user.role === "admin" ? "member" : "admin";
  user.approved = true;
  saveState();
  render();
}

function deleteUser(username) {
  if (!isAdmin() || username === adminUsername) return;
  state.users = state.users.filter((user) => user.username !== username);
  state.projects.forEach((project) => {
    project.collaborators = project.collaborators.filter((item) => item !== username);
    project.editors = project.editors.filter((item) => item !== username);
  });
  saveState();
  render();
}

function approveProject(id) {
  const project = state.projects.find((item) => item.id === id);
  if (!project || !isAdmin()) return;
  project.approved = true;
  logProject(project, "Project approved by admin.");
  saveState();
  render();
}

function deleteProject(id) {
  const project = state.projects.find((item) => item.id === id);
  if (!canManageProject(project)) return;
  state.projects = state.projects.filter((item) => item.id !== id);
  if (selectedProjectId === id) selectedProjectId = null;
  saveState();
  render();
}

function toggleProjectEditor(projectId, username) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!canManageProject(project) || username === project.manager) return;
  project.editors = project.editors.includes(username) ? project.editors.filter((item) => item !== username) : [...project.editors, username];
  logProject(project, `${displayName(username)} edit access changed.`);
  saveState();
  renderEditorLists();
  render();
}

function removeCollaborator(projectId, username) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!canManageProject(project) || username === project.manager) return;
  project.collaborators = project.collaborators.filter((item) => item !== username);
  project.editors = project.editors.filter((item) => item !== username);
  logProject(project, `${displayName(username)} removed from collaborators.`);
  saveState();
  renderEditorLists();
  render();
}

function deleteFundingPart(projectId, partId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!canEditProject(project)) return;
  project.fundingParts = project.fundingParts.filter((part) => part.id !== partId);
  saveState();
  renderEditorLists();
  render();
}

function deleteFundingLog(id) {
  if (!isAdmin()) return;
  state.funds.logs = state.funds.logs.filter((log) => log.id !== id);
  saveState();
  render();
}

function completeStage(projectId, stageId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!canEditProject(project)) return;
  const stage = project.stages.find((item) => item.id === stageId);
  if (!stage) return;
  stage.completed = true;
  stage.completedAt = todayString();
  stage.skipped = false;
  logProject(project, `Stage verified done: ${stage.name}.`);
  syncProjectProgress(project);
  saveState();
  render();
}

function skipStage(projectId, stageId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!canManageProject(project)) return;
  const stage = project.stages.find((item) => item.id === stageId);
  if (!stage) return;
  stage.skipped = true;
  stage.completed = true;
  stage.completedAt = todayString();
  logProject(project, `Stage skipped early: ${stage.name}.`);
  syncProjectProgress(project);
  saveState();
  render();
}

function deleteStage(projectId, stageId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!canEditProject(project)) return;
  project.stages = project.stages.filter((stage) => stage.id !== stageId);
  syncProjectProgress(project);
  saveState();
  render();
}

function logProject(project, message) {
  project.updateLog.unshift({ id: crypto.randomUUID(), username: currentUser()?.username || "System", message, createdAt: new Date().toISOString() });
}

function syncProjectProgress(project) {
  project.progress = project.stages.length ? Math.round((project.stages.filter((stage) => stage.completed || stage.skipped).length / project.stages.length) * 100) : 0;
}

function nextTimelineProject(projects) {
  const today = dateValue(todayString());
  return projects.flatMap((project) => project.stages.map((stage) => ({ project, date: stage.date }))).filter((item) => dateValue(item.date) >= today).sort((a, b) => dateValue(a.date) - dateValue(b.date))[0] || null;
}

function sortedStages(stages) {
  return [...stages].sort((a, b) => dateValue(a.date) - dateValue(b.date));
}

function stageState(stage) {
  if (stage.skipped) return "skipped";
  if (stage.completed && dateValue(stage.completedAt) <= dateValue(stage.date)) return "complete";
  if (stage.completed && dateValue(stage.completedAt) > dateValue(stage.date)) return "late";
  if (dateValue(todayString()) > dateValue(stage.date)) return "late";
  return "upcoming";
}

function stageStateLabel(stage) {
  const stateName = stageState(stage);
  if (stateName === "complete") return `Done ${formatDate(stage.completedAt)}`;
  if (stateName === "skipped") return `Skipped ${formatDate(stage.completedAt)}`;
  if (stateName === "late") return "Late";
  return "Upcoming";
}

function timelinePosition(date, min, span) {
  return Math.min(96, Math.max(4, ((dateValue(date) - min) / span) * 92 + 4));
}

function dateValue(value) {
  return new Date(`${value}T12:00:00`).getTime();
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value) {
  return dateFormat.format(new Date(`${value}T12:00:00`));
}

function statusClass(status) {
  return status.toLowerCase().replaceAll(" ", "-");
}

function statusBadge(status) {
  return `<span class="badge status-flag ${statusClass(status)}">${escapeHtml(status)}</span>`;
}

function moneyValue(value) {
  const parsed = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

render();
