# FastGPT SSO 服务模版
这个服务是专门给私有化用户对接 SSO 的，如果不需要对接 SSO，则不需要使用这个服务。

## 开发方案

1. 安装 bun
2. 安装依赖 `bun install`
3. 启动 `bun run dev`
4. 打包：`docker buildx build --platform=linux/amd64 -f ./Dockerfile -t registry.cn-hangzhou.aliyuncs.com/fastgpt/fastgpt-sso:v4.8.14 .`

## 部署方式
默认端口：3000
```
PORT=your_port bun run dev
```

## 用户和组织同步

同步接口为 `GET /user/list` 和 `GET /org/list`，请求头需包含 `Authorization: Bearer <AUTH_TOKEN>`。

默认使用 `SSO_PROVIDER` 对应 provider 的同步实现。登录 provider 与同步 provider 需要分离时，设置 `SSO_SYNC_PROVIDER`；在 `src/provider/index.ts` 的 `providerMap` 中按需实现 `getUserList` 和 `getOrgList`。用户记录的组织字段为 `orgs`。

## 环境配置

除 `SSO_PROVIDER`、`SSO_TARGET_URL` 外，按 provider 配置对应的环境变量。使用用户和组织同步时配置随机的 `AUTH_TOKEN`；不要将示例值用于生产环境。`.env.template` 中的 `test` provider 提供了登录和同步演示。
