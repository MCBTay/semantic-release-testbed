This is a library that I'm building in order to be able to test out semantic release.  We need some history on the repo that isn't to convention to simulate adding this to an existing project

## What Problem Are We Trying to Solve?
Manually managing version numbers sucks.  It requires developers to coordinate and concern themselves with "what's the next version number?".  
semantic-release aims to automate all of that for us -- it can determine the version number, generate release no tes, and publish the package.

## Setup
- Install `semantic-release` as a dev dependency.
- Create a tag on the master branch indicating the version number -- without one, semantic release will assume we're starting at 1.0.0.
- Configure GitHub Settings
  - In General -> Pull Requests: Ensure Merge and Squash are allowed.  Ensure default commit message for both is set to PR title.
  - In Actions -> General -> Workflow Permissions: Workflows need read and write permissions.  Need to allow Github Actions to create and approve PRs.

## Two Main Branches Now
- main
- beta
  - arbitrarily named, it could be named anything.  beta and next are common options.
  - think of beta as our nnew working branch
  - when we're working in beta merging pull requests in, a pre-release will be created.  
    - the version number of the prerelease will be determined by semantic-release based onthe commit mesages (pr titles)
    - it will publish a pre-release to github releases
    - it will publish a release to the NPM registry that can be installed by using @beta.  it will not be marked as the latest release.
    - v1.3.0-beta.1, v1.3.0-beta.2, v1.3.0-beta.3, etc
  - doing this gives us the ability to still get a new build for every PR merge for testing purposes, while not actually incrementinng the package version and making a new verison
    available to our consumers.

## Commit Messages Are Important Now
- For us, what this really means is pull request titles.  We have a Github Action workflow now that will validate your PR title.
- Pull requests need to be set to use the PR title as the default commit message.  This is done in repo settings.
- Mergers need not modify the default commit message when merging.
- For validation, we enforce that you're using one of the [Angular Commit Convention](https://github.com/angular/angular/blob/main/contributing-docs/commit-message-guidelines.md) types and allow you to optionally provide a scope.  Failure to do so will fail this workflow and prevent merging.  We also check to see if you have a JIRA ticket in the title in the format of [JIRA-123].  This won't fail the workflow but will be a warning.

## Format
```
<type>(<scope>): [JIRA-####] <short summary>
  │       │           │             │
  │       │           │             └─⫸ Summary in present tense. Not capitalized. No period at the end.
  │       │           │
  │       │           └─⫸ JIRA ticket number.  Will throw warning if omitted.  Should be present on every ticket.
  │       │
  │       └─⫸ Optional Commit Scope: Must be wrapped in parenthesis and appears to be anything we want it to be.  I don't 
  │                                   foresee us using this very much.  Used in release note generation to group like items.
  │
  └─⫸ Commit Type: feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert
```

semantic-release uses commit messages to know what the next version number should be, or if there should be one at all.

### Type

Must be one of the following:

| Type         | Description                                                                                         | Generates Release |
|--------------|-----------------------------------------------------------------------------------------------------|-------------------|
| **build**    | Changes that affect the build system or external dependencies (example scopes: gulp, broccoli, npm) |        ❌         |
| **ci**       | Changes to our CI configuration files and scripts (examples: Github Actions, SauceLabs)             |        ❌         |
| **docs**     | Documentation only changes                                                                          |        ❌         |
| **feat**     | A new feature                                                                                       |        ✅ (Minor) |
| **fix**      | A bug fix                                                                                           |        ✅ (Patch) |
| **perf**     | A code change that improves performance                                                             |        ✅ (Patch) |
| **refactor** | A code change that neither fixes a bug nor adds a feature                                           |        ❌         |
| **test**     | Adding missing tests or correcting existing tests                                                   |        ❌         |


The `<type>` and `<summary>` fields are mandatory, the `(<scope>)` field is optional.

### Examples
| PR Title                                         | Pass/Fail/Warn | Description                          |
|--------------------------------------------------|----------------|--------------------------------------|
| `feat: [JIRA-1234] add new feature`              | ✅             | Passes, no warning                   |
| `fix(core): [JIRA-5678] fix bug in core module`  | ✅             | Passes, no warning                   |
| `docs(readme): [JIRA-9999] update documentation` | ✅             | Passes, no warning                   |
| `chore: [JIRA-1111] update dependencies`         | ✅             | Passes, no warning                   |
| `refactor(api): [JIRA-2222] refactor API layer`  | ✅             | Passes, no warning                   |
| `feat: add new feature`                          | ⚠️             | Passes, warning: missing JIRA ticket |
| `fix(core): fix bug in core module`              | ⚠️             | Passes, warning: missing JIRA ticket |
| `feature: [JIRA-1234] add new feature`           | ❌             | Fails: invalid type                  |
| `fix(core) [JIRA-5678] fix bug in core module`   | ❌             | Fails: missing colon                 |
| `docs[readme]: [JIRA-9999] update documentation` | ❌             | Fails: invalid scope format          |
| `chore [JIRA-1111] update dependencies`          | ❌             | Fails: missing colon                 |
| `refactor(api):`                                 | ❌             | Fails: no subject                    |
| `test: `                                         | ❌             | Fails: no subject                    |

### Workflows
We've got two different versions of workflows at this point:

#### Reusable workflows
- build.yml - Builds, lints, and tests the library.  Has an optional input to publish the artifact to the workflow run.
- release.yml - Utilizes semantic-release to release the library to Github
- create-beta-branch-and-pr.yml - Creates a beta branch and then opens a PR with an empty commit for it into main.  
- enforce-pr-title.yml - Enforces the PR title based on the convention described above.

#### Event triggered workflows
- ci.yml - Runs on pushes to main or beta.  Builds the library and then releases it.
- pull_request.yml - Runns on pull requests to main and beta.  Runs build.yml.

#### Developer Workflow
1. Create branch from origin/beta.
2. Do your work.
3. PR into beta.  Ensure PR title is correct.  Squash Commit to add one commit for your feature/fix/task to beta branch.  This creates a pre-release package based on your commit message.
4. PR beta into main.  Merge commit.  This creates a release package based on your commit message.
5. Once beta has been PR'd into main, beta will be deleted.  Because of this, we have an action to create beta branch and go ahead and create a new PR for beta in to main.