# Sealos / Kubernetes 接入自部署 FastGPT 商业版

本目录部署的是本仓库的三主体改造版本。请构建并发布自己的镜像；官方 SSO 镜像不包含本次改造。以下命令在仓库根目录运行。

## 1. 构建并发布镜像

在有 Docker / Buildx 的机器上构建。先确认 Kubernetes 节点 CPU 架构，再选择 `linux/amd64` 或 `linux/arm64`。例如目标为 x86_64：

```sh
export SSO_IMAGE=你的镜像仓库地址/你的项目/fastgpt-wecom-sso:1.0.7
# 登录自己的镜像仓库，按提示输入凭据
docker login 你的镜像仓库地址
docker buildx build --platform linux/amd64 -t "$SSO_IMAGE" --load .
docker push "$SSO_IMAGE"
```

Apple Silicon 本机默认构建 ARM 镜像，不要把默认架构误用于 x86 集群。部署时必须能从集群拉取所发布镜像。后续版本使用新 tag，不覆盖同一个 tag；构建只复制依赖描述、源码和 tsconfig，不包含真实 env 文件。

## 2. 创建 SSO Secret

选择与 FastGPT 商业后端相同的 namespace（Sealos 的项目空间通常有对应 namespace）：

```sh
export FASTGPT_NAMESPACE=你的FastGPT命名空间
cp deploy/kubernetes/sso.env.example .env.production
chmod 600 .env.production
# 编辑 .env.production：替换域名、token、实际使用主体的应用配置（1～3 个）
```

字段说明见仓库 README。`PUBLIC_URL` 是本 SSO 的公网 HTTPS origin；`FASTGPT_REDIRECT_URIS` 是 FastGPT 浏览器回调地址白名单，通常为 `https://你的FastGPT域名/login/provider`。支持配置 1～3 个主体，可先只保留一个真实主体；已配置主体需填写完整有效凭据，`key` 上线后保持稳定。

本文件用于 `kubectl --from-env-file`，JSON 直接填写，不要套 `.env.local` 示例中的外围单引号；Secret 只在运行时注入。

```sh
kubectl -n "$FASTGPT_NAMESPACE" create secret generic fastgpt-sso-env \
  --from-env-file=.env.production --dry-run=client -o yaml \
  | kubectl -n "$FASTGPT_NAMESPACE" apply -f -
```

该命令直接将 Secret 发给 Kubernetes，不应将渲染后的 Secret YAML 保存或提交到 Git。更新 Secret 后，需要重新创建 SSO Pod 才会加载新的环境变量。

## 3. 部署 SSO

将 `deployment.yaml` 中的镜像地址改成刚发布的 `$SSO_IMAGE`。私有镜像仓库需要配置同 namespace 的 imagePullSecret，并取消对应 `imagePullSecrets` 注释，也可由 Sealos 镜像凭据功能配置。

```sh
kubectl -n "$FASTGPT_NAMESPACE" apply -f deploy/kubernetes/deployment.yaml
kubectl -n "$FASTGPT_NAMESPACE" apply -f deploy/kubernetes/service.yaml
kubectl -n "$FASTGPT_NAMESPACE" rollout status deployment/fastgpt-sso --timeout=180s
kubectl -n "$FASTGPT_NAMESPACE" logs deployment/fastgpt-sso --tail=50
```

单副本、更新策略为 Recreate，不要配置 HPA。更新或重启会短暂中断服务，未完成的登录需重试。探针 `/test` 仅检测服务进程，不证明企微凭据和通讯录权限可用。资源值是起始估算，需要按实际通讯录规模调整。

如果使用 Sealos 应用管理界面部署：填写相同镜像、单实例、容器端口 3000、同名环境变量，并将升级策略设为 Recreate；不要再同时用 YAML 创建第二份 SSO 服务。本文 YAML 路线创建的 Service 名称固定为 `fastgpt-sso`；界面创建时请以实际 Service 名称为准。

## 4. 暴露公网 HTTPS 入口

让 Sealos 的公网访问 / 自定义域名功能或现有 Ingress 将 `https://sso.example.com` 转发到 `fastgpt-sso:3000`，TLS 在网关终止。使用专用 SSO 域名，不增加子路径前缀，不缓存或拦截 `/login/*` 路径，保留 query 和 cookie。本文未假设特定 IngressClass 或证书控制器；沿用现有 Sealos 网关配置。

确认公网 `https://sso.example.com/test` 可访问，再将 `.env.production` 中的 `PUBLIC_URL` 对齐实际域名。若域名后来发生变化，更新 Secret 后重启 SSO：

```sh
# 先重复第 2 步更新 Secret
kubectl -n "$FASTGPT_NAMESPACE" rollout restart deployment/fastgpt-sso
```

每个已配置的企微自建应用都需要配置 SSO 域名的授权登录 / 可信域名，并完成域名归属校验。校验文件由网关在根路径提供；服务自身没有通用静态文件路由。企微回调地址均为：

```text
https://sso.example.com/login/oauth/callback
```

