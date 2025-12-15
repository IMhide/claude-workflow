# Claude Code System Prompts and Workflows

This directory contains optimized system prompts and documentation for Rails performance analysis workflows using Claude Code.

## Active Workflows (GitHub Issue-Based)

### Performance Analysis Workflow

Your current production workflow uses a two-stage GitHub issue approach:

#### Stage 1: Issue Creation
**File**: `../.github/workflows/create-performance-issue.yml`
- Fetches AppSignal performance data via custom script
- Creates GitHub issue with structured data
- **Status**: Active, in use

#### Stage 2: Analysis
**Original**: `../.github/workflows/performance-analysis-on-issue.yml`
- Current production workflow
- 123-line prompt embedded in workflow
- ~2,000 tokens per execution
- **Status**: Active, in use

**Optimized**: `../.github/workflows/performance-analysis-on-issue-optimized.yml`
- Optimized version using system prompt
- 8-line task-specific prompt
- ~150 tokens per execution (93% reduction)
- **Status**: Ready to test

### Implementation Plan Workflow

**File**: `../.github/workflows/create-implementation-plan.yml`
- Label-triggered workflow (triggered by `ready-to-plan` label)
- Analyzes feature request issues with full comment thread
- Generates comprehensive implementation plans
- Uses external system prompt for methodology
- **Trigger**: When `ready-to-plan` label is added to an issue
- **Input**: Issue body + all comments + codebase analysis
- **Output**: Implementation plan posted as issue comment
- **Status**: ✅ Active, ready to use

### System Prompts for GitHub Issue Workflows

**File**: `rails-codebase-analysis-system.md`
- Specialized system prompt for analyzing Rails codebases based on GitHub issue data
- Contains Rails expertise, anti-patterns, analysis methodology
- Designed for your two-stage workflow
- **Use this with**: `performance-analysis-on-issue-optimized.yml`

**File**: `implementation-plan-system.md`
- Specialized system prompt for creating implementation plans from feature requests
- Contains planning methodology, task breakdown guidance, testing strategies
- Analyzes issue body + all comments + codebase
- **Use this with**: `create-implementation-plan.yml`

### Documentation for GitHub Issue Workflow

**File**: `github-workflow-comparison.md`
- Detailed comparison of original vs optimized workflow
- Token savings analysis (81% reduction)
- Migration strategies
- Customization guide
- **Read this first** to understand the optimization

## Quick Start Guide

### To Use the Implementation Plan Workflow:

1. **Create a feature request issue** with YAML frontmatter:
   ```markdown
   ---
   repository: owner/repo-to-analyze
   ---

   # Feature: Add CSV export for user data

   We need to add functionality to export user data as CSV...
   ```

2. **Add clarifications in comments**:
   - Discuss requirements
   - Make design decisions
   - Answer questions
   - All comments will be analyzed

3. **Add the `ready-to-plan` label** to trigger the workflow

4. **Review the generated plan**:
   - Claude Code will analyze the codebase
   - Find similar patterns to follow
   - Break down into implementation tasks
   - Post comprehensive plan as comment

5. **Start implementation**:
   - Follow the phased task breakdown
   - Reference the files identified in the plan
   - Use the testing strategy provided

### To Deploy the Optimized Performance Analysis Workflow:

1. **Review the system prompt**:
   ```bash
   cat .github/prompts/rails-codebase-analysis-system.md
   ```

2. **Customize if needed** (optional):
   - Add your app-specific context
   - Adjust performance thresholds
   - Include team coding standards

3. **Test the optimized workflow**:
   - Option A: Deploy and test with specific label
   - Option B: Deploy side-by-side with original
   - Option C: Direct replacement (backup first)

4. **Compare outputs**:
   - Test with 3-5 real performance issues
   - Compare analysis quality
   - Verify `analysis-output.md` is created
   - Check comment formatting

5. **Deploy to production**:
   - Replace `performance-analysis-on-issue.yml` with optimized version
   - Or run both in parallel with different triggers

### File Usage Map

