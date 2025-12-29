# Database Patterns Analysis

## Objective
Analyze the database layer of the repository to identify patterns, potential issues, and best practices.

## Focus Areas

### 1. Schema Design
- Table relationships and normalization
- Index usage and optimization
- Primary/foreign key constraints
- Data types appropriateness

### 2. Query Patterns
- N+1 query issues
- Missing indexes for common queries
- Complex joins that could be optimized
- Raw SQL vs ORM usage

### 3. Connection Management
- Connection pooling configuration
- Connection leak detection
- Timeout settings
- Retry logic

### 4. Migration Strategy
- Migration versioning
- Rollback capabilities
- Data migration handling
- Schema change impact

### 5. Security
- SQL injection vulnerabilities
- Parameterized queries usage
- Sensitive data handling
- Access control patterns

## Output Format
Provide findings in structured JSON with severity levels (critical, high, medium, low, info).
