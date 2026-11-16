package com.pooja.ticketsystem.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/** Audit rows are written by the stored procedure sp_write_audit_log, so this entity is read-only. */
@Entity
@Table(name = "audit_logs")
@Getter
@Setter
@NoArgsConstructor
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", insertable = false, updatable = false)
    private Long userId;

    @Column(name = "user_email", insertable = false, updatable = false)
    private String userEmail;

    @Column(insertable = false, updatable = false)
    private String action;

    @Column(name = "entity_type", insertable = false, updatable = false)
    private String entityType;

    @Column(name = "entity_id", insertable = false, updatable = false)
    private Long entityId;

    @Column(insertable = false, updatable = false)
    private String details;

    @Column(name = "ip_address", insertable = false, updatable = false)
    private String ipAddress;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;
}
