const { domains } = require("../config/domains");
const { MockMailAdapter } = require("./domains/mockmail");
const { OfficialApiExampleAdapter } = require("./domains/official-api-example");

const adapterFactories = {
  mockmail: (definition) => new MockMailAdapter(definition),
  officialApiExample: (definition) => new OfficialApiExampleAdapter(definition)
};

function getDomainDefinitions() {
  return domains.map(({ domain, label, description }) => ({
    domain,
    label,
    description
  }));
}

function getDomainDefinition(domain) {
  return domains.find((item) => item.domain === domain) || null;
}

function getDomainAdapter(domain) {
  const definition = getDomainDefinition(domain);

  if (!definition) {
    const error = new Error(`Unsupported domain: ${domain}`);
    error.status = 404;
    throw error;
  }

  const factory = adapterFactories[definition.adapter];

  if (!factory) {
    const error = new Error(`Adapter not implemented: ${definition.adapter}`);
    error.status = 500;
    throw error;
  }

  return factory(definition);
}

module.exports = {
  getDomainDefinitions,
  getDomainAdapter
};
