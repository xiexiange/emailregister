class DomainRegistrationAdapter {
  constructor(definition) {
    this.definition = definition;
  }

  async register() {
    throw new Error("register() must be implemented by each domain adapter.");
  }
}

module.exports = {
  DomainRegistrationAdapter
};
