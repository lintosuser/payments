-- Add business_name to clients. Either business_name OR (first_name + last_name)
-- must be present — enforced at the API level, not via CHECK constraint, so CSV
-- imports of partial historical data don't fail.
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF COL_LENGTH('dbo.clients', 'business_name') IS NULL
BEGIN
  ALTER TABLE dbo.clients
    ADD business_name NVARCHAR(256) NOT NULL
        CONSTRAINT df_clients_business_name DEFAULT '';
END
GO
