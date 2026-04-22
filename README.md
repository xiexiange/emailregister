# emailregister

一个安全的“邮箱后缀路由注册”演示工程。

## 说明

本项目提供的是通用架构，不包含针对第三方邮箱站点的自动化注册实现。
后端仅内置：

- `mockmail.dev` 的演示适配器
- `example-api.com` 的授权 API 示例适配器

如果你有自有邮箱系统或目标服务的官方授权接口，可以按域名新增独立模块接入。

## 启动

```bash
npm.cmd start
```

默认启动地址：

```text
http://localhost:3000
```

## 架构

- `public/`：前端页面，负责选择域名并展示结果
- `src/server.js`：统一 HTTP 服务与 API 入口
- `src/config/domains.js`：域名到适配器的映射
- `src/services/domains/`：每个域名独立注册模块，互不影响
- `src/services/registrationService.js`：统一注册调度层

## 新增域名模块

1. 在 `src/services/domains/` 新建一个适配器文件
2. 继承 `DomainRegistrationAdapter` 并实现 `register()`
3. 在 `src/services/domainRegistry.js` 注册工厂
4. 在 `src/config/domains.js` 配置域名与适配器映射

这样前端无需修改，只传域名即可。
