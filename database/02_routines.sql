-- =====================================================================
-- Complaint & Ticket Management System  |  MySQL 8.x
-- Script 2 of 2: stored functions + stored procedures
-- Run AFTER 01_schema.sql  (MySQL Workbench: open this file and run all)
--
-- Error codes raised with SIGNAL (the Spring Boot app maps them):
--   45000 -> business rule violated   (HTTP 400)
--   45001 -> optimistic lock conflict (HTTP 409)
--   45002 -> record not found         (HTTP 404)
-- =====================================================================

USE ticket_system;

DROP FUNCTION  IF EXISTS fn_priority_sla_hours;
DROP FUNCTION  IF EXISTS fn_resolution_hours;
DROP FUNCTION  IF EXISTS fn_is_sla_breached;
DROP PROCEDURE IF EXISTS sp_write_audit_log;
DROP PROCEDURE IF EXISTS sp_create_ticket;
DROP PROCEDURE IF EXISTS sp_assign_ticket;
DROP PROCEDURE IF EXISTS sp_change_ticket_status;
DROP PROCEDURE IF EXISTS sp_report_summary;
DROP PROCEDURE IF EXISTS sp_report_by_priority;
DROP PROCEDURE IF EXISTS sp_report_by_employee;
DROP PROCEDURE IF EXISTS sp_report_resolved_tickets;

DELIMITER $$

-- ---------------------------------------------------------------------
-- FUNCTION: SLA (target resolution time) in hours for a priority
-- ---------------------------------------------------------------------
CREATE FUNCTION fn_priority_sla_hours(p_priority VARCHAR(20))
    RETURNS INT
    DETERMINISTIC
BEGIN
    RETURN CASE p_priority
               WHEN 'CRITICAL' THEN 4
               WHEN 'HIGH'     THEN 24
               WHEN 'MEDIUM'   THEN 72
               ELSE 120
        END;
END$$

-- ---------------------------------------------------------------------
-- FUNCTION: resolution time in hours (created_at -> resolved_at)
-- returns NULL while the ticket is not resolved
-- ---------------------------------------------------------------------
CREATE FUNCTION fn_resolution_hours(p_ticket_id BIGINT)
    RETURNS DECIMAL(10, 2)
    READS SQL DATA
BEGIN
    DECLARE v_hours DECIMAL(10, 2);

    SELECT ROUND(TIMESTAMPDIFF(MINUTE, created_at, resolved_at) / 60, 2)
    INTO v_hours
    FROM tickets
    WHERE id = p_ticket_id
      AND resolved_at IS NOT NULL;

    RETURN v_hours;
END$$

-- ---------------------------------------------------------------------
-- FUNCTION: 1 if the ticket missed (or is missing) its SLA, else 0
-- resolved ticket   -> compares resolved_at with created_at
-- unresolved ticket -> compares NOW() with created_at
-- ---------------------------------------------------------------------
CREATE FUNCTION fn_is_sla_breached(p_ticket_id BIGINT)
    RETURNS TINYINT(1)
    READS SQL DATA
BEGIN
    DECLARE v_breached TINYINT(1) DEFAULT 0;

    SELECT IF(TIMESTAMPDIFF(MINUTE, created_at, COALESCE(resolved_at, NOW()))
                  > fn_priority_sla_hours(priority) * 60, 1, 0)
    INTO v_breached
    FROM tickets
    WHERE id = p_ticket_id;

    RETURN IFNULL(v_breached, 0);
END$$

-- ---------------------------------------------------------------------
-- PROCEDURE: write one audit row
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_write_audit_log(
    IN p_user_id     BIGINT,
    IN p_action      VARCHAR(50),
    IN p_entity_type VARCHAR(30),
    IN p_entity_id   BIGINT,
    IN p_details     VARCHAR(1000),
    IN p_ip          VARCHAR(45)
)
BEGIN
    DECLARE v_email VARCHAR(150) DEFAULT NULL;

    IF p_user_id IS NOT NULL THEN
        SELECT email INTO v_email FROM users WHERE id = p_user_id;
    END IF;

    INSERT INTO audit_logs (user_id, user_email, action, entity_type, entity_id, details, ip_address)
    VALUES (p_user_id, v_email, p_action, p_entity_type, p_entity_id, p_details, p_ip);
END$$

