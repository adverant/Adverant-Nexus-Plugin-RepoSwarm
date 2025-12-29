# Installation

This guide covers how to install RepoSwarm in your Nexus environment.

## Prerequisites

- Nexus Platform 1.0.0 or higher
- Active Nexus account
- Appropriate subscription tier (see [Pricing](/docs/pricing.md))

## Installation Methods

### Via Nexus Marketplace (Recommended)

1. Navigate to **Plugins > Marketplace** in your Nexus Dashboard
2. Search for "RepoSwarm"
3. Click **Install**
4. Select your subscription tier
5. Confirm installation

### Via CLI

```bash
nexus plugin install nexus-reposwarm
```

### Via API

```bash
curl -X POST "https://api.adverant.ai/plugins/nexus-reposwarm/install" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

## Post-Installation

After installation, the plugin will be available at:
- **Dashboard**: Plugins > RepoSwarm
- **API**: `https://api.adverant.ai/proxy/nexus-reposwarm/api/v1/*`

## Verification

Verify the installation:

```bash
# Check plugin status
nexus plugin status nexus-reposwarm

# Or via API
curl "https://api.adverant.ai/proxy/nexus-reposwarm/health" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Expected response:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": "..."
}
```

## Troubleshooting

### Installation Fails

1. Verify your Nexus version meets minimum requirements
2. Check your subscription tier supports this plugin
3. Ensure API key has `plugins:install` permission

### Plugin Not Appearing

1. Clear browser cache
2. Refresh the dashboard
3. Check installation status via CLI

## Next Steps

- [Configuration](/docs/getting-started/configuration.md)
- [Quick Start](/docs/getting-started/quickstart.md)
- [API Reference](/docs/api-reference/endpoints.md)
