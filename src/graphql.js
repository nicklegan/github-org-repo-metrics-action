const graphql = {
  repoQuery: /* GraphQL */ `
    query ($owner: String!, $cursorID: String) {
      organization(login: $owner) {
        repositories(first: 100, after: $cursorID) {
          nodes {
            name
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  `,
  // get rpositories for a team part of an organization
  teamRepoQuery: /* GraphQL */ `
    query ($owner: String!, $team: String!, $cursorID: String) {
      organization(login: $owner) {
        team(slug: $team) {
          repositories(first: 100, after: $cursorID) {
            nodes {
              name
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    }
  `,
  repoDetailsQuery: /* GraphQL */ `
    query GitHub($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        name
        issues(first: 20) {
          totalCount
          nodes {
            createdAt
            state
            closedAt
            author {
              login
            }
            authorAssociation
            timelineItems(last: 100) {
              nodes {
                __typename
                ... on AddedToProjectEvent {
                  createdAt
                }
                ... on AssignedEvent {
                  createdAt
                }
                ... on ClosedEvent {
                  createdAt
                  closer {
                    __typename
                    ... on PullRequest {
                      id
                    }
                    ... on Commit {
                      id
                    }
                  }
                }
                ... on CommentDeletedEvent {
                  createdAt
                }
                ... on ConvertedNoteToIssueEvent {
                  createdAt
                }
                ... on CrossReferencedEvent {
                  createdAt
                }
                ... on DemilestonedEvent {
                  createdAt
                }
                ... on IssueComment {
                  createdAt
                }
                ... on LabeledEvent {
                  createdAt
                }
                ... on LockedEvent {
                  createdAt
                }
                ... on MentionedEvent {
                  createdAt
                }
                ... on MilestonedEvent {
                  createdAt
                }
                ... on MovedColumnsInProjectEvent {
                  createdAt
                }
                ... on PinnedEvent {
                  createdAt
                }
                ... on ReferencedEvent {
                  createdAt
                }
                ... on RemovedFromProjectEvent {
                  createdAt
                }
                ... on RenamedTitleEvent {
                  createdAt
                }
                ... on ReopenedEvent {
                  createdAt
                }
                ... on SubscribedEvent {
                  createdAt
                }
                ... on TransferredEvent {
                  createdAt
                }
                ... on UnassignedEvent {
                  createdAt
                }
                ... on UnlabeledEvent {
                  createdAt
                }
                ... on UnlockedEvent {
                  createdAt
                }
                ... on UnpinnedEvent {
                  createdAt
                }
                ... on UnsubscribedEvent {
                  createdAt
                }
                ... on UserBlockedEvent {
                  createdAt
                }
              }
            }
          }
          pageInfo {
            startCursor
            hasNextPage
            endCursor
          }
        }
        pullRequests(first: 20) {
          totalCount
          nodes {
            createdAt
            state
            mergedAt
            closedAt
            author {
              login
            }
            authorAssociation
          }
          pageInfo {
            startCursor
            hasNextPage
            endCursor
          }
        }
        stargazers {
          totalCount
        }
        forks {
          totalCount
        }
        watchers {
          totalCount
        }
      }
      rateLimit {
        limit
        cost
        remaining
        resetAt
      }
    }
  `,
  issueDetailsQuery: /* GraphQL */ `
    query GitHub($owner: String!, $repo: String!, $cursor: String!) {
      repository(owner: $owner, name: $repo) {
        name
        issues(first: 20, after: $cursor) {
          totalCount
          nodes {
            createdAt
            state
            closedAt
            author {
              login
            }
            authorAssociation
            timelineItems(last: 100) {
              nodes {
                __typename
                ... on AddedToProjectEvent {
                  createdAt
                }
                ... on AssignedEvent {
                  createdAt
                }
                ... on ClosedEvent {
                  createdAt
                  closer {
                    __typename
                    ... on PullRequest {
                      id
                    }
                    ... on Commit {
                      id
                    }
                  }
                }
                ... on CommentDeletedEvent {
                  createdAt
                }
                ... on ConvertedNoteToIssueEvent {
                  createdAt
                }
                ... on CrossReferencedEvent {
                  createdAt
                }
                ... on DemilestonedEvent {
                  createdAt
                }
                ... on IssueComment {
                  createdAt
                }
                ... on LabeledEvent {
                  createdAt
                }
                ... on LockedEvent {
                  createdAt
                }
                ... on MentionedEvent {
                  createdAt
                }
                ... on MilestonedEvent {
                  createdAt
                }
                ... on MovedColumnsInProjectEvent {
                  createdAt
                }
                ... on PinnedEvent {
                  createdAt
                }
                ... on ReferencedEvent {
                  createdAt
                }
                ... on RemovedFromProjectEvent {
                  createdAt
                }
                ... on RenamedTitleEvent {
                  createdAt
                }
                ... on ReopenedEvent {
                  createdAt
                }
                ... on SubscribedEvent {
                  createdAt
                }
                ... on TransferredEvent {
                  createdAt
                }
                ... on UnassignedEvent {
                  createdAt
                }
                ... on UnlabeledEvent {
                  createdAt
                }
                ... on UnlockedEvent {
                  createdAt
                }
                ... on UnpinnedEvent {
                  createdAt
                }
                ... on UnsubscribedEvent {
                  createdAt
                }
                ... on UserBlockedEvent {
                  createdAt
                }
              }
            }
          }
          pageInfo {
            startCursor
            hasNextPage
            endCursor
          }
        }
      }
      rateLimit {
        limit
        cost
        remaining
        resetAt
      }
    }
  `,
  pullRequestDetailsQuery: /* GraphQL */ `
    query GitHub($owner: String!, $repo: String!, $cursor: String!) {
      repository(owner: $owner, name: $repo) {
        name
        pullRequests(first: 20, after: $cursor) {
          totalCount
          nodes {
            createdAt
            state
            mergedAt
            closedAt
            author {
              login
            }
            authorAssociation
          }
          pageInfo {
            startCursor
            hasNextPage
            endCursor
          }
        }
      }
      rateLimit {
        limit
        cost
        remaining
        resetAt
      }
    }
  `
}

module.exports = graphql
