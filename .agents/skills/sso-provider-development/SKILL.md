---
name: sso-provider-development
description: Use when adding or modifying an SSO login provider, OAuth/SAML mapping, or user/organization sync provider in this standalone FastGPT SSO template.
---

# SSO Provider Development

在独立模板中新增或修改 provider 时，按以下步骤完成实现和验证。模板是 Bun + Express 项目；以本仓库的类型、示例和脚本为准，不直接依赖 FastGPT monorepo 内的模块。

## 1. 先确认接口契约

阅读 `src/type.ts`、`src/provider/index.ts`、`src/controllers.ts`、`src/index.ts` 和一个现有 provider 示例。确认本次能力对应的 handler、环境变量和响应结构；不要仅凭主项目里的 provider 实现推断模板已有能力。

provider 函数按 `src/type.ts` 的类型实现：

- 登录跳转：`RedirectFn` 接收 `req`、`redirect_uri`、`state`，返回 `{ redirectUrl }`。
- 登录用户信息：`GetUserInfoFn` 接收 OAuth `code`，返回用户身份字段。
- 用户同步：`GetUserListFn` 返回 `UserListType`，组织归属字段为 `orgs`。
- 组织同步：`GetOrgListFn` 返回 `OrgListType`，字段为 `id`、`name`、`parentId`。
- Callback、SAML metadata、assert 仅在 provider 需要这些能力时实现。

登录能力和同步能力是可选的。sync-only provider 不要求实现登录函数；login-only provider 不要求实现同步函数。只实现实际支持的函数，缺失能力由 controller 返回错误响应。

## 2. 实现并注册 provider

1. 在 `src/provider/` 新建 provider 模块，按 `src/provider/example.ts` 或 `src/provider/oauth2.example.ts` 的风格导出符合类型的函数。
2. 将模块函数加入 `src/provider/index.ts` 的 `providerMap`。映射键就是环境变量使用的 provider 名称。
3. `SSO_PROVIDER` 选择登录 provider；`SSO_SYNC_PROVIDER` 可单独选择用户/组织同步 provider。未设置 `SSO_SYNC_PROVIDER` 时，同步沿用 `SSO_PROVIDER`。
4. 避免在 provider 模块加载时缓存可变环境变量；在需要支持运行时测试或配置切换的路径中，于函数调用时读取配置。
5. 错误信息不得包含 client secret、access token、密码或完整敏感响应。

## 3. 更新配置说明

新增或修改的环境变量必须同步写入 `.env.template`，使用无效占位值或注释示例，不提交真实凭据。更新 `README.md` 中的 provider 配置说明；说明哪些变量必填、哪些可选，以及登录 provider 与同步 provider 是否需要分开配置。

同步 API 为 `GET /user/list` 和 `GET /org/list`，由 `src/index.ts` 挂载 `auth` 中间件。启用同步时配置 `AUTH_TOKEN`，调用方使用 `Authorization: Bearer <AUTH_TOKEN>`；不得为了方便测试移除鉴权。

## 4. 验证行为

1. 运行 `package.json` 中的 build script，确认 provider 被入口正确打包。
2. 启动实际服务，分别调用本次改动涉及的 endpoint。同步改动至少验证：有效 Bearer token 返回符合 `UserListType` / `OrgListType` 的记录；缺失或错误 token 返回 `401`。
3. 若 `SSO_SYNC_PROVIDER` 与 `SSO_PROVIDER` 可分离，设置不同 provider 执行烟测，确认同步路由使用同步 provider；未设置时确认回退行为。
4. 检查 README 和 `.env.template`，确保新增配置可以按文档启动，且不含真实密钥。

完成条件：provider 已注册；支持的 endpoint 返回契约规定的数据；鉴权边界和 provider 选择已实际验证；配置文档同步；构建成功。
