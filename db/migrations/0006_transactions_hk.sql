IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.transactions') AND name = 'hk_freq_months')
  ALTER TABLE dbo.transactions ADD hk_freq_months INT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.transactions') AND name = 'hk_next_charge')
  ALTER TABLE dbo.transactions ADD hk_next_charge DATE NULL;
