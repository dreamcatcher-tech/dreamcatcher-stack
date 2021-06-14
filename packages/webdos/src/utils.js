import Debug from "debug";
import assert from "assert";
const debug = Debug("web-components:utils");

export const getNextPath = (path, cwd) => {
  assert.strictEqual(typeof path, "string");
  assert.strictEqual(typeof cwd, "string");
  const segments = getPathSegments(path);
  assert(segments.includes(cwd), `invalid cwd: ${cwd}`);
  while (segments[0] !== cwd) {
    segments.shift();
  }
  segments.shift();
  const nextPath = segments.shift();
  debug(`nextPath`, nextPath);
  return nextPath;
};
export const getPathSegments = (alias) => {
  // TODO merge with metrologyFactory function
  if (alias === "/") {
    return ["/"];
  }
  let prefix = "";
  const splits = alias.split("/").filter((seg) => !!seg);
  splits.unshift("/");
  const paths = splits.map((segment) => {
    prefix && prefix !== "/" && (prefix += "/"); // TODO make child naming convention avoid this check ?
    prefix += segment;
    return prefix;
  });
  return paths;
};
