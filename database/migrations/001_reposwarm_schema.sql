-- RepoSwarm Plugin Database Schema
-- Migration: 001_reposwarm_schema.sql
-- Description: Initial schema for repository analysis and monitoring

-- Create schema for RepoSwarm plugin
CREATE SCHEMA IF NOT EXISTS reposwarm;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Repository analysis tracking
CREATE TABLE reposwarm.analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,

  -- Repository information
  repo_url TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  branch TEXT NOT NULL DEFAULT 'main',
  commit_hash TEXT,
  platform TEXT NOT NULL DEFAULT 'github', -- github, gitlab, bitbucket

  -- Analysis configuration
  analysis_depth TEXT NOT NULL DEFAULT 'standard', -- quick, standard, deep
  include_security BOOLEAN DEFAULT true,
  include_performance BOOLEAN DEFAULT true,
  include_documentation BOOLEAN DEFAULT true,
  include_testing BOOLEAN DEFAULT true,
  include_maintainability BOOLEAN DEFAULT true,
  force_reanalysis BOOLEAN DEFAULT false,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'queued', -- queued, cloning, detecting, analyzing, synthesizing, generating, completed, failed
  progress INTEGER DEFAULT 0, -- 0-100
  current_step TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  error_code TEXT,

  -- Detection results
  detected_type TEXT, -- backend, frontend, mobile, infra-as-code, library, monorepo, mixed
  tech_stack JSONB DEFAULT '[]'::jsonb,
  detection_confidence INTEGER DEFAULT 0,

  -- Analysis results
  architecture_doc TEXT, -- Generated .arch.md content
  architecture_data JSONB, -- Structured architecture analysis
  findings JSONB DEFAULT '[]'::jsonb,
  recommendations JSONB DEFAULT '[]'::jsonb,

  -- Dependency graph
  dependencies JSONB DEFAULT '{}'::jsonb,

  -- Usage metrics (for billing)
  tokens_consumed INTEGER DEFAULT 0,
  agents_used INTEGER DEFAULT 0,
  files_analyzed INTEGER DEFAULT 0,
  repo_size_bytes BIGINT DEFAULT 0,
  duration_ms INTEGER DEFAULT 0,
  cache_hit BOOLEAN DEFAULT false,

  -- Webhook callback
  webhook_url TEXT,
  webhook_sent BOOLEAN DEFAULT false,
  webhook_sent_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for analyses table
CREATE INDEX idx_analyses_user_id ON reposwarm.analyses(user_id);
CREATE INDEX idx_analyses_tenant_id ON reposwarm.analyses(tenant_id);
CREATE INDEX idx_analyses_repo_url ON reposwarm.analyses(repo_url);
CREATE INDEX idx_analyses_repo_commit ON reposwarm.analyses(repo_url, commit_hash);
CREATE INDEX idx_analyses_status ON reposwarm.analyses(status);
CREATE INDEX idx_analyses_created_at ON reposwarm.analyses(created_at DESC);
CREATE INDEX idx_analyses_detected_type ON reposwarm.analyses(detected_type);

-- Repository monitors for continuous monitoring
CREATE TABLE reposwarm.monitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,

  -- Repository information
  repo_url TEXT NOT NULL,
  branch TEXT DEFAULT 'main',
  platform TEXT NOT NULL DEFAULT 'github',

  -- Configuration
  poll_interval_hours INTEGER DEFAULT 24,
  analysis_depth TEXT DEFAULT 'standard',

  -- Notification settings
  webhook_url TEXT,
  notify_on JSONB DEFAULT '["architecture-change", "security-issue"]'::jsonb,
  email_notifications BOOLEAN DEFAULT false,

  -- State tracking
  status TEXT DEFAULT 'active', -- active, paused, deleted
  last_check_at TIMESTAMP WITH TIME ZONE,
  last_commit_hash TEXT,
  last_analysis_id UUID REFERENCES reposwarm.analyses(id),
  next_check_at TIMESTAMP WITH TIME ZONE,
  consecutive_failures INTEGER DEFAULT 0,
  last_error TEXT,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for monitors table
CREATE INDEX idx_monitors_user_id ON reposwarm.monitors(user_id);
CREATE INDEX idx_monitors_tenant_id ON reposwarm.monitors(tenant_id);
CREATE INDEX idx_monitors_repo_url ON reposwarm.monitors(repo_url);
CREATE INDEX idx_monitors_status ON reposwarm.monitors(status);
CREATE INDEX idx_monitors_next_check ON reposwarm.monitors(next_check_at)
  WHERE status = 'active';

