const loadInboxesBtn = document.getElementById("loadInboxesBtn");
const inboxSelect = document.getElementById("inboxSelect");
const emailInput = document.getElementById("emailInput");
const bindByEmailBtn = document.getElementById("bindByEmailBtn");
const refreshEmailsBtn = document.getElementById("refreshEmailsBtn");
const autoPollInput = document.getElementById("autoPollInput");
const pollIntervalSelect = document.getElementById("pollIntervalSelect");
const renderHtmlInput = document.getElementById("renderHtmlInput");
const statusText = document.getElementById("status");
const mailList = document.getElementById("mailList");
const registerCodexBtn = document.getElementById("registerCodexBtn");
const registrationProfileText = document.getElementById("registrationProfileText");
const codexResultText = document.getElementById("codexResultText");
const detailSubject = document.getElementById("detailSubject");
const detailFrom = document.getElementById("detailFrom");
const detailTo = document.getElementById("detailTo");
const detailBody = document.getElementById("detailBody");
const toInput = document.getElementById("toInput");
const subjectInput = document.getElementById("subjectInput");
const bodyInput = document.getElementById("bodyInput");
const isHtmlInput = document.getElementById("isHtmlInput");
const sendBtn = document.getElementById("sendBtn");

let inboxes = [];
let selectedInboxId = "";
let pollTimer = null;
let isRefreshing = false;
let currentEmailDetail = null;

function setStatus(message) {
  statusText.textContent = message;
}

function renderInboxOptions() {
  inboxSelect.innerHTML = inboxes
    .map((item) => `<option value="${item.id}">${item.emailAddress} (${item.id})</option>`)
    .join("");

  if (inboxes.length > 0) {
    selectedInboxId = inboxes[0].id;
    inboxSelect.value = selectedInboxId;
  }
}

function getSelectedInboxEmail() {
  const match = inboxes.find((item) => item.id === selectedInboxId);
  return match ? String(match.emailAddress || "").trim() : "";
}

function randomLetters(min, max) {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const length = Math.floor(Math.random() * (max - min + 1)) + min;
  let value = "";
  for (let i = 0; i < length; i += 1) {
    value += letters[Math.floor(Math.random() * letters.length)];
  }
  return value;
}

function randomNameProfile() {
  const family = randomLetters(10, 13);
  const given = randomLetters(5, 7);
  const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);
  return {
    familyName: cap(family),
    givenName: cap(given),
    fullName: `${cap(given)} ${cap(family)}`
  };
}

function saveRegistrationProfile(profile) {
  try {
    localStorage.setItem("codex_registration_profile", JSON.stringify(profile));
  } catch (error) {
    // ignore storage failures
  }
}

async function startCodexRegistration() {
  const email = getSelectedInboxEmail() || emailInput.value.trim();

  if (!email) {
    setStatus("请先绑定一个邮箱，再发起 codex 测试请求。");
    return;
  }

  const name = randomNameProfile();
  const profile = {
    platform: "codex",
    email,
    familyName: name.familyName,
    givenName: name.givenName,
    fullName: name.fullName,
    generatedAt: new Date().toISOString()
  };

  saveRegistrationProfile(profile);
  registrationProfileText.textContent = `资料已生成: email=${profile.email}, given=${profile.givenName}, family=${profile.familyName}`;
  codexResultText.textContent = "正在请求本地 authorize/continue...";
  registerCodexBtn.disabled = true;

  const text = `platform: codex\nemail: ${profile.email}\ngiven_name: ${profile.givenName}\nfamily_name: ${profile.familyName}\nfull_name: ${profile.fullName}`;

  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    // ignore clipboard failure
  }

  try {
    const response = await fetch("/api/codex/authorize-continue", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: profile.email
      })
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.message || "codex 第一步请求失败");
    }

    codexResultText.textContent = JSON.stringify(payload, null, 2);
    setStatus("codex 第一步本地测试请求已完成。");
  } catch (error) {
    codexResultText.textContent = error.message || "codex 第一步请求失败";
    setStatus(error.message || "codex 第一步请求失败。");
  } finally {
    registerCodexBtn.disabled = false;
  }
}

function clearPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function updatePollingState() {
  clearPolling();

  if (!autoPollInput.checked) {
    return;
  }

  const seconds = Number(pollIntervalSelect.value || 10);
  pollTimer = setInterval(() => {
    refreshEmails(true);
  }, Math.max(3, seconds) * 1000);
}

function sanitizeHtml(input) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(input, "text/html");
  const blockedTags = ["script", "style", "iframe", "object", "embed", "link", "meta"];

  blockedTags.forEach((tag) => {
    doc.querySelectorAll(tag).forEach((node) => node.remove());
  });

  doc.querySelectorAll("*").forEach((node) => {
    Array.from(node.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = String(attr.value || "").trim().toLowerCase();

      if (name.startsWith("on")) {
        node.removeAttribute(attr.name);
        return;
      }

      if ((name === "href" || name === "src") && value.startsWith("javascript:")) {
        node.removeAttribute(attr.name);
      }
    });
  });

  return doc.body.innerHTML || "";
}

function looksLikeHtml(text) {
  return /<\/?[a-z][\s\S]*>/i.test(text || "");
}

