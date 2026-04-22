const crypto = require("node:crypto");

function createRandomPrefix(length = 10) {
  const seed = crypto.randomBytes(length * 2).toString("base64").replace(/[^a-z0-9]/gi, "").toLowerCase();
  return seed.slice(0, length);
}

function createRandomPassword(length = 16) {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  const buffer = crypto.randomBytes(length);

  return Array.from(buffer, (value) => charset[value % charset.length]).join("");
}

module.exports = {
  createRandomPrefix,
  createRandomPassword
};
