This is a library that I'm building in order to be able to test out semantic release.  We need some history on the repo that isn't to convention to simulate adding this to an existing project

## What Problem Are We Trying to Solve?
Manually managing version numbers sucks.  It requires developers to coordinate and concern themselves with "what's the next version number?".  
semantic-release aims to automate all of that for us -- it can determine the version number, generate release notes, and publish the package.

## Setup
- Install `semantic-release` as a dev dependency.
- Create a tag on the `main` branch indicating the version number -- without one, semantic release will assume we're starting at 1.0.0.
    - We will manually release `v19.0.0` and then introduce `semantic-release`.  We will create a release by our standard process (bumping the package number in `package.json` and merging it to `main`).  Then we can introduce `semantic-release` and the workflows necessary to automate all of this.
    - (!) We should do this at a time where we don't have much work in flight, to limit friction (!)
- Configure GitHub Settings
  - In General -> Pull Requests: Ensure Merge and Squash are allowed.  Ensure default commit message for both is set to PR title.
  - In Actions -> General -> Workflow Permissions: Workflows need read and write permissions.  Need to allow Github Actions to create and approve PRs.
- Create `.releaserc` in library directory.  In this file, we define the branches that we care about in regards to semantic release.
  - For our configuration, we care about the default branch (`main`) and we have the `beta` branch defined as a pre-release branch. 

## Github Actions
We've got two different versions of workflows at this point.  Reusable workflows are workflows that are called by our event triggered workflows.  Below is a brief explanation of each of our workflow files.

### Reusable workflows
- `build.yml` - Builds, lints, and tests the library.  Has an optional input to publish the artifact to the workflow run.
- `release.yml` - Utilizes `semantic-release` to release the library to Github (when applicable).
- `create-beta-branch-and-pr.yml` - Checks for the presence of a `beta` branch.  If `beta` does not exist, creates a `beta` branch and then opens a PR with an empty commit for it into `main`.  Only runs if the workflow is called from the `main` branch.

### Event Triggered Workflows
- `ci.yml` - Runs on pushes to `main` or `beta`.  Builds the library and then releases it (when applicable).  For pushes to `main`, 
- `pull_request.yml` - Runs on pull requests to `main` and `beta`.  Uses `build.yml` and `security-scans.yml`.
- `enforce-pr-title.yml` - Runs on pull requests to `main` and `beta`.  Enforces the PR title based on the convention described above. 

## What happens when `semantic-release` runs?
1. Evaluates if all of the necessary tokens to authenticate to various services are present: NPM, Github, etc. 
1. Searches for the most recent version tag on the branch.  `semantic-release` will use this to figure out what the "next" version number should be.
1. Analyzes commits.  It will go over each new commit on the branch since the last tag it found and try to determine if a release is necessary, and if so, what type of release.  This is the reason that our commit messages are suddenly significant.
    - If commit message is of type `build`, `ci`, `docs`, `refactor`, or `test` -- `semantic-release` will determine that no release is necessary and will not create a release or package.
    - If commit message is of type `fix` or `perf` -- `semantic-release` will determine that a release is necessary and that it will be a patch release.  
        - For example, if the current version is `v1.2.3` and we run a release with `fix` or `perf` commits, it will increment the version number to `v1.2.4`.
        - Multiple of these commits in a single release **will not** continue to iterate the patch version.
    - If commit message is of type `feat` -- `semantic-release` will determine that a release is necessary and that it will be a minor release.
        - For example, if the current version is `v1.2.3` and we run a release with `feat` commits, it will increment the version number to `v1.3.0`.
        - Multiple of these commits in a single release **will not** continue to iterate the minor version.
    - In order to stay with the versioning scheme of the packages around us, we will be locking our major version to match the major version of Angular.  At the time of writing, that would be `v19.x.x`.  This is a bit of a deviation from traditional semantic versioning, but the only time we should instruct `semantic-release` that we've introduced a breaking change is when we're upgrading versions of Angular.  When we need to do that, we need to include the following in the commit body: `BREAKING CHANGE: <summary>`.  The format is stringent.  This will cause `semantic-release` to iterate the `major` version.  For example, `v19.x.x` -> `v20.x.x`.
