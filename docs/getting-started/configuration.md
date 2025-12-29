# Configuration

This guide covers configuring RepoSwarm for your use case.

## Configuration Options

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NEXUS_REPOSWARM_API_KEY` | API key for external services | - | No |
| `NEXUS_REPOSWARM_TIMEOUT_MS` | Request timeout in milliseconds | 30000 | No |
| `NEXUS_REPOSWARM_MAX_CONCURRENT` | Maximum concurrent operations | 5 | No |
| `NEXUS_REPOSWARM_LOG_LEVEL` | Logging verbosity | info | No |

### Dashboard Configuration

1. Navigate to **Plugins > RepoSwarm > Settings**
2. Configure options as needed
3. Click **Save**

### API Configuration

```bash
curl -X PATCH "https://api.adverant.ai/proxy/nexus-reposwarm/api/v1/config" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "timeout": 60000,
    "maxConcurrent": 10
  }'
```

## Subscription Tiers

Configuration options vary by subscription tier:

| Feature | Free | Starter | Pro | Enterprise |
|---------|------|---------|-----|------------|
| API Access | Limited | Yes | Yes | Yes |
| Custom Config | No | Basic | Advanced | Full |
| Webhooks | No | No | Yes | Yes |
| Priority Queue | No | No | Yes | Yes |

## Integrations

### Required Integrations

- **MageAgent**: Multi-agent AI orchestration
- **GraphRAG**: Caching and pattern learning

### Optional Integrations

- **FileProcess**: Advanced file processing
- **Webhooks**: Event notifications

## Security Configuration

### API Key Scopes

Ensure your API key has the required scopes:

```
nexus-reposwarm:read    # Read operations
nexus-reposwarm:write   # Write operations
nexus-reposwarm:admin   # Administrative actions
```

### Network Access

The plugin requires network access to:
- `api.adverant.ai`
- External services (if configured)

## Best Practices

1. **Start with defaults**: Begin with default configuration
2. **Monitor performance**: Adjust based on usage patterns
3. **Use appropriate tier**: Select a tier matching your needs
4. **Secure credentials**: Never expose API keys in code

## Next Steps

- [Quick Start](/docs/getting-started/quickstart.md)
- [API Reference](/docs/api-reference/endpoints.md)
