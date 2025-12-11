# GitHub Issue Workflow Comparison: Original vs Optimized

## Your Actual Workflow

Your system uses a two-stage approach:

1. **Stage 1**: `create-performance-issue.yml`
   - Fetches AppSignal performance data via custom script
   - Creates GitHub issue with structured performance data
   - Issue contains YAML frontmatter with repository info

2. **Stage 2**: `performance-analysis-on-issue.yml`
   - Triggered when performance issue is created
   - Claude Code analyzes the repository based on issue data
   - Posts analysis as a comment

This comparison focuses on **optimizing Stage 2** (the analysis workflow).

## Key Changes in Optimized Version

### 1. Prompt Size Reduction

**Original** (`performance-analysis-on-issue.yml` lines 98-221):
- **123 lines** of detailed instructions
- Complete methodology in every workflow run
- Analysis steps, output format, requirements all in prompt
- Approximately **~2,000 tokens** per execution

**Optimized** (`performance-analysis-on-issue-optimized.yml` lines 122-129):
- **8 lines** of task-specific prompt
- System prompt loaded separately (~1,200 tokens, one-time)
- Task prompt minimal (~150 tokens per run)
- **~93% reduction** in per-run prompt tokens (2,000 → 150 tokens)

### 2. Separation of Concerns

**Original**:
```yaml
prompt: |
  You are analyzing repository **${{ steps.parse-yaml.outputs.repository }}**...

  ## Step 1: Read the Performance Issue Report
  First, read the issue body from: ...

  ## Step 2: Analyze the Repository
  Based on the specific issues identified...

  ### 2.1 Locate the Problematic Code
  - Find the endpoint/action mentioned...
  [... 120+ more lines ...]
```
Everything mixed together - task details + methodology + output format

**Optimized**:
```yaml
system_prompt_file: /tmp/system-prompt.txt  # All methodology here
prompt: |
  Analyze the Rails performance issue reported in GitHub issue #${{ github.event.issue.number }}.

  **Issue URL**: ${{ github.event.issue.html_url }}
  **Repository**: ${{ steps.parse-yaml.outputs.repository }}

  Read the issue, analyze the codebase, provide recommendations.
  Write your analysis to `analysis-output.md`.
```
Clean separation - system prompt has methodology, user prompt has task details

### 3. Maintainability

**Original**:
- Methodology embedded in workflow file
- Hard to update analysis approach
- Changes require workflow file edit
- No reusability across different workflows

**Optimized**:
- Methodology in separate prompt file (`.github/prompts/rails-codebase-analysis-system.md`)
- Easy to update analysis approach independently
- Workflow file stays simple and stable
- System prompt reusable for other Rails analysis tasks

### 4. Rails-Specific Expertise

**Original**:
- Generic analysis instructions
- No specific Rails anti-patterns listed
- No severity classification built-in
- Output format described but not structured

**Optimized**:
- 8 common Rails anti-patterns pre-defined
- Severity classification guidelines built-in
- Rails-specific optimization patterns included
- Structured output format with examples
- Quantitative analysis emphasis

## Side-by-Side Comparison

### Original Prompt Structure
```
Lines 98-105:  Context about the task
Lines 106-112: What data is in the issue
Lines 113-119: What to extract from issue
Lines 120-128: How to locate code
Lines 129-143: How to identify root causes
Lines 144-153: How to generate recommendations
Lines 154-180: Recommendation format details
Lines 181-195: Implementation priority structure
Lines 196-206: Output requirements
Lines 207-221: CRITICAL file writing instructions
```
Total: **123 lines, ~2,000 tokens**

### Optimized Prompt Structure
```
Lines 122-129:
  - Issue number
  - Issue URL
  - Repository name
  - Simple instructions
  - Output file name
```
Total: **8 lines, ~150 tokens**

All the methodology (what to look for, how to analyze, output format, etc.) is in the system prompt file.

## Token Usage Analysis

### Per Workflow Execution