```
Your Two-Stage Workflow:
┌─────────────────────────────────────────────────────────────┐
│ Stage 1: Fetch Data & Create Issue                         │
│ File: create-performance-issue.yml                          │
│ Status: ✅ Active, no changes needed                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Stage 2: Analyze Code & Post Comment                       │
│                                                             │
│ CURRENT (Original):                                         │
│ File: performance-analysis-on-issue.yml                     │
│ Prompt: 123 lines, embedded in workflow                    │
│ Tokens: ~2,000 per run                                     │
│ Status: ✅ Active, in production                            │
│                                                             │
│ OPTIMIZED (New):                                            │
│ File: performance-analysis-on-issue-optimized.yml           │
│ System Prompt: rails-codebase-analysis-system.md           │
│ Task Prompt: 8 lines in workflow                           │
│ Tokens: ~150 per run (93% reduction)                       │
│ Status: ⭐ Ready to test and deploy                         │
└─────────────────────────────────────────────────────────────┘

Documentation:
├── github-workflow-comparison.md    ← Read this for details
├── rails-codebase-analysis-system.md ← System prompt file
└── README.md                        ← You are here
```

## Benefits of Optimization

### Token Savings
- **Per run**: 2,000 → 150 tokens (93% reduction)
- **100 runs/month**: 700K → 135K tokens (81% reduction)
- **Cost savings**: ~$1.70/month (modest but scales)

### Quality Improvements
- Rails-specific anti-pattern detection
- Structured, consistent output
- Quantitative analysis emphasis
- Actionable code-level recommendations

### Maintainability
- Methodology in separate file
- Easy to update and improve
- Reusable across workflows
- Clear separation of concerns

## Support

### Questions?
- Check `github-workflow-comparison.md` for detailed explanations
- Review the system prompt for methodology details
- Compare original vs optimized workflow files

### Issues?
- Verify system prompt file exists and is accessible
- Check that `analysis-output.md` is being created
- Review Claude Code logs in workflow output
- Test with known performance issues first

## Customization

The system prompt (`rails-codebase-analysis-system.md`) can be customized for your specific needs:

### Add Your App Context
```markdown
## Application Context

**Our Stack**:
- Rails version
- Database setup
- Caching strategy
- Deployment platform

**Our Patterns**:
- Service object patterns
- Query object conventions
- Caching strategies
```

### Adjust Thresholds
```markdown
## Severity Classification

For our SLAs:
- Critical: p95 > 1500ms
- High: p95 > 800ms
- Medium: p95 > 400ms
```

### Add Team Standards
```markdown
## Team Coding Standards

- Use `includes` for N+1 (our convention)
- All DB changes need DBA review
- Fragment cache all expensive partials
```

## Architecture Overview

```
AppSignal → Script → GitHub Issue → Claude Code → Analysis Comment
            [Stage 1]               [Stage 2 - OPTIMIZE HERE]

Stage 1 (Working, no changes):
- Fetch AppSignal data
- Parse performance metrics
- Create structured GitHub issue

Stage 2 (Optimize this):
- Parse issue for performance data
- Analyze Rails codebase
- Find root causes
- Generate recommendations
- Post as comment

Optimization: Move methodology to system prompt, shrink task prompt
```

## Migration Checklist

- [ ] Read `github-workflow-comparison.md`
- [ ] Review `rails-codebase-analysis-system.md`
- [ ] Customize system prompt for your app (optional)
- [ ] Deploy `performance-analysis-on-issue-optimized.yml`
- [ ] Test with 3-5 real performance issues
- [ ] Compare output quality with original
- [ ] Verify `analysis-output.md` creation
- [ ] Check GitHub comment formatting
- [ ] Monitor token usage in Claude dashboard
- [ ] Replace original workflow when confident
- [ ] Update documentation with learnings

## Files Summary

### ✅ Prompt Files (This Directory)
- `rails-codebase-analysis-system.md` - System prompt for Rails performance analysis
- `implementation-plan-system.md` - System prompt for implementation planning
- `github-workflow-comparison.md` - Documentation and comparison
- `README.md` - This file

### 🏭 Workflow Files (../.github/workflows/)
- `create-performance-issue.yml` - Stage 1: Fetch AppSignal data and create issue
- `performance-analysis-on-issue.yml` - Stage 2: Original workflow with embedded prompt
- `performance-analysis-on-issue-optimized.yml` - Stage 2: Optimized workflow with system prompt
- `create-implementation-plan.yml` - Label-triggered implementation plan generation

---

**Recommendation**: Start by reading `github-workflow-comparison.md` for a detailed understanding of the optimization, then test `performance-analysis-on-issue-optimized.yml` with real performance issues.
