"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const modulePath = path.join(__dirname, "upstream-linux-package.js");
const trustedBytes = Buffer.from("official package fixture version one\n");

function metadata(bytes) {
  return {
    size: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  };
}

async function fixture(t, handler) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-download-test-"));
  const server = http.createServer(handler);
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return {
    root,
    cacheDir: path.join(root, "cache"),
    destination: path.join(root, "package.deb"),
    url: `http://127.0.0.1:${server.address().port}/package.deb`,
  };
}

function invoke(method, args) {
  const source = `
    const [modulePath, method, serializedArgs] = process.argv.slice(1);
    Promise.resolve().then(() => require(modulePath)[method](...JSON.parse(serializedArgs)))
      .then((result) => process.stdout.write(JSON.stringify({ result }) + "\\n"))
      .catch((error) => { console.error(error.message); process.exitCode = 1; });
  `;
  return new Promise((resolve, reject) => {
    const child = childProcess.spawn(process.execPath, [
      "-e", source, modulePath, method, JSON.stringify(args),
    ], {
      env: { ...process.env, NO_PROXY: "127.0.0.1", no_proxy: "127.0.0.1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Download did not stop within 10 seconds: ${stderr}`));
    }, 10000);
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr });
    });
  });
}

function filesIn(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(filePath) : [filePath];
  }).sort();
}

function assertSuccessful(result) {
  assert.equal(result.signal, null);
  assert.equal(result.code, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test("downloads verified bytes while keeping diagnostics off stdout", async (t) => {
  const f = await fixture(t, (_request, response) => {
    response.writeHead(200, { "Content-Length": trustedBytes.length });
    response.end(trustedBytes);
  });
  const result = await invoke("download", [f.url, f.destination, {
    expected: metadata(trustedBytes),
  }]);
  assertSuccessful(result);
  assert.deepEqual(fs.readFileSync(f.destination), trustedBytes);
  assert.match(result.stderr, /download|bytes|%/i);
  assert.deepEqual(filesIn(f.root), [f.destination]);
});

test("incomplete HTTP responses preserve the destination and remove temporary files", async (t) => {
  const f = await fixture(t, (_request, response) => {
    response.writeHead(200, { "Content-Length": trustedBytes.length * 2 });
    response.end(trustedBytes);
  });
  fs.writeFileSync(f.destination, "previous valid artifact");
  const result = await invoke("download", [f.url, f.destination, { timeoutSeconds: 1 }]);
  assert.notEqual(result.code, 0);
  assert.equal(fs.readFileSync(f.destination, "utf8"), "previous valid artifact");
  assert.deepEqual(filesIn(f.root), [f.destination]);
});

test("HTTP errors fail even when their body has the expected bytes", async (t) => {
  const f = await fixture(t, (_request, response) => {
    response.writeHead(503);
    response.end(trustedBytes);
  });
  const result = await invoke("download", [f.url, f.destination, {
    expected: metadata(trustedBytes),
  }]);
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /503/);
  assert.deepEqual(filesIn(f.root), []);
});

test("a stalled response is bounded by the whole-download deadline", async (t) => {
  const f = await fixture(t, (_request, response) => {
    response.writeHead(200, { "Content-Length": 1000 });
    response.write("partial");
  });
  fs.writeFileSync(f.destination, "previous valid artifact");
  const startedAt = Date.now();
  const result = await invoke("download", [f.url, f.destination, { timeoutSeconds: 1 }]);
  const elapsedMs = Date.now() - startedAt;
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /timed? out|timeout|time-out/i);
  assert.ok(elapsedMs < 5000, `Stalled download took ${elapsedMs} ms`);
  assert.equal(fs.readFileSync(f.destination, "utf8"), "previous valid artifact");
  assert.deepEqual(filesIn(f.root), [f.destination]);
});

test("the low-speed deadline stops a response before the total deadline", async (t) => {
  const f = await fixture(t, (_request, response) => {
    response.writeHead(200, { "Content-Length": 1000 });
    response.write("partial");
  });
  const startedAt = Date.now();
  const result = await invoke("download", [f.url, f.destination, {
    timeoutSeconds: 6,
    lowSpeedSeconds: 1,
  }]);
  const elapsedMs = Date.now() - startedAt;
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /slow|speed|timed? out|timeout|time-out/i);
  assert.ok(elapsedMs < 5000, `Low-speed download took ${elapsedMs} ms`);
  assert.deepEqual(filesIn(f.root), []);
});

for (const mismatch of ["size", "sha256"]) {
  test(`a downloaded ${mismatch} mismatch cannot replace an existing destination`, async (t) => {
    const f = await fixture(t, (_request, response) => response.end(trustedBytes));
    fs.writeFileSync(f.destination, "previous valid artifact");
    const expected = metadata(trustedBytes);
    if (mismatch === "size") expected.size += 1;
    else expected.sha256 = "0".repeat(64);
    const result = await invoke("download", [f.url, f.destination, { expected }]);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, new RegExp(`${mismatch} mismatch`, "i"));
    assert.equal(fs.readFileSync(f.destination, "utf8"), "previous valid artifact");
    assert.deepEqual(filesIn(f.root), [f.destination]);
  });
}

