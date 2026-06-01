// OAUTH2.0 Authorization reference: https://www.ruanyifeng.com/blog/2014/05/oauth_2_0.html
import axios from "axios";
import type { GetUserInfoFn, RedirectFn } from "type";

const OAuth2AuthorizeURL = process.env.OAUTH2_AUTHORIZE_URL || "";
const OAuth2TokenURL = process.env.OAUTH2_TOKEN_URL || "";
const OAuth2UserInfoURL = process.env.OAUTH2_USER_INFO_URL || "";

const ClientID = process.env.OAUTH2_CLIENT_ID || "";
const ClientSecret = process.env.OAUTH2_CLIENT_SECRET || "";
const Scope = process.env.OAUTH2_SCOPE || "";

const OAuth2UsernameMap = process.env.OAUTH2_USERNAME_MAP || "";
const OAuth2AvatarMap = process.env.OAUTH2_AVATAR_MAP || "";
const OAuth2MemberNameMap = process.env.OAUTH2_MEMBER_NAME_MAP || "";
const OAuth2ContactMap = process.env.OAUTH2_CONTACT_MAP || "";

let cache_redirect_uri = "";

function getNestedValue(obj: any, path: string): any {
  if (!path) return undefined;

  const keys = path.split(".");
  let current = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[key];
  }

  return current;
}

export const oauth2_redirectFn: RedirectFn = async ({
  redirect_uri,
  state,
}) => {
  // parse the redirect_uri
  const url = new URL(OAuth2AuthorizeURL);
  url.searchParams.set("redirect_uri", redirect_uri);
  url.searchParams.set("client_id", ClientID);
  url.searchParams.set("response_type", "code");
  if (Scope) {
    url.searchParams.set("scope", Scope);
  }
  if (state) {
    url.searchParams.set("state", state);
  }

  cache_redirect_uri = redirect_uri;
  return {
    redirectUrl: url.toString(),
  };
};

export const oauth2_getUserInfo: GetUserInfoFn = async (code: string) => {
  const {
    data: { access_token },
  } = await axios.request({
    url: OAuth2TokenURL,
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    data: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: ClientID,
      code,
      redirect_uri: cache_redirect_uri,
      ...(ClientSecret ? { client_secret: ClientSecret } : {}),
    }),
  });

  const { data } = await axios.request({
    url: OAuth2UserInfoURL,
    method: "get",
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
  });

  const username = getNestedValue(data, OAuth2UsernameMap);
  const avatar = getNestedValue(data, OAuth2AvatarMap);
  const memberName = getNestedValue(data, OAuth2MemberNameMap);
  const contact = getNestedValue(data, OAuth2ContactMap);

  return {
    username,
    avatar,
    memberName,
    contact,
  };
};
