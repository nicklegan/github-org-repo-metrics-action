const { repoQuery, teamRepoQuery, repoDetailsQuery, issueDetailsQuery, pullRequestDetailsQuery } = require('./src/graphql')
const core = require('@actions/core')
const github = require('@actions/github')
const { GitHub } = require('@actions/github/lib/utils')
const { createAppAuth } = require('@octokit/auth-app')
const { orderBy } = require('natural-orderby')
const { stringify } = require('csv-stringify/sync')
const eventPayload = require(process.env.GITHUB_EVENT_PATH)
const { owner, repo } = github.context.repo

const appId = core.getInput('appid', { required: false })
const privateKey = core.getInput('privatekey', { required: false })
const installationId = core.getInput('installationid', { required: false })

const token = core.getInput('token', { required: false })
const org = core.getInput('org', { required: false }) || eventPayload.organization.login
const team = core.getInput('team', { required: false }) || ''
const days = core.getInput('days', { required: false }) || '30'
const fromdate = core.getInput('fromdate', { required: false }) || ''
const todate = core.getInput('todate', { required: false }) || ''
const stale = core.getInput('fromdate', { required: false }) || '14'
const old = core.getInput('todate', { required: false }) || '120'
const sortColumn = core.getInput('sort', { required: false }) || 'openedPullRequests'
const sortOrder = core.getInput('sort-order', { required: false }) || 'desc'
const jsonExport = core.getInput('json', { required: false }) || 'false'
const diffReport = core.getInput('diff-report', { required: false }) || 'false'
const committerName = core.getInput('committer-name', { required: false }) || 'github-actions'
const committerEmail = core.getInput('committer-email', { required: false }) || 'github-actions@github.com'

let octokit
let startDate
let endDate
let columnDate
let fileDate
let logDate

// GitHub App authentication
if (appId && privateKey && installationId) {
  octokit = new GitHub({
    authStrategy: createAppAuth,
    auth: {
      appId: appId,
      privateKey: privateKey,
      installationId: installationId
    }
  })
} else {
  octokit = github.getOctokit(token)
}

const regex = '([0-9]{4}-[0-9]{2}-[0-9]{2})'
const flags = 'i'
const re = new RegExp(regex, flags)

if (re.test(fromdate, todate) !== true) {
  endDate = new Date()
  startDate = new Date()
  startDate.setDate(endDate.getDate() - days)
  columnDate = `<${days} days`
  fileDate = `${days}-days`
  logDate = `${days} days`
} else {
  endDate = new Date(todate)
  startDate = new Date(fromdate)
  columnDate = `${startDate.toISOString().substr(0, 10)} to ${endDate.toISOString().substr(0, 10)}`
  fileDate = `${startDate.toISOString().substr(0, 10)}-to-${endDate.toISOString().substr(0, 10)}`
  logDate = columnDate
}

// Orchestrator
;(async () => {
  try {
    let repoArray = []
    let queryArray = []
    let processArray = []
    if (team) {
      await getTeamRepos(repoArray)
    } else {
      await getRepos(repoArray)
    }
    await queryGitHub(repoArray, queryArray)
    processRepo(queryArray, processArray)
    await pushCSV(processArray)
    if (jsonExport === 'true') {
      await json(processArray)
    }
  } catch (error) {
    core.setFailed(JSON.stringify(error))
  }
})()

// Converts milliseconds to days
function millisecondsToDays(milliseconds) {
  return milliseconds / 1000 / 60 / 60 / 24
}

//Converts a decimal to a percent.
function toPercent(number) {
  return Math.round(number * 100) + '%'
}

//Sums the contents of a list.
function sumList(list) {
  return list.reduce((a, b) => a + b, 0)
}

//Averages the contents of a list.
function averageList(list) {
  if (list.length == 0) {
    return 'N/A'
  }
  return Math.round(sumList(list) / list.length)
}

// Concatenates a list of lists into one shallow list.
function concatenateLists(lists) {
  return lists.reduce((list1, list2) => list1.concat(list2), [])
}

// Calculates the union of a group of Sets.
function unionSets(...iterables) {
  const set = new Set()

  for (let iterable of iterables) {
    for (let item of iterable) {
      set.add(item)
    }
  }

  return set
}

// Calculates the number of items in the union of a list of sets.
function unionSetSize(sets) {
  return sets.reduce((set1, set2) => unionSets(set1, set2), new Set()).size
}

// Calculates the total star count for a repository.
function getStarCount(repo) {
  return repo.repository.stargazers.totalCount
}

// Calculates the total watch count for a repository.
function getWatchCount(repo) {
  return repo.repository.watchers.totalCount
}

// Calculates the total fork count for a repository.
function getForkCount(repo) {
  return repo.repository.forks.totalCount
}

// Calculates the total issue count for a repository.
function getIssueCount(repo) {
  return repo.repository.issues.totalCount
}

// Calculates the total pull request count for a repository.
function getPullRequestCount(repo) {
  return repo.repository.pullRequests.totalCount
}

