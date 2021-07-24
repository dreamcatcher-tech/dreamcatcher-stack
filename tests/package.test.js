const assert = require("assert");
const { checkModules } = require("./dist/interblock");

describe("package", () => {
  test("Running module load checks on ./dist/interblock.js", async () => {
    const modules = checkModules();
    assert(Object.keys(modules).length);
  });
  test("package.json/main points to dist/interblock.js", () => {
    const { main } = require("../package.json");
    const msg = `main points to ./index.js only in local development`;
    assert.strictEqual(main, "dist/interblock.js", msg);
  });
  // TODO add a test for terser plugin being set to minify
});
