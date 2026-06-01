import { RedirectFn, GetUserInfoFn, GetOrgListFn, GetUserListFn } from '../type';

// 用于存储生成的code和对应的用户信息
const codeMap = new Map();

export const test_redirectFn: RedirectFn = async ({ redirect_uri, state }) => {
  // 生成随机 code
  const code = Math.random().toString(36).substring(2, 15);

  // 存储 code 对应的模拟用户信息
  codeMap.set(code, {
    username: 'testuser1234',
    avatar: 'https://example.com/avatar.jpg',
    contact: '15677751111'
  });

  const redirectUrl = `${redirect_uri}?code=${code}${state ? `&state=${state}` : ''}`;
  console.log(redirectUrl);

  return { redirectUrl };
};

export const test_getUserInfo: GetUserInfoFn = async (code: string) => {
  // 获取存储的用户信息
  const userInfo = codeMap.get(code);
  console.log(userInfo, code);
  if (!userInfo) {
    return Promise.reject('Invalid code');
  }

  // 使用完后删除 code
  codeMap.delete(code);

  return userInfo;
};

export const test_GetUserList: GetUserListFn = async () => {
  return Promise.resolve([
    {
      username: 'test-1',
      avatar: 'https://example.com/avatar.jpg',
      contact: '15677751111',
      memberName: 'testuser1234',
      orgs: ['1', '2']
    },
    {
      username: 'test-2',
      avatar: 'https://example.com/avatar.jpg',
      contact: '15677751111',
      memberName: 'testuser5678',
      orgs: ['3', '4']
    }
  ]);
};

export const test_getOrgList: GetOrgListFn = async () => {
  return [
    {
      id: '1',
      name: '社区管理',
      parentId: '0'
    },
    {
      id: '2',
      name: '1-2',
      parentId: '1'
    },
    {
      id: '3',
      name: '1-2-3',
      parentId: '2'
    },
    {
      id: '4',
      name: '4',
      parentId: '0'
    }
  ];
};
