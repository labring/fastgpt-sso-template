import express from "express";
import { initGlobalStore } from "global";

import {
  handleGetAuthUrl,
  handleCallback,
  handleGetUserInfo,
  handleGetUserList,
  handleGetOrgList,
  handleSAMLMetadata,
  handleSAMLAssert,
} from "controllers";
import { auth } from "middleware";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const PORT = process.env.PORT || 3000;

// 接收重定向请求
app.get("/login/oauth/getAuthURL", handleGetAuthUrl);
app.get("/login/oauth/getUserInfo", handleGetUserInfo);
// 用作处理特殊的重定向请求
app.get("/login/oauth/callback", handleCallback);
// 获取用户身份信息
app.get("/user/list", auth, handleGetUserList);
app.get("/org/list", auth, handleGetOrgList);

// 测试
app.get("/test", async (req, res) => {
  res.send("FastGPT-SSO-Service");
});

// SAML2.0 Support
app.get("/login/saml/metadata.xml", handleSAMLMetadata);
app.post("/login/saml/assert", handleSAMLAssert);

app.listen(PORT, () => {
  const provider = process.env.SSO_PROVIDER;
  console.log("Provider", provider);

  console.log(`SSO server is running on http://localhost:${PORT}`);
  initGlobalStore();
});
