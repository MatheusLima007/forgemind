export function normalizeToPosixPath(value: string): string {
  return value.replaceAll("\\", "/");
}
