const { DomainRegistrationAdapter } = require("./base");
const { createRandomPassword, createRandomPrefix } = require("../../lib/random");
const { postJson } = require("../../lib/http");

class OfficialApiExampleAdapter extends DomainRegistrationAdapter {
  async register({ domain }) {
    const apiUrl = process.env.OFFICIAL_API_EXAMPLE_URL;

    if (!apiUrl) {
      const prefix = createRandomPrefix(10);
      const password = createRandomPassword(18);

      return {
        account: `${prefix}@${domain}`,
        password,
        provider: this.definition.label,
        mode: "template",
        detail: "未配置 OFFICIAL_API_EXAMPLE_URL，当前返回模板数据。接入自有/授权服务后可在此实现真实流程。"
      };
    }

    const prefix = createRandomPrefix(10);
    const password = createRandomPassword(18);

    const response = await postJson(apiUrl, {
      emailPrefix: prefix,
      emailDomain: domain,
      password
    });

    return {
      account: response.account || `${prefix}@${domain}`,
      password: response.password || password,
      provider: this.definition.label,
      mode: "official-api",
      detail: "通过授权 API 完成注册。"
    };
  }
}

module.exports = {
  OfficialApiExampleAdapter
};