test("verified package cache is reused across fresh build directories", async (t) => {
  let requests = 0;
  const f = await fixture(t, (_request, response) => {
    requests += 1;
    response.end(trustedBytes);
  });
  for (const directory of ["first-candidate", "second-candidate"]) {
    const outputDir = path.join(f.root, directory);
    fs.mkdirSync(outputDir);
    const destination = path.join(outputDir, "chatgpt.deb");
    const result = await invoke("downloadPackage", [f.url, destination, metadata(trustedBytes), {
      cacheDir: f.cacheDir,
    }]);
    assert.equal(assertSuccessful(result).result, destination);
    assert.deepEqual(fs.readFileSync(destination), trustedBytes);
  }
  assert.equal(requests, 1);
  const cachedFiles = filesIn(f.cacheDir);
  assert.equal(cachedFiles.length, 1);
  assert.equal(path.extname(cachedFiles[0]), ".deb");
  assert.match(path.basename(cachedFiles[0]), new RegExp(metadata(trustedBytes).sha256));
  assert.deepEqual(fs.readFileSync(cachedFiles[0]), trustedBytes);
});

test("same-size cache corruption is detected and downloaded again", async (t) => {
  let requests = 0;
  const f = await fixture(t, (_request, response) => {
    requests += 1;
    response.end(trustedBytes);
  });
  const args = [f.url, f.destination, metadata(trustedBytes), { cacheDir: f.cacheDir }];
  assertSuccessful(await invoke("downloadPackage", args));
  const cachedFiles = filesIn(f.cacheDir);
  assert.equal(cachedFiles.length, 1);
  fs.writeFileSync(cachedFiles[0], Buffer.alloc(trustedBytes.length, "x"));
  fs.unlinkSync(f.destination);
  assertSuccessful(await invoke("downloadPackage", args));
  assert.equal(requests, 2);
  assert.deepEqual(fs.readFileSync(f.destination), trustedBytes);
  assert.deepEqual(fs.readFileSync(cachedFiles[0]), trustedBytes);
});

test("parallel builds can safely publish and copy the same package cache entry", async (t) => {
  const f = await fixture(t, (_request, response) => {
    response.writeHead(200, { "Content-Length": trustedBytes.length });
    response.write(trustedBytes.subarray(0, 1));
    setTimeout(() => response.end(trustedBytes.subarray(1)), 50);
  });
  const destinations = [f.destination, path.join(f.root, "second-package.deb")];
  const results = await Promise.all(destinations.map((destination) => invoke("downloadPackage", [
    f.url, destination, metadata(trustedBytes), { cacheDir: f.cacheDir },
  ])));
  for (const [index, result] of results.entries()) {
    assert.equal(assertSuccessful(result).result, destinations[index]);
    assert.deepEqual(fs.readFileSync(destinations[index]), trustedBytes);
  }
  const cachedFiles = filesIn(f.cacheDir);
  assert.equal(cachedFiles.length, 1);
  assert.deepEqual(fs.readFileSync(cachedFiles[0]), trustedBytes);
  fs.writeFileSync(destinations[0], "modified candidate");
  assert.deepEqual(fs.readFileSync(cachedFiles[0]), trustedBytes);
  assert.deepEqual(fs.readFileSync(destinations[1]), trustedBytes);
});

test("changed signed metadata fetches the new hash even when the URL is unchanged", async (t) => {
  let requests = 0;
  let currentBytes = trustedBytes;
  const f = await fixture(t, (_request, response) => {
    requests += 1;
    response.end(currentBytes);
  });
  assertSuccessful(await invoke("downloadPackage", [
    f.url, f.destination, metadata(currentBytes), { cacheDir: f.cacheDir },
  ]));
  currentBytes = Buffer.from("official package fixture version two\n");
  assertSuccessful(await invoke("downloadPackage", [
    f.url, f.destination, metadata(currentBytes), { cacheDir: f.cacheDir },
  ]));
  assert.equal(requests, 2);
  assert.deepEqual(fs.readFileSync(f.destination), currentBytes);
  assert.ok(filesIn(f.cacheDir).some((filePath) =>
    path.basename(filePath).includes(metadata(currentBytes).sha256)));
});

test("invalid network bytes never become a trusted cache entry", async (t) => {
  let requests = 0;
  const f = await fixture(t, (_request, response) => {
    requests += 1;
    response.end(Buffer.alloc(trustedBytes.length, "x"));
  });
  fs.writeFileSync(f.destination, "previous valid artifact");
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await invoke("downloadPackage", [
      f.url, f.destination, metadata(trustedBytes), { cacheDir: f.cacheDir },
    ]);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /SHA256 mismatch/i);
    assert.equal(fs.readFileSync(f.destination, "utf8"), "previous valid artifact");
    assert.deepEqual(filesIn(f.cacheDir), []);
  }
  assert.equal(requests, 2);
});

test("package downloads also work without a durable cache", async (t) => {
  const f = await fixture(t, (_request, response) => response.end(trustedBytes));
  const result = await invoke("downloadPackage", [f.url, f.destination, metadata(trustedBytes)]);
  assert.equal(assertSuccessful(result).result, f.destination);
  assert.deepEqual(fs.readFileSync(f.destination), trustedBytes);
  assert.deepEqual(filesIn(f.root), [f.destination]);
});
