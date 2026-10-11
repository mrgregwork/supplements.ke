/**
 * Known disposable/throwaway email domains, blocked at checkout only (not
 * account creation elsewhere) to raise the cost of the card-testing pattern
 * seen against ShopUSA (johnsmith00X@storebotmail.joonix.net): a bot
 * walking the real checkout form with a disposable address and a stolen
 * card. Not exhaustive -- a determined attacker can always find a new
 * domain -- this is one layer alongside the checkout rate limit, not a
 * complete defense on its own.
 */
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  // Confirmed used in the ShopUSA incident.
  "joonix.net",
  "storebotmail.joonix.net",
  // Widely known disposable/temp-mail providers.
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.info",
  "guerrillamail.biz",
  "guerrillamail.de",
  "sharklasers.com",
  "10minutemail.com",
  "10minutemail.net",
  "20minutemail.com",
  "temp-mail.org",
  "tempmail.com",
  "tempmail.net",
  "tempmailo.com",
  "throwawaymail.com",
  "yopmail.com",
  "yopmail.net",
  "yopmail.fr",
  "trashmail.com",
  "maildrop.cc",
  "mintemail.com",
  "getnada.com",
  "dispostable.com",
  "fakeinbox.com",
  "mailnesia.com",
  "moakt.com",
  "emailondeck.com",
  "mohmal.com",
  "33mail.com",
  "spamgourmet.com",
]);

/** The domain a customer's checkout email ends in -- lowercase, no leading "@". */
function extractDomain(email: string): string | null {
  const atIndex = email.lastIndexOf("@");
  if (atIndex === -1) return null;
  return email.slice(atIndex + 1).trim().toLowerCase();
}

/** True if the email's domain (or a subdomain of it) is a known disposable provider. */
export function isDisposableEmail(email: string): boolean {
  const domain = extractDomain(email);
  if (!domain) return false;
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) return true;
  for (const blocked of DISPOSABLE_EMAIL_DOMAINS) {
    if (domain.endsWith(`.${blocked}`)) return true;
  }
  return false;
}
