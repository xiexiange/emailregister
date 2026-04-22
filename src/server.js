const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { getDomainDefinitions } = require("./services/domainRegistry");
const { registerEmailAccount } = require("./services/registrationService");

const publicDir = path.join(__dirname, "..", "public");

function loadEnvFile() {
  const envPath = path.join(__dirname, "..", ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf-8");
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const port = Number(process.env.PORT || 3000);

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}

function getMailSlurpConfig() {
  const apiKey = process.env.MAILSLURP_API_KEY || "";
  const baseUrl = process.env.MAILSLURP_BASE_URL || "https://api.mailslurp.com";

  if (!apiKey) {
    const error = new Error("MAILSLURP_API_KEY is missing");
    error.status = 400;
    throw error;
  }

  return { apiKey, baseUrl };
}

async function callMailSlurp(pathname, options = {}) {
  const { apiKey, baseUrl } = getMailSlurpConfig();
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (error) {
      payload = { raw: text };
    }
  }

  if (!response.ok) {
    const error = new Error(
      (payload && payload.message) || `MailSlurp API failed with ${response.status}`
    );
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

function normalizeInboxList(result) {
  const list = Array.isArray(result) ? result : result && Array.isArray(result.content) ? result.content : [];

  return list.map((item) => ({
    id: item.id,
    emailAddress: item.emailAddress,
    createdAt: item.createdAt
  }));
}

function sendFile(response, filePath) {
  const stream = fs.createReadStream(filePath);

  stream.on("error", () => {
    sendJson(response, 404, { message: "Resource not found" });
  });

  const extension = path.extname(filePath);
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8"
  };

  response.writeHead(200, {
    "Content-Type": contentTypes[extension] || "application/octet-stream"
  });
  stream.pipe(response);
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";

    request.on("data", (chunk) => {
      raw += chunk;
    });

    request.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });

    request.on("error", reject);
  });
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "GET" && requestUrl.pathname === "/api/domains") {
    sendJson(response, 200, { domains: getDomainDefinitions() });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/register") {
    try {
      const body = await readRequestBody(request);
      const result = await registerEmailAccount(body.domain);
      sendJson(response, 200, result);
    } catch (error) {
      sendJson(response, error.status || 500, {
        message: error.message || "Unexpected error"
      });
    }
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/mailslurp/inboxes") {
    try {
      const page = Number(requestUrl.searchParams.get("page") || 0);
      const size = Number(requestUrl.searchParams.get("size") || 20);

      let result;
      try {
        result = await callMailSlurp(`/inboxes/paginated?page=${page}&size=${size}&sort=DESC`);
      } catch (error) {
        result = await callMailSlurp(`/inboxes?page=${page}&size=${size}&sort=DESC`);
      }

      sendJson(response, 200, {
        items: normalizeInboxList(result)
      });
    } catch (error) {
      sendJson(response, error.status || 500, {
        message: error.message || "Failed to fetch inboxes"
      });
    }
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/mailslurp/inbox-by-email") {
    try {
      const emailAddress = requestUrl.searchParams.get("emailAddress");

      if (!emailAddress) {
        const error = new Error("emailAddress is required");
        error.status = 400;
        throw error;
      }

      let inbox = await callMailSlurp(
        `/inboxes/byEmailAddress?emailAddress=${encodeURIComponent(emailAddress)}`
      );

      if (!inbox || !inbox.id) {
        const pageResult = await callMailSlurp("/inboxes/paginated?page=0&size=100&sort=DESC");
        const candidates = normalizeInboxList(pageResult);
        inbox = candidates.find(
          (item) => String(item.emailAddress || "").toLowerCase() === String(emailAddress).toLowerCase()
        );
      }

      if (!inbox || !inbox.id) {
        const error = new Error("Inbox not found for emailAddress");
        error.status = 404;
        throw error;
      }

      sendJson(response, 200, {
        id: inbox.id,
        emailAddress: inbox.emailAddress,
        createdAt: inbox.createdAt
      });
    } catch (error) {
      sendJson(response, error.status || 500, {
        message: error.message || "Failed to find inbox"
      });
    }
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/mailslurp/emails") {
    try {
      const inboxId = requestUrl.searchParams.get("inboxId");
      const page = Number(requestUrl.searchParams.get("page") || 0);
      const size = Number(requestUrl.searchParams.get("size") || 20);

      if (!inboxId) {
        const error = new Error("inboxId is required");
        error.status = 400;
        throw error;
      }

      const result = await callMailSlurp(
        `/emails?inboxId=${encodeURIComponent(inboxId)}&page=${page}&size=${size}&sort=DESC`
      );

      const items = Array.isArray(result)
        ? result
        : result && Array.isArray(result.content)
          ? result.content
          : [];

      sendJson(response, 200, {
        items: items.map((item) => ({
          id: item.id,
          subject: item.subject || "(no subject)",
          from: item.from,
          to: item.to || [],
          createdAt: item.createdAt,
          read: Boolean(item.read)
        }))
      });
    } catch (error) {
      sendJson(response, error.status || 500, {
        message: error.message || "Failed to fetch emails"
      });
    }
    return;
  }

  if (request.method === "GET" && requestUrl.pathname.startsWith("/api/mailslurp/emails/")) {
    try {
      const emailId = requestUrl.pathname.replace("/api/mailslurp/emails/", "");

      if (!emailId) {
        const error = new Error("emailId is required");
        error.status = 400;
        throw error;
      }

      const email = await callMailSlurp(`/emails/${encodeURIComponent(emailId)}`);
      sendJson(response, 200, email);
    } catch (error) {
      sendJson(response, error.status || 500, {
        message: error.message || "Failed to fetch email detail"
      });
    }
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/mailslurp/send") {
    try {
      const body = await readRequestBody(request);
      const inboxId = String(body.inboxId || "").trim();
      const to = String(body.to || "").trim();
      const subject = String(body.subject || "").trim();
      const content = String(body.body || "").trim();
      const isHTML = Boolean(body.isHTML);

      if (!inboxId || !to || !subject || !content) {
        const error = new Error("inboxId, to, subject, body are required");
        error.status = 400;
        throw error;
      }

      const sendBody = {
        to: [to],
        subject,
        body: content,
        isHTML
      };

      let result;
      try {
        result = await callMailSlurp(`/inboxes/${encodeURIComponent(inboxId)}`, {
          method: "POST",
          body: sendBody
        });
      } catch (firstError) {
        try {
          result = await callMailSlurp(`/inboxes/${encodeURIComponent(inboxId)}/emails`, {
            method: "POST",
            body: sendBody
          });
        } catch (secondError) {
          const combined = new Error(
            `Send failed: ${firstError.message}; fallback failed: ${secondError.message}`
          );
          combined.status = secondError.status || firstError.status || 502;
          throw combined;
        }
      }

      sendJson(response, 200, {
        success: true,
        result
      });
    } catch (error) {
      sendJson(response, error.status || 500, {
        message: error.message || "Failed to send email"
      });
    }
    return;
  }

  if (
    request.method === "GET" &&
    (requestUrl.pathname === "/" ||
      requestUrl.pathname === "/mailbox" ||
      requestUrl.pathname.startsWith("/public/"))
  ) {
    const relativePath =
      requestUrl.pathname === "/"
        ? "index.html"
        : requestUrl.pathname === "/mailbox"
          ? "mailbox.html"
          : requestUrl.pathname.replace("/public/", "");
    sendFile(response, path.join(publicDir, relativePath));
    return;
  }

  sendJson(response, 404, { message: "Not found" });
});

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
