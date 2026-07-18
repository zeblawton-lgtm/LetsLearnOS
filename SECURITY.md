# Security policy

Please report suspected vulnerabilities privately through GitHub's security
advisory feature rather than a public issue. Do not include real API keys,
parent PINs, child/profile data, private addresses, or exploit logs containing
secrets in a report.

Supported security fixes target the latest `main` branch until versioned
release support is documented.

## Credential guidance

- Keep `OPENAI_API_KEY` in the backend `.env` or a server-side secret manager;
  inject `OPENAI_ACCESS_TOKEN` only from a trusted workload-identity flow.
- Never expose it through Vite variables, browser code, local storage, query
  strings, screenshots, or repository commits.
- Revoke a key immediately if exposure is suspected and inspect API usage.
- Use project-scoped credentials, spend limits, and file permissions appropriate
  to the deployment.

See `docs/security/security-report.md` for the kiosk threat model and current
controls.
