IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.transactions') AND name = 'short_code'
)
  ALTER TABLE dbo.transactions ADD short_code NVARCHAR(8) NULL;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.transactions') AND name = 'IX_transactions_short_code'
)
  CREATE UNIQUE INDEX IX_transactions_short_code
    ON dbo.transactions (short_code)
    WHERE short_code IS NOT NULL;