// Determines if an authorAssociation indicates the author is internal
function authorIsInternal(authorAssociation) {
  return authorAssociation === 'CONTRIBUTOR' || authorAssociation === 'OWNER' || authorAssociation === 'MEMBER' || authorAssociation === 'FIRST_TIMER' || authorAssociation === 'FIRST_TIME_CONTRIBUTOR'
}

// Determines if an authorAssociation indicates the author is external
function authorIsExternal(authorAssociation) {
  return authorAssociation === 'COLLABORATOR' || authorAssociation === 'NONE'
}

// Determines if an authorAssociation indicates the author is a first time contributor
function authorIsFirstTimeContributor(authorAssociation) {
  return authorAssociation === 'FIRST_TIMER' || authorAssociation === 'FIRST_TIME_CONTRIBUTOR'
}

// Query all organization repository names
async function getRepos(repoArray) {
  try {
    let paginationRepo = null
    let hasNextPageRepo = false
    let dataJSON = null

    console.log(`Retrieving metrics for all repos in org ${org}`)

    do {
      dataJSON = await octokit.graphql({
        query: repoQuery,
        owner: org,
        cursorID: paginationRepo
      })

      const repos = dataJSON.organization.repositories.nodes.map((repo) => repo.name)

      hasNextPageRepo = dataJSON.organization.repositories.pageInfo.hasNextPage

      for (const repo of repos) {
        if (hasNextPageRepo) {
          paginationRepo = dataJSON.organization.repositories.pageInfo.endCursor
        } else {
          paginationRepo = null
        }
        repoArray.push(repo)
      }
    } while (hasNextPageRepo)
  } catch (error) {
    core.setFailed(JSON.stringify(error))
  }
}

// Query all organization repos for a team
async function getTeamRepos(repoArray) {
  try {
    let paginationRepo = null
    let hasNextPageRepo = false
    let dataJSON = null

    console.log(`Retrieving metrics for team ${team} in org ${org}`)

    do {
      dataJSON = await octokit.graphql({
        query: teamRepoQuery,
        owner: org,
        team: team,
        cursorID: paginationRepo
      })

      const repos = dataJSON.organization.team.repositories.nodes.map((repo) => repo.name)

      hasNextPageRepo = dataJSON.organization.team.repositories.pageInfo.hasNextPage

      for (const repo of repos) {
        if (hasNextPageRepo) {
          paginationRepo = dataJSON.organization.team.repositories.pageInfo.endCursor
        }
        repoArray.push(repo)
      }
    } while (hasNextPageRepo)
  } catch (error) {
    core.setFailed(JSON.stringify(error))
  }
}

// Queries the GitHub API for information about a specific repo and returns the resulting data.
async function queryGitHub(repoArray, queryArray) {
  try {
    for (const repoName of repoArray) {
      const dataJSON = await octokit.graphql({
        query: repoDetailsQuery,
        owner: org,
        repo: repoName
      })

      if (dataJSON.repository.issues.pageInfo.hasNextPage) {
        // If the repo has more than 20 issues, get the rest of the issues
        let issues = await queryIssuesDeep(repoName, dataJSON.repository.issues.pageInfo.endCursor, dataJSON.repository.issues.nodes)
        dataJSON.repository.issues.nodes = issues
      }

      // If the repo has more than 20 pull requests, get the rest of the pull requests
      if (dataJSON.repository.pullRequests.pageInfo.hasNextPage) {
        let pullRequests = await queryPullRequestsDeep(repoName, dataJSON.repository.pullRequests.pageInfo.endCursor, dataJSON.repository.pullRequests.nodes)
        dataJSON.repository.pullRequests.nodes = pullRequests
      }
      queryArray.push(dataJSON)
      console.log(`${dataJSON.repository.name} (Rate limit: ${dataJSON.rateLimit.remaining})`)
    }
  } catch (error) {
    core.setFailed(JSON.stringify(error))
  }
}

// Recursively queries GitHub API for 20 additional issues until all of the issues have been retrieved.
async function queryIssuesDeep(repoName, cursor, issues) {
  try {
    // Request the additional issues
    const dataJSON = await octokit.graphql({
      query: issueDetailsQuery,
      owner: org,
      repo: repoName,
      cursor: cursor
    })

    // Push the new issues to the running issue list
    dataJSON.repository.issues.nodes.forEach((issue) => {
      issues.push(issue)
    })

    // Recurse if there are still more issues
    if (dataJSON.repository.issues.pageInfo.hasNextPage) {
      return await queryIssuesDeep(repoName, dataJSON.repository.issues.pageInfo.endCursor, issues)
    }
    return issues
  } catch (error) {
    core.setFailed(JSON.stringify(error))
  }
}

