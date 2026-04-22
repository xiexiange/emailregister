const { DomainRegistrationAdapter } = require("./base");
const { createRandomPassword, createRandomPrefix } = require("../../lib/random");

class MockMailAdapter extends DomainRegistrationAdapter {
  async register({ domain }) {
    const prefix = createRandomPrefix(10);
    const password = createRandomPassword(18);

    return {
      account: `${prefix}@${domain}`,
      password,
      provider: this.definition.label,
      mode: "mock",
      detail: "本适配器仅用于演示通用注册流程，不会访问外部站点。"
    };
  }
}

module.exports = {
  MockMailAdapter
};
