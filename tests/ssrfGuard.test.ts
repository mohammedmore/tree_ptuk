import test from "node:test";
import assert from "node:assert/strict";
import {
  isSafeOutboundUrl,
  assertSafeOutboundUrl,
  isAllowedPtukHost,
  isPrivateOrReservedIp,
} from "../server/utils/ssrfGuard.js";

test("ssrfGuard: correctly identifies allowed PTUK hosts", () => {
  assert.equal(isAllowedPtukHost("ptuk.edu.ps"), true);
  assert.equal(isAllowedPtukHost("edugate.ptuk.edu.ps"), true);
  assert.equal(isAllowedPtukHost("www.ptuk.edu.ps"), true);
  assert.equal(isAllowedPtukHost("sub.edugate.ptuk.edu.ps"), true);

  // Malicious variations
  assert.equal(isAllowedPtukHost("fakeptuk.edu.ps"), false);
  assert.equal(isAllowedPtukHost("ptuk.edu.ps.attacker.com"), false);
  assert.equal(isAllowedPtukHost("attacker.com"), false);
  assert.equal(isAllowedPtukHost("evil.com/ptuk.edu.ps"), false);
});

test("ssrfGuard: identifies private and reserved IP ranges", () => {
  assert.equal(isPrivateOrReservedIp("127.0.0.1"), true);
  assert.equal(isPrivateOrReservedIp("127.255.0.1"), true);
  assert.equal(isPrivateOrReservedIp("10.0.0.1"), true);
  assert.equal(isPrivateOrReservedIp("172.16.0.5"), true);
  assert.equal(isPrivateOrReservedIp("172.31.255.255"), true);
  assert.equal(isPrivateOrReservedIp("192.168.1.1"), true);
  assert.equal(isPrivateOrReservedIp("169.254.169.254"), true); // AWS/GCP metadata
  assert.equal(isPrivateOrReservedIp("::1"), true);

  // Public IP
  assert.equal(isPrivateOrReservedIp("8.8.8.8"), false);
});

test("ssrfGuard: blocks dangerous non-HTTP protocols", () => {
  const fileCheck = isSafeOutboundUrl("file:///etc/passwd");
  assert.equal(fileCheck.safe, false);

  const gopherCheck = isSafeOutboundUrl("gopher://127.0.0.1:6379/_");
  assert.equal(gopherCheck.safe, false);

  const jsCheck = isSafeOutboundUrl("javascript:alert(1)");
  assert.equal(jsCheck.safe, false);
});

test("ssrfGuard: blocks embedded credentials", () => {
  const check = isSafeOutboundUrl(
    "https://admin:secret@edugate.ptuk.edu.ps/login",
  );
  assert.equal(check.safe, false);
  assert.ok(check.reason?.includes("user:pass"));
});

test("ssrfGuard: accepts valid PTUK URLs", () => {
  const check = isSafeOutboundUrl(
    "https://edugate.ptuk.edu.ps/faces/ui/login.xhtml",
  );
  assert.equal(check.safe, true);
  assert.equal(check.url?.hostname, "edugate.ptuk.edu.ps");

  assert.doesNotThrow(() => {
    assertSafeOutboundUrl("https://ptuk.edu.ps/ar/studyFees");
  });
});

test("ssrfGuard: rejects localhost without dev flag and accepts with flag", () => {
  const checkNoDev = isSafeOutboundUrl("http://localhost:3000/api");
  assert.equal(checkNoDev.safe, false);

  const checkDev = isSafeOutboundUrl("http://localhost:3000/api", {
    allowLocalDev: true,
  });
  assert.equal(checkDev.safe, true);
});