-- Unique constraint: one active monitor per repo per user
CREATE UNIQUE INDEX idx_monitors_unique_active
  ON reposwarm.monitors(user_id, repo_url)
  WHERE status = 'active';

-- Detailed findings from analysis
CREATE TABLE reposwarm.findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES reposwarm.analyses(id) ON DELETE CASCADE,

  -- Finding details
  agent_type TEXT NOT NULL, -- architecture, security, performance, documentation, testing, maintainability
  finding_type TEXT NOT NULL, -- Same as agent_type for categorization
  severity TEXT, -- critical, high, medium, low, info
  title TEXT NOT NULL,
  description TEXT,
  location TEXT, -- file path or component reference
  line_number INTEGER,
  code_snippet TEXT,

  -- Remediation
  recommendation TEXT,
  effort_estimate TEXT, -- low, medium, high
  auto_fixable BOOLEAN DEFAULT false,

  -- Classification
  category TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  cwe_id TEXT, -- For security findings
  owasp_category TEXT, -- For security findings

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for findings table
CREATE INDEX idx_findings_analysis_id ON reposwarm.findings(analysis_id);
CREATE INDEX idx_findings_severity ON reposwarm.findings(severity);
CREATE INDEX idx_findings_finding_type ON reposwarm.findings(finding_type);
CREATE INDEX idx_findings_agent_type ON reposwarm.findings(agent_type);

-- Webhook delivery tracking
CREATE TABLE reposwarm.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference
  analysis_id UUID REFERENCES reposwarm.analyses(id) ON DELETE SET NULL,
  monitor_id UUID REFERENCES reposwarm.monitors(id) ON DELETE SET NULL,

  -- Delivery details
  webhook_url TEXT NOT NULL,
  event_type TEXT NOT NULL, -- analysis.started, analysis.completed, analysis.failed, monitor.triggered, monitor.change_detected
  payload JSONB NOT NULL,

  -- Response tracking
  status TEXT DEFAULT 'pending', -- pending, delivered, failed
  response_status INTEGER,
  response_body TEXT,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  next_retry_at TIMESTAMP WITH TIME ZONE,

  -- Timing
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivered_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for webhook deliveries
CREATE INDEX idx_webhook_deliveries_analysis ON reposwarm.webhook_deliveries(analysis_id);
CREATE INDEX idx_webhook_deliveries_monitor ON reposwarm.webhook_deliveries(monitor_id);
CREATE INDEX idx_webhook_deliveries_status ON reposwarm.webhook_deliveries(status);
CREATE INDEX idx_webhook_deliveries_retry ON reposwarm.webhook_deliveries(next_retry_at)
  WHERE status = 'pending';

-- Usage tracking for billing
CREATE TABLE reposwarm.usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,

  -- Usage details
  operation TEXT NOT NULL, -- analyze, monitor_check, export
  analysis_id UUID REFERENCES reposwarm.analyses(id) ON DELETE SET NULL,

  -- Metrics
  tokens_consumed INTEGER DEFAULT 0,
  agents_used INTEGER DEFAULT 0,
  files_analyzed INTEGER DEFAULT 0,
  repo_size_bytes BIGINT DEFAULT 0,
  duration_ms INTEGER DEFAULT 0,

  -- Billing
  billable BOOLEAN DEFAULT true,
  billed BOOLEAN DEFAULT false,
  billed_at TIMESTAMP WITH TIME ZONE,
  cost_cents INTEGER DEFAULT 0,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for usage table
CREATE INDEX idx_usage_user_id ON reposwarm.usage(user_id);
CREATE INDEX idx_usage_tenant_id ON reposwarm.usage(tenant_id);
CREATE INDEX idx_usage_created_at ON reposwarm.usage(created_at DESC);
CREATE INDEX idx_usage_billed ON reposwarm.usage(billed) WHERE billed = false;

