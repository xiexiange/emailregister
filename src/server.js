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

  if (request.method === "GET" && (requestUrl.pathname === "/" || requestUrl.pathname.startsWith("/public/"))) {
    const relativePath = requestUrl.pathname === "/" ? "index.html" : requestUrl.pathname.replace("/public/", "");
    sendFile(response, path.join(publicDir, relativePath));
    return;
  }

  sendJson(response, 404, { message: "Not found" });
});

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
