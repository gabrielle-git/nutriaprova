/**
 * Brazilian phone mask: (XX) XXXXX-XXXX
 */
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function unmaskPhone(value: string): string {
  return value.replace(/\D/g, "");
}

export function isPhoneValid(value: string): boolean {
  return unmaskPhone(value).length === 11;
}

/**
 * CRN mask: CRN-X XXXXX or CRN-XX XXXXXX
 * Region: 1-2 digits, Number: 3-6 digits
 */
export function maskCRN(raw: string): string {
  // Strip "CRN" prefix and non-digits
  const stripped = raw.replace(/^CRN-?/i, "");
  const digits = stripped.replace(/\D/g, "").slice(0, 8);
  if (digits.length === 0) return "CRN-";
  if (digits.length <= 2) return `CRN-${digits}`;
  // Region = first 1 digit if total <= 6, else first 2
  const regionLen = digits.length > 6 ? 2 : 1;
  const region = digits.slice(0, regionLen);
  const number = digits.slice(regionLen);
  return `CRN-${region} ${number}`;
}

export function isCRNValid(value: string): boolean {
  return /^CRN-\d{1,2}\s\d{3,6}$/.test(value.trim());
}
