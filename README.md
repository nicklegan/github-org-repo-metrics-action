# GitHub Organization Repository Metrics Report Action

> A GitHub Action to generate a report that contains various metrics for all repositories belonging to a GitHub organization.

## Usage

The example [workflow](https://docs.github.com/actions/reference/workflow-syntax-for-github-actions) below runs on a monthly [schedule](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule) using the amount of days counted from today set as the interval in the workflow (default 30 days) but can also be triggered manually using a [workflow_dispatch] input using a historic interval as dispatch inputs.

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
        uses: actions/checkout@v3

      - name: Get organization repository metrics
        uses: nicklegan/github-org-repo-metrics-action@v2.0.1
        with:
          token: ${{ secrets.ORG_TOKEN }}
          fromdate: ${{ github.event.inputs.fromdate }} # Used for workflow dispatch input
          todate: ${{ github.event.inputs.todate }} # Used for workflow dispatch input
        # org: ''
        # days: '30'
        # stale: '14'
        # old: '120'
        # sort: 'openedPullRequests'
        # sort-order: 'desc'
        # json: 'false'
        # diff-report: 'false'
        # appid: ${{ secrets.APPID }}
        # privatekey: ${{ secrets.PRIVATEKEY }}
        # installationid: ${{ secrets.INSTALLATIONID }}
```

## GitHub secrets

| Name                 | Value                                              | Required |
| :------------------- | :------------------------------------------------- | :------- |
| `ORG_TOKEN`          | A `repo`, `read:org`scoped [Personal Access Token] | `true`   |
| `ACTIONS_STEP_DEBUG` | `true` [Enables diagnostic logging]                | `false`  |

[personal access token]: https://github.com/settings/tokens/new?scopes=repo,read:org&description=Org+Metrics+Action 'Personal Access Token'
[enables diagnostic logging]: https://docs.github.com/actions/managing-workflow-runs/enabling-debug-logging#enabling-runner-diagnostic-logging 'Enabling runner diagnostic logging'

:bulb: Disable [token expiration](https://github.blog/changelog/2021-07-26-expiration-options-for-personal-access-tokens/) to avoid failed workflow runs when running on a schedule.

## Action inputs

| Name              | Description                                                             | Default                     | Location            | Required |
| :---------------- | :---------------------------------------------------------------------- | :-------------------------- | :------------------ | :------- |
| `org`             | Organization different than workflow context                            |                             | [workflow.yml]      | `false`  |
| `days`            | Amount of days in the past to collect data for                          | `30`                        | [workflow.yml]      | `false`  |
| `stale`           | Amount of days for an issue to be marked as stale                       | `14`                        | [workflow.yml]      | `false`  |
| `old`             | Amount of days for an issue to be marked as old                         | `120`                       | [workflow.yml]      | `false`  |
| `sort`            | Column used to sort the acquired metrics (select column in JSON format) | `openedPullRequests`        | [workflow.yml]      | `false`  |
| `sort-order`      | Sort order for the selected column                                      | `desc`                      | [workflow.yml]      | `false`  |
| `json`            | Additional report in JSON format                                        | `false`                     | [workflow.yml]      | `false`  |
| `diff-report`     | Use identical file name for future reports                              | `false`                     | [workflow.yml]      | `false`  |
| `committer-name`  | The name of the committer that will appear in the Git history           | `github-actions`            | [action.yml]        | `false`  |
| `committer-email` | The committer email that will appear in the Git history                 | `github-actions@github.com` | [action.yml]        | `false`  |
| `fromdate`        | The date from which to start collecting data                            |                             | [workflow_dispatch] | `false`  |
| `todate`          | The date to which to stop collecting data                               |                             | [workflow_dispatch] | `false`  |

[workflow.yml]: #Usage 'Usage'
[action.yml]: action.yml 'action.yml'
[workflow_dispatch]: https://docs.github.com/actions/using-workflows/events-that-trigger-workflows#workflow_dispatch

:bulb: JSON naming details used for sorting columns in the workflow file are specified below.

## Workflow dispatch inputs

The additional option to retrieve organization metrics using a custom date interval.
If the below fields are left empty during [workflow_dispatch] input, the default interval option of set days from the current date configured in `action.yml` will be used instead.

| Name                           | Value                                   | Required |
| :----------------------------- | :-------------------------------------- | :------- |
| `Optional interval start date` | A date matching the format `yyyy-mm-dd` | `false`  |
| `Optional interval end date`   | A date matching the format `yyyy-mm-dd` | `false`  |

## CSV / JSON layout

The results of all except the first column will be the sum or average of acquired metrics for the requested interval or all time per organization repository.
The last row of the report will contain the totals per column for all repositories combined.

| CSV columns                          | JSON layout                                  | Description                                                                                                                  |
| :----------------------------------- | :------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------- |
| `Repo Name`                          | `repo`                                       | Organization owned repositories                                                                                              |
| `PRs Opened (interval)`              | `openedPullRequests`                         | Total number of pull requests created during a set interval                                                                  |
| `PRs Opened Int (interval)`          | `openedPullRequestsInternal`                 | Total number of pull requests created by an organization member during a set interval                                        |
| `PRs Opened Ext (interval)`          | `openedPullRequestsExternal`                 | Total number of pull requests created by an outside collaborator or an Action/App during a set interval                      |
| `PRs Opened FTC (interval)`          | `openedPullRequestsFirstTimeContributor`     | Total number of pull requests created by a first time contributor during a set interval                                      |
| `PRs Merged (interval)`              | `mergedPullRequests`                         | Total number of pull requests merged during a set interval                                                                   |
| `PR turnaround time (interval)`      | `averagePullRequestMergeTimeInterval`        | Average time in days from status open till merged for all pull requests merged during a set interval                         |
| `PRs Closed (interval)`              | `closedPullRequests`                         | Total number of pull requests closed during a set interval                                                                   |
| `PRs Open (all time)`                | `openPullRequests`                           | Total number of open pull requests                                                                                           |
| `PR turnaround time (all time)`      | `averagePullRequestMergeTime`                | Average time in days from status open till merged for all pull requests merged                                               |
| `Total PRs (all time)`               | `pullRequests`                               | Total number of pull requests created                                                                                        |
| `Total PRs Int (all time)`           | `internalPullRequests`                       | Total number of pull requests created by an organization member                                                              |
| `Total PRs Ext (all time)`           | `externalPullRequests`                       | Total number of pull requests created by an outside collaborator or an Action/App                                            |
| `Issues Opened (interval)`           | `openedIssues`                               | Total number of issues opened during a set interval                                                                          |
| `Issues Opened Int (interval)`       | `openedIssuesInternal`                       | Total number of issues opened by an organization member during a set interval                                                |
| `Issues Opened Ext (interval)`       | `openedIssuesExternal`                       | Total number of issues opened by an outside collaborator or an Action/App during a set interval                              |
| `Issues Opened FTC (interval)`       | `openedIssuesFirstTimeContributor`           | Total number of issues opened by by a first time contributor during a set interval                                           |
| `Issues Closed (interval)`           | `closedIssues`                               | Total number of issues closed during a set interval                                                                          |
| `Total Issues (all time)`            | `issues`                                     | Total number of issues opened                                                                                                |
| `Total Issues Int (all time)`        | `internalIssues`                             | Total number of issues opened by an organization member                                                                      |
| `Total Issues Ext (all time)`        | `externalIssues`                             | Total number of issues opened by an outside collaborator or an Action/App                                                    |
| `Open Issues (all time)`             | `openIssues`                                 | Total number of open issues                                                                                                  |
| `Stale Issues`                       | `staleIssues`                                | Number of issues without activity for a set number of days (default >14 days)                                                |
| `% Stale Issues (all time)`          | `percentStaleIssues`                         | Percent of total issues which can be categorized as stale                                                                    |
| `Old Issues`                         | `oldIssues`                                  | Number of issues which are open after a set number of days (default >120 days)                                               |
| `% Old Issues (all time)`            | `percentOldIssues`                           | Percent of total issues which can be categorized as old                                                                      |
| `% Issues Closed by PR (all time)`   | `percentIssuesClosedByPullRequest`           | Percent of total issues closed by pull request                                                                               |
| `Average Issue open days (all time)` | `averageIssueOpenTime`                       | Average number of days issues are open                                                                                       |
| `Contributors (interval)`            | `contributorsThisPeriod`                     | Total number of users who created pull requests or opened issues during a set interval                                       |
| `Contributors Int (interval)`        | `contributorsThisPeriodInternal`             | Total number of organization members who created pull requests or opened issues during a set interval                        |
| `Contributors Ext (interval)`        | `contributorsThisPeriodExternal`             | Total number of outside collaborators or Actions/Apps who/which created pull requests or opened issues during a set interval |
| `Contributors FTC (interval)`        | `contributorsThisPeriodFirstTimeContributor` | Total number of first time collaborators who created pull requests or opened issues during a set interval                    |
| `Contributors (all time)`            | `contributorsAllTime`                        | Total number of users who created pull requests or opened issues                                                             |
| `Contributors Int (all time)`        | `contributorsAllTimeInternal`                | Total number of organization members who created pull requests or opened issues                                              |
| `Contributors Ext (all time)`        | `contributorsAllTimeExternal`                | Total number of outside collaborators or Actions/Apps who/which created pull requests or opened issues                       |
| `Stars (all time)`                   | `stars`                                      | Total number of stargazers                                                                                                   |
| `Watches (all time)`                 | `watches`                                    | Total number of users watching                                                                                               |
| `Forks (all time)`                   | `forks`                                      | Total number of forks                                                                                                        |

A CSV report file to be saved in the repository **reports** folder using the following naming format: **`organization`-`reportdate`-`interval`.csv**.

## GitHub App authentication

As an alternative you can use GitHub App authentication to generate the report.
For larger organizations it is recommended to use this method as more API requests per hour are allowed which will avoid running into [rate limit](https://docs.github.com/developers/apps/building-github-apps/rate-limits-for-github-apps) errors.

[Register](https://docs.github.com/developers/apps/building-github-apps/creating-a-github-app) a new organization/personal owned GitHub App with the below permissions:

| GitHub App Permission                     | Access           |
| :---------------------------------------- | :--------------- |
| `Repository Permissions:Contents`         | `read and write` |
| `Organization Permissions:Administration` | `read`           |

After registration [install the GitHub App](https://docs.github.com/developers/apps/managing-github-apps/installing-github-apps) on your organization. Store the below App values as secrets.

### GitHub App secrets

| Name             | Value                             | Required |
| :--------------- | :-------------------------------- | :------- |
| `APPID`          | GitHub App ID number              | `true`   |
| `PRIVATEKEY`     | Content of private key .pem file  | `true`   |
| `INSTALLATIONID` | GitHub App installation ID number | `true`   |
