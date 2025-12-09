#!/usr/bin/env node
'use strict';

// ==============================================================================
// AppSignal Performance Issue CLI Tool
// ==============================================================================
// Fetches AppSignal performance incidents and creates GitHub issues with
// comprehensive markdown reports.
//
// Usage: node get_issue.js <APP_ID> <INCIDENT_NUMBER>
//
// Environment Variables:
//   APPSIGNAL_API_KEY - Required. Your AppSignal API key
//   GITHUB_TOKEN      - Required. GitHub personal access token
//   GITHUB_REPO       - Optional. Repository in format "owner/repo"
//   DEBUG             - Optional. Enable debug logging
// ==============================================================================

const https = require('https');
const { execSync } = require('child_process');

// ==============================================================================
// CONSTANTS
// ==============================================================================

const APPSIGNAL_GRAPHQL_ENDPOINT = 'appsignal.com';
const GITHUB_API_ENDPOINT = 'api.github.com';

// ==============================================================================
// VALIDATION UTILITIES
// ==============================================================================

function isValidAppId(appId) {
  // MongoDB ObjectId is 24 character hex string
  return /^[0-9a-f]{24}$/i.test(appId);
}

function isValidIncidentNumber(number) {
  const num = parseInt(number, 10);
  return !isNaN(num) && num > 0 && num.toString() === number;
}

function isValidRepoFormat(repo) {
  // Format: owner/repo (e.g., "mycompany/api-service")
  return /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repo);
}

// ==============================================================================
// FORMATTING UTILITIES
// ==============================================================================

function formatDuration(ms) {
  if (ms === null || ms === undefined) return 'N/A';

  if (ms < 1) {
    return `${(ms * 1000).toFixed(2)} μs`;
  } else if (ms < 1000) {
    return `${ms.toFixed(2)} ms`;
  } else {
    return `${(ms / 1000).toFixed(2)} s`;
  }
}

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return 'N/A';

  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let value = bytes;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

function formatDate(timestamp) {
  if (!timestamp) return 'N/A';

  const date = new Date(timestamp);
  return date.toISOString().replace('T', ' ').split('.')[0] + ' UTC';
}

function formatStatus(state) {
  const statusMap = {
    'open': '🔴 Open',
    'closed': '✅ Closed',
    'resolved': '✅ Resolved'
  };

  return statusMap[state] || state;
}

function formatSeverity(severity) {
  const severityMap = {
    'critical': '🔥 Critical',
    'warning': '⚠️ Warning',
    'info': 'ℹ️ Info'
  };

  return severityMap[severity] || severity;
}

function calculateMedian(numbers) {
  if (!numbers || numbers.length === 0) return 0;

  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    return sorted[mid];
  }
}

function formatGroupDurations(groupDurations) {
  if (!groupDurations || groupDurations.length === 0) {
    return 'No breakdown available.';
  }

  let markdown = '| Component | Duration | Percentage |\n';
  markdown += '|-----------|----------|------------|\n';

  const total = groupDurations.reduce((sum, g) => sum + g.value, 0);

  groupDurations
    .sort((a, b) => b.value - a.value)
    .forEach(({ key, value }) => {
      const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
      markdown += `| ${key} | ${formatDuration(value)} | ${percentage}% |\n`;
    });

  return markdown;
}

function formatGroupAllocations(groupAllocations) {
  if (!groupAllocations || groupAllocations.length === 0) {
    return 'No allocation data available.';
  }

  let markdown = '| Component | Allocation |\n';
  markdown += '|-----------|------------|\n';

  groupAllocations
    .sort((a, b) => b.value - a.value)
    .forEach(({ key, value }) => {
      markdown += `| ${key} | ${formatBytes(value)} |\n`;
    });

  return markdown;
}

// ==============================================================================
// HTTP REQUEST FUNCTIONS
// ==============================================================================