| Component | Original | Optimized | Difference |
|-----------|----------|-----------|------------|
| Default System Prompt | ~5,000 tokens | 0 (replaced) | -5,000 |
| Custom System Prompt | 0 | ~1,200 tokens | +1,200 |
| User Prompt | ~2,000 tokens | ~150 tokens | -1,850 |
| **Total per run** | **~7,000 tokens** | **~1,350 tokens** | **-5,650 tokens (~81%)** |

### Monthly Cost Savings

Assuming:
- 100 performance issues per month
- Claude Sonnet 4 pricing: ~$3/million input tokens

**Original**: 100 runs × 7,000 tokens = 700,000 tokens/month = **$2.10/month**
**Optimized**: 100 runs × 1,350 tokens = 135,000 tokens/month = **$0.40/month**
**Savings**: **$1.70/month** (~81% cost reduction)

While the absolute savings are modest due to low volume, the percentage improvement is significant and scales with usage.

## What Stayed the Same

The optimized workflow keeps all the same:
- Trigger conditions (issues with YAML frontmatter)
- Repository checkout logic
- YAML parsing and validation
- Output file verification
- Comment posting
- Error handling
- Debug information

Only the Claude Code analysis step changed (Step 7).

## Implementation Comparison

### Original Step 7
```yaml
- name: Run Performance Analysis with Claude Code
  id: claude-analysis
  uses: anthropics/claude-code-action@v1
  with:
    claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
    show_full_output: true
    working_directory: target-repo
    prompt: |
      [123 lines of detailed instructions]
    claude_args: "--model claude-sonnet-4-20250514"
```

### Optimized Step 7
```yaml
- name: Prepare system prompt
  run: |
    cp .github/prompts/rails-codebase-analysis-system.md /tmp/system-prompt.txt

- name: Run Performance Analysis with Claude Code
  id: claude-analysis
  uses: anthropics/claude-code-action@v1
  with:
    claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
    show_full_output: true
    working_directory: target-repo
    system_prompt_file: /tmp/system-prompt.txt
    prompt: |
      [8 lines of task-specific instructions]
    claude_args: "--model claude-sonnet-4-20250514"
```

One additional step to copy the system prompt file, but much cleaner overall.

## Quality Improvements

The optimized version provides better analysis because:

### 1. Rails-Specific Knowledge
Built-in awareness of:
- N+1 queries (includes, preload, eager_load)
- Missing indexes (WHERE clauses, foreign keys)
- Caching strategies (fragment, Russian doll, counter caches)
- ActiveRecord optimization patterns
- Common Rails performance anti-patterns

### 2. Structured Output
Consistent sections every time:
- Issue Summary with severity
- Performance Metrics Analysis with baselines
- Root Cause with time breakdown
- Recommended Fixes with before/after code
- Implementation Priority
- Testing Recommendations
- Next Steps

### 3. Quantitative Focus
Emphasis on:
- Actual metrics from traces (ms, %, query counts)
- Expected improvements with reasoning
- Impact vs. effort estimates
- Success criteria

### 4. Actionable Recommendations
Requirements to:
- Reference specific files and line numbers
- Show complete before/after code
- Explain reasoning behind each fix
- Provide implementation effort estimates
- Note potential risks

## Migration Path

### Option 1: Test in Parallel (Recommended)

1. **Keep original workflow active**
2. **Deploy optimized workflow**
3. **Modify trigger to test on specific repos**:
   ```yaml
   if: |
     contains(github.event.issue.body, '---') &&
     contains(github.event.issue.labels.*.name, 'test-optimized')
   ```
4. **Add label to test issues** to trigger optimized workflow
5. **Compare outputs** for quality and accuracy
6. **Switch when confident**

### Option 2: Direct Replacement

1. **Backup original workflow**:
   ```bash
   cp .github/workflows/performance-analysis-on-issue.yml \
      .github/workflows/performance-analysis-on-issue-original-backup.yml
   ```
2. **Replace with optimized version**
3. **Test with 1-2 issues**
4. **Roll back if needed**

### Option 3: Gradual Rollout

1. **Deploy optimized workflow**
2. **Modify trigger to only run for specific repositories**:
   ```yaml
   if: |
     contains(github.event.issue.body, '---') &&
     contains('owner/repo1 owner/repo2', steps.parse-yaml.outputs.repository)
   ```