各已配置主体还需允许 SSO Pod 访问企微 API 时的真实公网出口 IP，并设置应用通讯录可见范围。这是集群出口 IP，不是 Ingress 的入口 IP。当前实现以有部门和成员详情读取权限的自建应用凭据拉取通讯录，勿直接照搬官方原版镜像的配置变量或 ID-only 通讯录助手配置。

## 5. 接入 FastGPT 商业后端

在实际执行 SSO 和同步请求的 FastGPT 商业后端 Deployment（通常对应 `fastgpt-pro` 服务）配置以下环境变量。具体名称以已安装版本和实际部署为准：

```dotenv
EXTERNAL_USER_SYSTEM_BASE_URL=http://fastgpt-sso:3000
EXTERNAL_USER_SYSTEM_AUTH_TOKEN=与SSO的AUTH_TOKEN完全相同
```

同 namespace 可用短 Service 名；跨 namespace 使用 `http://fastgpt-sso.<SSO命名空间>.svc.cluster.local:3000`。不要填 `localhost:3000`，它指向 FastGPT 容器自身。若使用 NetworkPolicy，允许商业后端到 SSO TCP 3000、Ingress 到 SSO、SSO 到 DNS 和企微公网 HTTPS。

token 推荐通过已有 `fastgpt-sso-env` Secret 中 `AUTH_TOKEN` 的 secretKeyRef 注入到商业后端，例如合入该 Deployment 正确容器的 env：

```yaml
env:
  - name: EXTERNAL_USER_SYSTEM_BASE_URL
    value: http://fastgpt-sso:3000
  - name: EXTERNAL_USER_SYSTEM_AUTH_TOKEN
    valueFrom:
      secretKeyRef:
        name: fastgpt-sso-env
        key: AUTH_TOKEN
```

Secret 必须与引用它的 Pod 在同一 namespace。应用后重新部署商业后端以加载配置；这段 env 示例需要合入现有 Deployment，不是独立可 apply 的资源。

在 FastGPT 管理界面配置企业微信 SSO 按钮；需要通讯录同步时选择成员同步模式。先验证返回的完整组织和成员数据，再触发 FastGPT 首次同步。该改造不会自动合并已有 FastGPT 账号；不同企微主体的同一个人是不同身份。

## 6. 验证与排查

本地可通过端口转发检查服务和真实企微通讯录：

```sh
kubectl -n "$FASTGPT_NAMESPACE" port-forward service/fastgpt-sso 3300:3000
```

另一个终端执行（用实际 token 替换占位）：

```sh
curl http://localhost:3300/test
curl -i http://localhost:3300/user/list
# 上一个应为 401；以下两个应为 success:true，并包含全部已配置主体的数据
curl -H 'Authorization: Bearer YOUR_AUTH_TOKEN' http://localhost:3300/org/list
curl -H 'Authorization: Bearer YOUR_AUTH_TOKEN' http://localhost:3300/user/list
```

端口转发只用于 API 检查；正式登录必须从 FastGPT 公网域名点击 SSO 按钮，选择企业后走公网 SSO 域名，不能用端口转发域名替代登录 cookie 所属域名。

验收：已配置企业分别登录成功；登录 username 与同步记录完全一致；唯一总根“企业通讯录”下的各企业节点及部门层级正确；多部门归属正确；无 token 或错 token 为 401；任一主体异常时同步整体失败。

| 现象 | 检查项 |
| --- | --- |
| ImagePullBackOff | 镜像地址、tag、节点架构、仓库可达性和拉取凭据 |
| CrashLoopBackOff | 日志中的配置校验错误、JSON 外围引号、主体数量、域名协议 |
| FastGPT 访问失败 | 实际商业后端容器配置、Service 名称、namespace、NetworkPolicy |
| 同步 401 | FastGPT token 与 SSO AUTH_TOKEN 是否完全一致，配置是否重启生效 |
| 同步 502 | 企微应用凭据、真实出口 IP、可见范围及详情读取权限；错误中的主体 key 和数字错误码 |
| redirect_uri is not allowed | FastGPT 实际公网回调与白名单精确匹配，是否被代理生成成内网地址 |
| Invalid request origin | 升级到 1.0.2 或更新版本，重新从 FastGPT 发起登录；确认网关未覆盖 Referrer-Policy / CSP 响应头 |
| 回调过期或无效 | HTTPS 域名、cookie、5 分钟有效期、Pod 是否重启、是否错误部署多副本 |

参考：[FastGPT 官方 SSO 配置](https://doc.fastgpt.io/en/guide/admin/sso)、[Sealos 自定义域名](https://sealos.io/docs/guides/app-deploy/add-a-domain)、[Kubernetes Secret](https://kubernetes.io/docs/tasks/configmap-secret/managing-secret-using-kubectl/)、[Deployment Recreate](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)。

## 从旧测试账号重新导入

SSO 1.0.4 已将登录和同步 username 改为公共前缀 `wecom-`，兼容原版 Pro v4.17.2 重复同步。此次交付按用户确认不迁移旧测试账号；暂停同步并自行清理待重新导入的旧账号，再部署 1.0.4，恢复完整同步后验证连续两次同步及登录。Pro 保持官方原版镜像，不部署此前的 wecomfix1 兼容镜像。