// Recursively queries GitHub API for 20 additional pull requests until all of the pull requests have been retrieved.
async function queryPullRequestsDeep(repoName, cursor, pullRequests) {
  try {
    // Request the additional pull requests
    const dataJSON = await octokit.graphql({
      query: pullRequestDetailsQuery,
      owner: org,
      repo: repoName,
      cursor: cursor
    })

    // Push the new pull requests to the running pull requests list
    dataJSON.repository.pullRequests.nodes.forEach((pullRequest) => {
      pullRequests.push(pullRequest)
    })

    // Recurse if there are still more pull requests
    if (dataJSON.repository.pullRequests.pageInfo.hasNextPage) {
      return await queryPullRequestsDeep(repoName, dataJSON.repository.pullRequests.pageInfo.endCursor, pullRequests)
    }
    return pullRequests
  } catch (error) {
    core.setFailed(JSON.stringify(error))
  }
}

// Calculates issue meta deta for a repo (e.g. number of open issues)
function getIssueMetaData(repo) {
  // Set up
  let internalIssues = 0
  let externalIssues = 0
  let openIssues = 0
  let staleIssues = 0
  let oldIssues = 0
  let closedByPullRequestIssues = 0
  let closedIssuesTotal = 0
  let openedIssues = 0
  let openedIssuesInternal = 0
  let openedIssuesExternal = 0
  let openedIssuesFirstTimeContributor = 0
  let closedIssues = 0
  let openTimes = []
  let contributorsListAllTime = new Set()
  let contributorsListAllTimeInternal = new Set()
  let contributorsListAllTimeExternal = new Set()
  let contributorsListThisPeriod = new Set()
  let contributorsListThisPeriodInternal = new Set()
  let contributorsListThisPeriodExternal = new Set()
  let contributorsListThisPeriodFirstTimeContributor = new Set()

  // Iterate through each issue of the repo
  if (repo != null) {
    repo.repository.issues.nodes.forEach(function (issue) {
      if (issue.author != null) {
        // Add contributor to all time contributors list
        contributorsListAllTime.add(issue.author.login)

        // Add contributor to all time internal/external contributor list
        if (authorIsInternal(issue.authorAssociation)) {
          contributorsListAllTimeInternal.add(issue.author.login)
          internalIssues += 1
        }
        if (authorIsExternal(issue.authorAssociation)) {
          contributorsListAllTimeExternal.add(issue.author.login)
          externalIssues += 1
        }
      }
      // Calculate the time created for use later on
      let timeCreated = new Date(issue.createdAt)

      if (issue.state === 'OPEN') {
        openIssues += 1
        let timelineEvents = issue.timelineItems.nodes
        let lastTimelineEvent = timelineEvents[timelineEvents.length - 1]
        // Last event is either the last event in the timeline or the creation of the issue
        let lastEventDate = lastTimelineEvent ? lastTimelineEvent.createdAt : issue.createdAt
        lastEventDate = new Date(lastEventDate)

        // Determine if issue is stale (no activity for default >14 days)
        if (millisecondsToDays(Date.now() - lastEventDate) > stale) {
          staleIssues += 1
        }

        // Determine if issue is old (open for default >120 days)
        if (millisecondsToDays(Date.now() - timeCreated) > old) {
          oldIssues += 1
        }
      }

      // Check if issue was created during the time period specified
      if (timeCreated > startDate && timeCreated < endDate) {
        openedIssues += 1

        // Add contributor to this period's contributors list
        contributorsListThisPeriod.add(issue.author.login)

        // Add contributor to this period's internal/external/first time contributor list
        if (authorIsInternal(issue.authorAssociation)) {
          openedIssuesInternal += 1
          contributorsListThisPeriodInternal.add(issue.author.login)
        }
        if (authorIsExternal(issue.authorAssociation)) {
          openedIssuesExternal += 1
          contributorsListThisPeriodExternal.add(issue.author.login)
        }
        if (authorIsFirstTimeContributor(issue.authorAssociation)) {
          openedIssuesFirstTimeContributor += 1
          contributorsListThisPeriodFirstTimeContributor.add(issue.author.login)
        }
      }

      if (issue.closedAt) {
        closedIssuesTotal += 1

        let timeClosed = new Date(issue.closedAt)

        // Check if issue was closed during the time period specified
        if (timeClosed > startDate && timeClosed < endDate) {
          closedIssues += 1
        }

        // Calculate time open in days
        let timeOpen = millisecondsToDays(timeClosed - timeCreated)
        openTimes.push(timeOpen)

        // Use this in case there are multiple closed events - uses the last one to determine if the issue was closed by PR
        let closedByPullRequest = false
        issue.timelineItems.nodes.forEach(function (timelineItem) {
          if (timelineItem.__typename === 'ClosedEvent') {
            if (timelineItem.closer && timelineItem.closer.__typename === 'PullRequest') {
              closedByPullRequest = true
            }
          }
        })
        if (closedByPullRequest) {
          closedByPullRequestIssues += 1
        }
      }
    })
  }
  return {
    internalIssues: internalIssues,
    externalIssues: externalIssues,
    openIssues: openIssues,
    staleIssues: staleIssues,
    oldIssues: oldIssues,
    closedByPullRequestIssues: closedByPullRequestIssues,
    closedIssuesTotal: closedIssuesTotal,
    openedIssues: openedIssues,
    openedIssuesInternal: openedIssuesInternal,
    openedIssuesExternal: openedIssuesExternal,
    openedIssuesFirstTimeContributor: openedIssuesFirstTimeContributor,
    closedIssues: closedIssues,
    openTimes: openTimes,
    contributorsListAllTime: contributorsListAllTime,
    contributorsListAllTimeInternal: contributorsListAllTimeInternal,
    contributorsListAllTimeExternal: contributorsListAllTimeExternal,
    contributorsListThisPeriod: contributorsListThisPeriod,
    contributorsListThisPeriodInternal: contributorsListThisPeriodInternal,
    contributorsListThisPeriodExternal: contributorsListThisPeriodExternal,
    contributorsListThisPeriodFirstTimeContributor: contributorsListThisPeriodFirstTimeContributor
  }
}

