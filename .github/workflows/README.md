# GitHub Actions - Performance Analysis Pipeline

This directory contains workflows for automated performance issue analysis:
- **Stage 1**: Fetches AppSignal performance data and creates GitHub issues
- **Stage 2**: Analyzes the codebase with Claude Code and posts recommendations

## Architecture Overview

The system uses a two-stage pipeline:

```
Stage 1: Issue Creation (~30 seconds)
┌─────────────┐
│  AppSignal  │
│     API     │
└──────┬──────┘
       │
       ▼
┌──────────────┐      ┌──────────────┐
│ get_issue.js │─────▶│ GitHub Issue │
│   (script)   │      │ (with YAML)  │
└──────────────┘      └──────┬───────┘
                             │
                             │ Triggers Stage 2
                             ▼
Stage 2: Codebase Analysis (5-10 minutes)
┌─────────────────────┐
│  Analysis Workflow  │
│   (issues.opened)   │
└──────────┬──────────┘
           │
           ▼
┌──────────────────────┐
│    Claude Code       │
│  Analyzes codebase   │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   GitHub Comment     │
│  (Recommendations)   │
└──────────────────────┘
```

**Key Integration Point:** YAML frontmatter in the GitHub issue connects Stage 1 to Stage 2.

---

## Stage 1: Performance Issue Creation

Workflow file: `create-performance-issue.yml`

This workflow fetches AppSignal performance incident data and automatically creates a GitHub issue with a comprehensive markdown report.

### Triggers

The workflow can be triggered in two ways:

#### 1. Manual Trigger (GitHub UI)

1. Go to your repository on GitHub
2. Click on **Actions** tab
3. Select **Create Performance Issue** workflow
4. Click **Run workflow**
5. Fill in the required inputs:
   - **app_id**: Your AppSignal Application ID (24-character hex string)
   - **issue_number**: The AppSignal Incident Number
   - **target_repo**: Target repository where the issue occurs (format: owner/repo)
6. Click **Run workflow**

#### 2. API Trigger (repository_dispatch)

Use the GitHub API to trigger the workflow programmatically:

```bash
curl -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer YOUR_GITHUB_TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/repos/OWNER/REPO/dispatches \
  -d '{
    "event_type": "create-performance-issue",
    "client_payload": {
      "app_id": "64cb678083eb67f665b627b0",
      "issue_number": "1173",
      "target_repo": "mycompany/api-service"
    }
  }'
```

Replace:
- `YOUR_GITHUB_TOKEN` with your GitHub Personal Access Token
- `OWNER/REPO` with your repository (e.g., `IMhide/claude-pipeline`)
- `app_id` with your AppSignal Application ID
- `issue_number` with the incident number

#### 3. API Trigger (workflow_dispatch)

Alternatively, trigger using workflow_dispatch:

```bash
curl -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer YOUR_GITHUB_TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/repos/OWNER/REPO/actions/workflows/create-performance-issue.yml/dispatches \
  -d '{
    "ref": "master",
    "inputs": {
      "app_id": "64cb678083eb67f665b627b0",
      "issue_number": "1173",
      "target_repo": "mycompany/api-service"
    }
  }'
```

### Generated Issue Format

The workflow creates an issue with:

**YAML Frontmatter** (triggers Stage 2):
```yaml
---
repository: owner/repo
---
```

**Issue Body Content:**
- Header with incident metadata
- Critical information table
- Performance metrics (min/max/avg/median)
- Detailed sample analysis (up to 10 samples)
- N+1 query detection
- Resource allocation analysis

**Issue Labels:**
- `performance`
- `appsignal`
- Severity-based labels
- `n+1-query` (if detected)

**Note:** This issue automatically triggers Stage 2 (codebase analysis) if the YAML frontmatter is present.

### Error Handling

The workflow will fail with clear error messages if:
- ❌ Invalid App ID format (must be 24-character hex)
- ❌ Invalid Incident Number (must be positive integer)
- ❌ Incident is not a PerformanceIncident type
- ❌ AppSignal API key is invalid
- ❌ Network connectivity issues
- ❌ Incident not found

### Example Usage

**Via curl (repository_dispatch):**
```bash
# Example with real values
curl -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer ghp_xxxxxxxxxxxx" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/repos/IMhide/claude-pipeline/dispatches \
  -d '{
    "event_type": "create-performance-issue",
    "client_payload": {
      "app_id": "64cb678083eb67f665b627b0",
      "issue_number": "1173",
      "target_repo": "mycompany/api-service"
    }
  }'
```

**Via GitHub CLI:**
```bash
gh workflow run create-performance-issue.yml \
  -f app_id=64cb678083eb67f665b627b0 \
  -f issue_number=1173 \
  -f target_repo=mycompany/api-service
```