3. **Expand repository list** as confidence grows
4. **Eventually replace original**

## Testing Checklist

Before fully deploying, test these scenarios:

- [ ] Issue with valid YAML frontmatter and performance data
- [ ] Issue with N+1 query patterns in traces
- [ ] Issue with slow database queries
- [ ] Issue with external API call delays
- [ ] Issue with memory allocation problems
- [ ] Issue with missing indexes
- [ ] Repository with complex Rails app structure
- [ ] Repository with non-standard file organization
- [ ] Verify `analysis-output.md` is created
- [ ] Verify comment is posted with analysis
- [ ] Compare quality with original workflow output

## Customization for Your App

The system prompt can be customized for your specific needs:

### Add Your Performance Thresholds
```markdown
## Severity Classification

For our application:
- **Critical**: p95 > 1500ms (we have strict SLAs)
- **High**: p95 > 800ms
- **Medium**: p95 > 400ms
- **Low**: p95 > 200ms
```

### Add App-Specific Context
```markdown
## Application Context

**Our Stack**:
- Rails 7.1 with Hotwire
- PostgreSQL with read replicas
- Redis for caching + Sidekiq
- Deployed on Heroku

**Our Patterns**:
- We use service objects for complex operations
- All background jobs in `app/jobs/`
- Heavy use of ActionCable for real-time features
```

### Add Team Standards
```markdown
## Team Coding Standards

- Use `includes` for N+1, not `preload` (our convention)
- All database migrations require DBA review
- Fragment caching required for all partials > 100ms
- Use our QueryObject pattern (app/queries/)
```

## Troubleshooting

### Issue: System prompt file not found

**Symptom**: Workflow fails with "system prompt file not found"

**Solution**: Ensure the system prompt is copied in Step 6:
```yaml
- name: Prepare system prompt
  run: |
    cp .github/prompts/rails-codebase-analysis-system.md /tmp/system-prompt.txt
```

### Issue: Analysis quality is different

**Symptom**: Optimized version gives different recommendations

**Reasons**:
1. Original was more generic, optimized is Rails-specific
2. Optimized has structured output format
3. Optimized emphasizes quantitative analysis

**Action**: Review 3-5 analyses from each version to compare quality

### Issue: Output file not created

**Symptom**: `analysis-output.md` not found after analysis

**Reasons**:
1. Claude encountered an error during analysis
2. File written to wrong directory
3. Permission issues

**Solution**: Check Claude Code logs in workflow output for errors

## Recommendation

**Deploy the optimized version** because:

✅ **Immediate Benefits**:
- 81% reduction in prompt tokens per run
- Faster execution (less context to process)
- Better Rails-specific insights
- Consistent, structured output

✅ **Long-term Benefits**:
- Easier to maintain and improve
- Reusable system prompt for other tasks
- Can build library of analysis types
- Team methodology codified

✅ **Low Risk**:
- Workflow structure unchanged
- Easy to roll back if needed
- Can test in parallel first

⚠️ **Considerations**:
- Need to maintain system prompt file
- Slight difference in analysis approach
- May need tuning for your specific apps

## Next Steps

1. **Review the system prompt** (`.github/prompts/rails-codebase-analysis-system.md`)
2. **Customize if needed** (add your app context, thresholds, patterns)
3. **Test the optimized workflow** with 2-3 real performance issues
4. **Compare outputs** with original workflow
5. **Deploy to production** once validated
6. **Monitor and iterate** on the system prompt as you learn

## Files Created

1. **`.github/prompts/rails-codebase-analysis-system.md`**
   - System prompt for Rails codebase analysis
   - ~1,200 tokens, loaded once per run
   - Contains all methodology and expertise

2. **`.github/workflows/performance-analysis-on-issue-optimized.yml`**
   - Optimized workflow using system prompt
   - Adds Step 6 to prepare system prompt
   - Modifies Step 7 to use system prompt
   - User prompt reduced from 123 lines to 8 lines

3. **`.github/prompts/github-workflow-comparison.md`** (this file)
   - Detailed comparison and migration guide

The original workflow files remain unchanged for comparison and rollback.