-- Subscription tiers and limits
CREATE TABLE reposwarm.subscription_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, -- free, starter, professional, enterprise
  display_name TEXT NOT NULL,

  -- Pricing
  price_monthly_cents INTEGER DEFAULT 0,
  price_yearly_cents INTEGER DEFAULT 0,

  -- Limits
  analyses_per_month INTEGER DEFAULT 5, -- -1 for unlimited
  max_repo_size_bytes BIGINT DEFAULT 52428800, -- 50MB default
  max_monitors INTEGER DEFAULT 0,
  max_files_per_analysis INTEGER DEFAULT 1000,

  -- Features
  features JSONB DEFAULT '[]'::jsonb,
  analysis_depths JSONB DEFAULT '["quick", "standard"]'::jsonb,
  export_formats JSONB DEFAULT '["markdown", "json"]'::jsonb,

  -- Settings
  priority_queue BOOLEAN DEFAULT false,
  dedicated_agents BOOLEAN DEFAULT false,
  custom_prompts BOOLEAN DEFAULT false,

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default tiers
INSERT INTO reposwarm.subscription_tiers (name, display_name, price_monthly_cents, analyses_per_month, max_repo_size_bytes, max_monitors, features, analysis_depths, export_formats)
VALUES
  ('free', 'Free', 0, 5, 52428800, 0, '["quick-analysis", "basic-detection"]', '["quick"]', '["markdown", "json"]'),
  ('starter', 'Starter', 2900, 50, 524288000, 5, '["standard-analysis", "security-scan", "history"]', '["quick", "standard"]', '["markdown", "json", "html"]'),
  ('professional', 'Professional', 9900, 500, 2147483648, 25, '["deep-analysis", "monitoring", "webhooks", "api-access", "all-formats"]', '["quick", "standard", "deep"]', '["markdown", "json", "html", "pdf"]'),
  ('enterprise', 'Enterprise', 49900, -1, -1, -1, '["everything", "priority-support", "custom-prompts", "sla", "dedicated-agents"]', '["quick", "standard", "deep"]', '["markdown", "json", "html", "pdf"]');

-- User subscriptions
CREATE TABLE reposwarm.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  tier_id UUID NOT NULL REFERENCES reposwarm.subscription_tiers(id),

  -- Billing
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,

  -- Status
  status TEXT DEFAULT 'active', -- active, cancelled, past_due, trialing
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT false,

  -- Usage tracking
  analyses_used_this_period INTEGER DEFAULT 0,
  period_reset_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for user subscriptions
CREATE INDEX idx_user_subscriptions_user ON reposwarm.user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_tenant ON reposwarm.user_subscriptions(tenant_id);
CREATE INDEX idx_user_subscriptions_status ON reposwarm.user_subscriptions(status);
CREATE UNIQUE INDEX idx_user_subscriptions_unique ON reposwarm.user_subscriptions(user_id)
  WHERE status = 'active';

-- Analysis templates for common repository types
CREATE TABLE reposwarm.analysis_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,

  -- Target
  target_type TEXT NOT NULL, -- backend, frontend, mobile, etc.
  tech_stack_patterns JSONB DEFAULT '[]'::jsonb,

  -- Configuration
  analysis_config JSONB NOT NULL,
  prompt_overrides JSONB DEFAULT '{}'::jsonb,

  -- Usage
  is_public BOOLEAN DEFAULT false,
  created_by UUID,
  usage_count INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for templates
CREATE INDEX idx_templates_target_type ON reposwarm.analysis_templates(target_type);
CREATE INDEX idx_templates_public ON reposwarm.analysis_templates(is_public) WHERE is_public = true;

-- Row-Level Security policies
ALTER TABLE reposwarm.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE reposwarm.monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE reposwarm.findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reposwarm.usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE reposwarm.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS policies for tenant isolation
CREATE POLICY tenant_isolation_analyses ON reposwarm.analyses
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_monitors ON reposwarm.monitors
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_usage ON reposwarm.usage
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_subscriptions ON reposwarm.user_subscriptions
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION reposwarm.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_analyses_updated_at
    BEFORE UPDATE ON reposwarm.analyses
    FOR EACH ROW
    EXECUTE FUNCTION reposwarm.update_updated_at_column();

CREATE TRIGGER update_monitors_updated_at
    BEFORE UPDATE ON reposwarm.monitors
    FOR EACH ROW
    EXECUTE FUNCTION reposwarm.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON reposwarm.user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION reposwarm.update_updated_at_column();

-- Comments for documentation
COMMENT ON SCHEMA reposwarm IS 'RepoSwarm plugin - AI-powered repository analysis';
COMMENT ON TABLE reposwarm.analyses IS 'Repository analysis jobs and results';
COMMENT ON TABLE reposwarm.monitors IS 'Continuous repository monitoring configuration';
COMMENT ON TABLE reposwarm.findings IS 'Detailed findings from repository analysis';
COMMENT ON TABLE reposwarm.webhook_deliveries IS 'Webhook delivery tracking for notifications';
COMMENT ON TABLE reposwarm.usage IS 'Usage tracking for billing';
COMMENT ON TABLE reposwarm.subscription_tiers IS 'Available subscription tiers and limits';
COMMENT ON TABLE reposwarm.user_subscriptions IS 'User subscription status and usage';
COMMENT ON TABLE reposwarm.analysis_templates IS 'Reusable analysis templates';
