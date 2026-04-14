type LogLevel = "info" | "warn" | "error";

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    value: String(error),
  };
}

export function logServerEvent({
  level = "info",
  event,
  message,
  details,
}: {
  level?: LogLevel;
  event: string;
  message: string;
  details?: Record<string, unknown>;
}) {
  const payload = {
    ts: new Date().toISOString(),
    source: "worldview-os",
    level,
    event,
    message,
    details,
  };

  const serialized = JSON.stringify(payload);

  if (level === "error") {
    console.error(serialized);
    return;
  }

  if (level === "warn") {
    console.warn(serialized);
    return;
  }

  console.info(serialized);
}

export function logServerError(
  event: string,
  error: unknown,
  details?: Record<string, unknown>,
) {
  logServerEvent({
    level: "error",
    event,
    message: error instanceof Error ? error.message : "Unhandled server error.",
    details: {
      ...details,
      error: serializeError(error),
    },
  });
}
