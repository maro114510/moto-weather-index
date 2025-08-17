# Security Policy

## Supported Versions

The following versions of Moto Weather Index API are currently supported with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via:

1. **Email**: Send details to [maro114510@example.com] with the subject line "Security Vulnerability Report"
2. **GitHub Security Advisory**: Use GitHub's private vulnerability reporting feature

### What to Include

When reporting a vulnerability, please include:

- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact assessment
- Any suggested fixes (optional)
- Your contact information for follow-up

### Response Timeline

- **Initial Response**: Within 48 hours of report
- **Assessment**: Within 5 business days
- **Fix Timeline**: Varies by severity
  - Critical: 24-72 hours
  - High: 1-2 weeks
  - Medium: 2-4 weeks
  - Low: Next regular release

## Security Best Practices

### For Users

1. **Environment Variables**: Never commit secrets to version control
   - Use proper secret management for `BATCH_SECRET`
   - Rotate secrets regularly

2. **Access Control**: 
   - Limit access to batch endpoints using HMAC authentication
   - Monitor API usage patterns

3. **Network Security**:
   - Use HTTPS in production
   - Implement proper CORS policies
   - Consider rate limiting

### For Contributors

1. **Code Security**:
   - Follow secure coding practices
   - Validate all inputs using Zod schemas
   - Never log sensitive information

2. **Dependencies**:
   - Keep dependencies updated
   - Review security advisories
   - Use automated dependency scanning

3. **Authentication**:
   - Use cryptographically secure HMAC-SHA256
   - Implement proper timestamp validation
   - Follow principle of least privilege

## Security Features

### Current Implementation

- **Input Validation**: All API inputs validated with Zod schemas
- **HMAC Authentication**: Batch endpoints protected with HMAC-SHA256
- **Error Handling**: Secure error responses without information disclosure
- **Dependency Management**: Automated updates via Dependabot
- **CORS Protection**: Configurable CORS middleware

### Planned Enhancements

- [ ] Rate limiting implementation
- [ ] Request size limits
- [ ] Enhanced logging for security events
- [ ] Automated security scanning in CI/CD

## Compliance

This project follows:

- **OWASP Security Guidelines**
- **Cloudflare Workers Security Best Practices**
- **Node.js Security Recommendations**

## Security Contacts

- **Primary Contact**: maro114510 (GitHub: @maro114510)
- **Security Team**: Currently maintained by individual contributor

## Acknowledgments

We appreciate responsible disclosure of security vulnerabilities. Contributors who report valid security issues will be:

- Credited in release notes (unless they prefer to remain anonymous)
- Added to security acknowledgments
- Considered for future collaboration opportunities

---

Last updated: 2025-08-17