// Calculates pull request meta data for a repo (e.g. number of open pull requests)
function getPullRequestMetaData(repo) {
  // Set up
  let internalPullRequests = 0
  let externalPullRequests = 0
  let openPullRequests = 0
  let mergedPullRequestsAllTime = 0
  let closedPullRequestsAllTime = 0
  let openedPullRequests = 0
  let openedPullRequestsInternal = 0
  let openedPullRequestsExternal = 0
  let openedPullRequestsFirstTimeContributor = 0
  let mergedPullRequests = 0
  let closedPullRequests = 0
  let openTimes = []
  let openTimesInterval = []
  let contributorsListAllTime = new Set()
  let contributorsListAllTimeInternal = new Set()
  let contributorsListAllTimeExternal = new Set()
  let contributorsListThisPeriod = new Set()
  let contributorsListThisPeriodInternal = new Set()
  let contributorsListThisPeriodExternal = new Set()
  let contributorsListThisPeriodFirstTimeContributor = new Set()

  // Iterate through each pull request of the repo
  if (repo != null) {
    repo.repository.pullRequests.nodes.forEach(function (pullRequest) {
      // Add contributor to all time contributors list
      if (pullRequest.author != null) {
        contributorsListAllTime.add(pullRequest.author.login)

        // Add contributor to all time internal/external contributor list
        if (authorIsInternal(pullRequest.authorAssociation)) {
          contributorsListAllTimeInternal.add(pullRequest.author.login)
          internalPullRequests += 1
        }
        if (authorIsExternal(pullRequest.authorAssociation)) {
          contributorsListAllTimeExternal.add(pullRequest.author.login)
          externalPullRequests += 1
        }

        // Calculate the time created for use later on
        let timeCreated = new Date(pullRequest.createdAt)

        if (pullRequest.state === 'OPEN') {
          openPullRequests += 1
        }

        // Total number of merged pull requests of all time
        if (pullRequest.state === 'MERGED') {
          mergedPullRequestsAllTime += 1
        }

        // Total number of closed pull requests of all time
        if (pullRequest.state === 'CLOSED') {
          closedPullRequestsAllTime += 1
        }

        // Check if pull request was created during the time period specified
        if (timeCreated > startDate && timeCreated < endDate) {
          openedPullRequests += 1

          // Add contributor to this period's contributors list
          contributorsListThisPeriod.add(pullRequest.author.login)

          // Add contributor to this period's internal/external/first time contributor list
          if (authorIsInternal(pullRequest.authorAssociation)) {
            openedPullRequestsInternal += 1
            contributorsListThisPeriodInternal.add(pullRequest.author.login)
          }
          if (authorIsExternal(pullRequest.authorAssociation)) {
            openedPullRequestsExternal += 1
            contributorsListThisPeriodExternal.add(pullRequest.author.login)
          }
          if (authorIsFirstTimeContributor(pullRequest.authorAssociation)) {
            openedPullRequestsFirstTimeContributor += 1
            contributorsListThisPeriodFirstTimeContributor.add(pullRequest.author.login)
          }
        }

        // Check if pull request was merged during the time period specified
        if (pullRequest.mergedAt && pullRequest.state === 'MERGED') {
          let timeMerged = new Date(pullRequest.mergedAt)
          if (timeMerged > startDate && timeMerged < endDate) {
            mergedPullRequests += 1
            let timeOpenInterval = millisecondsToDays(timeMerged - startDate)
            openTimesInterval.push(timeOpenInterval)
          }
          // Calculate time open in days
          let timeOpen = millisecondsToDays(timeMerged - timeCreated)
          openTimes.push(timeOpen)
        }

        // Check if pull request was closed during the time period specified
        if (pullRequest.closedAt && pullRequest.state === 'CLOSED') {
          let timeClosed = new Date(pullRequest.closedAt)
          if (timeClosed > startDate && timeClosed < endDate) {
            closedPullRequests += 1
          }
        }
      }
    })
  }
  return {
    internalPullRequests: internalPullRequests,
    externalPullRequests: externalPullRequests,
    openPullRequests: openPullRequests,
    mergedPullRequestsAllTime: mergedPullRequestsAllTime,
    closedPullRequestsAllTime: closedPullRequestsAllTime,
    openedPullRequests: openedPullRequests,
    openedPullRequestsInternal: openedPullRequestsInternal,
    openedPullRequestsExternal: openedPullRequestsExternal,
    openedPullRequestsFirstTimeContributor: openedPullRequestsFirstTimeContributor,
    mergedPullRequests: mergedPullRequests,
    closedPullRequests: closedPullRequests,
    openTimes: openTimes,
    openTimesInterval: openTimesInterval,
    contributorsListAllTime: contributorsListAllTime,
    contributorsListAllTimeInternal: contributorsListAllTimeInternal,
    contributorsListAllTimeExternal: contributorsListAllTimeExternal,
    contributorsListThisPeriod: contributorsListThisPeriod,
    contributorsListThisPeriodInternal: contributorsListThisPeriodInternal,
    contributorsListThisPeriodExternal: contributorsListThisPeriodExternal,
    contributorsListThisPeriodFirstTimeContributor: contributorsListThisPeriodFirstTimeContributor
  }
}