**Via webhook/automation service:**
Set up webhooks in AppSignal or your monitoring tools to automatically trigger this workflow when performance issues are detected.

---

## Stage 2: Codebase Analysis

Two workflow options are available for automated codebase analysis:
- `performance-analysis-on-issue.yml` (Original)
- `performance-analysis-on-issue-optimized.yml` (Optimized - Recommended)

### Overview

- **Purpose**: Analyzes Rails codebases to identify performance issue root causes
- **Trigger**: Automatically when an issue is created with YAML frontmatter
- **Technology**: Claude Code with specialized Rails performance analysis prompts
- **Output**: Detailed analysis comment with specific recommendations

### Workflow Comparison

| Feature | Original | Optimized (Recommended) |
|---------|----------|-------------------------|
| **File** | `performance-analysis-on-issue.yml` | `performance-analysis-on-issue-optimized.yml` |
| **Prompt Architecture** | 123-line embedded prompt | 8-line task prompt + external system prompt |
| **Token Usage** | ~2,000 tokens per run | ~150 tokens per run |
| **Token Reduction** | Baseline | **93% reduction** |
| **Rails Expertise** | Generic analysis | 8 built-in anti-patterns |
| **System Prompt** | N/A | `.github/prompts/rails-codebase-analysis-system.md` |
| **Maintainability** | Hard (edit workflow file) | Easy (edit prompt file) |
| **Status** | Production, stable | **Recommended for new setups** |
| **Best For** | Already deployed | Token efficiency, customization |

**Recommendation:** Use the optimized workflow for new setups. It provides better Rails-specific analysis with significantly lower token usage.

### How It Works

Both workflows follow the same process:

1. **Parse YAML Frontmatter**: Extracts `repository` field from the issue
2. **Validate Repository**: Ensures the repository exists and is accessible
3. **Get Default Branch**: Determines which branch to analyze
4. **Checkout Target Repo**: Clones the repository for analysis
5. **Prepare System Prompt** (Optimized only): Loads external prompt file
6. **Run Claude Code**: Analyzes codebase for performance issues
7. **Verify Output**: Checks that `analysis-output.md` was created
8. **Post Comment**: Adds analysis results to the GitHub issue
9. **Handle Errors**: Posts helpful error messages if analysis fails

### Analysis Output

Claude Code generates `analysis-output.md` containing:

**Issue Summary**
- Endpoint/controller#action
- Severity classification
- Current performance metrics
- Impact assessment

**Performance Metrics Analysis**
- Mean, p95 response times
- Throughput and error rates
- Baseline comparisons

**Root Cause**
- Time breakdown (DB, view, Ruby, external calls)
- Specific code issues with file paths and line numbers

**Recommended Fixes**
- Before/after code examples
- Expected improvements (quantified)
- Implementation priority
- Potential risks

**Testing & Next Steps**
- How to verify fixes
- Success metrics
- Monitoring recommendations

### Configuration

**Permissions Required:**
```yaml
permissions:
  contents: read      # Read external repos
  issues: write       # Post comments
  id-token: write     # Claude Code OAuth
```

**Workflow Settings:**
- **Claude Model**: `claude-sonnet-4-20250514`
- **Timeout**: 20 minutes
- **Permission Mode**: `bypassPermissions` (for reading target repo)
- **Working Directory**: `target-repo/`

### Choosing a Workflow

**Use Original** (`performance-analysis-on-issue.yml`) if:
- You already have it deployed and it's working
- You need the simplest setup (no external files)
- Token usage isn't a concern

**Use Optimized** (`performance-analysis-on-issue-optimized.yml`) if:
- Setting up for the first time
- Want token efficiency (93% reduction)
- Need Rails-specific analysis (N+1 queries, missing indexes, etc.)
- Plan to customize analysis methodology
- Want easier maintenance

**Rails-Specific Analysis** (Optimized workflow only):
The system prompt includes expertise on common Rails anti-patterns:
1. N+1 queries
2. Missing database indexes
3. Unscoped queries
4. Synchronous external calls
5. View rendering issues
6. Memory allocation problems
7. Caching misses
8. Inefficient ActiveRecord usage

*For details on customizing the analysis, see `.github/prompts/README.md`*

---

## Required Secrets

Configure these secrets in: **Repository Settings → Secrets and variables → Actions**

### Stage 1 Secrets

**1. APPSIGNAL_API_KEY** (Required)
- Your AppSignal API key
- Get it from: https://appsignal.com/accounts
- Used by: `create-performance-issue.yml`

**2. GH_TOKEN** (Required)
- GitHub Personal Access Token
- Required scopes: `repo` (or `public_repo`) and `workflow`
- Cannot use `GITHUB_TOKEN` as secret name (reserved by GitHub)
- Used by: `create-performance-issue.yml` (creates issues)

