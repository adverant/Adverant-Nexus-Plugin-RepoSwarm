/**
 * Monitor Worker for RepoSwarm
 * Runs as a CronJob to check monitored repositories for changes
 */

import axios from 'axios';

const REPOSWARM_URL = process.env.REPOSWARM_URL || 'http://nexus-reposwarm:9200';
const DATABASE_URL = process.env.DATABASE_URL;
const BATCH_SIZE = 10;
const MAX_CONCURRENT = 3;

interface Monitor {
  id: string;
  userId: string;
  tenantId: string;
  repoUrl: string;
  branch?: string;
  pollIntervalHours: number;
  webhookUrl?: string;
  notifyOn: string[];
  status: string;
  lastCheckAt?: Date;
  lastCommitHash?: string;
  nextCheckAt?: Date;
  consecutiveFailures: number;
}

interface MonitorCheckResult {
  monitorId: string;
  success: boolean;
  hasChanges: boolean;
  newCommitHash?: string;
  analysisId?: string;
  error?: string;
}

async function getMonitorsDue(): Promise<Monitor[]> {
  // In production, this would query the database for monitors
  // where next_check_at <= NOW() AND status = 'active'
  console.log('Fetching monitors due for check...');

  // TODO: Implement actual database query
  // For now, return empty array - would query reposwarm.monitors table
  // SELECT * FROM reposwarm.monitors
  // WHERE status = 'active'
  //   AND (next_check_at IS NULL OR next_check_at <= NOW())
  // ORDER BY next_check_at ASC
  // LIMIT $BATCH_SIZE

  return [];
}

async function getLatestCommit(
  repoUrl: string,
  branch?: string
): Promise<string | null> {
  try {
    // Parse the repository URL to determine platform
    const url = new URL(repoUrl);
    const host = url.hostname.toLowerCase();

    if (host.includes('github.com')) {
      return await getGitHubLatestCommit(repoUrl, branch);
    } else if (host.includes('gitlab.com')) {
      return await getGitLabLatestCommit(repoUrl, branch);
    } else if (host.includes('bitbucket.org')) {
      return await getBitbucketLatestCommit(repoUrl, branch);
    }

    console.warn(`Unsupported platform for: ${repoUrl}`);
    return null;
  } catch (error) {
    console.error(`Failed to get latest commit for ${repoUrl}:`, error);
    return null;
  }
}

async function getGitHubLatestCommit(
  repoUrl: string,
  branch = 'main'
): Promise<string | null> {
  // Extract owner/repo from URL
  const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) return null;

  const [, owner, repo] = match;
  const repoName = repo.replace(/\.git$/, '');

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };

  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }

  const response = await axios.get(
    `https://api.github.com/repos/${owner}/${repoName}/commits/${branch}`,
    { headers, timeout: 10000 }
  );

  return response.data.sha;
}

async function getGitLabLatestCommit(
  repoUrl: string,
  branch = 'main'
): Promise<string | null> {
  // Extract project path from URL
  const match = repoUrl.match(/gitlab\.com\/(.+?)(?:\.git)?$/);
  if (!match) return null;

  const projectPath = encodeURIComponent(match[1]);

  const headers: Record<string, string> = {};
  if (process.env.GITLAB_TOKEN) {
    headers['PRIVATE-TOKEN'] = process.env.GITLAB_TOKEN;
  }

  const response = await axios.get(
    `https://gitlab.com/api/v4/projects/${projectPath}/repository/commits/${branch}`,
    { headers, timeout: 10000 }
  );

  return response.data.id;
}

async function getBitbucketLatestCommit(
  repoUrl: string,
  branch = 'main'
): Promise<string | null> {
  // Extract workspace/repo from URL
  const match = repoUrl.match(/bitbucket\.org\/([^\/]+)\/([^\/]+)/);
  if (!match) return null;

  const [, workspace, repo] = match;
  const repoName = repo.replace(/\.git$/, '');

  const headers: Record<string, string> = {};
  if (process.env.BITBUCKET_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.BITBUCKET_TOKEN}`;
  }

  const response = await axios.get(
    `https://api.bitbucket.org/2.0/repositories/${workspace}/${repoName}/commits/${branch}`,
    { headers, timeout: 10000 }
  );

  return response.data.values?.[0]?.hash;
}

async function triggerAnalysis(
  monitor: Monitor
): Promise<{ analysisId: string } | null> {
  try {
    const response = await axios.post(
      `${REPOSWARM_URL}/api/v1/reposwarm/analyze`,
      {
        repoUrl: monitor.repoUrl,
        branch: monitor.branch,
        force: true,
        analysisDepth: 'standard',
        webhookUrl: monitor.webhookUrl,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': monitor.userId,
          'X-Tenant-Id': monitor.tenantId,
        },
        timeout: 30000,
      }
    );

    return { analysisId: response.data.data?.analysisId };
  } catch (error) {
    console.error(`Failed to trigger analysis for monitor ${monitor.id}:`, error);
    return null;
  }
}

