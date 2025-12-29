# Security Policy

## Supported Versions

We release patches for security vulnerabilities for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

**DO NOT** create a public GitHub issue for security vulnerabilities.

Instead, please email us at **security@adverant.ai** with:

1. **Description**: A clear description of the vulnerability
2. **Impact**: What could an attacker do with this vulnerability?
3. **Reproduction Steps**: Detailed steps to reproduce the issue
4. **Affected Versions**: Which versions are affected?
5. **Possible Fix**: If you have suggestions for how to fix it

### What to Expect

1. **Acknowledgment**: We will acknowledge receipt within 48 hours
2. **Initial Assessment**: We'll provide an initial assessment within 7 days
3. **Updates**: We'll keep you informed of our progress
4. **Resolution**: We aim to resolve critical vulnerabilities within 30 days
5. **Disclosure**: We'll coordinate public disclosure timing with you

### Safe Harbor

We support responsible security research. We will not take legal action against researchers who:

- Make a good faith effort to avoid privacy violations, data destruction, or service interruption
- Report vulnerabilities directly to us before any public disclosure
- Give us reasonable time to address the issue
- Do not exploit the vulnerability beyond what is necessary to demonstrate it

## Security Best Practices

When using this plugin:

### API Keys
- Never commit API keys to version control
- Use environment variables for sensitive configuration
- Rotate keys periodically
- Use the minimum required permissions

### Network Security
- Use HTTPS for all communications
- Validate and sanitize all inputs
- Implement rate limiting
- Monitor for suspicious activity

### Data Handling
- Encrypt sensitive data at rest
- Use secure transmission protocols
- Follow data retention policies
- Implement proper access controls

## Security Updates

Security updates are released as:

- **Critical**: Within 24-48 hours
- **High**: Within 7 days
- **Medium**: Within 30 days
- **Low**: Next scheduled release

Subscribe to our security mailing list for notifications:
https://adverant.ai/security-updates

## Acknowledgments

We thank the following researchers for responsible disclosure:

- *Your name could be here!*

## Contact

- **Security Issues**: security@adverant.ai
- **General Support**: support@adverant.ai
- **PGP Key**: Available at https://adverant.ai/.well-known/security.txt