### Stage 2 Secrets

**3. CLAUDE_CODE_OAUTH_TOKEN** (Required)
- Claude Code OAuth token for authentication
- How to obtain:
  1. Visit https://claude.ai/code
  2. Follow the OAuth flow to authorize Claude Code
  3. Copy the generated token
- Used by: Both analysis workflows

**4. GH_PAT** (Optional)
- GitHub Personal Access Token for cross-repository access
- Required scopes: `repo` (or `public_repo` for public repos)
- **When needed**:
  - Analyzing repositories outside your workflow repository
  - Accessing private repositories
- **Fallback**: Uses `GITHUB_TOKEN` if `GH_PAT` is not set
  - Note: `GITHUB_TOKEN` has limited cross-repo access
- Used by: Both analysis workflows

### Permissions Configuration

**Repository-level permissions:**

1. Go to **Repository Settings → Actions → General**
2. Under **Workflow permissions**, select:
   - "Read and write permissions"
3. Enable: "Allow GitHub Actions to create and approve pull requests"

This ensures workflows can:
- Create issues (Stage 1)
- Post comments (Stage 2)
- Access repository contents

---

## Setup Guide

Complete setup instructions for both stages.

### Prerequisites

Before starting, ensure you have:
- AppSignal account with API access
- GitHub repository with Actions enabled
- Claude Code account (https://claude.ai/code)
- Node.js 20+ (for local testing of `get_issue.js`)

### Stage 1 Setup

**Step 1: Add AppSignal API Key**

1. Navigate to: **Repository Settings → Secrets and variables → Actions**
2. Click **New repository secret**
3. Name: `APPSIGNAL_API_KEY`
4. Value: Your AppSignal API key from https://appsignal.com/accounts
5. Click **Add secret**

**Step 2: Add GitHub Token**

1. Create a Personal Access Token at: https://github.com/settings/tokens
2. Required scopes: `repo`, `workflow`
3. Copy the token
4. In your repository: **Settings → Secrets and variables → Actions**
5. Click **New repository secret**
6. Name: `GH_TOKEN`
7. Value: Your Personal Access Token
8. Click **Add secret**

**Step 3: Test Stage 1**

1. Go to **Actions** tab in your repository
2. Select **Create Performance Issue** workflow
3. Click **Run workflow**
4. Fill in test values:
   - `app_id`: Your AppSignal application ID
   - `issue_number`: A test incident number
   - `target_repo`: The repository to analyze (e.g., `mycompany/api-service`)
5. Click **Run workflow**
6. Wait ~30 seconds and check that an issue was created

### Stage 2 Setup

**Step 1: Add Claude Code OAuth Token**

1. Visit https://claude.ai/code
2. Complete the OAuth authorization flow
3. Copy the generated token
4. In your repository: **Settings → Secrets and variables → Actions**
5. Click **New repository secret**
6. Name: `CLAUDE_CODE_OAUTH_TOKEN`
7. Value: Your OAuth token
8. Click **Add secret**

**Step 2: Add GH_PAT (Optional)**

Only needed if analyzing repositories outside your workflow repository:

1. Create a Personal Access Token at: https://github.com/settings/tokens
2. Required scopes: `repo`
3. In your repository: **Settings → Secrets and variables → Actions**
4. Click **New repository secret**
5. Name: `GH_PAT`
6. Value: Your Personal Access Token
7. Click **Add secret**

**Step 3: Choose a Workflow**

Select one of the analysis workflows:

**Option A: Original Workflow**
- File: `performance-analysis-on-issue.yml`
- Already in the repository
- No additional setup needed

**Option B: Optimized Workflow (Recommended)**
- File: `performance-analysis-on-issue-optimized.yml`
- Already in the repository
- System prompt file already at: `.github/prompts/rails-codebase-analysis-system.md`
- No additional setup needed

*Note: Both workflows are included. The optimized workflow provides better analysis with 93% token reduction.*

**Step 4: Test Stage 2**

1. Manually create a test GitHub issue with YAML frontmatter:
   ```markdown
   ---
   repository: owner/repo
   ---

   # Test Performance Issue

   Testing Stage 2 analysis workflow.
   ```

2. Check the **Actions** tab - Stage 2 should trigger automatically
3. Wait 5-10 minutes for analysis to complete
4. Check the issue for a new comment with analysis results

### Verification Checklist

Confirm your setup is working:

**Stage 1:**
- [ ] Issue created successfully
- [ ] Issue contains YAML frontmatter (`---\nrepository: ...\n---`)
- [ ] Issue has performance data sections
- [ ] Issue has appropriate labels (`performance`, `appsignal`)

**Stage 2:**
- [ ] Workflow triggered automatically after issue creation
- [ ] Analysis completed without errors (check Actions tab)
- [ ] Comment posted with analysis results
- [ ] Analysis includes specific file references and recommendations

---

## Troubleshooting

Common issues and solutions for both stages.

### Stage 1 Issues

**"Resource not accessible by personal access token"**
- **Cause**: Insufficient permissions for GH_TOKEN
- **Solution**:
  - Ensure token has `repo` and `workflow` scopes
  - Check **Repository Settings → Actions → General → Workflow permissions**
  - Enable "Read and write permissions"

**"Not a performance issue"**
- **Cause**: The incident is an ExceptionIncident, not a PerformanceIncident
- **Solution**: This tool only supports performance incidents. Check the incident type in AppSignal.

**"Incident not found"**
- **Cause**: Invalid App ID or Incident Number
- **Solution**:
  - Verify the App ID is a 24-character hex string
  - Confirm the incident number exists in AppSignal
  - Check you have access to the AppSignal application

**"Network timeout"**
- **Cause**: Connection issues or API problems
- **Solution**:
  - Check AppSignal API status
  - Verify your API key is valid
  - Check your network connectivity

**"Issue not triggering Stage 2"**
- **Cause**: Missing or malformed YAML frontmatter
- **Solution**:
  - Check the issue contains YAML frontmatter:
    ```yaml
    ---
    repository: owner/repo
    ---
    ```
  - Ensure `---` delimiters are on their own lines
  - Verify `repository` field format is `owner/repo` (no spaces, correct case)

### Stage 2 Issues

**"Stage 2 workflow not triggering"**
- **Cause**: YAML frontmatter missing or workflow file not present
- **Solution**:
  - Verify issue has YAML frontmatter (see above)
  - Check workflow file exists: `.github/workflows/performance-analysis-on-issue.yml` or `-optimized.yml`
  - View **Actions** tab to see if workflow ran but failed

**"Cannot access repository"**
- **Cause**: Repository doesn't exist or insufficient permissions
- **Solution**:
  - Verify repository name in YAML frontmatter is correct
  - For private/external repos: Add `GH_PAT` secret with appropriate access
  - Check repository exists and you have read access

**"System prompt file not found"** (Optimized workflow only)
- **Cause**: Missing system prompt file
- **Solution**:
  - Verify file exists: `.github/prompts/rails-codebase-analysis-system.md`
  - Check workflow checked out this repository (Step 1)
  - Ensure Step 6 (Prepare system prompt) runs before Step 7

**"analysis-output.md not found"**
- **Cause**: Claude Code encountered an error during analysis
- **Solution**:
  - Check workflow logs in Actions tab for Claude Code errors
  - Verify `CLAUDE_CODE_OAUTH_TOKEN` is set correctly
  - Check target repository is accessible and contains analyzable code
  - Try re-running the workflow

**"Claude Code timeout"**
- **Cause**: Analysis taking longer than 20 minutes
- **Solution**:
  - This is rare; usually indicates a very large codebase
  - Check the target repository size
  - Verify repository checkout completed successfully
  - Consider increasing timeout in workflow file if needed

**"Permission denied: id-token"**
- **Cause**: Missing id-token permission
- **Solution**:
  - Check workflow file has:
    ```yaml
    permissions:
      id-token: write
    ```
  - Verify repository Actions permissions allow workflows to use OIDC

**"Analysis quality different from expected"**
- **Cause**: System prompt not loaded (if using optimized workflow)
- **Solution**:
  - Verify Step 6 (Prepare system prompt) completed successfully
  - Check system prompt file is valid markdown
  - Ensure Claude model version matches: `claude-sonnet-4-20250514`

### Getting Help

If issues persist:

1. **Check workflow logs**: Go to **Actions** tab → Select failed run → View logs
2. **Verify all secrets**: Ensure all required secrets are set correctly
3. **Test each stage separately**: Isolate which stage is failing
4. **Review recent changes**: Check if workflow files were modified
5. **File an issue**: Create an issue in this repository with:
   - Error messages from workflow logs
   - Steps to reproduce
   - Workflow run URL

---

## Files in This Directory

**Workflows:**
- `create-performance-issue.yml` - Stage 1: Fetch AppSignal data and create issues
- `performance-analysis-on-issue.yml` - Stage 2: Original analysis workflow (embedded prompt)
- `performance-analysis-on-issue-optimized.yml` - Stage 2: Optimized workflow (external prompt, 93% token reduction)

**Scripts:**
- `get_issue.js` - Node.js script for fetching AppSignal performance incidents via GraphQL API

**Related Files:**
- `.github/prompts/rails-codebase-analysis-system.md` - System prompt for optimized workflow
- `.github/prompts/README.md` - Documentation for customizing analysis prompts
- `.github/prompts/github-workflow-comparison.md` - Detailed comparison and migration guide
