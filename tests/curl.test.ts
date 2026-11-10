import { describe, it, expect } from 'vitest';
import {
  parseCurl,
  toFetch,
  toPython,
  diffHeaders,
} from '@/lib/curl/parser';

describe('cURL Parser & Code Generator', () => {
  describe('parseCurl', () => {
    it('parses a simple GET request', () => {
      const curl = 'curl https://api.example.com/users';
      const parsed = parseCurl(curl);
      expect(parsed.method).toBe('GET');
      expect(parsed.url).toBe('https://api.example.com/users');
    });

    it('parses POST request with headers and body', () => {
      const curl = `curl -X POST https://api.example.com/users \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer token123' \\
  -d '{"name":"John","age":30}'`;
      const parsed = parseCurl(curl);
      expect(parsed.method).toBe('POST');
      expect(parsed.url).toBe('https://api.example.com/users');
      expect(parsed.headers['Content-Type']).toBe('application/json');
      expect(parsed.headers['Authorization']).toBe('Bearer token123');
      expect(parsed.body).toBe('{"name":"John","age":30}');
    });

    it('parses PUT, DELETE, and PATCH methods with --request flag', () => {
      expect(parseCurl('curl --request PUT https://api.example.com/items/1').method).toBe('PUT');
      expect(parseCurl('curl -X DELETE https://api.example.com/items/1').method).toBe('DELETE');
      expect(parseCurl('curl --request PATCH https://api.example.com/items/1').method).toBe('PATCH');
    });

    it('parses data from --data-raw and --data-binary', () => {
      const raw = `curl -X POST https://api.example.com/data --data-raw '{"test":"val"}'`;
      expect(parseCurl(raw).body).toBe('{"test":"val"}');

      const bin = `curl -X POST https://api.example.com/data --data-binary '{"bin":"val"}'`;
      expect(parseCurl(bin).body).toBe('{"bin":"val"}');
    });

    it('defaults method to POST when data is present without explicit method', () => {
      const curl = `curl https://api.example.com/users -d '{"data":"test"}'`;
      const parsed = parseCurl(curl);
      expect(parsed.method).toBe('POST');
    });

    it('parses URL without scheme by prefixing https://', () => {
      const curl = 'curl api.example.com/status';
      const parsed = parseCurl(curl);
      expect(parsed.url).toBe('https://api.example.com/status');
    });

    it('extracts query parameters into queryParams dictionary', () => {
      const curl = 'curl "https://api.example.com/users?page=2&limit=50&active=true"';
      const parsed = parseCurl(curl);
      expect(parsed.queryParams.page).toBe('2');
      expect(parsed.queryParams.limit).toBe('50');
      expect(parsed.queryParams.active).toBe('true');
    });

    it('handles empty input gracefully', () => {
      const parsed = parseCurl('');
      expect(parsed.method).toBe('GET');
      expect(parsed.url).toBe('');
      expect(parsed.headers).toEqual({});
    });
  });

  describe('toFetch & toPython code generation', () => {
    it('generates JavaScript fetch snippet', () => {
      const parsed = parseCurl("curl -X POST https://api.example.com/login -H 'Content-Type: application/json' -d '{\"user\":\"admin\"}'");
      const code = toFetch(parsed);
      expect(code).toContain("await fetch('https://api.example.com/login'");
      expect(code).toContain('"method": "POST"');
      expect(code).toContain('"Content-Type": "application/json"');
    });

    it('generates Python requests snippet', () => {
      const parsed = parseCurl("curl -X POST https://api.example.com/login -H 'Content-Type: application/json' -d '{\"user\":\"admin\"}'");
      const code = toPython(parsed);
      expect(code).toContain('import requests');
      expect(code).toContain("requests.post('https://api.example.com/login'");
      expect(code).toContain('headers=headers');
    });
  });

  describe('diffHeaders', () => {
    it('identifies identical and modified headers across two requests', () => {
      const a = { 'Content-Type': 'application/json', 'Authorization': 'Bearer 1' };
      const b = { 'Content-Type': 'application/json', 'Authorization': 'Bearer 2', 'X-Custom': 'val' };

      const diff = diffHeaders(a, b);
      const ct = diff.find((d) => d.key === 'Content-Type');
      const auth = diff.find((d) => d.key === 'Authorization');
      const custom = diff.find((d) => d.key === 'X-Custom');

      expect(ct?.status).toBe('same');
      expect(auth?.status).toBe('diff');
      expect(custom?.status).toBe('right');
    });
  });
});

