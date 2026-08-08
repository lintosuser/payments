-- Lintos payments — initial schema for SQL Server 2019+
-- Run on the target database (e.g. PaymentsDB).
-- Login + DB user (paymentUser) are assumed to exist; this file only creates schema.
-- Idempotent: safe to re-run.

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-------------------------------------------------------------------------------
-- admin_users: app login accounts (bcrypt-hashed password).
-------------------------------------------------------------------------------
IF OBJECT_ID('dbo.admin_users', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.admin_users (
    id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_admin_users PRIMARY KEY DEFAULT NEWID(),
    email         NVARCHAR(256) NOT NULL,
    password_hash NVARCHAR(256) NOT NULL,
    created_at    DATETIME2(0)  NOT NULL DEFAULT SYSUTCDATETIME()
  );
  CREATE UNIQUE INDEX ux_admin_users_email ON dbo.admin_users(email);
END
GO

-------------------------------------------------------------------------------
-- sessions: opaque cookie tokens. token_hash = sha256(hex) of the raw token.
-------------------------------------------------------------------------------
IF OBJECT_ID('dbo.sessions', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.sessions (
    id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_sessions PRIMARY KEY DEFAULT NEWID(),
    user_id    UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_sessions_user
                 REFERENCES dbo.admin_users(id) ON DELETE CASCADE,
    token_hash CHAR(64)      NOT NULL,
    expires_at DATETIME2(0)  NOT NULL,
    created_at DATETIME2(0)  NOT NULL DEFAULT SYSUTCDATETIME()
  );
  CREATE UNIQUE INDEX ux_sessions_token_hash ON dbo.sessions(token_hash);
  CREATE INDEX ix_sessions_expires ON dbo.sessions(expires_at);
END
GO

-------------------------------------------------------------------------------
-- clients
-------------------------------------------------------------------------------
IF OBJECT_ID('dbo.clients', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.clients (
    id              UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_clients PRIMARY KEY DEFAULT NEWID(),
    first_name      NVARCHAR(120) NOT NULL,
    last_name       NVARCHAR(120) NOT NULL,
    user_id         NVARCHAR(64)  NOT NULL,
    email           NVARCHAR(256) NOT NULL,
    phone           NVARCHAR(40)  NOT NULL CONSTRAINT df_clients_phone DEFAULT '',
    cell            NVARCHAR(40)  NOT NULL,
    street          NVARCHAR(200) NOT NULL CONSTRAINT df_clients_street DEFAULT '',
    city            NVARCHAR(120) NOT NULL CONSTRAINT df_clients_city   DEFAULT '',
    zip             NVARCHAR(20)  NOT NULL CONSTRAINT df_clients_zip    DEFAULT '',
    token           NVARCHAR(256) NULL,
    token_exp_month NVARCHAR(2)   NULL,
    token_exp_year  NVARCHAR(4)   NULL,
    l4digit         NVARCHAR(4)   NULL,
    notes           NVARCHAR(MAX) NOT NULL CONSTRAINT df_clients_notes  DEFAULT '',
    owner_id        UNIQUEIDENTIFIER NULL CONSTRAINT fk_clients_owner
                      REFERENCES dbo.admin_users(id),
    created_at      DATETIME2(0)  NOT NULL CONSTRAINT df_clients_created DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2(0)  NOT NULL CONSTRAINT df_clients_updated DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX ix_clients_owner   ON dbo.clients(owner_id);
  CREATE INDEX ix_clients_user_id ON dbo.clients(user_id);
END
GO

-- updated_at trigger
IF OBJECT_ID('dbo.trg_clients_updated', 'TR') IS NOT NULL DROP TRIGGER dbo.trg_clients_updated;
GO
CREATE TRIGGER dbo.trg_clients_updated ON dbo.clients
AFTER UPDATE AS
BEGIN
  SET NOCOUNT ON;
  UPDATE c SET updated_at = SYSUTCDATETIME()
    FROM dbo.clients c JOIN inserted i ON c.id = i.id;
END
GO

-------------------------------------------------------------------------------
-- transactions
-- yaad_id keeps the legacy column name but holds the active provider's tx id
-- (Tranzila index / YaadPay Id). No migration cost to rename later.
-------------------------------------------------------------------------------
IF OBJECT_ID('dbo.transactions', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.transactions (
    id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_transactions PRIMARY KEY DEFAULT NEWID(),
    yaad_id     NVARCHAR(64)  NOT NULL CONSTRAINT df_tx_yaadid DEFAULT '',
    amount      DECIMAL(12,2) NOT NULL,
    coin        SMALLINT      NOT NULL CONSTRAINT df_tx_coin DEFAULT 1,
    status      NVARCHAR(32)  NOT NULL,
    ccode       NVARCHAR(8)   NOT NULL CONSTRAINT df_tx_ccode  DEFAULT '',
    acode       NVARCHAR(32)  NOT NULL CONSTRAINT df_tx_acode  DEFAULT '',
    info        NVARCHAR(500) NOT NULL,
    hesh        NVARCHAR(64)  NOT NULL CONSTRAINT df_tx_hesh   DEFAULT '',
    type        NVARCHAR(32)  NOT NULL,
    l4digit     NVARCHAR(8)   NOT NULL CONSTRAINT df_tx_l4     DEFAULT '',
    brand       NVARCHAR(32)  NOT NULL CONSTRAINT df_tx_brand  DEFAULT '',
    bank        NVARCHAR(32)  NOT NULL CONSTRAINT df_tx_bank   DEFAULT '',
    payment_url NVARCHAR(2000) NOT NULL CONSTRAINT df_tx_url   DEFAULT '',
    client_id   UNIQUEIDENTIFIER NULL CONSTRAINT fk_tx_client REFERENCES dbo.clients(id),
    owner_id    UNIQUEIDENTIFIER NULL CONSTRAINT fk_tx_owner  REFERENCES dbo.admin_users(id),
    created_at  DATETIME2(0)  NOT NULL CONSTRAINT df_tx_created DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX ix_tx_owner   ON dbo.transactions(owner_id);
  CREATE INDEX ix_tx_client  ON dbo.transactions(client_id);
  CREATE INDEX ix_tx_created ON dbo.transactions(created_at DESC);
  CREATE INDEX ix_tx_yaad_id ON dbo.transactions(yaad_id);
END
GO