async function sendWebhookNotification(
  monitor: Monitor,
  event: 'monitor.triggered' | 'monitor.change_detected',
  data: Record<string, unknown>
): Promise<boolean> {
  if (!monitor.webhookUrl) return true;

  try {
    await axios.post(
      monitor.webhookUrl,
      {
        event,
        timestamp: new Date().toISOString(),
        data: {
          monitorId: monitor.id,
          repoUrl: monitor.repoUrl,
          branch: monitor.branch,
          ...data,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'RepoSwarm-Monitor/1.0',
        },
        timeout: 30000,
      }
    );
    return true;
  } catch (error) {
    console.error(`Failed to send webhook for monitor ${monitor.id}:`, error);
    return false;
  }
}

async function updateMonitorState(
  monitorId: string,
  updates: {
    lastCheckAt?: Date;
    lastCommitHash?: string;
    nextCheckAt?: Date;
    consecutiveFailures?: number;
    lastError?: string;
  }
): Promise<void> {
  // TODO: Implement actual database update
  console.log(`Updating monitor ${monitorId}:`, updates);
}

async function processMonitor(monitor: Monitor): Promise<MonitorCheckResult> {
  console.log(`Processing monitor ${monitor.id} for ${monitor.repoUrl}`);

  try {
    // Get latest commit
    const latestCommit = await getLatestCommit(monitor.repoUrl, monitor.branch);

    if (!latestCommit) {
      return {
        monitorId: monitor.id,
        success: false,
        hasChanges: false,
        error: 'Failed to get latest commit',
      };
    }

    // Check if there are changes
    const hasChanges = monitor.lastCommitHash !== latestCommit;

    if (hasChanges) {
      console.log(`Changes detected for ${monitor.repoUrl}: ${monitor.lastCommitHash} -> ${latestCommit}`);

      // Send change detected webhook
      await sendWebhookNotification(monitor, 'monitor.change_detected', {
        previousCommit: monitor.lastCommitHash,
        newCommit: latestCommit,
      });

      // Trigger new analysis
      const analysisResult = await triggerAnalysis(monitor);

      // Update monitor state
      const nextCheckAt = new Date(
        Date.now() + monitor.pollIntervalHours * 60 * 60 * 1000
      );

      await updateMonitorState(monitor.id, {
        lastCheckAt: new Date(),
        lastCommitHash: latestCommit,
        nextCheckAt,
        consecutiveFailures: 0,
      });

      return {
        monitorId: monitor.id,
        success: true,
        hasChanges: true,
        newCommitHash: latestCommit,
        analysisId: analysisResult?.analysisId,
      };
    } else {
      console.log(`No changes for ${monitor.repoUrl}`);

      // Update next check time
      const nextCheckAt = new Date(
        Date.now() + monitor.pollIntervalHours * 60 * 60 * 1000
      );

      await updateMonitorState(monitor.id, {
        lastCheckAt: new Date(),
        nextCheckAt,
        consecutiveFailures: 0,
      });

      return {
        monitorId: monitor.id,
        success: true,
        hasChanges: false,
      };
    }
  } catch (error) {
    console.error(`Error processing monitor ${monitor.id}:`, error);

    // Update failure count
    await updateMonitorState(monitor.id, {
      consecutiveFailures: monitor.consecutiveFailures + 1,
      lastError: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      monitorId: monitor.id,
      success: false,
      hasChanges: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function processMonitorsBatch(monitors: Monitor[]): Promise<MonitorCheckResult[]> {
  const results: MonitorCheckResult[] = [];

  // Process in batches with limited concurrency
  for (let i = 0; i < monitors.length; i += MAX_CONCURRENT) {
    const batch = monitors.slice(i, i + MAX_CONCURRENT);
    const batchResults = await Promise.all(batch.map(processMonitor));
    results.push(...batchResults);
  }

  return results;
}

async function main(): Promise<void> {
  console.log('Starting RepoSwarm Monitor Worker...');
  console.log(`RepoSwarm URL: ${REPOSWARM_URL}`);
  console.log(`Database configured: ${!!DATABASE_URL}`);

  const startTime = Date.now();
  let totalProcessed = 0;
  let totalChanges = 0;
  let totalErrors = 0;

  try {
    // Get all monitors due for checking
    const monitors = await getMonitorsDue();
    console.log(`Found ${monitors.length} monitors due for check`);

    if (monitors.length === 0) {
      console.log('No monitors to process');
      return;
    }

    // Process monitors in batches
    const results = await processMonitorsBatch(monitors);

    // Summarize results
    for (const result of results) {
      totalProcessed++;
      if (result.hasChanges) totalChanges++;
      if (!result.success) totalErrors++;
    }

    const duration = Date.now() - startTime;
    console.log('\n=== Monitor Worker Summary ===');
    console.log(`Total Processed: ${totalProcessed}`);
    console.log(`Changes Detected: ${totalChanges}`);
    console.log(`Errors: ${totalErrors}`);
    console.log(`Duration: ${duration}ms`);
    console.log('==============================\n');
  } catch (error) {
    console.error('Monitor worker failed:', error);
    process.exit(1);
  }
}

// Run the worker
main()
  .then(() => {
    console.log('Monitor worker completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Monitor worker failed:', error);
    process.exit(1);
  });
