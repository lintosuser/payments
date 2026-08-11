-- Track whether each invoice was forwarded to the bookkeeping inbox
-- (bk@mail.paperless.tax). bk_sent flips to 1 once the PDF email succeeds.
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.transactions') AND name = 'bk_sent'
)
  ALTER TABLE dbo.transactions ADD bk_sent BIT NOT NULL DEFAULT 0;

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.transactions') AND name = 'bk_sent_at'
)
  ALTER TABLE dbo.transactions ADD bk_sent_at DATETIME2 NULL;
