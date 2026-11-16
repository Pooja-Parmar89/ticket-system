package com.pooja.ticketsystem.service;

import com.pooja.ticketsystem.exception.BusinessException;
import com.pooja.ticketsystem.exception.ConflictException;
import com.pooja.ticketsystem.exception.ResourceNotFoundException;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.SQLException;

/**
 * Calls the MySQL stored procedures that change tickets.
 * Each procedure runs its own transaction (SELECT ... FOR UPDATE + version check),
 * so these methods are NOT annotated with @Transactional.
 *
 * SQLSTATE raised by the procedures:  45000 = business rule, 45001 = version conflict, 45002 = not found.
 */
@Component
public class TicketProcedures {

    private final JdbcTemplate jdbc;

    public TicketProcedures(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Long createTicket(String title, String description, String priority, Long createdBy, String ip) {
        return call(() -> jdbc.queryForObject("CALL sp_create_ticket(?, ?, ?, ?, ?)", Long.class,
                title, description, priority, createdBy, ip));
    }

    public Long assignTicket(Long ticketId, Long employeeId, Long actorId, Long expectedVersion, String ip) {
        return call(() -> jdbc.queryForObject("CALL sp_assign_ticket(?, ?, ?, ?, ?)", Long.class,
                ticketId, employeeId, actorId, expectedVersion, ip));
    }

    public Long changeStatus(Long ticketId, String newStatus, Long actorId, Long expectedVersion, String ip) {
        return call(() -> jdbc.queryForObject("CALL sp_change_ticket_status(?, ?, ?, ?, ?)", Long.class,
                ticketId, newStatus, actorId, expectedVersion, ip));
    }

    private <T> T call(java.util.function.Supplier<T> action) {
        try {
            return action.get();
        } catch (DataAccessException ex) {
            SQLException sql = findSqlException(ex);
            if (sql != null && sql.getSQLState() != null) {
                switch (sql.getSQLState()) {
                    case "45000" -> throw new BusinessException(sql.getMessage());
                    case "45001" -> throw new ConflictException(sql.getMessage());
                    case "45002" -> throw new ResourceNotFoundException(sql.getMessage());
                    default -> {
                    }
                }
            }
            throw ex;
        }
    }

    private SQLException findSqlException(Throwable ex) {
        while (ex != null) {
            if (ex instanceof SQLException sql) {
                return sql;
            }
            ex = ex.getCause();
        }
        return null;
    }
}
