import logo from "./assets/logo-left.svg" with { type: "text" };
import type { Corp } from "./config";

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char]!,
  );

const companyIcon = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M2 21h20M8 7h4M8 11h4M8 15h4M9 21v-2h2v2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const arrowIcon = `<svg class="arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export function renderSelectionPage(ticket: string, corps: Corp[]) {
  const buttons = corps
    .map(
      (corp) =>
        `<button type="submit" name="corp" value="${escapeHtml(corp.key)}" class="enterprise-button"><span class="company-icon">${companyIcon}</span><span class="company-name">${escapeHtml(corp.name)}</span><span class="button-action">继续登录</span>${arrowIcon}</button>`,
    )
    .join("");
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>选择所属企业 · FastGPT</title>
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;min-height:100svh;padding:32px 20px;display:grid;place-items:center;background:linear-gradient(135deg,#f2f7ff 0%,#f8f9fd 55%,#f6f5fc 100%);color:#111824;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;-webkit-font-smoothing:antialiased}
main{width:100%;max-width:540px;padding:56px 48px 36px;background:#fff;border:1px solid #fff;border-radius:26px;box-shadow:0 3px 12px #182d5206,0 18px 64px #182d5205}
.brand{display:flex;justify-content:center;margin:0 auto 48px}
.brand svg{display:block;width:236px;max-width:100%;height:auto}
h1{margin:0 0 12px;font-size:24px;font-weight:600;letter-spacing:-.5px;line-height:1.4}
.description{margin:0;color:#8995ad;font-size:14px;line-height:1.8}
form{display:grid;gap:16px;margin-top:30px}
.enterprise-button{appearance:none;width:100%;min-height:66px;display:flex;align-items:center;gap:14px;padding:14px 19px;border:1px solid #dfe4ed;border-radius:10px;background:#fff;color:#344054;font:inherit;text-align:left;cursor:pointer;box-shadow:0 2px 3px #182d5208;transition:background .15s,border-color .15s,box-shadow .15s}
.enterprise-button:hover{background:#f7faff;border-color:#a8c2ff;box-shadow:0 4px 12px #3370ff12}
.enterprise-button:active{background:#eef4ff;border-color:#83a7ff}
.enterprise-button:focus-visible{outline:3px solid #a8c2ff;outline-offset:4px}
.company-icon{width:32px;height:32px;display:grid;place-items:center;flex-shrink:0;border:1px solid #e1eaff;border-radius:7px;background:#f2f6ff;color:#3370ff}
.company-icon svg{width:21px;height:21px}
.company-name{flex:1;min-width:0;overflow-wrap:anywhere;font-size:16px;font-weight:500;line-height:1.5}
.button-action{font-size:13px;color:#3370ff;white-space:nowrap}
.arrow{width:18px;height:18px;flex-shrink:0;color:#3370ff}
.divider{display:flex;align-items:center;gap:14px;margin:30px 0 20px;color:#8b96ad;font-size:12px;letter-spacing:.2px;white-space:nowrap}
.divider:before,.divider:after{content:"";height:1px;flex:1;background:#e7ebf2}
footer{margin:0;text-align:center;color:#8b96ad;font-size:12px;line-height:1.9}
@media(max-width:560px){body{padding:16px 12px}main{padding:40px 24px 30px;border-radius:22px}.brand{margin-bottom:36px}.brand svg{width:214px}h1{font-size:22px}form{margin-top:26px;gap:14px}.enterprise-button{padding:14px;gap:11px;min-height:64px}.button-action{font-size:12px}.company-name{font-size:15px}}
@media(prefers-reduced-motion:reduce){.enterprise-button{transition:none}}
</style>
</head>
<body>
<main aria-labelledby="page-title">
<div class="brand" role="img" aria-label="FastGPT">${logo.replace("<svg ", '<svg aria-hidden="true" focusable="false" ')}</div>
<h1 id="page-title">选择所属企业</h1>
<p class="description">请选择您的企业，使用企业微信账号登录 FastGPT。</p>
<form method="post" action="/login/wecom/select" aria-label="选择企业登录">
<input type="hidden" name="ticket" value="${escapeHtml(ticket)}">
${buttons}
</form>
<div class="divider">企业微信 SSO</div>
<footer>登录将跳转至所选企业的企业微信认证页面</footer>
</main>
</body>
</html>`;
}
