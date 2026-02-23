import { NextRequest, NextResponse } from 'next/server';
import { projectRevisionsService } from '@/lib/projects/revisions-service';
import { withSecurity } from '@/lib/security/middleware';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

// GET /api/projects/[slug]/revisions/summary - Quick version summaries for efficient browsing
async function GETHandler(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const resolvedParams = await params;
    const { searchParams } = new URL(request.url);

    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const groupBy = searchParams.get('groupBy') || 'day'; // day, week, month
    const includeMilestones = searchParams.get('milestones') !== 'false';
    const includeMinor = searchParams.get('includeMinor') === 'true';

    // Get revisions using ProjectRevisionsService
    const allRevisions = await projectRevisionsService.getRevisions(resolvedParams.slug, {
      limit,
    });

    // Filter minor revisions if requested
    const revisions = includeMinor ? allRevisions : allRevisions.filter(r => !r.is_minor);

    // Get overall stats
    const stats = await projectRevisionsService.getRevisionStats(resolvedParams.slug);

    // Group revisions by time period for better overview
    const groupedRevisions = new Map();
    const milestones: any[] = [];

    revisions.forEach((revision, index) => {
      const prevRevision = index < revisions.length - 1 ? revisions[index + 1] : null;
      const sizeChange = prevRevision ? revision.size_bytes - prevRevision.size_bytes : 0;

      // Get time group
      const timestamp = new Date(revision.revision_timestamp);
      let timeGroup: string;
      if (groupBy === 'week') {
        const year = timestamp.getFullYear();
        const week = getWeekNumber(timestamp);
        timeGroup = `${year}-W${String(week).padStart(2, '0')}`;
      } else if (groupBy === 'month') {
        timeGroup = timestamp.toISOString().substring(0, 7); // YYYY-MM
      } else {
        timeGroup = timestamp.toISOString().substring(0, 10); // YYYY-MM-DD
      }

      // Detect potential milestones
      if (includeMilestones) {
        const isMilestone =
          Math.abs(sizeChange) > 2000 || // Large content changes
          (revision.summary &&
            /\b(release|version|milestone|complete|finish|done)\b/i.test(revision.summary)) ||
          (revision.summary && /\b(major|significant|important)\b/i.test(revision.summary));

        if (isMilestone) {
          milestones.push({
            id: revision.id,
            timestamp: revision.revision_timestamp,
            summary: revision.summary,
            size_change: sizeChange,
            author_name: revision.author_name,
            milestone_type:
              Math.abs(sizeChange) > 2000 ? 'content_milestone' : 'declared_milestone',
          });
        }
      }

      // Initialize group if needed
      if (!groupedRevisions.has(timeGroup)) {
        groupedRevisions.set(timeGroup, {
          period: timeGroup,
          period_display: formatTimePeriod(timeGroup, groupBy),
          revisions: [],
          summary_stats: {
            total_revisions: 0,
            net_size_change: 0,
            major_changes: 0,
            minor_changes: 0,
            unique_sessions: 0,
          },
          content_themes: new Set(),
          dominant_activity: 'editing',
        });
      }

      const groupData = groupedRevisions.get(timeGroup);

      // Detect content type hints
      const content = revision.content || '';
      let contentHint = 'text_only';
      if (content.includes('# ')) contentHint = 'has_headers';
      else if (content.includes('TODO') || content.includes('FIXME')) contentHint = 'has_todos';
      else if (content.includes('![')) contentHint = 'has_images';
      else if (content.includes('```')) contentHint = 'has_code';

      groupData.revisions.push({
        id: revision.id,
        summary: revision.summary || 'No summary',
        summary_preview: createSmartSummary(revision.summary, sizeChange),
        author_name: revision.author_name,
        timestamp: revision.revision_timestamp,
        is_minor: Boolean(revision.is_minor),
        size_change: sizeChange,
        content_hint: contentHint,
        productivity_indicator: calculateQuickProductivityScore(revision, sizeChange, contentHint),
      });

      // Update group statistics
      groupData.summary_stats.total_revisions++;
      groupData.summary_stats.net_size_change += sizeChange;
      if (Math.abs(sizeChange) > 500) groupData.summary_stats.major_changes++;
      else groupData.summary_stats.minor_changes++;

      // Track content themes
      if (contentHint !== 'text_only') {
        groupData.content_themes.add(contentHint);
      }
    });

    // Convert to array and add session estimation
    const periodSummaries = Array.from(groupedRevisions.values()).map(group => {
      // Estimate unique work sessions based on time gaps
      group.revisions.sort(
        (a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      let sessions = 1;
      for (let i = 1; i < group.revisions.length; i++) {
        const timeDiff =
          new Date(group.revisions[i].timestamp).getTime() -
          new Date(group.revisions[i - 1].timestamp).getTime();
        if (timeDiff > 2 * 60 * 60 * 1000) sessions++; // 2+ hours gap = new session
      }
      group.summary_stats.unique_sessions = sessions;

      // Determine dominant activity
      const hasStructuralChanges = group.revisions.some(
        (r: any) => r.content_hint === 'has_headers' || Math.abs(r.size_change) > 1000
      );
      const hasDetailWork = group.revisions.some(
        (r: any) => r.content_hint === 'has_code' || r.content_hint === 'has_todos'
      );

      if (hasStructuralChanges && group.summary_stats.major_changes > 2) {
        group.dominant_activity = 'major_restructuring';
      } else if (hasDetailWork) {
        group.dominant_activity = 'detail_work';
      } else if (group.summary_stats.minor_changes > group.summary_stats.major_changes * 2) {
        group.dominant_activity = 'polishing';
      }

      group.content_themes = Array.from(group.content_themes);
      return group;
    });

    // Overall project insights
    const totalRevisions = revisions.length;
    const totalSizeChange = revisions.reduce((sum, r, i) => {
      const prev = i < revisions.length - 1 ? revisions[i + 1] : null;
      return sum + (prev ? r.size_bytes - prev.size_bytes : 0);
    }, 0);

    const recentActivityPattern = analyzeRecentActivity(periodSummaries.slice(0, 5));

    return NextResponse.json({
      project_slug: resolvedParams.slug,
      overview: {
        total_revisions: totalRevisions,
        total_all_time: stats.total_revisions,
        total_size_change: totalSizeChange,
        size_change_formatted: formatSizeChange(totalSizeChange),
        most_recent: revisions[0]?.revision_timestamp,
        time_span:
          revisions.length > 0
            ? {
                from: revisions[revisions.length - 1]?.revision_timestamp,
                to: revisions[0]?.revision_timestamp,
              }
            : null,
        grouping: groupBy,
      },
      period_summaries: periodSummaries,
      milestones: milestones
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10),
      insights: {
        recent_activity_pattern: recentActivityPattern,
        most_productive_period: findMostProductivePeriod(periodSummaries),
        editing_consistency: calculateEditingConsistency(periodSummaries),
        content_evolution: analyzeContentEvolution(periodSummaries),
      },
      quick_actions: generateQuickActions(periodSummaries, milestones),
    });
  } catch (error) {
    logger.error('Error generating revision summary:', error);
    return NextResponse.json({ error: 'Failed to generate revision summary' }, { status: 500 });
  }
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function createSmartSummary(originalSummary: string | null, sizeChange: number): string {
  if (originalSummary && originalSummary.trim()) {
    return originalSummary.length > 80 ? originalSummary.substring(0, 77) + '...' : originalSummary;
  }

  // Generate smart summary based on change size
  if (Math.abs(sizeChange) > 2000)
    return `Major content ${sizeChange > 0 ? 'addition' : 'removal'} (${formatSizeChange(sizeChange)})`;
  if (Math.abs(sizeChange) > 500)
    return `Moderate ${sizeChange > 0 ? 'expansion' : 'reduction'} (${formatSizeChange(sizeChange)})`;
  if (sizeChange > 0) return `Small addition (${formatSizeChange(sizeChange)})`;
  if (sizeChange < 0) return `Minor edit (${formatSizeChange(sizeChange)})`;
  return 'Content adjustment';
}

function calculateQuickProductivityScore(
  revision: any,
  sizeChange: number,
  contentHint: string
): 'high' | 'medium' | 'low' {
  let score = 0;

  // Size change contribution
  if (Math.abs(sizeChange) > 1000) score += 3;
  else if (Math.abs(sizeChange) > 200) score += 2;
  else if (sizeChange !== 0) score += 1;

  // Summary quality
  if (revision.summary && revision.summary.length > 20) score += 2;
  else if (revision.summary && revision.summary.length > 0) score += 1;

  // Content type hints
  if (contentHint === 'has_headers') score += 2;
  else if (contentHint !== 'text_only') score += 1;

  if (score >= 5) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
}

function formatTimePeriod(period: string, groupBy: string): string {
  if (groupBy === 'week') {
    const [year, week] = period.split('-W');
    return `Week ${week}, ${year}`;
  }
  if (groupBy === 'month') {
    const [year, month] = period.split('-');
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const monthIndex = parseInt(month || '1') - 1;
    return `${monthNames[monthIndex] || 'Unknown'} ${year || ''}`;
  }
  return period; // day format is already good
}

function formatSizeChange(bytes: number): string {
  if (bytes === 0) return 'no change';
  const abs = Math.abs(bytes);
  const sign = bytes > 0 ? '+' : '-';

  if (abs < 1024) return `${sign}${abs}B`;
  if (abs < 1024 * 1024) return `${sign}${(abs / 1024).toFixed(1)}KB`;
  return `${sign}${(abs / (1024 * 1024)).toFixed(2)}MB`;
}

function analyzeRecentActivity(recentPeriods: any[]): any {
  if (recentPeriods.length === 0) return { pattern: 'inactive', description: 'No recent activity' };

  const totalRevisions = recentPeriods.reduce((sum, p) => sum + p.summary_stats.total_revisions, 0);
  const avgRevisionsPerPeriod = totalRevisions / recentPeriods.length;
  const totalSizeChange = recentPeriods.reduce(
    (sum, p) => sum + p.summary_stats.net_size_change,
    0
  );

  if (avgRevisionsPerPeriod > 10 && totalSizeChange > 5000) {
    return { pattern: 'intensive', description: 'High activity with substantial changes' };
  } else if (avgRevisionsPerPeriod > 5) {
    return { pattern: 'active', description: 'Regular editing activity' };
  } else if (totalRevisions > 0) {
    return { pattern: 'sporadic', description: 'Occasional updates' };
  }

  return { pattern: 'quiet', description: 'Minimal recent activity' };
}

function findMostProductivePeriod(periods: any[]): any {
  if (periods.length === 0) return null;

  const scored = periods
    .map(period => ({
      period: period.period_display,
      score:
        period.summary_stats.total_revisions * 2 +
        Math.min(period.summary_stats.major_changes * 5, 25) +
        Math.min(period.summary_stats.unique_sessions * 3, 15),
      revisions: period.summary_stats.total_revisions,
      major_changes: period.summary_stats.major_changes,
    }))
    .sort((a, b) => b.score - a.score);

  return scored[0];
}

function calculateEditingConsistency(periods: any[]): number {
  if (periods.length < 3) return 0;

  const activePeriods = periods.filter(p => p.summary_stats.total_revisions > 0).length;
  return Math.round((activePeriods / periods.length) * 100);
}

function analyzeContentEvolution(periods: any[]): any {
  const themes = new Map();
  let structuralChanges = 0;
  let detailWork = 0;

  periods.forEach(period => {
    period.content_themes.forEach((theme: string) => {
      themes.set(theme, (themes.get(theme) || 0) + 1);
    });

    if (period.dominant_activity === 'major_restructuring') structuralChanges++;
    if (period.dominant_activity === 'detail_work') detailWork++;
  });

  const dominantTheme = Array.from(themes.entries()).sort((a, b) => b[1] - a[1])[0];

  return {
    dominant_content_type: dominantTheme ? dominantTheme[0] : 'text_only',
    structural_vs_detail: structuralChanges > detailWork ? 'structural_focus' : 'detail_focus',
    content_diversity: themes.size,
  };
}

function generateQuickActions(periods: any[], milestones: any[]): any[] {
  const actions = [];

  if (milestones.length > 0) {
    actions.push({
      type: 'review',
      title: 'Review Recent Milestones',
      description: `${milestones.length} milestone${milestones.length > 1 ? 's' : ''} detected`,
      action: 'show_milestones',
    });
  }

  const recentPeriod = periods[0];
  if (recentPeriod && recentPeriod.summary_stats.major_changes > 3) {
    actions.push({
      type: 'compare',
      title: 'Compare Recent Major Changes',
      description: `${recentPeriod.summary_stats.major_changes} major changes in ${recentPeriod.period_display}`,
      action: 'compare_recent_major',
    });
  }

  return actions;
}

// Apply security middleware
export const GET = withSecurity(GETHandler, {});
