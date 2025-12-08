# GitHub Actions - AppSignal Performance Issue Creator

## Workflow: Create Performance Issue

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
      "issue_number": "1173"
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
      "issue_number": "1173"
    }
  }'
```

### Required Secrets

Make sure these secrets are configured in your repository:

1. **APPSIGNAL_API_KEY**
   - Your AppSignal API key
   - Get it from: https://appsignal.com/accounts
   - Add to: Repository Settings → Secrets and variables → Actions → New repository secret

2. **GITHUB_TOKEN**
   - Automatically provided by GitHub Actions
   - Has permissions set in the workflow: `contents: read`, `issues: write`

### Setup Instructions

1. **Add AppSignal API Key Secret:**
   ```
   Repository Settings → Secrets and variables → Actions → New repository secret
   Name: APPSIGNAL_API_KEY
   Value: your_appsignal_api_key
   ```

2. **Ensure GITHUB_TOKEN has permissions:**
   - Go to Repository Settings → Actions → General
   - Under "Workflow permissions", ensure "Read and write permissions" is selected
   - OR use the fine-grained permissions in the workflow (already configured)

3. **Test the workflow:**
   - Use Manual Trigger from GitHub UI first to verify it works
   - Then use API trigger for automation

### Workflow Outputs

When successful, the workflow will:
- ✅ Fetch incident data from AppSignal
- ✅ Generate comprehensive markdown report with 6 sections:
  1. Header with incident metadata
  2. Critical information table
  3. Performance metrics (min/max/avg/median)
  4. Detailed sample analysis (up to 10 samples)
  5. N+1 query detection
  6. Resource allocation analysis
- ✅ Create a GitHub issue with:
  - Title: `[Performance] ActionName - Slow response time (duration)`
  - Labels: `performance`, `appsignal`, severity-based, `n+1-query` (if detected)
  - Complete markdown report as issue body

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
      "issue_number": "1173"
    }
  }'
```

**Via GitHub CLI:**
```bash
gh workflow run create-performance-issue.yml \
  -f app_id=64cb678083eb67f665b627b0 \
  -f issue_number=1173
```

**Via webhook/automation service:**
Set up webhooks in AppSignal or your monitoring tools to automatically trigger this workflow when performance issues are detected.

### Troubleshooting

**"Resource not accessible by personal access token"**
- Ensure GITHUB_TOKEN has `issues: write` permission
- Check Repository Settings → Actions → General → Workflow permissions

**"Not a performance issue"**
- The incident is an ExceptionIncident, not a PerformanceIncident
- This tool only supports performance incidents

**"Incident not found"**
- Verify the App ID and Incident Number are correct
- Check that you have access to the AppSignal application

**Network timeout**
- The workflow has a default timeout
- Check AppSignal API status
- Verify your API key is valid

### Advanced Usage

**Integrate with AppSignal Webhooks:**
You can configure AppSignal to trigger this workflow automatically:
1. Set up a webhook in AppSignal to call your GitHub API endpoint
2. Use repository_dispatch trigger
3. Automatically create GitHub issues for performance incidents

**Scheduled Checks:**
Add a schedule trigger to periodically check for new incidents:
```yaml
on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
```

### Files

- **Workflow:** `.github/workflows/create-performance-issue.yml`
- **CLI Script:** `.github/get_issue.js`
- **Documentation:** This file
