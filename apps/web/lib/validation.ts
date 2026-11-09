export function isValidEmailAddress(value: string): boolean {
  if (!value || /\s/.test(value)) return false;

  const separator = value.indexOf('@');
  if (separator < 1 || separator !== value.lastIndexOf('@')) return false;

  const local = value.slice(0, separator);
  const domain = value.slice(separator + 1);
  const finalDot = domain.lastIndexOf('.');

  return finalDot > 0
    && finalDot < domain.length - 1
    && !local.startsWith('.')
    && !local.endsWith('.')
    && !value.includes('..');
}
