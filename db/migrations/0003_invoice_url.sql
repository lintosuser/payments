-- Store the Tranzila retrieval URL for each issued invoice so we can re-open
-- the existing PDF instead of creating a duplicate document.
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF COL_LENGTH('dbo.transactions', 'invoice_url') IS NULL
BEGIN
  ALTER TABLE dbo.transactions
    ADD invoice_url NVARCHAR(2000) NOT NULL
        CONSTRAINT df_tx_invoice_url DEFAULT '';
END
GO