1. After analyzing commits, there are two potential workflows:
    - If `semantic-release` determined that there should not be a release, then nothing else happens, and the job is marked as passed.
    - If `semantic-release` determined that there should be a release, it begins the release process:
        - **Determines the next release version number.**
            - For the main branch
            - For a pre-release branch
        - **Generates release notes.**
            - These will be used on the Github Release that is created as a part of this process.  Uses the commit message types (and scopes) to organize the release notes.
        - **Creates git tag.**
          - These tags can be used to create release branches from if needed.  We may find ourselves in a future where we need to support multiple versions of Angular.  By tagging the repo with every release, we can easily create a maintenance branch for a particular version if we needed to simultaneously support Angular 19 and Angular 20, for example.
        - **Publishes the NPM package.**
            - Regardless of branch, the package will be published using the version number determined above.
            - For the `main` branch, it will publish the package with the `latest` tag.  
                - Consumers of the library will be able to access this release normally by using `npm i package`.
            - For a pre-release branch, it will be published with the appropriate tag (`beta` in our usecase).  
                - Consumers of the library can install this version by specifying `npm i package@beta` or with a specific version number `npm i package@2.0.0-beta.2`.  As we work on the `beta` branch, it will increment the number after the tag.
        - **Creates a Github Release.**
            - Regardless of branch, the release will be published with the generated changelog.
            - Regardless of branch, the release will use the git tag created above.
            - For the `main` branch, the release will be marked as `latest`.
            - For a pre-release branch, the release will be marked as `pre-release`.
        - **Enriches pull requests and issues.**
            - Will add labels to pull requests to indicate which distribution channel that work was released on.  For example, will add a label of `released` for a pull request released on the `main` branch and a label of `released on @beta` for a pull request released on the `beta` branch.  A pull request that has been released on both (like most ultimately should be) will end up with both labels.
            - Will add comments to pull requests to indicate when it has been included in a release and what version it was included in.
            - Will add comments and labels to Github Issues as well that are mentioned in the release notes.  We don't use Github Issues so this hasn't been tested in our workflow much.
        - If all of the above completes successfully, the job is marked as passed.

## Pull Requests
The way we use pull requests will need to change a little bit in order to integrate `semantic-release` into our workflow.

### Multiple Long Running Branches
Traditionally we've only had a single long running branch -- `main`/`master` or the default branch.  In order for us to be able to generate builds as each piece of work that gets merged, but not necessarily update the public package each time, we'll need to maintain multiple branches.

- `main`
    - This is our default branch.
    - We will regularly merge `beta` into `main` to create releases.  This may be done on a sprint interval or completely ad-hoc.
        - Generally speaking, we should try to wait until we have features `completed` before we merge `beta` into `main`.  The whole point of this is to prevent public updates of the package from happening all the time while allowing us to still generate packages that we can use during development.
- `beta`
    - This has been arbitrarily named.  It could be named whatever we like.  `beta` and `next` are common choices.
    - We can think of `beta` as the branch we want to open our PRs against.  Of course there are always exceptions, but as a rule of thumb we want to create our local branches from `origin/beta` and open our pull requests into `beta`.

There's also nothing saying we can't have multiple of these.  

### Creating a Pull Request
For the most part, creating a pull request is largely the same as what we've always done. 

