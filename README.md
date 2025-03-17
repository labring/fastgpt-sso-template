# FastGPT SSO 服务模版
这个服务是专门给私有化用户对接 SSO 的，如果不需要对接 SSO，则不需要使用这个服务。

## 开发方案

1. 安装 bun
2. 安装依赖 `bun install`
3. 启动 `bun run dev`
4. 打包：`docker buildx build --platform=linux/amd64  -f ./projects/sso/Dockerfile -t registry.cn-hangzhou.aliyuncs.com/fastgpt/fastgpt-sso:v4.8.14 .`

## 部署方式
默认端口：3000
```
PORT=your_port bun run dev
```
