SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('dbo.audit_log', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.audit_log (
    id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_audit_log PRIMARY KEY DEFAULT NEWID(),
    user_id    UNIQUEIDENTIFIER NULL,
    user_email NVARCHAR(256)    NOT NULL CONSTRAINT df_audit_email DEFAULT '',
    action     NVARCHAR(64)     NOT NULL,
    entity     NVARCHAR(64)     NOT NULL CONSTRAINT df_audit_entity DEFAULT '',
    entity_id  NVARCHAR(256)    NOT NULL CONSTRAINT df_audit_eid   DEFAULT '',
    details    NVARCHAR(MAX)    NOT NULL CONSTRAINT df_audit_det   DEFAULT '',
    ip         NVARCHAR(64)     NOT NULL CONSTRAINT df_audit_ip    DEFAULT '',
    created_at DATETIME2(0)     NOT NULL CONSTRAINT df_audit_ts    DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX ix_audit_created ON dbo.audit_log(created_at DESC);
  CREATE INDEX ix_audit_user    ON dbo.audit_log(user_id);
  CREATE INDEX ix_audit_action  ON dbo.audit_log(action);
END
GO