-- ---------------------------------------------------------------------
-- PROCEDURE: create a ticket (status OPEN) and generate ticket_no
-- returns one row: ticket_id
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_create_ticket(
    IN p_title       VARCHAR(200),
    IN p_description TEXT,
    IN p_priority    VARCHAR(20),
    IN p_created_by  BIGINT,
    IN p_ip          VARCHAR(45)
)
BEGIN
    DECLARE v_ticket_id BIGINT;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
        BEGIN
            ROLLBACK;
            RESIGNAL;
        END;

    IF p_priority NOT IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid priority. Use LOW, MEDIUM, HIGH or CRITICAL';
    END IF;

    START TRANSACTION;

    INSERT INTO tickets (title, description, priority, status, created_by)
    VALUES (p_title, p_description, p_priority, 'OPEN', p_created_by);

    SET v_ticket_id = LAST_INSERT_ID();

    UPDATE tickets
    SET ticket_no = CONCAT('TKT-', DATE_FORMAT(NOW(), '%Y'), '-', LPAD(v_ticket_id, 5, '0'))
    WHERE id = v_ticket_id;

    CALL sp_write_audit_log(p_created_by, 'TICKET_CREATED', 'TICKET', v_ticket_id,
                            CONCAT('Priority ', p_priority, ': ', LEFT(p_title, 150)), p_ip);

    COMMIT;

    SELECT v_ticket_id AS ticket_id;
END$$

-- ---------------------------------------------------------------------
-- PROCEDURE: admin assigns (or re-assigns) a ticket to an employee
-- Uses SELECT ... FOR UPDATE + version check = safe under concurrent users
-- returns one row: new_version
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_assign_ticket(
    IN p_ticket_id        BIGINT,
    IN p_employee_id      BIGINT,
    IN p_actor_id         BIGINT,
    IN p_expected_version BIGINT,
    IN p_ip               VARCHAR(45)
)
BEGIN
    DECLARE v_status   VARCHAR(20) DEFAULT NULL;
    DECLARE v_version  BIGINT DEFAULT NULL;
    DECLARE v_old_emp  BIGINT DEFAULT NULL;
    DECLARE v_role     VARCHAR(20) DEFAULT NULL;
    DECLARE v_active   TINYINT(1) DEFAULT 0;
    DECLARE v_emp_name VARCHAR(100) DEFAULT NULL;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
        BEGIN
            ROLLBACK;
            RESIGNAL;
        END;

    START TRANSACTION;

    SELECT status, version, assigned_to
    INTO v_status, v_version, v_old_emp
    FROM tickets
    WHERE id = p_ticket_id
        FOR UPDATE;

    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45002' SET MESSAGE_TEXT = 'Ticket not found';
    END IF;

    IF v_version <> p_expected_version THEN
        SIGNAL SQLSTATE '45001'
            SET MESSAGE_TEXT = 'Ticket was modified by someone else. Please refresh and try again';
    END IF;

    IF v_status = 'RESOLVED' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A resolved ticket cannot be assigned again';
    END IF;

    SELECT role, active, full_name
    INTO v_role, v_active, v_emp_name
    FROM users
    WHERE id = p_employee_id;

    IF v_role IS NULL OR v_role <> 'EMPLOYEE' OR v_active = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ticket can only be assigned to an active employee';
    END IF;

    UPDATE tickets
    SET assigned_to = p_employee_id,
        assigned_at = NOW(),
        status      = 'ASSIGNED',
        version     = version + 1
    WHERE id = p_ticket_id;

    CALL sp_write_audit_log(p_actor_id,
                            IF(v_old_emp IS NULL, 'TICKET_ASSIGNED', 'TICKET_REASSIGNED'),
                            'TICKET', p_ticket_id,
                            CONCAT('Assigned to ', v_emp_name, ' (id ', p_employee_id, ')'), p_ip);

    COMMIT;

    SELECT v_version + 1 AS new_version;
END$$

-- ---------------------------------------------------------------------
-- PROCEDURE: move a ticket through the workflow
--   ASSIGNED -> IN_PROGRESS -> RESOLVED   (no skipping, no going back)
-- returns one row: new_version
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_change_ticket_status(
    IN p_ticket_id        BIGINT,
    IN p_new_status       VARCHAR(20),
    IN p_actor_id         BIGINT,
    IN p_expected_version BIGINT,
    IN p_ip               VARCHAR(45)
)
BEGIN
    DECLARE v_status  VARCHAR(20) DEFAULT NULL;
    DECLARE v_version BIGINT DEFAULT NULL;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
        BEGIN
            ROLLBACK;
            RESIGNAL;
        END;

    START TRANSACTION;

    SELECT status, version
    INTO v_status, v_version
    FROM tickets
    WHERE id = p_ticket_id
        FOR UPDATE;

    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45002' SET MESSAGE_TEXT = 'Ticket not found';
    END IF;

    IF v_version <> p_expected_version THEN
        SIGNAL SQLSTATE '45001'
            SET MESSAGE_TEXT = 'Ticket was modified by someone else. Please refresh and try again';
    END IF;

    IF NOT ((v_status = 'ASSIGNED' AND p_new_status = 'IN_PROGRESS')
        OR (v_status = 'IN_PROGRESS' AND p_new_status = 'RESOLVED')) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Invalid status change. Allowed: ASSIGNED -> IN_PROGRESS -> RESOLVED';
    END IF;

    UPDATE tickets
    SET status      = p_new_status,
        resolved_at = IF(p_new_status = 'RESOLVED', NOW(), resolved_at),
        version     = version + 1
    WHERE id = p_ticket_id;

    CALL sp_write_audit_log(p_actor_id, 'TICKET_STATUS_CHANGED', 'TICKET', p_ticket_id,
                            CONCAT(v_status, ' -> ', p_new_status), p_ip);

    COMMIT;

    SELECT v_version + 1 AS new_version;
