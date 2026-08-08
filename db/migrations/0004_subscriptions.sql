SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('dbo.subscriptions', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.subscriptions (
    id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_subscriptions PRIMARY KEY DEFAULT NEWID(),
    client_id   UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_sub_client REFERENCES dbo.clients(id),
    owner_id    UNIQUEIDENTIFIER NULL     CONSTRAINT fk_sub_owner  REFERENCES dbo.admin_users(id),
    amount      DECIMAL(12,2)   NOT NULL,
    coin        SMALLINT        NOT NULL CONSTRAINT df_sub_coin    DEFAULT 1,
    info        NVARCHAR(500)   NOT NULL,
    freq_months INT             NOT NULL CONSTRAINT df_sub_freq    DEFAULT 1,
    next_charge DATE            NOT NULL,
    active      BIT             NOT NULL CONSTRAINT df_sub_active  DEFAULT 1,
    created_at  DATETIME2(0)    NOT NULL CONSTRAINT df_sub_created DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX ix_sub_client ON dbo.subscriptions(client_id);
  CREATE INDEX ix_sub_due    ON dbo.subscriptions(next_charge, active);
END
GO
