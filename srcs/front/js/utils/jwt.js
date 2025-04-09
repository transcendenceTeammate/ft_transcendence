export function parseJwtPayload(rawJwt)
{
  let input = rawJwt.split('.')[1];
  input = input.replace(/-/g, '+').replace(/_/g, '/');
  
  return JSON.parse(atob(input));
}

export function isJwtExpired(rawJwt)
{
  const jwtPayLoad = parseJwtPayload(rawJwt).exp;

  return Math.trunc(Date.now() / 1000) >= jwtPayLoad.exp;  
}