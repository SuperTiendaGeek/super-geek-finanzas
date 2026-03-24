export function isRequired(value: string) {
  return value.trim().length > 0;
}

export function isPositiveNumber(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0;
}

export function hasMinLength(value: string, min: number) {
  return value.trim().length >= min;
}
