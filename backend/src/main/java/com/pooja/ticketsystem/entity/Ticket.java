package com.pooja.ticketsystem.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Tickets are CREATED and CHANGED only by MySQL stored procedures
 * (sp_create_ticket, sp_assign_ticket, sp_change_ticket_status), so this entity is read-only.
 * The 'version' column is the optimistic-lock counter checked inside the procedures.
 */
@Entity
@Table(name = "tickets")
@Getter
@Setter
@NoArgsConstructor
public class Ticket {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ticket_no", insertable = false, updatable = false)
    private String ticketNo;

    @Column(insertable = false, updatable = false)
    private String title;

    @Column(insertable = false, updatable = false)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(insertable = false, updatable = false)
    private Priority priority;

    @Enumerated(EnumType.STRING)
    @Column(insertable = false, updatable = false)
    private TicketStatus status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", insertable = false, updatable = false)
    private User createdBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_to", insertable = false, updatable = false)
    private User assignedTo;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    @Column(name = "assigned_at", insertable = false, updatable = false)
    private LocalDateTime assignedAt;

    @Column(name = "resolved_at", insertable = false, updatable = false)
    private LocalDateTime resolvedAt;

    @Column(insertable = false, updatable = false)
    private Long version;
}