function makeGraphQLRequest(apiKey, query, variables) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      query: query,
      variables: variables
    });

    if (process.env.DEBUG) {
      console.log('Debug: GraphQL Query:', query);
      console.log('Debug: Variables:', variables);
    }

    const options = {
      hostname: APPSIGNAL_GRAPHQL_ENDPOINT,
      path: `/graphql?token=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          return;
        }

        try {
          const parsed = JSON.parse(data);

          if (process.env.DEBUG) {
            console.log('Debug: GraphQL Response:', JSON.stringify(parsed, null, 2));
          }

          resolve(parsed);
        } catch (err) {
          reject(new Error(`Failed to parse JSON response: ${err.message}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Request failed: ${err.message}`));
    });

    req.write(postData);
    req.end();
  });
}

function makeGitHubRequest(token, owner, repo, method, path, body) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;

    const options = {
      hostname: GITHUB_API_ENDPOINT,
      path: `/repos/${owner}/${repo}${path}`,
      method: method,
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'AppSignal-CLI-Tool',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    };

    if (postData) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    if (process.env.DEBUG) {
      console.log('Debug: GitHub Request:', method, path);
    }

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`GitHub API ${res.statusCode}: ${data}`));
          return;
        }

        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (err) {
          reject(new Error(`Failed to parse GitHub response: ${err.message}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`GitHub request failed: ${err.message}`));
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

// ==============================================================================
// GRAPHQL FUNCTIONS
// ==============================================================================

function buildGraphQLQuery() {
  return `
    query GetIncident($appId: String!, $incidentNumber: Int!) {
      app(id: $appId) {
        incident(incidentNumber: $incidentNumber) {
          __typename

          ... on PerformanceIncident {
            id
            actionNames
            description
            digests
            severity
            state
            totalDuration

            samples(limit: 10) {
              duration
              action
              time
              groupDurations {
                key
                value
              }
              groupAllocations {
                key
                value
              }
              hasNPlusOne
              params
              overview {
                key
                value
              }
              queueDuration
              sessionData
            }
          }

          ... on ExceptionIncident {
            id
            __typename
          }
        }
      }
    }
  `;
}

function validateIncidentType(graphqlResponse) {
  if (graphqlResponse.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(graphqlResponse.errors)}`);
  }

  if (!graphqlResponse.data || !graphqlResponse.data.app) {
    throw new Error('No app data returned from AppSignal');
  }

  if (!graphqlResponse.data.app.incident) {
    throw new Error('Incident not found');
  }

  const incident = graphqlResponse.data.app.incident;
  const typename = incident.__typename;

  if (typename !== 'PerformanceIncident') {
    throw new Error('Not a performance issue');
  }

  return incident;
}

// ==============================================================================
// MARKDOWN REPORT GENERATION
// ==============================================================================

function generateYAMLFrontmatter(targetRepo) {
  return `---
repository: ${targetRepo}
---

`;
}

function generateHeaderSection(incident, appId, incidentNumber, targetRepo) {
  const actionName = incident.actionNames && incident.actionNames[0] ? incident.actionNames[0] : 'Unknown Action';
  const repoUrl = `https://github.com/${targetRepo}`;

  return `# Performance Issue: ${actionName}

**Repository:** [${targetRepo}](${repoUrl})
**Incident Number:** #${incidentNumber}
**AppSignal ID:** ${incident.id}
**App ID:** ${appId}

**Status:** ${formatStatus(incident.state)}
**Severity:** ${formatSeverity(incident.severity)}

## Description
${incident.description || 'No description provided'}

---`;
}

function generateCriticalInfoSection(incident) {
  const actionNames = incident.actionNames && incident.actionNames.length > 0
    ? incident.actionNames.join(', ')
    : 'N/A';

  return `## Critical Information

| Metric | Value |
|--------|-------|
| **Average Duration** | ${formatDuration(incident.totalDuration)} |
| **Affected Actions** | ${actionNames} |
| **State** | ${incident.state} |
| **Severity** | ${incident.severity} |`;
}

