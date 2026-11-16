-- =====================================================================
-- Complaint & Ticket Management System  |  MySQL 8.x
-- Script 1 of 2: database + tables + indexes
-- Run order: 01_schema.sql -> 02_routines.sql
-- =====================================================================

CREATE DATABASE IF NOT EXISTS ticket_system
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE ticket_system;

-- ---------------------------------------------------------------------
-- USERS  (roles: ADMIN, EMPLOYEE, USER)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    full_name       VARCHAR(100)  NOT NULL,
    email           VARCHAR(150)  NOT NULL,
    password_hash   VARCHAR(100)  NOT NULL,
    role            VARCHAR(20)   NOT NULL DEFAULT 'USER',
    email_verified  TINYINT(1)    NOT NULL DEFAULT 0,
    active          TINYINT(1)    NOT NULL DEFAULT 1,
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT chk_users_role CHECK (role IN ('ADMIN', 'EMPLOYEE', 'USER'))
) ENGINE = InnoDB;

CREATE INDEX idx_users_role ON users (role, active);

-- ---------------------------------------------------------------------
-- OTP TOKENS  (OTP is stored as a hash, never in plain text)
-- purpose: REGISTER | RESET_PASSWORD
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS otp_tokens (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    email       VARCHAR(150) NOT NULL,
    otp_hash    VARCHAR(100) NOT NULL,
    purpose     VARCHAR(30)  NOT NULL,
    expires_at  DATETIME     NOT NULL,
    attempts    INT          NOT NULL DEFAULT 0,
    used        TINYINT(1)   NOT NULL DEFAULT 0,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_otp_purpose CHECK (purpose IN ('REGISTER', 'RESET_PASSWORD'))
) ENGINE = InnoDB;

CREATE INDEX idx_otp_lookup ON otp_tokens (email, purpose, used, expires_at);

-- ---------------------------------------------------------------------
-- TICKETS
-- version column = optimistic locking (checked inside stored procedures)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tickets (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    ticket_no    VARCHAR(20)   NULL,
    title        VARCHAR(200)  NOT NULL,
    description  TEXT          NOT NULL,
    priority     VARCHAR(20)   NOT NULL DEFAULT 'MEDIUM',
    status       VARCHAR(20)   NOT NULL DEFAULT 'OPEN',
    created_by   BIGINT        NOT NULL,
    assigned_to  BIGINT        NULL,
    created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    assigned_at  DATETIME      NULL,
    resolved_at  DATETIME      NULL,
    version      BIGINT        NOT NULL DEFAULT 0,
    CONSTRAINT uq_ticket_no UNIQUE (ticket_no),
    CONSTRAINT fk_ticket_creator  FOREIGN KEY (created_by)  REFERENCES users (id),
    CONSTRAINT fk_ticket_assignee FOREIGN KEY (assigned_to) REFERENCES users (id),
    CONSTRAINT chk_ticket_priority CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    CONSTRAINT chk_ticket_status   CHECK (status IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED'))
) ENGINE = InnoDB;

CREATE INDEX idx_tickets_status_priority ON tickets (status, priority);
CREATE INDEX idx_tickets_created_by      ON tickets (created_by, created_at);
CREATE INDEX idx_tickets_assigned_to     ON tickets (assigned_to, status);
CREATE INDEX idx_tickets_resolved_at     ON tickets (resolved_at);

-- ---------------------------------------------------------------------
-- COMMENTS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ticket_comments (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    ticket_id   BIGINT       NOT NULL,
    user_id     BIGINT       NOT NULL,
    comment     VARCHAR(2000) NOT NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_comment_ticket FOREIGN KEY (ticket_id) REFERENCES tickets (id) ON DELETE CASCADE,
    CONSTRAINT fk_comment_user   FOREIGN KEY (user_id)   REFERENCES users (id)
) ENGINE = InnoDB;

CREATE INDEX idx_comments_ticket ON ticket_comments (ticket_id, created_at);

-- ---------------------------------------------------------------------
-- ATTACHMENTS  (file bytes live on disk, only metadata is stored here)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ticket_attachments (
    id             BIGINT AUTO_INCREMENT PRIMARY KEY,
    ticket_id      BIGINT       NOT NULL,
    uploaded_by    BIGINT       NOT NULL,
    original_name  VARCHAR(255) NOT NULL,
    stored_name    VARCHAR(255) NOT NULL,
    content_type   VARCHAR(100) NULL,
    size_bytes     BIGINT       NOT NULL,
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_attachment_stored UNIQUE (stored_name),
    CONSTRAINT fk_attachment_ticket FOREIGN KEY (ticket_id)   REFERENCES tickets (id) ON DELETE CASCADE,
    CONSTRAINT fk_attachment_user   FOREIGN KEY (uploaded_by) REFERENCES users (id)
) ENGINE = InnoDB;

CREATE INDEX idx_attachments_ticket ON ticket_attachments (ticket_id);

-- ---------------------------------------------------------------------
-- AUDIT LOGS  (who did what, when, from which IP)
-- user_email is copied here so the log stays readable even if a user is changed
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id      BIGINT       NULL,
    user_email   VARCHAR(150) NULL,
    action       VARCHAR(50)  NOT NULL,
    entity_type  VARCHAR(30)  NOT NULL,
    entity_id    BIGINT       NULL,
    details      VARCHAR(1000) NULL,
    ip_address   VARCHAR(45)  NULL,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB;

CREATE INDEX idx_audit_entity  ON audit_logs (entity_type, entity_id, created_at);
CREATE INDEX idx_audit_user    ON audit_logs (user_id, created_at);
CREATE INDEX idx_audit_created ON audit_logs (created_at);