#### PR Titles Are Important and Enforced Now
`semantic-release` depends entirely on commit messages in order to derive when and what to create.  Since our long running branches are protected by branch protection rules and cannot be committed to directly, what this ultimately means to us is that we need to be stringent about our pull request titles.  The format that we will be following and that `semantic-release` depends on are the [Angular Commit Message Conventions](https://github.com/angular/angular/blob/main/contributing-docs/commit-message-guidelines.md).

Github settings have been updated such that default merge/squash commit messages are the PR titles.  By doing this, we can validate our pull request title with a Github Action to ensure the proper format.  Then, when a developer goes to merge the PR, whether squash or merge, the commit will default to the PR title which will be well formed.


##### PR Title Format
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

##### `<type>`
`<type>` is required and is the primary driver in how `semantic-release` determines what the next version number should be.  `<type>` is expected to be one of the following:

| Type       | Description                                                                                         | Generates Release |
|------------|-----------------------------------------------------------------------------------------------------|-------------------|
| `build`    | Changes that affect the build system or external dependencies (example scopes: gulp, broccoli, npm) |        ❌         |
| `ci`       | Changes to our CI configuration files and scripts (examples: Github Actions, SauceLabs)             |        ❌         |
| `docs`     | Documentation only changes                                                                          |        ❌         |
| `feat`     | A new feature                                                                                       |        ✅ (Minor) |
| `fix`      | A bug fix                                                                                           |        ✅ (Patch) |
| `perf`     | A code change that improves performance                                                             |        ✅ (Patch) |
| `refactor` | A code change that neither fixes a bug nor adds a feature                                           |        ❌         |
| `test`     | Adding missing tests or correcting existing tests                                                   |        ❌         |

##### `(scope)`
`(scope)` is an optional field that we can use in PR titles to help group work items together.  `(scope)` has no bearing on the version number and seems to only be used to group like items in the generated changelog.

##### `[JIRA-####]`
Ideally each PR title should contain a JIRA number.  Our PR title workflow will check for the existence of a JIRA number in the title.  If it does not exist, the workflow will throw a warning but will still pass.  The thought here being that we will likely not have a JIRA number for every single merge -- like a recurring merge of `beta` into `main`.  

##### `<short summary>`
Each PR title should have a short summary providing a succinct description of the change.  The Angular team recommends:
- use the imperative, present tense: "change" not "changed" nor "changes"
- don't capitalize the first letter
- no dot (`.`) at the end

##### PR Title Examples
This table shows examples of various pull request tiles and how our PR title validation workflow will evaluate them.
| PR Title                                         | Status         | Description                  |
|--------------------------------------------------|----------------|------------------------------|
| `feat: [JIRA-1234] add new feature`              | ✅             | no warning                   |
| `fix(core): [JIRA-5678] fix bug in core module`  | ✅             | no warning                   |
| `docs(readme): [JIRA-9999] update documentation` | ✅             | no warning                   |
| `chore: [JIRA-1111] update dependencies`         | ✅             | no warning                   |
| `refactor(api): [JIRA-2222] refactor API layer`  | ✅             | no warning                   |
| `feat: add new feature`                          | ⚠️             | warning: missing JIRA ticket |
| `fix(core): fix bug in core module`              | ⚠️             | warning: missing JIRA ticket |
| `feature: [JIRA-1234] add new feature`           | ❌             | invalid type                 |
| `fix(core) [JIRA-5678] fix bug in core module`   | ❌             | missing colon                |
| `docs[readme]: [JIRA-9999] update documentation` | ❌             | invalid scope format         |
| `chore [JIRA-1111] update dependencies`          | ❌             | missing colon                |
| `refactor(api):`                                 | ❌             | no subject                   |
| `test: `                                         | ❌             | no subject                   |

### Merging a Pull Request
Traditionally we've squashed every single PR merge into `main`.  We did this typically to keep our `main` history clean.  This is something we'll need to slightly change in order to integrate `semantic-release` into our workflow.

#### Merging a Working Branch Into `beta`
We'll be merging most of our work into the `beta` branch.  Often times, because we'll be merging our working development branches into `beta`, there will (potentially) be a large number of commits in these branches.  Because of that **we want to squash commits that are merging into `beta` as a rule of thumb**.  This will keep our `beta` branch history clean.  With our convention for pull request titles (and the enforcement of it via Github Actions), all commits onto `beta` should strictly follow the commit convention.  By doing so, `semantic-release` will be able to properly analyze these commits and generate appropriate pre-releases.

#### Merging a Working Branch Into `main`
There may be instances where we'll want to merge a working branch into `main`.  For example, there may be work in flight on `beta` that we aren't ready to merge into `main`, but we need a bug fix to go into `main` before that.  In situations like this, **we want to squash commits that are merging into `main` from a working branch as a rule of thumb**.  By doing this and following our PR title convention, this will ensure `semantic-release` will be able to properly analyze these commits and generate appropriate releases.
(!) NOTE: Merging a working branch into main will put the `beta` branch out of date.  Because of this, we should enforce that anytime this needs to happen that `beta` is merged from `origin/main` after. (!)

#### Merging `beta` Into `main`
Most of the time, we'll be merging `beta` into `main`.  This will be our standard operating flow to include multiple pieces of work into a single package update.  If we have followed our PR title convention, and squashed each merge into the `beta` branch, the `beta` branch will contain properly formatted commit messages.  Because of this, **we want to merge commits into `main` as a rule of thumb**.  By merging these commits, our `main` history contains each of the commits from the `beta` branch and `semantic-release` will be able to properly generate release notes and create the release.

#### Developer Workflow
1. Create branch from origin/beta.
2. Do your work.
3. PR into beta.  Ensure PR title is correct.  Squash Commit to add one commit for your feature/fix/task to beta branch.  This creates a pre-release package based on your commit message.
4. PR beta into main.  Merge commit.  This creates a release package based on your commit message.
5. Once beta has been PR'd into main, beta will be deleted.  Because of this, we have an action to create beta branch and go ahead and create a new PR for beta in to main.