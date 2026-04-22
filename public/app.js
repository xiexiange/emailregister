const domainSelect = document.getElementById("domainSelect");
const submitButton = document.getElementById("submitButton");
const statusText = document.getElementById("statusText");
const resultCard = document.getElementById("resultCard");
const accountValue = document.getElementById("accountValue");
const inboxIdValue = document.getElementById("inboxIdValue");
const passwordValue = document.getElementById("passwordValue");
const providerValue = document.getElementById("providerValue");
const detailValue = document.getElementById("detailValue");

async function loadDomains() {
  statusText.textContent = "正在加载可用域名...";

  try {
    const response = await fetch("/api/domains");
    const payload = await response.json();

    domainSelect.innerHTML = payload.domains
      .map((item) => `<option value="${item.domain}">${item.domain} | ${item.label}</option>`)
      .join("");

    statusText.textContent = "请选择一个后缀后发起注册。";
  } catch (error) {
    statusText.textContent = "域名加载失败，请检查服务端是否正常启动。";
  }
}

async function registerAccount() {
  const domain = domainSelect.value;

  if (!domain) {
    statusText.textContent = "请先选择邮箱后缀。";
    return;
  }

  submitButton.disabled = true;
  resultCard.classList.add("hidden");
  statusText.textContent = `正在提交 ${domain} 的注册请求...`;

  try {
    const response = await fetch("/api/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ domain })
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.message || "请求失败");
    }

    accountValue.textContent = payload.account;
    inboxIdValue.textContent = payload.inboxId || "-";
    passwordValue.textContent = payload.password;
    providerValue.textContent = `${payload.provider} / ${payload.mode}`;
    detailValue.textContent = payload.detail || "";
    resultCard.classList.remove("hidden");
    statusText.textContent = "注册流程执行完成。";
  } catch (error) {
    statusText.textContent = error.message || "注册失败。";
  } finally {
    submitButton.disabled = false;
  }
}

submitButton.addEventListener("click", registerAccount);
loadDomains();