// Processes the raw repo data from GitHub by calculating the relevant metrics and returning a JSON of these metrics for the CSV/JSON report.
function processRepo(queryArray, processArray) {
  queryArray.map((repo) => {
    // Set up
    let issueMetaData = getIssueMetaData(repo)
    let pullRequestMetaData = getPullRequestMetaData(repo)
    let contributorsListAllTime = unionSets(issueMetaData.contributorsListAllTime, pullRequestMetaData.contributorsListAllTime)
    let contributorsListAllTimeInternal = unionSets(issueMetaData.contributorsListAllTimeInternal, pullRequestMetaData.contributorsListAllTimeInternal)
    let contributorsListAllTimeExternal = unionSets(issueMetaData.contributorsListAllTimeExternal, pullRequestMetaData.contributorsListAllTimeExternal)
    let contributorsListThisPeriod = unionSets(issueMetaData.contributorsListThisPeriod, pullRequestMetaData.contributorsListThisPeriod)
    let contributorsListThisPeriodInternal = unionSets(issueMetaData.contributorsListThisPeriodInternal, pullRequestMetaData.contributorsListThisPeriodInternal)
    let contributorsListThisPeriodExternal = unionSets(issueMetaData.contributorsListThisPeriodExternal, pullRequestMetaData.contributorsListThisPeriodExternal)
    let contributorsListThisPeriodFirstTimeContributor = unionSets(issueMetaData.contributorsListThisPeriodFirstTimeContributor, pullRequestMetaData.contributorsListThisPeriodFirstTimeContributor)

    // Make JSON of processed data
    if (repo != null) {
      let repoData = {
        repo: repo.repository.name,

        // These metrics are for the entire time since the repository has existed
        stars: getStarCount(repo),
        watches: getWatchCount(repo),
        forks: getForkCount(repo),
        issues: getIssueCount(repo),
        internalIssues: issueMetaData.internalIssues,
        externalIssues: issueMetaData.externalIssues,
        openIssues: issueMetaData.openIssues,
        staleIssues: issueMetaData.staleIssues,
        percentStaleIssues: issueMetaData.openIssues === 0 ? 'N/A' : toPercent(issueMetaData.staleIssues / issueMetaData.openIssues),
        oldIssues: issueMetaData.oldIssues,
        percentOldIssues: issueMetaData.openIssues === 0 ? 'N/A' : toPercent(issueMetaData.oldIssues / issueMetaData.openIssues),
        percentIssuesClosedByPullRequest: issueMetaData.closedIssuesTotal === 0 ? 'N/A' : toPercent(issueMetaData.closedByPullRequestIssues / issueMetaData.closedIssuesTotal),
        averageIssueOpenTime: averageList(issueMetaData.openTimes),
        pullRequests: getPullRequestCount(repo),
        internalPullRequests: pullRequestMetaData.internalPullRequests,
        externalPullRequests: pullRequestMetaData.externalPullRequests,
        openPullRequests: pullRequestMetaData.openPullRequests,
        mergedPullRequestsAllTime: pullRequestMetaData.mergedPullRequestsAllTime,
        closedPullRequestsAllTime: pullRequestMetaData.closedPullRequestsAllTime,
        averagePullRequestMergeTime: averageList(pullRequestMetaData.openTimes),
        averagePullRequestMergeTimeInterval: averageList(pullRequestMetaData.openTimesInterval),
        contributorsAllTime: contributorsListAllTime.size,
        contributorsAllTimeInternal: contributorsListAllTimeInternal.size,
        contributorsAllTimeExternal: contributorsListAllTimeExternal.size,

        // These lists are included in repoData (but not the final CSV/JSON report) to help with aggregation
        issueOpenTimes: issueMetaData.openTimes,
        closedByPullRequestIssues: issueMetaData.closedByPullRequestIssues,
        closedIssuesTotal: issueMetaData.closedIssuesTotal,
        pullRequestOpenTimes: pullRequestMetaData.openTimes,
        pullRequestOpenTimesInterval: pullRequestMetaData.openTimesInterval,
        contributorsListAllTime: contributorsListAllTime,
        contributorsListAllTimeInternal: contributorsListAllTimeInternal,
        contributorsListAllTimeExternal: contributorsListAllTimeExternal,
        contributorsListThisPeriod: contributorsListThisPeriod,
        contributorsListThisPeriodInternal: contributorsListThisPeriodInternal,
        contributorsListThisPeriodExternal: contributorsListThisPeriodExternal,
        contributorsListThisPeriodFirstTimeContributor: contributorsListThisPeriodFirstTimeContributor,

        // These metrics are for the time period provided through workflow inputs
        openedIssues: issueMetaData.openedIssues,
        openedIssuesInternal: issueMetaData.openedIssuesInternal,
        openedIssuesExternal: issueMetaData.openedIssuesExternal,
        openedIssuesFirstTimeContributor: issueMetaData.openedIssuesFirstTimeContributor,
        closedIssues: issueMetaData.closedIssues,
        openedPullRequests: pullRequestMetaData.openedPullRequests,
        openedPullRequestsInternal: pullRequestMetaData.openedPullRequestsInternal,
        openedPullRequestsExternal: pullRequestMetaData.openedPullRequestsExternal,
        openedPullRequestsFirstTimeContributor: pullRequestMetaData.openedPullRequestsFirstTimeContributor,
        mergedPullRequests: pullRequestMetaData.mergedPullRequests,
        closedPullRequests: pullRequestMetaData.closedPullRequests,
        contributorsThisPeriod: contributorsListThisPeriod.size,
        contributorsThisPeriodInternal: contributorsListThisPeriodInternal.size,
        contributorsThisPeriodExternal: contributorsListThisPeriodExternal.size,
        contributorsThisPeriodFirstTimeContributor: contributorsListThisPeriodFirstTimeContributor.size
      }
      processArray.push(repoData)
    }
  })
}