function generatePerformanceMetricsSection(incident) {
  const samples = incident.samples || [];
  if (samples.length === 0) {
    return '## Performance Metrics\n\nNo sample data available.';
  }

  const durations = samples.map(s => s.duration);
  const stats = {
    min: Math.min(...durations),
    max: Math.max(...durations),
    avg: durations.reduce((a, b) => a + b, 0) / durations.length,
    median: calculateMedian(durations)
  };

  return `## Performance Metrics

Based on ${samples.length} sample(s):

| Statistic | Duration |
|-----------|----------|
| **Minimum** | ${formatDuration(stats.min)} |
| **Maximum** | ${formatDuration(stats.max)} |
| **Average** | ${formatDuration(stats.avg)} |
| **Median** | ${formatDuration(stats.median)} |`;
}

function generateSamplesSection(samples) {
  if (!samples || samples.length === 0) {
    return '## Sample Analysis\n\nNo samples available.';
  }

  let markdown = `## Sample Analysis

Analyzed ${samples.length} sample(s) from recent occurrences.

`;

  samples.forEach((sample, index) => {
    markdown += `### Sample ${index + 1}
- **Time:** ${formatDate(sample.time)}
- **Duration:** ${formatDuration(sample.duration)}
- **Action:** ${sample.action || 'N/A'}
- **Queue Duration:** ${formatDuration(sample.queueDuration)}

#### Time Breakdown
${formatGroupDurations(sample.groupDurations)}

#### Memory Allocation
${formatGroupAllocations(sample.groupAllocations)}

---

`;
  });

  return markdown;
}

function generateNPlusOneSection(samples) {
  if (!samples || samples.length === 0) {
    return '## N+1 Query Detection\n\nNo samples available for analysis.';
  }

  const nPlusOneDetected = samples.filter(s => s.hasNPlusOne);

  let markdown = `## N+1 Query Detection

`;

  if (nPlusOneDetected.length === 0) {
    markdown += '✅ No N+1 query patterns detected in samples.\n';
  } else {
    markdown += `⚠️ **N+1 query pattern detected in ${nPlusOneDetected.length} out of ${samples.length} samples!**

### Affected Samples:
`;

    nPlusOneDetected.forEach((sample, index) => {
      const sampleIndex = samples.indexOf(sample) + 1;
      markdown += `- Sample #${sampleIndex} at ${formatDate(sample.time)} (${formatDuration(sample.duration)})\n`;
    });
  }

  return markdown;
}

function generateResourceAllocationSection(samples) {
  if (!samples || samples.length === 0) {
    return '## Resource Allocation Analysis\n\nNo samples available.';
  }

  // Aggregate allocation data across samples
  const allocationMap = new Map();

  samples.forEach(sample => {
    if (sample.groupAllocations) {
      sample.groupAllocations.forEach(({ key, value }) => {
        if (!allocationMap.has(key)) {
          allocationMap.set(key, []);
        }
        allocationMap.get(key).push(value);
      });
    }
  });

  if (allocationMap.size === 0) {
    return '## Resource Allocation Analysis\n\nNo allocation data available.';
  }

  let markdown = `## Resource Allocation Analysis

Average memory allocation by category:

| Category | Average Allocation | Samples |
|----------|-------------------|---------|
`;

  Array.from(allocationMap.entries())
    .sort((a, b) => {
      const avgA = a[1].reduce((sum, v) => sum + v, 0) / a[1].length;
      const avgB = b[1].reduce((sum, v) => sum + v, 0) / b[1].length;
      return avgB - avgA;
    })
    .forEach(([key, values]) => {
      const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
      markdown += `| ${key} | ${formatBytes(avg)} | ${values.length} |\n`;
    });

  return markdown;
}

function generateMarkdownReport(incident, appId, incidentNumber, targetRepo) {
  const sections = [];

  // Add YAML frontmatter first
  sections.push(generateYAMLFrontmatter(targetRepo));

  // Add all sections with updated parameters
  sections.push(generateHeaderSection(incident, appId, incidentNumber, targetRepo));
  sections.push(generateCriticalInfoSection(incident));
  sections.push(generatePerformanceMetricsSection(incident));
  sections.push(generateSamplesSection(incident.samples));
  sections.push(generateNPlusOneSection(incident.samples));
  sections.push(generateResourceAllocationSection(incident.samples));

  return sections.join('\n\n');
}

