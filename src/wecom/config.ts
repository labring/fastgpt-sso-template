export type Corp = {
  key: string;
  name: string;
  corpId: string;
  agentId: string;
  appSecret: string;
  directorySecret?: string;
};
export type Config = {
  publicUrl: string;
  redirects: string[];
  authToken: string;
  corps: Corp[];
};
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const fail = (message: string): never => {
  throw new Error(message);
};
export function loadConfig(
  env: Record<string, string | undefined> = process.env,
): Config {
  if (
    (env.SSO_PROVIDER && env.SSO_PROVIDER !== "wecom") ||
    (env.SSO_SYNC_PROVIDER && env.SSO_SYNC_PROVIDER !== "wecom")
  )
    fail("Only wecom provider is supported");
  const publicUrl = checkedUrl(env.PUBLIC_URL || "", "PUBLIC_URL");
  if (publicUrl.pathname !== "/" || publicUrl.search || publicUrl.hash)
    fail("PUBLIC_URL must be an origin without path");
  let corps: unknown, redirects: unknown;
  try {
    corps = JSON.parse(env.WECOM_CORPS || "");
    redirects = JSON.parse(env.FASTGPT_REDIRECT_URIS || "");
  } catch {
    fail("WECOM_CORPS and FASTGPT_REDIRECT_URIS must be JSON arrays");
  }
  if (!Array.isArray(corps) || corps.length < 1 || corps.length > 3)
    fail("WECOM_CORPS must contain between 1 and 3 corporations");
  const keys = new Set<string>(),
    ids = new Set<string>();
  for (const c of corps as Corp[]) {
    if (
      !c ||
      ["key", "name", "corpId", "agentId", "appSecret"].some(
        (k) => typeof (c as any)[k] !== "string" || !(c as any)[k].trim(),
      )
    )
      fail(
        "Each corporation requires key, name, corpId, agentId and appSecret",
      );
    if (
      !/^[a-z0-9-]{1,32}$/.test(c.key) ||
      !/^\d+$/.test(c.agentId) ||
      keys.has(c.key) ||
      ids.has(c.corpId)
    )
      fail("Invalid or duplicate corporation key/corpId or invalid agentId");
    if (
      c.directorySecret !== undefined &&
      (typeof c.directorySecret !== "string" || !c.directorySecret.trim())
    )
      fail("Invalid directorySecret");
    keys.add(c.key);
    ids.add(c.corpId);
  }
  if (
    !Array.isArray(redirects) ||
    !redirects.length ||
    redirects.some((v) => typeof v !== "string")
  )
    fail("FASTGPT_REDIRECT_URIS requires callback URLs");
  const urls = (redirects as string[]).map((v) => {
    const u = checkedUrl(v, "FASTGPT_REDIRECT_URIS");
    if (u.hash || u.searchParams.has("code") || u.searchParams.has("state"))
      fail("Callback URLs cannot contain fragment, code or state");
    return u.toString();
  });
  if (!env.AUTH_TOKEN?.trim()) fail("AUTH_TOKEN is required");
  return {
    publicUrl: publicUrl.origin,
    redirects: urls,
    authToken: env.AUTH_TOKEN!,
    corps: corps as Corp[],
  };
}
function checkedUrl(value: string, name: string): URL {
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return fail(`${name} must be an absolute URL`);
  }
  if (
    u.username ||
    u.password ||
    (u.protocol !== "https:" &&
      !(
        u.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)
      ))
  )
    fail(`${name} requires HTTPS (HTTP allowed on loopback only)`);
  return u;
}
// Pro sync uses the first '-' separated segment to find existing accounts.
// Keep that segment common to every corporation; WeCom IDs are case-insensitive.
export const userId = (key: string, id: string) =>
  `wecom-${key}:${encodeURIComponent(id.toLowerCase())}`;
export const rootId = (key: string) => `wecom:${key}:root`;
export const departmentId = (key: string, id: number) =>
  `wecom:${key}:dept:${id}`;
