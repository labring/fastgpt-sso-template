export const getErrText = (error: any) => {
  if (typeof error === 'string') {
    return error;
  }

  return error?.message || 'Internal server error';
};