// Aggregate data across all of the processed repos
function aggregateRepoData(repos) {
  // Set up
  let openIssues = sumList(repos.map((repo) => repo.openIssues))
  let staleIssues = sumList(repos.map((repo) => repo.staleIssues))
  let oldIssues = sumList(repos.map((repo) => repo.oldIssues))

  // Make JSON of aggregate processed data
  let totalData = {
    repo: 'TOTAL',

    // These metrics are for the time period provided through workflow inputs
    openedPullRequests: sumList(repos.map((repo) => repo.openedPullRequests)),
    openedPullRequestsInternal: sumList(repos.map((repo) => repo.openedPullRequestsInternal)),
    openedPullRequestsExternal: sumList(repos.map((repo) => repo.openedPullRequestsExternal)),
    openedPullRequestsFirstTimeContributor: sumList(repos.map((repo) => repo.openedPullRequestsFirstTimeContributor)),
    mergedPullRequests: sumList(repos.map((repo) => repo.mergedPullRequests)),
    averagePullRequestMergeTimeInterval: averageList(concatenateLists(repos.map((repo) => repo.pullRequestOpenTimesInterval))),
    closedPullRequests: sumList(repos.map((repo) => repo.closedPullRequests)),

    // These metrics are for the entire time since the repository has existed
    openPullRequests: sumList(repos.map((repo) => repo.openPullRequests)),
    mergedPullRequestsAllTime: sumList(repos.map((repo) => repo.mergedPullRequestsAllTime)),
    closedPullRequestsAllTime: sumList(repos.map((repo) => repo.closedPullRequestsAllTime)),
    averagePullRequestMergeTime: averageList(concatenateLists(repos.map((repo) => repo.pullRequestOpenTimes))),
    pullRequests: sumList(repos.map((repo) => repo.pullRequests)),
    internalPullRequests: sumList(repos.map((repo) => repo.internalPullRequests)),
    externalPullRequests: sumList(repos.map((repo) => repo.externalPullRequests)),

    // These metrics are for the time period provided through workflow inputs
    openedIssues: sumList(repos.map((repo) => repo.openedIssues)),
    openedIssuesInternal: sumList(repos.map((repo) => repo.openedIssuesInternal)),
    openedIssuesExternal: sumList(repos.map((repo) => repo.openedIssuesExternal)),
    openedIssuesFirstTimeContributor: sumList(repos.map((repo) => repo.openedIssuesFirstTimeContributor)),
    closedIssues: sumList(repos.map((repo) => repo.closedIssues)),

    // These metrics are for the entire time since the repository has existed
    issues: sumList(repos.map((repo) => repo.issues)),
    internalIssues: sumList(repos.map((repo) => repo.internalIssues)),
    externalIssues: sumList(repos.map((repo) => repo.externalIssues)),
    openIssues: openIssues,
    staleIssues: staleIssues,
    percentStaleIssues: toPercent(staleIssues / openIssues),
    oldIssues: oldIssues,
    percentOldIssues: toPercent(oldIssues / openIssues),
    percentIssuesClosedByPullRequest: toPercent(sumList(repos.map((repo) => repo.closedByPullRequestIssues)) / sumList(repos.map((repo) => repo.closedIssuesTotal))),
    averageIssueOpenTime: averageList(concatenateLists(repos.map((repo) => repo.issueOpenTimes))),

    // These metrics are for the time period provided through workflow inputs
    contributorsThisPeriod: unionSetSize(repos.map((repo) => repo.contributorsListThisPeriod)),
    contributorsThisPeriodInternal: unionSetSize(repos.map((repo) => repo.contributorsListThisPeriodInternal)),
    contributorsThisPeriodExternal: unionSetSize(repos.map((repo) => repo.contributorsListThisPeriodExternal)),
    contributorsThisPeriodFirstTimeContributor: unionSetSize(repos.map((repo) => repo.contributorsListThisPeriodFirstTimeContributor)),

    // These metrics are for the entire time since the repository has existed
    contributorsAllTime: unionSetSize(repos.map((repo) => repo.contributorsListAllTime)),
    contributorsAllTimeInternal: unionSetSize(repos.map((repo) => repo.contributorsListAllTimeInternal)),
    contributorsAllTimeExternal: unionSetSize(repos.map((repo) => repo.contributorsListAllTimeExternal)),

    // These metrics are for the entire time since the repository has existed
    stars: sumList(repos.map((repo) => repo.stars)),
    watches: sumList(repos.map((repo) => repo.watches)),
    forks: sumList(repos.map((repo) => repo.forks))
  }
  return totalData
}

