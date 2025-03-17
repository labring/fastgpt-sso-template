import { Request } from 'express';
export type RedirectFn = (data: {
  req: Request;
  redirect_uri: string;
  state: string;
}) => Promise<{ redirectUrl: string }>;

export type GetUserInfoFn = (code: string) => Promise<{
  username: string;
  avatar: string;
  contact: string;
  memberName?: string;
}>;

export type CallbackFn = (data: { req: Request }) => Promise<{ redirectUrl: string }>;

export type AssertFn = (data: {
  SAMLResponse: string;
  RelayState: string;
}) => Promise<{ redirectUrl: string }>;
export type GetMetaDataFn = () => Promise<string>;

export type UserListType = {
  username: string;
  memberName: string;
  avatar?: string;
  contact?: string;
  org?: string[];
}[];

export type GetUserListFn = () => Promise<UserListType>;

export type OrgListType = {
  id: string;
  name: string;
  parentId: string;
}[];

export type GetOrgListFn = () => Promise<OrgListType>;
