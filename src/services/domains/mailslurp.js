const { DomainRegistrationAdapter } = require("./base");
const { createRandomPassword, createRandomPrefix } = require("../../lib/random");
const { postJson } = require("../../lib/http");

class MailSlurpAdapter extends DomainRegistrationAdapter {
  async register({ domain }) {
    const apiKey = process.env.MAILSLURP_API_KEY;
    const baseUrl = process.env.MAILSLURP_BASE_URL || "https://api.mailslurp.com";
    const mode = process.env.MAILSLURP_CREATE_MODE || "address";
    const domainId = process.env.MAILSLURP_DOMAIN_ID || "";
    const inboxType = process.env.MAILSLURP_INBOX_TYPE || "HTTP_INBOX";
    const expiresIn = Number(process.env.MAILSLURP_EXPIRES_IN || 0);
    const fallbackToPool = String(process.env.MAILSLURP_FALLBACK_TO_POOL || "false").toLowerCase() === "true";

    const prefix = createRandomPrefix(10);
    const generatedPassword = createRandomPassword(18);
    const requestedAddress = `${prefix}@${domain}`;

    if (!apiKey) {
      return {
        account: requestedAddress,
        password: generatedPassword,
        provider: this.definition.label,
        mode: "template",
        detail:
          "未配置 MAILSLURP_API_KEY，当前返回模板数据。补齐 MailSlurp 参数后将调用官方 API 创建邮箱。"
      };
    }

    const payload = {
      inboxType
    };

    if (mode === "domainId") {
      payload.domainId = domainId || "mock-domain-id";
      payload.prefix = prefix;
    } else if (mode === "pool") {
      payload.useDomainPool = true;
    } else {
      payload.emailAddress = requestedAddress;
    }

    if (Number.isFinite(expiresIn) && expiresIn > 0) {
      payload.expiresIn = expiresIn;
    }

    let response;

    try {
      response = await postJson(`${baseUrl}/inboxes/withOptions`, payload, {
        headers: {
          "x-api-key": apiKey
        }
      });
    } catch (error) {
      if (mode === "address" && fallbackToPool) {
        response = await postJson(
          `${baseUrl}/inboxes/withOptions`,
          {
            inboxType,
            useDomainPool: true
          },
          {
            headers: {
              "x-api-key": apiKey
            }
          }
        );
      } else {
        const wrapped = new Error(
          `MailSlurp create inbox failed: ${error.message}. Check MAILSLURP_API_KEY and mode-specific params.`
        );
        wrapped.status = error.status || 502;
        throw wrapped;
      }
    }

    return {
      account: response.emailAddress || requestedAddress,
      password: generatedPassword,
      provider: this.definition.label,
      mode: `mailslurp-${mode}`,
      detail:
        "MailSlurp 创建邮箱成功。注意：MailSlurp 主要通过 API Key 访问邮箱，返回的 password 是本系统展示字段，不是 MailSlurp 登录密码。"
    };
  }
}

module.exports = {
  MailSlurpAdapter
};
