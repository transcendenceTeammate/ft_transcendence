export function clearCookie(name, domain = '') {
    const domainPart = domain ? `; domain=${domain}` : '';
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/${domainPart}`;
}