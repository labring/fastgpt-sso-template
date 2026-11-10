import { createApp } from "./app";
import { loadConfig } from "./wecom/config";
const config = loadConfig();
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("PORT must be between 1 and 65535");
createApp(config).listen(port, () => {
  console.log(
    `WeCom SSO listening on port ${port} (${config.corps.length} corporations, single instance)`,
  );
});