END$$

-- ---------------------------------------------------------------------
-- REPORT: overall summary for a date range (NULL = no limit)
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_report_summary(IN p_from DATE, IN p_to DATE)
BEGIN
    SELECT COUNT(*)                                                         AS total_tickets,
           IFNULL(SUM(status = 'OPEN'), 0)                                  AS open_count,
           IFNULL(SUM(status = 'ASSIGNED'), 0)                              AS assigned_count,
           IFNULL(SUM(status = 'IN_PROGRESS'), 0)                           AS in_progress_count,
           IFNULL(SUM(status = 'RESOLVED'), 0)                              AS resolved_count,
           ROUND(AVG(CASE WHEN status = 'RESOLVED'
                              THEN TIMESTAMPDIFF(MINUTE, created_at, resolved_at) / 60 END), 2)
                                                                            AS avg_resolution_hours,
           IFNULL(SUM(TIMESTAMPDIFF(MINUTE, created_at, COALESCE(resolved_at, NOW()))
                          > fn_priority_sla_hours(priority) * 60), 0)       AS sla_breached_count
    FROM tickets
    WHERE (p_from IS NULL OR created_at >= p_from)
      AND (p_to IS NULL OR created_at < DATE_ADD(p_to, INTERVAL 1 DAY));
END$$

-- ---------------------------------------------------------------------
-- REPORT: tickets and average resolution time per priority
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_report_by_priority(IN p_from DATE, IN p_to DATE)
BEGIN
    SELECT priority,
           COUNT(*)                                   AS total_tickets,
           IFNULL(SUM(status = 'RESOLVED'), 0)        AS resolved_count,
           ROUND(AVG(CASE WHEN status = 'RESOLVED'
                              THEN TIMESTAMPDIFF(MINUTE, created_at, resolved_at) / 60 END), 2)
                                                      AS avg_resolution_hours,
           fn_priority_sla_hours(priority)            AS sla_hours
    FROM tickets
    WHERE (p_from IS NULL OR created_at >= p_from)
      AND (p_to IS NULL OR created_at < DATE_ADD(p_to, INTERVAL 1 DAY))
    GROUP BY priority
    ORDER BY FIELD(priority, 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW');
END$$

-- ---------------------------------------------------------------------
-- REPORT: workload and performance per employee
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_report_by_employee(IN p_from DATE, IN p_to DATE)
BEGIN
    SELECT u.id                                        AS employee_id,
           u.full_name                                 AS employee_name,
           COUNT(t.id)                                 AS assigned_total,
           IFNULL(SUM(t.status = 'RESOLVED'), 0)       AS resolved_count,
           IFNULL(SUM(t.status IN ('ASSIGNED', 'IN_PROGRESS')), 0) AS pending_count,
           ROUND(AVG(CASE WHEN t.status = 'RESOLVED'
                              THEN TIMESTAMPDIFF(MINUTE, t.created_at, t.resolved_at) / 60 END), 2)
                                                       AS avg_resolution_hours
    FROM users u
             LEFT JOIN tickets t
                       ON t.assigned_to = u.id
                           AND (p_from IS NULL OR t.created_at >= p_from)
                           AND (p_to IS NULL OR t.created_at < DATE_ADD(p_to, INTERVAL 1 DAY))
    WHERE u.role = 'EMPLOYEE'
      AND u.active = 1
    GROUP BY u.id, u.full_name
    ORDER BY resolved_count DESC, u.full_name;
END$$

-- ---------------------------------------------------------------------
-- REPORT: every resolved ticket with its resolution time (used for CSV too)
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_report_resolved_tickets(IN p_from DATE, IN p_to DATE)
BEGIN
    SELECT t.id                          AS ticket_id,
           t.ticket_no,
           t.title,
           t.priority,
           u.full_name                   AS assigned_to_name,
           t.created_at,
           t.resolved_at,
           fn_resolution_hours(t.id)     AS resolution_hours,
           fn_priority_sla_hours(t.priority) AS sla_hours,
           fn_is_sla_breached(t.id)      AS sla_breached
    FROM tickets t
             LEFT JOIN users u ON u.id = t.assigned_to
    WHERE t.status = 'RESOLVED'
      AND (p_from IS NULL OR t.created_at >= p_from)
      AND (p_to IS NULL OR t.created_at < DATE_ADD(p_to, INTERVAL 1 DAY))
    ORDER BY t.resolved_at DESC;
END$$

DELIMITER ;
