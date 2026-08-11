-- Key/value app settings editable from the UI (bookkeeping email, ח.פ., etc.)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'app_settings')
  CREATE TABLE dbo.app_settings (
    skey NVARCHAR(64)  NOT NULL PRIMARY KEY,
    sval NVARCHAR(512) NULL,
    updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
