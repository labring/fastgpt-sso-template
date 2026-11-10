export const env = {
  PUBLIC_URL: "http://localhost:3000",
  AUTH_TOKEN: "test-only-token",
  FASTGPT_REDIRECT_URIS: '["https://fastgpt.example/login/provider"]',
  WECOM_CORPS: JSON.stringify(
    ["a", "b", "c"].map((key) => ({
      key,
      name: `企业${key}`,
      corpId: `ww${key}`,
      agentId: "100001",
      appSecret: "test-secret",
    })),
  ),
};