function renderEmailBody(detail) {
  const body = detail && (detail.body || detail.bodyExcerpt || "");
  const useHtml = renderHtmlInput.checked && looksLikeHtml(body);

  if (useHtml) {
    detailBody.innerHTML = sanitizeHtml(body);
    return;
  }

  detailBody.textContent = body || "(empty)";
}

async function loadInboxes() {
  setStatus("正在获取收件箱列表...");

  try {
    const response = await fetch("/api/mailslurp/inboxes");
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.message || "加载失败");
    }

    inboxes = payload.items || [];
    renderInboxOptions();
    setStatus(`已加载 ${inboxes.length} 个收件箱。`);
  } catch (error) {
    setStatus(error.message || "加载收件箱失败。");
  }
}

async function bindInboxByEmail() {
  const emailAddress = emailInput.value.trim();

  if (!emailAddress) {
    setStatus("请先输入邮箱地址。");
    return;
  }

  setStatus("正在按邮箱地址绑定收件箱...");

  try {
    const response = await fetch(`/api/mailslurp/inbox-by-email?emailAddress=${encodeURIComponent(emailAddress)}`);
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.message || "绑定失败");
    }

    const exists = inboxes.find((item) => item.id === payload.id);
    if (!exists) {
      inboxes.unshift(payload);
    }
    renderInboxOptions();
    selectedInboxId = payload.id;
    inboxSelect.value = selectedInboxId;
    setStatus(`绑定成功：${payload.emailAddress}`);
  } catch (error) {
    setStatus(error.message || "绑定失败。");
  }
}

function renderEmailList(items) {
  if (!items.length) {
    mailList.innerHTML = `<li class="muted">当前收件箱暂无邮件。</li>`;
    return;
  }

  mailList.innerHTML = items
    .map(
      (item) => `
      <li class="mail-item" data-id="${item.id}">
        <div><strong>${item.subject || "(no subject)"}</strong></div>
        <div class="muted">${item.from || "-"} -> ${(item.to || []).join(", ")}</div>
        <div class="muted">${item.createdAt || "-"}</div>
      </li>
    `
    )
    .join("");
}

async function refreshEmails(silent = false) {
  if (!selectedInboxId) {
    if (!silent) {
      setStatus("请先选择收件箱。");
    }
    return;
  }

  if (isRefreshing) {
    return;
  }

  isRefreshing = true;
  if (!silent) {
    setStatus("正在刷新邮件列表...");
  }

  try {
    const response = await fetch(`/api/mailslurp/emails?inboxId=${encodeURIComponent(selectedInboxId)}`);
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.message || "获取邮件失败");
    }

    renderEmailList(payload.items || []);
    if (!silent) {
      setStatus("邮件列表已刷新。");
    }
  } catch (error) {
    if (!silent) {
      setStatus(error.message || "刷新失败。");
    }
  } finally {
    isRefreshing = false;
  }
}

async function loadEmailDetail(emailId) {
  setStatus("正在加载邮件详情...");

  try {
    const response = await fetch(`/api/mailslurp/emails/${encodeURIComponent(emailId)}`);
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.message || "详情加载失败");
    }

    detailSubject.textContent = payload.subject || "(no subject)";
    detailFrom.textContent = payload.from || "-";
    detailTo.textContent = (payload.to || []).join(", ");
    currentEmailDetail = payload;
    renderEmailBody(payload);
    setStatus("邮件详情已加载。");
  } catch (error) {
    setStatus(error.message || "详情加载失败。");
  }
}

async function sendEmail() {
  if (!selectedInboxId) {
    setStatus("请先选择收件箱。");
    return;
  }

  const to = toInput.value.trim();
  const subject = subjectInput.value.trim();
  const body = bodyInput.value.trim();
  const isHTML = isHtmlInput.checked;

  if (!to || !subject || !body) {
    setStatus("to / subject / body 不能为空。");
    return;
  }

  sendBtn.disabled = true;
  setStatus("正在发送邮件...");

  try {
    const response = await fetch("/api/mailslurp/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inboxId: selectedInboxId,
        to,
        subject,
        body,
        isHTML
      })
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.message || "发送失败");
    }

    setStatus("发送成功。");
    await refreshEmails();
  } catch (error) {
    setStatus(error.message || "发送失败。");
  } finally {
    sendBtn.disabled = false;
  }
}

inboxSelect.addEventListener("change", () => {
  selectedInboxId = inboxSelect.value;
  refreshEmails(true);
});

mailList.addEventListener("click", (event) => {
  const element = event.target.closest(".mail-item");
  if (!element) {
    return;
  }
  loadEmailDetail(element.dataset.id);
});

loadInboxesBtn.addEventListener("click", loadInboxes);
bindByEmailBtn.addEventListener("click", bindInboxByEmail);
refreshEmailsBtn.addEventListener("click", refreshEmails);
sendBtn.addEventListener("click", sendEmail);
autoPollInput.addEventListener("change", updatePollingState);
pollIntervalSelect.addEventListener("change", updatePollingState);
registerCodexBtn.addEventListener("click", startCodexRegistration);
renderHtmlInput.addEventListener("change", () => {
  if (currentEmailDetail) {
    renderEmailBody(currentEmailDetail);
  }
});

window.addEventListener("beforeunload", clearPolling);
