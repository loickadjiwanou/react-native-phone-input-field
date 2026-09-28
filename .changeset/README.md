# Changesets

Every pull request that changes the published package adds a changeset:

```sh
yarn changeset
```

Pick the bump (patch / minor / major) and describe the change for users. On `main`, the release workflow opens a "Version packages" PR that updates `CHANGELOG.md` and the version; merging it publishes to npm.
