export function defaultConfigPath(home = process.env.HOME ?? "") {
  if (!home) throw new Error("HOME is required to resolve Natalia config path");
  return `${home}/.config/natalia-cli/config.yaml`;
}

export function redactSecret(value: string) {
  return value.replace(
    /([A-Za-z0-9_.-]+)(\s*[:=]\s*)([^\s,}]+)/giu,
    (match, key, separator) =>
      isSecretKey(String(key)) ? `${key}${separator}[REDACTED]` : match,
  );
}

function isSecretKey(key: string) {
  const normalized = key.toLowerCase().replace(/[.-]/gu, "_");
  return (
    normalized.includes("api_key") ||
    normalized.includes("secret") ||
    normalized.includes("password") ||
    normalized.includes("authorization") ||
    normalized === "token" ||
    normalized.endsWith("_token")
  );
}

export function keyIdentity(apiKey?: string) {
  if (!apiKey) return "no-key";
  return new Bun.CryptoHasher("sha256")
    .update(apiKey)
    .digest("hex")
    .slice(0, 12);
}
