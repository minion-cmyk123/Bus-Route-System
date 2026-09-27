# Security

Do not put passwords, tokens, passenger data or exploit details in public issues. Use GitHub private vulnerability reporting if enabled by the repository owner; otherwise contact the maintainer through a private channel before disclosing sensitive details.

Supported branch: the latest release from `main`. Run `npm audit` and review automated dependency updates regularly. Automated checks are not a substitute for a security review.

Known product boundaries: no email verification, self-service account recovery, MFA or account deletion UI; per-process general rate limits; and no immutable/off-host audit log sink. These must be evaluated for the intended deployment.
