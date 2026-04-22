const domains = [
  {
    domain: "mockmail.dev",
    adapter: "mockmail",
    label: "Mock Mail",
    description: "演示用域名，返回随机账号与密码。"
  },
  {
    domain: "example-api.com",
    adapter: "officialApiExample",
    label: "Official API Example",
    description: "官方 API 示例骨架，需要替换为你自己的授权接口。"
  }
];

module.exports = {
  domains
};
