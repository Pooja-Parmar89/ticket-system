package com.pooja.ticketsystem.service;

import com.pooja.ticketsystem.dto.Dtos.AuditLogResponse;
import com.pooja.ticketsystem.dto.Dtos.PageResponse;
import com.pooja.ticketsystem.entity.AuditLog;
import com.pooja.ticketsystem.repository.AuditLogRepository;
import com.pooja.ticketsystem.security.UserPrincipal;
import com.pooja.ticketsystem.util.RequestUtils;
import jakarta.persistence.criteria.Predicate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/** Writes audit rows through the stored procedure sp_write_audit_log and reads them back. */
@Service
public class AuditService {

    private static final Logger log = LoggerFactory.getLogger(AuditService.class);

    private final JdbcTemplate jdbc;
    private final AuditLogRepository repository;

    public AuditService(JdbcTemplate jdbc, AuditLogRepository repository) {
        this.jdbc = jdbc;
        this.repository = repository;
    }

    /** Logs an action done by the currently logged-in user (or anonymous when nobody is logged in). */
    public void log(String action, String entityType, Long entityId, String details) {
        UserPrincipal user = RequestUtils.currentUser();
        logAs(user == null ? null : user.getId(), action, entityType, entityId, details);
    }

    /** Logs an action for an explicit user id (used for login / register, before a JWT exists). */
    public void logAs(Long userId, String action, String entityType, Long entityId, String details) {
        try {
            jdbc.update("CALL sp_write_audit_log(?, ?, ?, ?, ?, ?)",
                    userId, action, entityType, entityId, details, RequestUtils.clientIp());
        } catch (Exception ex) {
            // an audit problem must never break the user's request, but it must be visible in the log
            log.error("Could not write audit log {} {}: {}", action, entityType, ex.getMessage());
        }
    }

    public List<AuditLogResponse> historyOfTicket(Long ticketId) {
        return repository.findByEntityTypeAndEntityIdOrderByIdAsc("TICKET", ticketId)
                .stream().map(AuditService::toResponse).toList();
    }

    public PageResponse<AuditLogResponse> search(String action, String entityType, String userEmail, int page, int size) {
        Specification<AuditLog> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (action != null && !action.isBlank()) {
                predicates.add(cb.equal(root.get("action"), action));
            }
            if (entityType != null && !entityType.isBlank()) {
                predicates.add(cb.equal(root.get("entityType"), entityType));
            }
            if (userEmail != null && !userEmail.isBlank()) {
                predicates.add(cb.like(cb.lower(root.get("userEmail")), "%" + userEmail.toLowerCase() + "%"));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        Page<AuditLog> result = repository.findAll(spec,
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100), Sort.by(Sort.Direction.DESC, "id")));
        return new PageResponse<>(result.getContent().stream().map(AuditService::toResponse).toList(),
                result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages());
    }

    private static AuditLogResponse toResponse(AuditLog a) {
        return new AuditLogResponse(a.getId(), a.getUserId(), a.getUserEmail(), a.getAction(),
                a.getEntityType(), a.getEntityId(), a.getDetails(), a.getIpAddress(), a.getCreatedAt());
    }
}
