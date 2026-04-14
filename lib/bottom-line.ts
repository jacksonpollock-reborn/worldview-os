export type BottomLineSegment = {
  label: string;
  value: string;
};

const BOTTOM_LINE_LABEL_PATTERN =
  /(View|Reason|Risk|Downgrade if|Upgrade if|Review|Ignore):\s*/g;

export function parseBottomLineSegments(value: string): BottomLineSegment[] {
  const matches = [...value.matchAll(BOTTOM_LINE_LABEL_PATTERN)];

  if (matches.length < 3) {
    return [];
  }

  return matches.map((match, index) => {
    const label = match[1];
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? value.length;

    return {
      label,
      value: value.slice(start, end).trim(),
    };
  });
}
