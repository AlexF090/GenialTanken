// semantic-release runs after CI passed on `main` (.github/workflows/release.yml). The squash
// commit of a pull request carries its title, so the title decides the next version:
// `fix` → patch, `feat` → minor, `!` or a `BREAKING CHANGE` footer → major.
// The `${…}` placeholders are filled in by semantic-release, so they stay plain strings.
export default {
  branches: ['main'],
  plugins: [
    ['@semantic-release/commit-analyzer', { preset: 'conventionalcommits' }],
    ['@semantic-release/release-notes-generator', { preset: 'conventionalcommits' }],
    ['@semantic-release/changelog', { changelogFile: 'CHANGELOG.md' }],
    // No @semantic-release/npm: every package is private. The API reads its version from
    // apps/api/package.json, so every workspace package gets the release version.
    [
      '@semantic-release/exec',
      {
        prepareCmd:
          'pnpm --recursive --include-workspace-root exec pnpm pkg set version=${nextRelease.version}',
      },
    ],
    [
      '@semantic-release/git',
      {
        assets: [
          'CHANGELOG.md',
          'package.json',
          'apps/*/package.json',
          'packages/*/package.json',
          'e2e/package.json',
        ],
        // [skip ci]: the commit changes only versions and the changelog, so CI and the web deploy
        // are skipped for it.
        message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
    // Only "Contents" permission on RELEASE_TOKEN: no comments or labels on released pull
    // requests and no issue when a release fails (the failed workflow run shows it).
    [
      '@semantic-release/github',
      { successComment: false, failComment: false, releasedLabels: false },
    ],
  ],
};
