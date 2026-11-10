import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { HttpError, userId, type Config } from "./config";
import type { Client } from "./directory";
import { ExpiringStore } from "./store";
import { renderSelectionPage } from "./selection-page";
import type { GetUserInfoFn } from "../type";
type Identity = Awaited<ReturnType<GetUserInfoFn>>;
type Transaction = { redirect: string; state: string; browser?: string };
type Authorization = Transaction & { corp: string; browser: string };
const bad = (message = "Invalid or expired login request"): never => {
  throw new HttpError(400, message);
};
export function queryString(
  req: Request,
  key: string,
  required = true,
): string {
  const value = req.query[key];
  if (value === undefined && !required) return "";
  if (typeof value !== "string" || (required && !value) || value.length > 4096)
    bad(`Invalid ${key}`);
  return value as string;
}
const cookieName = (id: string) => `wecom_${id}`;
function browserCookie(req: Request, id: string) {
  if (!/^[a-f0-9]{64}$/.test(id)) return "";
  const values = (req.headers.cookie || "")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.startsWith(cookieName(id) + "="));
  return values.length === 1 ? values[0].slice(cookieName(id).length + 1) : "";
}
function same(a: string, b: string) {
  const aa = Buffer.from(a),
    bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
export class Login {
  private tickets: ExpiringStore<Transaction>;
  private states: ExpiringStore<Authorization>;
  private codes: ExpiringStore<Identity>;
  constructor(
    private config: Config,
    private client: Client,
    now = Date.now,
  ) {
    this.tickets = new ExpiringStore(300_000, 10_000, now);
    this.states = new ExpiringStore(300_000, 10_000, now);
    this.codes = new ExpiringStore(60_000, 10_000, now);
  }
  start(redirect: string, state: string) {
    let url: URL;
    try {
      url = new URL(redirect);
    } catch {
      return bad("Invalid redirect_uri");
    }
    if (!this.config.redirects.includes(url.toString()))
      bad("redirect_uri is not allowed");
    const ticket = this.tickets.put({ redirect: url.toString(), state });
    return `${this.config.publicUrl}/login/wecom/select?${new URLSearchParams({ ticket })}`;
  }
  private setCookie(
    res: Response,
    id: string,
    value: string,
    maxAge = 300_000,
  ) {
    res.cookie(cookieName(id), value, {
      httpOnly: true,
      secure: this.config.publicUrl.startsWith("https:"),
      sameSite: "lax",
      path: "/login",
      maxAge,
    });
  }
  private restartLogin(res: Response, ticket?: string, status = 302) {
    if (ticket && /^[a-f0-9]{64}$/.test(ticket))
      this.setCookie(res, ticket, "", 0);
    // Expired/consumed transactions no longer contain a callback. Only use the
    // configured trusted destination, never a URL supplied on the stale link.
    const login = new URL(this.config.redirects[0]);
    login.pathname = login.pathname.endsWith("/login/provider")
      ? login.pathname.slice(0, -"/provider".length)
      : "/login";
    login.search = "";
    login.hash = "";
    res.redirect(status, login.toString());
  }
  selectPage(req: Request, res: Response) {
    const ticket = req.query.ticket;
    if (typeof ticket !== "string" || !/^[a-f0-9]{64}$/.test(ticket))
      return this.restartLogin(res);
    const txn = this.tickets.get(ticket);
    if (!txn) return this.restartLogin(res, ticket);
    const existing = browserCookie(req, ticket);
    if (txn!.browser && !same(txn!.browser, existing))
      return this.restartLogin(res, ticket);
    txn!.browser ||= randomBytes(32).toString("hex");
    this.setCookie(res, ticket, txn!.browser);
    res.type("html").send(renderSelectionPage(ticket, this.config.corps));
  }
  select(req: Request, res: Response) {
    if (req.headers.origin !== this.config.publicUrl)
      bad("Invalid request origin");
    const { ticket, corp } = req.body || {};
    if (typeof ticket !== "string" || typeof corp !== "string") bad();
    const txn = this.tickets.get(ticket);
    if (!txn) return this.restartLogin(res, ticket, 303);
    const selected = this.config.corps.find((c) => c.key === corp);
    if (
      !txn?.browser ||
      !same(txn.browser, browserCookie(req, ticket)) ||
      !selected
    )
      bad();
    this.tickets.take(ticket);
    const state = this.states.put({
      ...txn!,
      corp: selected!.key,
      browser: txn!.browser!,
    });
    this.setCookie(res, ticket, "", 0);
    this.setCookie(res, state, txn!.browser!);
    const url = new URL("https://login.work.weixin.qq.com/wwlogin/sso/login");
    url.search = new URLSearchParams({
      login_type: "CorpApp",
      appid: selected!.corpId,
      agentid: selected!.agentId,
      redirect_uri: `${this.config.publicUrl}/login/oauth/callback`,
      state,
    }).toString();
    res.redirect(url.toString());
  }
  async callback(req: Request): Promise<string> {
    const state = queryString(req, "state");
    const code = queryString(req, "code");
    const txn = this.states.get(state);
    if (!txn || !same(txn.browser, browserCookie(req, state))) bad();
    this.states.take(state); // reserve before any network operation; no concurrent callback replay
    const corp = this.config.corps.find((c) => c.key === txn!.corp)!;
    const identity = await this.client.get(corp, "auth/getuserinfo", { code });
    if (typeof identity.userid !== "string" || !identity.userid)
      throw new HttpError(403, "Only enterprise members can log in");
    const member = await this.client.get(corp, "user/get", {
      userid: identity.userid,
    });
    if (
      typeof member.userid !== "string" ||
      member.userid.toLowerCase() !== identity.userid.toLowerCase() ||
      member.status !== 1
    )
      throw new HttpError(403, "Member is unavailable or inactive");
    const localCode = this.codes.put({
      username: userId(corp.key, member.userid),
      memberName: typeof member.name === "string" ? member.name : member.userid,
      avatar: typeof member.avatar === "string" ? member.avatar : "",
      contact: typeof member.mobile === "string" ? member.mobile : "",
    });
    const target = new URL(txn!.redirect);
    target.searchParams.set("code", localCode);
    if (txn!.state) target.searchParams.set("state", txn!.state);
    return target.toString();
  }
  clearCallbackCookie(req: Request, res: Response) {
    this.setCookie(res, queryString(req, "state"), "", 0);
  }
  consumeCode(code: string): Identity {
    const identity = this.codes.take(code);
    if (!identity) bad("Invalid or expired code");
    return identity!;
  }
}
