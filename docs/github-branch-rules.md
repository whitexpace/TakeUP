# GitHub branch protection rules

Apply these rules to both `main` and `dev` in GitHub Settings -> Branches -> Add branch protection rule.

- Require a pull request before merging
- Require approvals: 1 or 2
- Dismiss stale approvals when new commits are pushed
- Require conversation resolution
- Require status checks to pass before merging
- Require branches to be up to date before merging
- Block force pushes
- Do not allow bypassing the above settings (if available)

Suggested merge strategy:

- Prefer squash merge (cleaner sprint history)

Optional if your team is ready:

- Require signed commits

Required status checks (from CI workflow):

- `lint`
- `typecheck`
- `test`
