# FastGPT 三主体企业微信 SSO

独立的 Bun + Express 服务：支持 1～3 个企业微信主体接入同一套 FastGPT。用户先选择企业，再进入该企业的企业微信 Web 登录；用户和部门同步接口聚合已配置主体的数据。仅支持 `wecom`，不再提供演示登录、通用 OAuth2 或 SAML。

## 本地启动

需要 Bun 1.3.14 或兼容的 1.x 版本。

```sh
bun install --frozen-lockfile
cp .env.template .env.local
# 修改 .env.local 中的占位配置
bun run dev
```

```sh
bun run typecheck
bun run test
bun run build
bun run start
# 也可以运行打包结果
bun dist/index.js
```

`start` 运行源码，`dev` 开启 watch。Bun 自动读取 `.env` / `.env.local`，不需要 dotenv。默认监听 3000 端口；`GET /test` 返回服务标识，不验证上游企微可用性。

## 配置

| 变量 | 说明 |
| --- | --- |
| `PORT` | 可选，默认 3000 |
| `SSO_PROVIDER` | 可选，默认 `wecom`，其他值启动失败 |
| `SSO_SYNC_PROVIDER` | 可选，默认沿用登录 provider；仅允许 `wecom` |
| `PUBLIC_URL` | 必填，本 SSO 服务的外部 origin，例如 `https://sso.example.com`，不含路径；仅本地回环允许 HTTP |
| `FASTGPT_REDIRECT_URIS` | 必填，FastGPT 回调地址的 JSON 数组，精确匹配；通常为 `https://fastgpt.example.com/login/provider` |
| `AUTH_TOKEN` | 必填，同步接口 Bearer token，请使用随机强密钥 |
| `WECOM_CORPS` | 必填，包含 1～3 个主体的 JSON 数组，参考 `.env.template` |

可先保留一个真实主体完成验证，再添加第二、第三个。删除未使用的示例对象，无需凑满三个；每个已配置主体都必须填写有效凭据。添加主体时保持已有 `key` 不变，更新环境变量后重启服务。

每个主体的字段：

| 字段 | 说明 |
| --- | --- |
| `key` | 永久且唯一的主体标识，1–32 位小写字母、数字或连字符；上线后改变会生成新的用户和部门身份 |
| `name` | 企业选择页及组织根节点显示名称 |
| `corpId` | 企业 ID，各主体必须不同 |
| `agentId` | 企业自建应用 AgentID，字符串数字 |
| `appSecret` | 该自建应用 Secret，服务端保密 |
| `directorySecret` | 可选，默认 `appSecret`；可填本企业另一个具有通讯录读取权限的自建应用 Secret |

不要将真实 Secret、Bearer token 或 `.env` 文件提交到仓库；日志和客户端错误不输出企微 token 或原始错误正文。原模板的 `HOSTNAME`、`REDIRECT`、`SSO_TARGET_URL` 和 `OAUTH2_*` 配置已不使用。

## 各企业微信后台分别配置

1. 在每个主体创建供 FastGPT 使用的企业自建应用，取得 CorpID、AgentID、Secret。
2. 开启企业微信授权登录，配置本 SSO 服务域名及可信域名。企微回调为 `https://sso.example.com/login/oauth/callback`，不是 FastGPT 域名。按后台提示完成域名所有权校验；校验文件由反向代理在域名根路径提供。
3. 配置服务固定出口 IP 为可信 IP，并配置应用可见范围覆盖要同步的部门、成员和必要上级部门。要同步全部企业，请覆盖完整通讯录。
4. 确认自建应用凭据能调用部门列表、部门成员详情及读取成员接口，返回部门名称和成员姓名。通讯录同步助手的凭据在部分接口仅能获取 ID，不能代替本方案需要的详情读取权限；权限不足会使同步明确失败。
5. 手机号、头像等字段受企微应用权限限制，可能为空；系统不会将手机号作为身份主键。默认只同步启用且已激活的成员，缺少 status 字段时保留上游可见成员；登录要求成员 `status=1`。

