# AGENTS.md

本仓库是独立的 Bun + Express SSO 服务模板，不属于 FastGPT workspace。实现时以本仓库代码和 `package.json` scripts 为准，保持可独立安装、构建和运行。

## Provider 开发

新增或修改登录、OAuth/SAML 映射、用户或组织同步 provider 时，先阅读 [`sso-provider-development`](.agents/skills/sso-provider-development/SKILL.md)，并按其中的接口契约、注册步骤和验证条件执行。

主要位置：

- `src/provider/`：provider 实现与注册表 `index.ts`
- `src/type.ts`：登录、用户同步和组织同步契约
- `src/controllers.ts`、`src/index.ts`：API handler 与路由
- `.env.template`、`README.md`：环境变量示例与开发/部署说明

新增环境变量时同步更新 `.env.template` 和对应说明；只提交占位配置，不写真实密钥。保持 provider 可选能力与接口类型一致，不为 login-only 或 sync-only provider 添加无关函数。

## 安全与验证

`/user/list` 和 `/org/list` 使用 `AUTH_TOKEN` 的 Bearer 鉴权。通过实际 HTTP smoke 验证同步响应和未授权请求；不要通过移除鉴权来简化测试。

使用 `package.json` 中已有脚本进行构建和运行验证。新增或修改接口时，实际启动服务并覆盖本次改动的成功路径、失败路径及 provider 选择行为。
