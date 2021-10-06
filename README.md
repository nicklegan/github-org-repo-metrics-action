# GitHub Organization Repository Metrics Action

> A GitHub Action to generate a report that contains various metrics for all repositories belonging to a GitHub organization.

## Usage

The example [workflow](https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions) below runs on a monthly [schedule](https://docs.github.com/en/actions/reference/events-that-trigger-workflows#scheduled-events) using the amount of days from today as the interval set in __action.yml__ (default 30 days) but can also be triggered manually using a [workflow_dispatch](https://docs.github.com/en/actions/reference/events-that-trigger-workflows#manual-events) with the same setting or using a historic interval as dispatch inputs.

```yml
name: Org Repo Metrics Report

on:
  schedule:
    # Runs on the first day of the month at 00:00 UTC
    #
    #        ┌────────────── minute
    #        │ ┌──────────── hour
    #        │ │ ┌────────── day (month)
    #        │ │ │ ┌──────── month
    #        │ │ │ │ ┌────── day (week)
    - cron: '0 0 1 * *'
  workflow_dispatch:
    inputs:
      fromdate:
        description: 'Optional interval start date (format: yyyy-mm-dd)'
        required: false # Skipped if workflow dispatch input is not provided
      todate:
        description: 'Optional interval end date (format: yyyy-mm-dd)'
        required: false # Skipped if workflow dispatch input is not provided

jobs:
  org-repo-metrics-report:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v2

      - name: Get organization repository metrics
        uses: nicklegan/github-org-repo-metrics-action@v1.0.2
        with:
          token: ${{ secrets.ORG_TOKEN }}
          fromdate: ${{ github.event.inputs.fromdate }} # Used for workflow dispatch input
          todate: ${{ github.event.inputs.todate }} # Used for workflow dispatch input
```

## GitHub secrets

| Name                 | Value                                              | Required |
| :------------------- | :------------------------------------------------- | :------- |
| `ORG_TOKEN`          | A `repo`, `read:org`scoped [Personal Access Token] | `true`   |
| `ACTIONS_STEP_DEBUG` | `true` [Enables diagnostic logging]                | `false`  |

[personal access token]: https://github.com/settings/tokens/new?scopes=repo,read:org&description=Org+Metrics+Action 'Personal Access Token'
[enables diagnostic logging]: https://docs.github.com/en/actions/managing-workflow-runs/enabling-debug-logging#enabling-runner-diagnostic-logging 'Enabling runner diagnostic logging'

:bulb: Disable [token expiration](https://github.blog/changelog/2021-07-26-expiration-options-for-personal-access-tokens/) to avoid failed workflow runs when running on a schedule.

## Action inputs

| Name              | Description                                                   | Default                     | Options                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Required |
| :---------------- | :------------------------------------------------------------ | :-------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- |
| `org`             | Organization different than workflow context                  |                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `false`  |
| `days`            | Amount of days in the past to collect data for                | `30`                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `false`  |
| `sort`            | Column used to sort the acquired metrics                      | `openedPullRequests`        | `openedPullRequests`, `openedPullRequestsInternal`, `openedPullRequestsExternal`, `openedPullRequestsFirstTimeContributor`, `mergedPullRequests`, `averagePullRequestMergeTimeInterval`, `closedPullRequests`, `openPullRequests`, `averagePullRequestMergeTime`, `pullRequests`, `internalPullRequests`, `externalPullRequests`, `openedIssues`, `openedIssuesInternal`, `openedIssuesExternal`, `openedIssuesFirstTimeContributor`, `closedIssues`, `issues`, `internalIssues`, `externalIssues`, `openIssues`, `staleIssues`, `percentStaleIssues`, `oldIssues`, `percentOldIssues`, `percentOldIssues`, `percentIssuesClosedByPullRequest`, `averageIssueOpenTime`, `contributorsThisPeriod`, `contributorsThisPeriodInternal`, `contributorsThisPeriodExternal`, `contributorsThisPeriodFirstTimeContributor`, `contributorsAllTime`, `contributorsAllTimeInternal`, `contributorsAllTimeExternal`, `stars`, `watches`, `forks` | `false`  |
| `committer-name`  | The name of the committer that will appear in the Git history | `github-actions`            |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `false`  |
| `committer-email` | The committer email that will appear in the Git history       | `github-actions@github.com` |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `false`  |
| `stale`           | Amount of days for an issue to be marked as stale             | `14`                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `false`  |
| `old`             | Amount of days for an issue to be marked as old               | `120`                       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `false`  |
| `fromdate`        | The date from which to start collecting data                  |                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `false`  |
| `todate`          | The date to which to stop collecting data                     |                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `false`  |

## Workflow dispatch inputs

The additional option to retrieve organization metrics using a custom date interval.
If the below fields are left empty during [workflow dispatch input](https://github.blog/changelog/2020-07-06-github-actions-manual-triggers-with-workflow_dispatch/), the default interval option of set days from the current date configured in `main.yml` will be used instead.

| Name                           | Value                                   | Required |
| :----------------------------- | :-------------------------------------- | :------- |
| `Optional interval start date` | A date matching the format `yyyy-mm-dd` | `false`  |
| `Optional interval end date`   | A date matching the format `yyyy-mm-dd` | `false`  |

## CSV layout

The results of all except the first column will be the sum or average of acquired metrics for the requested interval or all time per organization repository.
The last row of the report will contain the totals per column for all repositories combined.

| Column                             | Description                                                                                                                  |
| :--------------------------------- | :--------------------------------------------------------------------------------------------------------------------------- |
| Repo Name                          | An organization owned repository                                                                                             |
| PRs Opened (interval)              | Total number of pull requests created during a set interval                                                                  |
| PRs Opened Int (interval)          | Total number of pull requests created by an organization member during a set interval                                        |
| PRs Opened Ext (interval)          | Total number of pull requests created by an outside collaborator or an Action/App during a set interval                      |
| PRs Opened FTC (interval)          | Total number of pull requests created by a first time contributor during a set interval                                      |
| PRs Merged (interval)              | Total number of pull requests merged during a set interval                                                                   |
| PR turnaround time (interval)      | Average time in days from status open till merged for all pull requests merged during a set interval                         |
| PRs Closed (interval)              | Total number of pull requests closed during a set interval                                                                   |
| PRs Open (all time)                | Total number of open pull requests                                                                                           |
| PR turnaround time (all time)      | Average time in days from status open till merged for all pull requests merged                                               |
| Total PRs (all time)               | Total number of pull requests created                                                                                        |
| Total PRs Int (all time)           | Total number of pull requests created by an organization member                                                              |
| Total PRs Ext (all time)           | Total number of pull requests created by an outside collaborator or an Action/App                                            |
| Issues Opened (interval)           | Total number of issues opened during a set interval                                                                          |
| Issues Opened Int (interval)       | Total number of issues opened by an organization member during a set interval                                                |
| Issues Opened Ext (interval)       | Total number of issues opened by an outside collaborator or an Action/App during a set interval                              |
| Issues Opened FTC (interval)       | Total number of issues opened by by a first time contributor during a set interval                                           |
| Issues Closed (interval)           | Total number of issues closed during a set interval                                                                          |
| Total Issues (all time)            | Total number of issues opened                                                                                                |
| Total Issues Int (all time)        | Total number of issues opened by an organization member                                                                      |
| Total Issues Ext (all time)        | Total number of issues opened by an outside collaborator or an Action/App                                                    |
| Open Issues (all time)             | Total number of open issues                                                                                                  |
| Stale Issues                       | Number of issues without activity for a set number of days (default >14 days)                                                |
| % Stale Issues (all time)          | Percent of total issues which can be categorized as stale                                                                    |
| Old Issues                         | Number of issues which are open after a set number of days (default >120 days)                                               |
| % Old Issues (all time)            | Percent of total issues which can be categorized as old                                                                      |
| % Issues Closed by PR (all time)   | Percent of total issues closed by pull request                                                                               |
| Average Issue open days (all time) | Average number of days issues are open                                                                                       |
| Contributors (interval)            | Total number of users who created pull requests or opened issues during a set interval                                       |
| Contributors Int (interval)        | Total number of organization members who created pull requests or opened issues during a set interval                        |
| Contributors Ext (interval)        | Total number of outside collaborators or Actions/Apps who/which created pull requests or opened issues during a set interval |
| Contributors FTC (interval)        | Total number of first time collaborators who created pull requests or opened issues during a set interval                    |
| Contributors (all time)            | Total number of users who created pull requests or opened issues                                                             |
| Contributors Int (all time)        | Total number of organization members who created pull requests or opened issues                                              |
| Contributors Ext (all time)        | Total number of outside collaborators or Actions/Apps who/which created pull requests or opened issues                       |
| Stars (all time)                   | Total number of stargazers                                                                                                   |
| Watches (all time)                 | Total number of users watching                                                                                               |
| Forks (all time)                   | Total number of forks                                                                                                        |

A CSV report file to be saved in the repository __reports__ folder using the following naming format: __organization-reportdate-interval.csv__.

## GitHub App authentication

In some scenarios it might be preferred to authenthicate as a [GitHub App](https://docs.github.com/developers/apps/getting-started-with-apps/about-apps) rather than using a [personal access token](https://docs.github.com/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token).

The following features could be a benefit authenticating as a GitHub App installation:

- The GitHub App is directly installed on the organization, no separate user account is required.
- A GitHub App has more granular permissions than a personal access token.
- To avoid hitting the 5000 requests per hour GitHub API rate limit, [authenticating as a GitHub App installation](https://docs.github.com/developers/apps/building-github-apps/authenticating-with-github-apps#authenticating-as-an-installation) would increase the [API request limit](https://docs.github.com/developers/apps/building-github-apps/rate-limits-for-github-apps#github-enterprise-cloud-server-to-server-rate-limits).

The GitHub App authentication strategy can be integrated with the Octokit library by installing and configuring the [@octokit/auth-app](https://github.com/octokit/auth-app.js/#usage-with-octokit) npm module before [rebuilding](https://docs.github.com/actions/creating-actions/creating-a-javascript-action) the Action in a separate repository.
