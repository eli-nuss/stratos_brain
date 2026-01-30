-- Migration: Create supply chain relationships table
-- Date: 2026-01-30
-- Purpose: Store supplier-customer relationships between companies for flow visualization

-- Create the relationships table
CREATE TABLE IF NOT EXISTS supply_chain_relationships (
  relationship_id SERIAL PRIMARY KEY,
  
  -- Supplier (upstream) - can be public asset or private company
  supplier_asset_id BIGINT REFERENCES assets(asset_id) ON DELETE CASCADE,
  supplier_private_id INTEGER REFERENCES private_companies(company_id) ON DELETE CASCADE,
  
  -- Customer (downstream) - can be public asset or private company
  customer_asset_id BIGINT REFERENCES assets(asset_id) ON DELETE CASCADE,
  customer_private_id INTEGER REFERENCES private_companies(company_id) ON DELETE CASCADE,
  
  -- Relationship metadata
  relationship_type VARCHAR(50) NOT NULL DEFAULT 'supplier', -- supplier, partner, investor, acquirer
  relationship_strength VARCHAR(20) DEFAULT 'medium', -- critical, strong, medium, weak
  description TEXT,
  
  -- Business context
  products_services TEXT[], -- What products/services flow in this relationship
  revenue_dependency_percent NUMERIC(5,2), -- How much of customer's supply comes from this supplier
  is_exclusive BOOLEAN DEFAULT FALSE,
  
  -- Timing
  start_year INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  source_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure at least one supplier and one customer is specified
  CONSTRAINT valid_supplier CHECK (supplier_asset_id IS NOT NULL OR supplier_private_id IS NOT NULL),
  CONSTRAINT valid_customer CHECK (customer_asset_id IS NOT NULL OR customer_private_id IS NOT NULL),
  
  -- Prevent duplicate relationships
  CONSTRAINT unique_relationship UNIQUE (supplier_asset_id, supplier_private_id, customer_asset_id, customer_private_id, relationship_type)
);

-- Create indexes for efficient querying
CREATE INDEX idx_scr_supplier_asset ON supply_chain_relationships(supplier_asset_id) WHERE supplier_asset_id IS NOT NULL;
CREATE INDEX idx_scr_supplier_private ON supply_chain_relationships(supplier_private_id) WHERE supplier_private_id IS NOT NULL;
CREATE INDEX idx_scr_customer_asset ON supply_chain_relationships(customer_asset_id) WHERE customer_asset_id IS NOT NULL;
CREATE INDEX idx_scr_customer_private ON supply_chain_relationships(customer_private_id) WHERE customer_private_id IS NOT NULL;
CREATE INDEX idx_scr_relationship_type ON supply_chain_relationships(relationship_type);
CREATE INDEX idx_scr_is_active ON supply_chain_relationships(is_active);

-- Add comments
COMMENT ON TABLE supply_chain_relationships IS 'Stores supplier-customer relationships between companies in the AI supply chain';
COMMENT ON COLUMN supply_chain_relationships.relationship_strength IS 'critical = single source/major dependency, strong = significant supplier, medium = one of several, weak = minor';
COMMENT ON COLUMN supply_chain_relationships.revenue_dependency_percent IS 'Estimated percentage of customer supply/revenue dependent on this supplier';
