-- Migration: Add hierarchical asset structure optimization
-- Description: Adds indexes and constraints to optimize hierarchical asset queries
-- Date: 2026-04-05

-- Add index for efficient queries on parent_asset_id
-- This significantly improves performance when querying child assets
CREATE INDEX IF NOT EXISTS idx_asset_parent_id ON public.asset(parent_asset_id);

-- Add index for querying root assets
CREATE INDEX IF NOT EXISTS idx_asset_parent_null ON public.asset(parent_asset_id) WHERE parent_asset_id IS NULL;

-- Add foreign key constraint to ensure referential integrity
-- Prevent child assets from referencing non-existent parents
ALTER TABLE public.asset
ADD CONSTRAINT fk_asset_parent 
FOREIGN KEY (parent_asset_id) 
REFERENCES public.asset(id) 
ON DELETE RESTRICT;

-- Add composite index for both asset_id and parent_asset_id for comprehensive queries
CREATE INDEX IF NOT EXISTS idx_asset_hierarchy ON public.asset(id, parent_asset_id);
