import { HttpError, type Corp } from "./config";
export type ApiData = Record<string, any>;
export class WeComClient {
  private tokens = new Map<string, { value: string; expires: number }>();
  private pending = new Map<string, Promise<string>>();
  constructor(
    private base = "https://qyapi.weixin.qq.com",
    private timeout = 10_000,
  ) {}
  private async request(
    path: string,
    params: Record<string, string>,
  ): Promise<ApiData> {
    try {
      const url = new URL(`/cgi-bin/${path}`, this.base);
      url.search = new URLSearchParams(params).toString();
      const response = await fetch(url, {
        signal: AbortSignal.timeout(this.timeout),
        redirect: "error",
      });
      if (!response.ok) throw new Error();
      const body = await response.json();
      if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body) ||
        (body.errcode !== undefined && !Number.isInteger(body.errcode))
      )
        throw new Error();
      return body;
    } catch {
      throw new HttpError(502, "WeCom request failed");
    }
  }
  private async token(corp: Corp, directory: boolean): Promise<string> {
    const key = `${corp.key}:${directory ? "directory" : "login"}`;
    const cached = this.tokens.get(key);
    if (cached && cached.expires > Date.now()) return cached.value;
    const existing = this.pending.get(key);
    if (existing) return existing;
    const task = (async () => {
      const body = await this.request("gettoken", {
        corpid: corp.corpId,
        corpsecret: directory
          ? corp.directorySecret || corp.appSecret
          : corp.appSecret,
      });
      if (
        body.errcode ||
        typeof body.access_token !== "string" ||
        !body.access_token ||
        !Number.isFinite(body.expires_in) ||
        body.expires_in <= 0
      )
        throw new HttpError(502, `WeCom token unavailable (${corp.key})`);
      this.tokens.set(key, {
        value: body.access_token,
        expires: Date.now() + Math.max(1, body.expires_in - 120) * 1000,
      });
      return body.access_token as string;
    })();
    this.pending.set(key, task);
    try {
      return await task;
    } finally {
      this.pending.delete(key);
    }
  }
  async get(
    corp: Corp,
    path: string,
    params: Record<string, string> = {},
    directory = false,
  ): Promise<ApiData> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await this.token(corp, directory);
      const body = await this.request(path, { ...params, access_token: token });
      if ([40014, 42001].includes(body.errcode) && attempt === 0) {
        const key = `${corp.key}:${directory ? "directory" : "login"}`;
        if (this.tokens.get(key)?.value === token) this.tokens.delete(key);
        continue;
      }
      if (body.errcode !== 0)
        throw new HttpError(
          502,
          `WeCom API failed (${corp.key}, ${path}, ${Number.isInteger(body.errcode) ? body.errcode : "invalid response"})`,
        );
      return body;
    }
    throw new HttpError(502, "WeCom authentication failed");
  }
}
