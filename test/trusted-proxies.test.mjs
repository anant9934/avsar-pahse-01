import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isPrivateSubnet,
  isLoopbackIp,
  isTrustedEdgeRequest,
  extractVerifiedClientIp,
} from "../src/lib/ratelimit/trusted-proxies.ts";
import { resolveRateLimitSubject } from "../src/lib/ratelimit/ip-resolver.ts";

describe("Trusted Proxy Validation & Campus NAT Mitigation", () => {
  describe("Subnet & IP Class Detection", () => {
    it("correctly identifies RFC 1918 private subnets", () => {
      assert.equal(isPrivateSubnet("10.0.0.1"), true);
      assert.equal(isPrivateSubnet("10.254.12.3"), true);
      assert.equal(isPrivateSubnet("172.16.0.5"), true);
      assert.equal(isPrivateSubnet("172.31.255.255"), true);
      assert.equal(isPrivateSubnet("192.168.1.100"), true);
      assert.equal(isPrivateSubnet("127.0.0.1"), true);
      assert.equal(isPrivateSubnet("::1"), true);
    });

    it("rejects public routable IPs from private classification", () => {
      assert.equal(isPrivateSubnet("8.8.8.8"), false);
      assert.equal(isPrivateSubnet("1.1.1.1"), false);
      assert.equal(isPrivateSubnet("142.250.190.46"), false);
      assert.equal(isPrivateSubnet("172.32.0.1"), false); // Outside /12
    });

    it("identifies loopback addresses", () => {
      assert.equal(isLoopbackIp("127.0.0.1"), true);
      assert.equal(isLoopbackIp("::1"), true);
      assert.equal(isLoopbackIp("localhost"), true);
      assert.equal(isLoopbackIp("192.168.1.1"), false);
    });
  });

  describe("Edge Proxy Header Verification", () => {
    it("recognizes Vercel edge proxy headers", () => {
      const headers = new Headers({
        "x-vercel-id": "iad1::iad1::abcd-1234",
        "x-vercel-forwarded-for": "203.0.113.195",
      });
      assert.equal(isTrustedEdgeRequest(headers), true);

      const resolved = extractVerifiedClientIp(headers);
      assert.equal(resolved.clientIp, "203.0.113.195");
      assert.equal(resolved.isTrustedEdge, true);
    });

    it("recognizes Cloudflare edge proxy headers", () => {
      const headers = new Headers({
        "cf-ray": "82a938c3e80-IAD",
        "cf-connecting-ip": "198.51.100.42",
      });
      assert.equal(isTrustedEdgeRequest(headers), true);

      const resolved = extractVerifiedClientIp(headers);
      assert.equal(resolved.clientIp, "198.51.100.42");
      assert.equal(resolved.isTrustedEdge, true);
    });

    it("extracts client IP from X-Forwarded-For chain defensively", () => {
      const headers = new Headers({
        "x-forwarded-for": "198.51.100.5, 10.0.0.1, 10.0.0.2",
      });
      const resolved = extractVerifiedClientIp(headers);
      assert.equal(resolved.clientIp, "198.51.100.5");
    });
  });

  describe("Campus NAT Mitigation", () => {
    it("scopes rate limits to candidateId when authenticated", () => {
      const request = {
        headers: new Headers({ "x-forwarded-for": "10.10.5.2" }),
      };
      const subject = resolveRateLimitSubject(request, "cand-student-42");

      assert.equal(subject.subject, "cand:cand-student-42");
      assert.equal(subject.type, "candidate");
      assert.equal(subject.isCampusNat, true);
    });

    it("falls back to IP scoping when anonymous", () => {
      const request = {
        headers: new Headers({ "x-forwarded-for": "203.0.113.50" }),
      };
      const subject = resolveRateLimitSubject(request, null);

      assert.equal(subject.subject, "ip:203.0.113.50");
      assert.equal(subject.type, "ip");
      assert.equal(subject.isCampusNat, false);
    });
  });
});