// Writes the data for each repo as well as repos combined into a CSV/JSON report in the reports folder.
async function pushCSV(data) {
  try {
    // Set sorting settings and add header to array
    const columns = {
      repo: 'Repo Name',

      // These metrics are for the time period provided through workflow inputs
      openedPullRequests: `PRs Opened (${columnDate})`,
      openedPullRequestsInternal: `PRs Opened Int (${columnDate})`,
      openedPullRequestsExternal: `PRs Opened Ext (${columnDate})`,
      openedPullRequestsFirstTimeContributor: `PRs Opened FTC (${columnDate})`,
      mergedPullRequests: `PRs Merged (${columnDate})`,
      averagePullRequestMergeTimeInterval: `PR turnaround time (${columnDate})`,
      closedPullRequests: `PRs Closed (${columnDate})`,

      // These metrics are for the entire time since the repository has existed
      openPullRequests: 'PRs Open (all time)',
      mergedPullRequestsAllTime: 'PRs Merged (all time)',
      closedPullRequestsAllTime: 'PRs Closed (all time)',
      averagePullRequestMergeTime: 'PR turnaround time (all time)',
      pullRequests: 'Total PRs (all time)',
      internalPullRequests: 'Total PRs Int (all time)',
      externalPullRequests: 'Total PRs Ext (all time)',

      // These metrics are for the time period provided through workflow inputs
      openedIssues: `Issues Opened (${columnDate})`,
      openedIssuesInternal: `Issues Opened Int (${columnDate})`,
      openedIssuesExternal: `Issues Opened Ext (${columnDate})`,
      openedIssuesFirstTimeContributor: `Issues Opened FTC (${columnDate})`,
      closedIssues: `Issues Closed (${columnDate})`,

      // These metrics are for the entire time since the repository has existed
      issues: 'Total Issues (all time)',
      internalIssues: 'Total Issues Int (all time)',
      externalIssues: 'Total Issues Ext (all time)',
      openIssues: 'Open Issues (all time)',
      staleIssues: `Stale Issues (>${stale})`,
      percentStaleIssues: '% Stale Issues (all time)',
      oldIssues: `Old Issues (>${old})`,
      percentOldIssues: '% Old Issues (all time)',
      percentIssuesClosedByPullRequest: '% Issues Closed by PR (all time)',
      averageIssueOpenTime: 'Average Issue open days (all time)',

      // These metrics are for the time period provided through workflow inputs
      contributorsThisPeriod: `Contributors (${columnDate})`,
      contributorsThisPeriodInternal: `Contributors Int (${columnDate})`,
      contributorsThisPeriodExternal: `Contributors Ext (${columnDate})`,
      contributorsThisPeriodFirstTimeContributor: `Contributors FTC (${columnDate})`,

      // These metrics are for the entire time since the repository has existed
      contributorsAllTime: 'Contributors (all time)',
      contributorsAllTimeInternal: 'Contributors Int (all time)',
      contributorsAllTimeExternal: 'Contributors Ext (all time)',

      // These metrics are for the entire time since the repository has existed
      stars: 'Stars (all time)',
      watches: 'Watches (all time)',
      forks: 'Forks (all time)'
    }

    const sortArray = orderBy(data, [sortColumn], [sortOrder])
    sortArray.push(aggregateRepoData(data))
    const csv = stringify(sortArray, {
      header: true,
      columns: columns
    })

    // Prepare path/filename, repo/org context and commit name/email variables
    let reportPath
    const teamSuffix = team ? `-${team}` : ''
    if (diffReport === 'true') {
      reportPath = { path: `reports/${org}${teamSuffix}-repo-metrics-report-${fileDate}.csv` }
    } else {
      reportPath = { path: `reports/${org}${teamSuffix}-${new Date().toISOString().substring(0, 19).replace(/:/g, '-') + 'Z'}-${fileDate}.csv` }
    }

    const opts = {
      owner,
      repo,
      path: reportPath,
      message: `${new Date().toISOString().slice(0, 10)} organization metrics report`,
      content: Buffer.from(csv).toString('base64'),
      committer: {
        name: committerName,
        email: committerEmail
      }
    }

    // try to get the sha, if the file already exists
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner,
        repo,
        ...reportPath
      })

      if (data && data.sha) {
        reportPath.sha = data.sha
      }
    } catch (err) {}

    console.log(`Pushing CSV report to repository path: ${reportPath.path}`)

    await octokit.rest.repos.createOrUpdateFileContents({
      ...opts,
      ...reportPath
    })
  } catch (error) {
    core.setFailed(JSON.stringify(error))
  }
}

