# Quick Start

Get up and running with RepoSwarm in 5 minutes.

## Prerequisites

Before starting, ensure you have:
- [ ] Installed RepoSwarm ([Installation Guide](/docs/getting-started/installation.md))
- [ ] Configured the plugin ([Configuration Guide](/docs/getting-started/configuration.md))
- [ ] Valid API key with appropriate scopes

## Your First Operation

### Via Dashboard

1. Navigate to **Plugins > RepoSwarm**
2. Click **New Operation**
3. Fill in the required fields
4. Click **Submit**
5. View results when complete

### Via API

```bash
# Example API call
curl -X POST "https://api.adverant.ai/proxy/nexus-reposwarm/api/v1/operations" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "input": "your-input-here"
  }'
```

**Response:**
```json
{
  "operationId": "op_abc123",
  "status": "processing",
  "estimatedDuration": 30
}
```

### Check Status

```bash
curl "https://api.adverant.ai/proxy/nexus-reposwarm/api/v1/operations/op_abc123" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Response:**
```json
{
  "operationId": "op_abc123",
  "status": "completed",
  "result": {
    // Operation-specific results
  }
}
```

## Common Use Cases

### Use Case 1: Basic Operation
Brief description and example.

### Use Case 2: Advanced Operation
Brief description and example.

### Use Case 3: Batch Processing
Brief description and example.

## SDK Examples

### TypeScript/JavaScript

```typescript
import { NexusClient } from '@adverant/nexus-sdk';

const client = new NexusClient({ apiKey: process.env.NEXUS_API_KEY });
const plugin = client.plugin('nexus-reposwarm');

// Perform operation
const result = await plugin.operation({
  input: 'your-input-here'
});

console.log(result);
```

### Python

```python
from nexus_sdk import NexusClient

client = NexusClient(api_key=os.environ['NEXUS_API_KEY'])
plugin = client.plugin('nexus-reposwarm')

# Perform operation
result = plugin.operation(input='your-input-here')
print(result)
```

## Rate Limits

Be aware of rate limits based on your tier:

| Tier | Requests/Minute | Requests/Hour |
|------|-----------------|---------------|
| Free | 10 | 100 |
| Starter | 60 | 1000 |
| Pro | 300 | 5000 |
| Enterprise | Unlimited | Unlimited |

## Next Steps

- [API Reference](/docs/api-reference/endpoints.md) - Complete API documentation
- [Use Cases](/docs/use-cases/) - Detailed use case examples
- [Architecture](/docs/architecture/overview.md) - Technical deep dive

## Need Help?

- **Documentation**: [docs.adverant.ai/plugins/nexus-reposwarm](https://docs.adverant.ai/plugins/nexus-reposwarm)
- **Discord**: [discord.gg/adverant](https://discord.gg/adverant)
- **Email**: support@adverant.ai
