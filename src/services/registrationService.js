const { getDomainAdapter } = require("./domainRegistry");

async function registerEmailAccount(domain) {
  if (!domain || typeof domain !== "string") {
    const error = new Error("domain is required");
    error.status = 400;
    throw error;
  }

  const adapter = getDomainAdapter(domain.trim().toLowerCase());
  return adapter.register({ domain: domain.trim().toLowerCase() });
}

module.exports = {
  registerEmailAccount
};
