export type ChangeMindParts = {
  trigger: string;
  failure: string;
};

export function splitChangeMindCondition(value: string): ChangeMindParts | null {
  const match = value.match(/^IF\s+(.+?)\s*->\s*(.+)$/i);

  if (!match) {
    return null;
  }

  return {
    trigger: match[1].trim(),
    failure: match[2].trim(),
  };
}
