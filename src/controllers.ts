import type { Request, Response } from 'express';
import { getProvider } from 'provider';
import { getErrText } from 'utils';

export const handleGetAuthUrl = async (req: Request, res: Response) => {
  const provider = getProvider();
  if (!provider) {
    return res.status(400).json({ error: 'provider is required' });
  }
  const { redirectFn } = provider;

  if (process.env.REDIRECT) {
    // if current hostname is not equal to HOSTNAME, redirect to HOSTNAME with the same path
    if (process.env.HOSTNAME) {
      const hostname = new URL(process.env.HOSTNAME).hostname;
      if (req.hostname !== hostname) {
        const authURL = new URL(req.originalUrl, process.env.HOSTNAME);
        res.status(200).json({
          success: true,
          message: '',
          authURL: authURL.toString()
        });
      }
    }
  }

  const { redirect_uri, state } = req.query as {
    redirect_uri: string;
    state: string;
  };

  if (!redirect_uri) {
    return res.status(400).json({ error: 'redirect_uri is required' });
  }

  try {
    const { redirectUrl } = await redirectFn({ req, redirect_uri, state });

    res.status(200).json({
      success: true,
      message: '',
      authURL: redirectUrl
    });
  } catch (error) {
    res.status(500).json({
      message: getErrText(error)
    });
  }
};

export const handleSAMLMetadata = async (req: Request, res: Response) => {
  const provider = getProvider();
  if (!provider) {
    return res.status(400).json({ error: 'provider is required' });
  }
  const { getMetaData } = provider;

  if (!getMetaData) {
    return res.status(400).json({ error: 'getMetaData is required' });
  }

  try {
    const metadata = await getMetaData();
    res.set('Content-Type', 'application/xml');
    res.send(metadata);
  } catch (error) {
    res.status(500).json({
      message: getErrText(error)
    });
  }
};

export const handleCallback = async (req: Request, res: Response) => {
  const provider = getProvider();
  if (!provider) {
    return res.status(400).json({ error: 'provider is required' });
  }
  const { callbackFn } = provider;

  if (!callbackFn) {
    return res.status(400).json({ error: 'callbackFn is required' });
  }

  try {
    const { redirectUrl } = await callbackFn({ req });
    res.redirect(redirectUrl);
  } catch (error) {
    res.status(500).json({
      message: getErrText(error)
    });
  }
};

export const handleSAMLAssert = async (req: Request, res: Response) => {
  const { SAMLResponse, RelayState } = req.body as {
    SAMLResponse: string;
    RelayState: string;
  };
  const provider = getProvider();
  if (!provider) {
    return res.status(400).json({ error: 'provider is required' });
  }
  const { assertFn } = provider;
  if (!assertFn) {
    return res.status(400).json({ error: 'assertFn is required' });
  }
  if (!SAMLResponse) {
    return res.status(400).json({ error: 'SAMLResponse and RelayState is required' });
  }

  try {
    const { redirectUrl } = await assertFn({ SAMLResponse, RelayState });
    res.redirect(redirectUrl);
  } catch (error) {
    res.status(500).json({
      message: getErrText(error)
    });
  }
};

export const handleGetUserInfo = async (req: Request, res: Response) => {
  const provider = getProvider();
  if (!provider) {
    return res.status(400).json({ error: 'provider is required' });
  }
  const { getUserInfo } = provider;

  try {
    const { code } = req.query as { code: string };

    if (!code) {
      throw new Error('code is required');
    }

    const userInfo = await getUserInfo(code);

    // 返回用户信息
    res.json({
      success: true,
      message: '',
      ...userInfo
    });
  } catch (error: any) {
    res.json({
      success: false,
      message: getErrText(error)
    });
  }
};

export const handleGetUserList = async (req: Request, res: Response) => {
  const provider = getProvider();
  if (!provider) {
    return res.status(400).json({ error: 'provider is required' });
  }
  const { getUserList } = provider;
  if (!getUserList) {
    return res.status(400).json({ error: 'getUserList is required' });
  }

  try {
    const userList = await getUserList();
    res.json({
      success: true,
      message: '',
      userList
    });
  } catch (error: any) {
    res.json({
      success: false,
      message: getErrText(error)
    });
  }
};

export const handleGetOrgList = async (req: Request, res: Response) => {
  const provider = getProvider();
  if (!provider) {
    return res.status(400).json({ error: 'provider is required' });
  }
  const { getOrgList } = provider;
  if (!getOrgList) {
    return res.status(400).json({ error: 'getOrgList is required' });
  }

  try {
    const orgList = await getOrgList();
    res.json({
      success: true,
      message: '',
      orgList
    });
  } catch (error: any) {
    res.json({
      success: false,
      message: getErrText(error)
    });
  }
};
