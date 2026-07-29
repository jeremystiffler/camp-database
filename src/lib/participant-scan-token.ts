export function participantScanTokenSuffix(value: string | null | undefined) {
  if (!value) return null;
  const candidate = value.trim().split(/[:/]/).filter(Boolean).at(-1)?.toLowerCase() || "";
  return /^[a-f0-9]{32}$/.test(candidate) ? candidate : null;
}