// ==============================================================================
// GITHUB INTEGRATION
// ==============================================================================

function detectGitHubRepo(envOverride) {
  // First, check environment variable override
  if (envOverride) {
    const match = envOverride.match(/^([^\/]+)\/([^\/]+)$/);
    if (!match) {
      throw new Error('GITHUB_REPO must be in format "owner/repo"');
    }
    return { owner: match[1], repo: match[2] };
  }

  // Try to detect from git remote
  try {
    const remoteUrl = execSync('git config --get remote.origin.url', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();

    // Parse different GitHub URL formats
    // SSH: git@github.com:owner/repo.git
    // HTTPS: https://github.com/owner/repo.git
    let match;

    if (remoteUrl.startsWith('git@github.com:')) {
      match = remoteUrl.match(/git@github\.com:([^\/]+)\/(.+?)(?:\.git)?$/);
    } else if (remoteUrl.includes('github.com')) {
      match = remoteUrl.match(/github\.com\/([^\/]+)\/(.+?)(?:\.git)?$/);
    }

    if (match) {
      return { owner: match[1], repo: match[2] };
    }
  } catch (err) {
    // Git command failed, no git repo or no remote
  }

  throw new Error('Could not detect GitHub repository. Please set GITHUB_REPO environment variable.');
}

function generateIssueTitle(incident) {
  const action = incident.actionNames && incident.actionNames[0] ? incident.actionNames[0] : 'Unknown';
  const duration = formatDuration(incident.totalDuration);
  return `[Performance] ${action} - Slow response time (${duration})`;
}

function generateIssueLabels(incident) {
  const labels = ['performance'];

  if (incident.severity === 'critical') {
    labels.push('critical');
  } else if (incident.severity === 'warning') {
    labels.push('high-priority');
  }

  if (incident.samples && incident.samples.some(s => s.hasNPlusOne)) {
    labels.push('n+1-query');
  }

  labels.push('appsignal');

  return labels;
}

async function createGitHubIssue(token, owner, repo, title, body, labels) {
  const issueData = {
    title: title,
    body: body,
    labels: labels || []
  };

  try {
    const response = await makeGitHubRequest(
      token,
      owner,
      repo,
      'POST',
      '/issues',
      issueData
    );

    return {
      success: true,
      url: response.html_url,
      number: response.number
    };
  } catch (err) {
    throw new Error(`Failed to create GitHub issue: ${err.message}`);
  }
}

// ==============================================================================
// CLI AND ENVIRONMENT FUNCTIONS
// ==============================================================================

function printUsageAndExit() {
  console.error(`
Usage: node get_issue.js <APP_ID> <INCIDENT_NUMBER> <TARGET_REPO>

Arguments:
  APP_ID           AppSignal application ID (24-character hex string)
  INCIDENT_NUMBER  Incident number (positive integer)
  TARGET_REPO      Target repository where issue occurs (format: owner/repo)

Environment Variables:
  APPSIGNAL_API_KEY  Required. Your AppSignal API key
  GH_TOKEN           Required. GitHub personal access token
  GITHUB_REPO        Optional. Override where to create the issue (default: auto-detect from git)
  DEBUG              Optional. Enable debug logging

Examples:
  node get_issue.js 64cb678083eb67f665b627b0 123 mycompany/api-service
  APPSIGNAL_API_KEY=xxx GH_TOKEN=yyy node get_issue.js 64cb678083eb67f665b627b0 123 mycompany/api-service

Note: The TARGET_REPO is for informational purposes only. The GitHub issue will be
created in the repository detected from git (or GITHUB_REPO if set), NOT in the target repo.
`);
  process.exit(1);
}

function parseCliArguments() {
  const args = process.argv.slice(2);

  if (args.length !== 3) {
    printUsageAndExit();
  }

  const [appId, incidentNumber, targetRepo] = args;

  if (!isValidAppId(appId)) {
    console.error('ERROR: Invalid APP_ID format (expected 24-character hex string)');
    process.exit(1);
  }

  if (!isValidIncidentNumber(incidentNumber)) {
    console.error('ERROR: Invalid INCIDENT_NUMBER format (expected positive integer)');
    process.exit(1);
  }

  if (!isValidRepoFormat(targetRepo)) {
    console.error('ERROR: Invalid TARGET_REPO format (expected owner/repo)');
    process.exit(1);
  }

  return { appId, incidentNumber, targetRepo };
}

function validateEnvironment() {
  const errors = [];

  if (!process.env.APPSIGNAL_API_KEY) {
    errors.push('APPSIGNAL_API_KEY environment variable is required');
  }

  if (!process.env.GH_TOKEN) {
    errors.push('GH_TOKEN environment variable is required');
  }

  if (errors.length > 0) {
    console.error('Environment validation failed:');
    errors.forEach(err => console.error(`  - ${err}`));
    console.error('\nPlease set the required environment variables and try again.');
    process.exit(1);
  }

  return {
    appsignalApiKey: process.env.APPSIGNAL_API_KEY,
    githubToken: process.env.GH_TOKEN,
    githubRepo: process.env.GITHUB_REPO || null
  };
}

// ==============================================================================
// ERROR HANDLING
// ==============================================================================

function handleError(error) {
  console.error('ERROR:', error.message);

  if (error.stack && process.env.DEBUG) {
    console.error('\nStack trace:');
    console.error(error.stack);
  }

  // Provide helpful suggestions based on error type
  if (error.message.includes('ENOTFOUND')) {
    console.error('\nNetwork error. Please check your internet connection.');
  } else if (error.message.includes('401') || error.message.includes('403')) {
    console.error('\nAuthentication failed. Please check your API keys.');
  } else if (error.message === 'Not a performance issue') {
    console.error('\nThis incident is not a PerformanceIncident type.');
    console.error('This tool only supports performance incidents.');
  } else if (error.message.includes('Incident not found')) {
    console.error('\nThe specified incident could not be found.');
    console.error('Please verify the App ID and Incident Number are correct.');
  }

  process.exit(1);
}

// ==============================================================================
// MAIN EXECUTION
// ==============================================================================

async function main() {
  try {
    // 1. Parse CLI arguments (now includes targetRepo)
    const { appId, incidentNumber, targetRepo } = parseCliArguments();

    // 2. Validate environment variables
    const env = validateEnvironment();

    // 3. Detect GitHub repository (for issue creation)
    const githubRepo = detectGitHubRepo(env.githubRepo);

    console.log('Fetching incident data from AppSignal...');

    // 4. Build and execute GraphQL query
    const query = buildGraphQLQuery();
    const variables = {
      appId: appId,
      incidentNumber: parseInt(incidentNumber, 10)
    };

    const graphqlResponse = await makeGraphQLRequest(
      env.appsignalApiKey,
      query,
      variables
    );

    // 5. Validate incident type
    const incident = validateIncidentType(graphqlResponse);

    console.log('Generating markdown report...');

    // 6. Generate markdown report (now with targetRepo)
    const markdownReport = generateMarkdownReport(incident, appId, incidentNumber, targetRepo);

    console.log('Creating GitHub issue...');

    // 7. Create GitHub issue
    const title = generateIssueTitle(incident);
    const labels = generateIssueLabels(incident);

    const result = await createGitHubIssue(
      env.githubToken,
      githubRepo.owner,
      githubRepo.repo,
      title,
      markdownReport,
      labels
    );

    // 8. Success output
    console.log('\n✅ Success!');
    console.log(`GitHub Issue: ${result.url}`);
    console.log(`Issue Number: #${result.number}`);
    console.log(`Target Repository: ${targetRepo}`);

    process.exit(0);

  } catch (error) {
    handleError(error);
  }
}

// ==============================================================================
// ENTRY POINT
// ==============================================================================

if (require.main === module) {
  main();
}