// Create and push optional JSON report
async function json(data) {
  try {
    const jsonData = data.map((repo) => {
      return {
        repo: repo.repo,

        // These metrics are for the time period provided through workflow inputs
        openedPullRequests: repo.openedPullRequests,
        openedPullRequestsInternal: repo.openedPullRequestsInternal,
        openedPullRequestsExternal: repo.openedPullRequestsExternal,
        openedPullRequestsFirstTimeContributor: repo.openedPullRequestsFirstTimeContributor,
        mergedPullRequests: repo.mergedPullRequests,
        averagePullRequestMergeTimeInterval: repo.averagePullRequestMergeTimeInterval,
        closedPullRequests: repo.closedPullRequests,

        // These metrics are for the entire time since the repository has existed
        openPullRequests: repo.openPullRequests,
        mergedPullRequestsAllTime: repo.mergedPullRequestsAllTime,
        closedPullRequestsAllTime: repo.closedPullRequestsAllTime,
        averagePullRequestMergeTime: repo.averagePullRequestMergeTime,
        pullRequests: repo.pullRequests,
        internalPullRequests: repo.internalPullRequests,
        externalPullRequests: repo.externalPullRequests,

        // These metrics are for the time period provided through workflow inputs
        openedIssues: repo.openedIssues,
        openedIssuesInternal: repo.openedIssuesInternal,
        openedIssuesExternal: repo.openedIssuesExternal,
        openedIssuesFirstTimeContributor: repo.openedIssuesFirstTimeContributor,
        closedIssues: repo.closedIssues,

        // These metrics are for the entire time since the repository has existed
        issues: repo.issues,
        internalIssues: repo.internalIssues,
        externalIssues: repo.externalIssues,
        openIssues: repo.openIssues,
        staleIssues: repo.staleIssues,
        percentStaleIssues: repo.percentStaleIssues,
        oldIssues: repo.oldIssues,
        percentOldIssues: repo.percentOldIssues,
        percentIssuesClosedByPullRequest: repo.percentIssuesClosedByPullRequest,
        averageIssueOpenTime: repo.averageIssueOpenTime,

        // These metrics are for the time period provided through workflow inputs
        contributorsThisPeriod: repo.contributorsThisPeriod,
        contributorsThisPeriodInternal: repo.contributorsThisPeriodInternal,
        contributorsThisPeriodExternal: repo.contributorsThisPeriodExternal,
        contributorsThisPeriodFirstTimeContributor: repo.contributorsThisPeriodFirstTimeContributor,

        // These metrics are for the entire time since the repository has existed
        contributorsAllTime: repo.contributorsAllTime,
        contributorsAllTimeInternal: repo.contributorsAllTimeInternal,
        contributorsAllTimeExternal: repo.contributorsAllTimeExternal,

        // These metrics are for the entire time since the repository has existed
        stars: repo.stars,
        watches: repo.watches,
        forks: repo.forks
      }
    })

    let reportPath
    const teamSuffix = team ? `-${team}` : ''
    const sortArray = orderBy(jsonData, [sortColumn], [sortOrder])
    sortArray.push(aggregateRepoData(data))
    if (diffReport === 'true') {
      reportPath = { path: `reports/${org}${teamSuffix}-repo-metrics-report-${fileDate}.json` }
    } else {
      reportPath = { path: `reports/${org}${teamSuffix}-${new Date().toISOString().substring(0, 19).replace(/:/g, '-') + 'Z'}-${fileDate}.json` }
    }

    const opts = {
      owner,
      repo,
      path: reportPath,
      message: `${new Date().toISOString().slice(0, 10)} organization metrics report`,
      content: Buffer.from(JSON.stringify(sortArray, null, 2)).toString('base64'),
      committer: {
        name: committerName,
        email: committerEmail
      }
    }

    // try to get the sha, if the file already exists
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner,
        repo,
        ...reportPath
      })

      if (data && data.sha) {
        reportPath.sha = data.sha
      }
    } catch (err) {}

    console.log(`Pushing JSON report to repository path: ${reportPath.path}`)

    await octokit.rest.repos.createOrUpdateFileContents({
      ...opts,
      ...reportPath
    })
  } catch (error) {
    core.setFailed(JSON.stringify(error))
  }
}