本实现以浏览器 Web 登录为入口，支持扫描企微登录页面二维码。企微客户端内的静默网页授权不在本次范围。

官方接口参考：[构造登录链接](https://developer.work.weixin.qq.com/document/path/98174)、[获取登录身份](https://developer.work.weixin.qq.com/document/path/98176)、[部门列表](https://developer.work.weixin.qq.com/document/path/90208)、[部门成员详情](https://developer.work.weixin.qq.com/document/path/90201)、[读取成员](https://developer.work.weixin.qq.com/document/path/90196)。

## FastGPT 对接

在 FastGPT 配置本服务的内网地址和同步 token：

```dotenv
EXTERNAL_USER_SYSTEM_BASE_URL=http://fastgpt-sso:3000
EXTERNAL_USER_SYSTEM_AUTH_TOKEN=与本服务AUTH_TOKEN相同
```

然后在 FastGPT 管理端启用 SSO 登录入口及成员同步模式。不同 FastGPT 版本的配置界面可能不同，请参考 [FastGPT 官方 SSO 文档](https://doc.fastgpt.io/en/guide/admin/sso)。内部地址用于 FastGPT 后端访问，`PUBLIC_URL` 必须能被用户浏览器和企微回调访问。

登录顺序：FastGPT 请求授权地址 → 本服务企业选择页 → 所选企微 Web 登录 → 本服务回调验证 → 返回 FastGPT 的 `code` 和原始 `state` → FastGPT 向本服务换取身份。本地 code 为随机值、60 秒过期且只能使用一次；登录事务和企微 state 为 5 分钟过期，并由 HttpOnly / SameSite=Lax cookie 绑定浏览器。HTTPS 部署时 cookie 使用 Secure 属性。

接口保持：

| 接口 | 说明 |
| --- | --- |
| `GET /login/oauth/getAuthURL?redirect_uri=...&state=...` | 返回 `success`、`message`、`authURL` |
| `GET /login/oauth/getUserInfo?code=...` | 消费本地 code，返回 `username`、`memberName`、`avatar`、`contact` |
| `GET /login/oauth/callback` | 本服务处理企微回调，浏览器需携带对应登录 cookie |
| `GET /user/list` | Bearer 鉴权，返回 `success`、`message`、`userList` |
| `GET /org/list` | Bearer 鉴权，返回 `success`、`message`、`orgList` |

从 SSO 镜像 1.0.4 起，用户身份为 `wecom-<key>:<小写并URL编码的企微userid>`；企微 userid 不区分大小写。登录和同步共用同一个映射。部门 ID 为 `wecom:<key>:dept:<部门ID>`，企业节点为 `wecom:<key>:root`，统一挂在唯一总根 `wecom:root`（名称“企业通讯录”）下；仅总根的 `parentId` 为 `""`，符合 FastGPT 只允许一个根部门的接口要求。多部门成员通过 `orgs` 保留多个归属；不可见父部门下的可见部门挂到企业根节点。跨主体的同一个人是不同账号，不自动合并，也不迁移已有 FastGPT 账号。上线前用目标 FastGPT 版本验证自定义身份及组织 ID 的接收行为。

通讯录按已配置的全部主体完整拉取，成员按 userid 去重。`department/list` 和 `user/list` 本身不分页，本服务枚举每个可见部门且 `fetch_child=0`。并发最多三个主体、主体内部串行读取；请求 10 秒超时。token 按主体及用途缓存，失效错误只刷新重试一次。

成员和组织共用 60 秒完整快照；并发刷新复用同一任务。任一主体失败、部门结果为空或结构不合法，返回 `success:false` 及非 2xx 状态，不返回部分列表；过期快照不会静默作为成功结果使用。两个独立 API 请求跨过缓存更新点时，不保证事务级一致性。同步是 FastGPT 发起的拉取；本服务没有后台定时同步或事件回调。

## Sealos / Kubernetes 部署

镜像构建、推送、Secret、单副本 Deployment、Service、公网域名及商业版接入步骤见 [部署指南](deploy/kubernetes/README.md)。

## Docker 部署

```sh
docker build -t fastgpt-wecom-sso .
docker run --name fastgpt-sso --restart unless-stopped \
  --env-file .env.local -p 3000:3000 fastgpt-wecom-sso
```

注意：Docker `--env-file` 不按 shell 规则去除引号，需将 JSON 值外围的单引号去掉（Bun `.env.local` 示例中有单引号）。服务前部署 HTTPS 反向代理，保持登录路径和 cookie 完整转发，不缓存登录或同步响应。

**仅支持单实例。** 登录事务、一次性 code、access token 和通讯录快照均在进程内；重启后未完成的登录需要重来。不要直接扩容多副本；需要多实例时应先改用共享事务和 code 存储。

## 验证

```sh
curl http://localhost:3000/test
curl -H "Authorization: Bearer YOUR_AUTH_TOKEN" http://localhost:3000/org/list
curl -H "Authorization: Bearer YOUR_AUTH_TOKEN" http://localhost:3000/user/list
# 应返回 401
curl -i http://localhost:3000/user/list
```

自动测试使用本地 HTTP 模拟企微，覆盖三主体登录与同步、主体身份隔离、鉴权、回调保护、一次性 code、过期及上游失败；不需要真实凭据。实际接入仍需逐个主体完成真实企微登录、核对可见成员及部门数量，再在目标 FastGPT 中确认账号归属和同步结果。不要直接把首次同步作为已有账号迁移操作。


## 原版 Pro 重复同步兼容性（SSO 1.0.4）

FastGPT Pro v4.17.2 用首个用户名按 `-` 分割的第一个片段查询已有外部账号。因此所有主体统一使用 `wecom-` 用户名前缀，例如 `wecom-tjffy-a:zhangsan`、`wecom-cui-a:cuijinrui`。登录与同步使用相同映射，部门 ID 保持原格式，直接使用原版 Pro 镜像，不需要 Pro 兼容补丁。

旧版 SSO 使用 `wecom:<key>:<userid>`。本次按用户确认的“删除旧测试账号后重新导入”方式交付，不执行数据库迁移或删除。升级前暂停同步，由管理员清理待重新导入的旧测试账号，部署 SSO 1.0.4 后先同步再登录，连续同步两次验证不重复创建账号。不要保留旧账号并期待新用户名自动接管旧资源。已配置主体必须完整同步，删除主体配置可能触发 Pro 的离职处理。

## 企业选择页品牌样式

SSO 1.0.5 使用蓝白风格的响应式企业选择页，原始 FastGPT SVG 存放在 `src/wecom/assets/logo-left.svg`，页面模板位于 `src/wecom/selection-page.ts`，由 `login.ts` 的选择页 handler 调用。Logo 在构建时作为文本嵌入，无外部字体或图片依赖。修改后需重新构建镜像。

## 失效企业选择链接（SSO 1.0.6）

企业选择 ticket 仍为 5 分钟有效且只能消费一次。再次打开已使用、过期或服务重启后失效的选择链接时，浏览器会跳回 FastGPT 登录页，不再展示 JSON 错误。GET 使用 302，重复 POST 使用 303；来源和 cookie 校验继续保留。登录页由 `FASTGPT_REDIRECT_URIS` 第一项推导：`/login/provider` 改为 `/login`，保留部署子路径，清除 query 和 fragment；非标准回调路径回退到同 origin 的 `/login`。多个入口时请把首选入口放在白名单第一项，客户端 query 参数不能覆盖返回地址。其他 API 和企微回调的错误处理不变。
