package com.pooja.ticketsystem.service;

import com.pooja.ticketsystem.dto.Dtos.*;
import com.pooja.ticketsystem.entity.*;
import com.pooja.ticketsystem.exception.ResourceNotFoundException;
import com.pooja.ticketsystem.repository.TicketRepository;
import com.pooja.ticketsystem.repository.UserRepository;
import com.pooja.ticketsystem.security.UserPrincipal;
import com.pooja.ticketsystem.util.RequestUtils;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class TicketService {

    private final TicketRepository ticketRepository;
    private final UserRepository userRepository;
    private final TicketProcedures procedures;
    private final AuditService auditService;
    private final EmailService emailService;

    public TicketService(TicketRepository ticketRepository, UserRepository userRepository,
                         TicketProcedures procedures, AuditService auditService, EmailService emailService) {
        this.ticketRepository = ticketRepository;
        this.userRepository = userRepository;
        this.procedures = procedures;
        this.auditService = auditService;
        this.emailService = emailService;
    }

    // ------------------------------------------------------------------ create
    public TicketResponse create(CreateTicketRequest request, UserPrincipal me) {
        Long id = procedures.createTicket(request.title().trim(), request.description().trim(),
                request.priority().name(), me.getId(), RequestUtils.clientIp());
        Ticket ticket = load(id);

        emailService.send(List.of(me.getUsername()), "Ticket " + ticket.getTicketNo() + " created",
                "Hi " + me.getFullName() + ",\n\nYour complaint has been registered.\n\nTicket: " + ticket.getTicketNo()
                        + "\nTitle: " + ticket.getTitle() + "\nPriority: " + ticket.getPriority()
                        + "\n\nWe will assign it to a support employee soon.");

        List<String> adminEmails = userRepository.findAll().stream()
                .filter(u -> u.getRole() == Role.ADMIN && u.isActive() && u.isEmailVerified())
                .map(User::getEmail).toList();
        emailService.send(adminEmails, "New ticket " + ticket.getTicketNo() + " (" + ticket.getPriority() + ")",
                "A new ticket needs assignment.\n\nTicket: " + ticket.getTicketNo() + "\nTitle: " + ticket.getTitle()
                        + "\nRaised by: " + me.getFullName());
        return toResponse(ticket);
    }

    // ------------------------------------------------------------------ read
    public PageResponse<TicketResponse> search(TicketStatus status, Priority priority, String text,
                                               int page, int size, UserPrincipal me) {
        Specification<Ticket> spec = visibleTo(me).and(filter(status, priority, text));
        Page<Ticket> result = ticketRepository.findAll(spec,
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 50), Sort.by(Sort.Direction.DESC, "id")));
        return new PageResponse<>(result.getContent().stream().map(TicketService::toResponse).toList(),
                result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages());
    }

    public TicketResponse get(Long id, UserPrincipal me) {
        return toResponse(loadAccessible(id, me));
    }

    public DashboardResponse dashboard(UserPrincipal me) {
        Specification<Ticket> visible = visibleTo(me);
        Map<String, Long> byStatus = new LinkedHashMap<>();
        long total = 0;
        for (TicketStatus s : TicketStatus.values()) {
            long count = ticketRepository.count(visible.and(filter(s, null, null)));
            byStatus.put(s.name(), count);
            total += count;
        }
        Map<String, Long> byPriority = new LinkedHashMap<>();
        for (Priority p : Priority.values()) {
            byPriority.put(p.name(), ticketRepository.count(visible.and(filter(null, p, null))));
        }
        return new DashboardResponse(total, byStatus, byPriority);
    }

    // ------------------------------------------------------------------ workflow
    public TicketResponse assign(Long ticketId, AssignRequest request, UserPrincipal admin) {
        procedures.assignTicket(ticketId, request.employeeId(), admin.getId(), request.version(), RequestUtils.clientIp());
        Ticket ticket = load(ticketId);

        String subject = "Ticket " + ticket.getTicketNo() + " assigned";
        emailService.send(List.of(ticket.getAssignedTo().getEmail()), "New ticket assigned: " + ticket.getTicketNo(),
                "Hi " + ticket.getAssignedTo().getFullName() + ",\n\nTicket " + ticket.getTicketNo() + " has been assigned to you.\n"
                        + "Title: " + ticket.getTitle() + "\nPriority: " + ticket.getPriority()
                        + "\nTarget resolution time: " + ticket.getPriority().slaHours() + " hours");
        emailService.send(List.of(ticket.getCreatedBy().getEmail()), subject,
                "Your ticket " + ticket.getTicketNo() + " is now assigned to " + ticket.getAssignedTo().getFullName() + ".");
        return toResponse(ticket);
    }

    public TicketResponse changeStatus(Long ticketId, StatusRequest request, UserPrincipal me) {
        Ticket current = load(ticketId);
        boolean isAdmin = me.getRole() == Role.ADMIN;
        boolean isAssignee = current.getAssignedTo() != null && current.getAssignedTo().getId().equals(me.getId());
        if (!isAdmin && !isAssignee) {
            throw new AccessDeniedException("Only the assigned employee or an admin can change the status");
        }

        procedures.changeStatus(ticketId, request.status().name(), me.getId(), request.version(), RequestUtils.clientIp());
        Ticket ticket = load(ticketId);

        String body = "Your ticket " + ticket.getTicketNo() + " (" + ticket.getTitle() + ") is now " + ticket.getStatus() + ".";
        if (ticket.getStatus() == TicketStatus.RESOLVED) {
            body += "\nResolved in " + String.format("%.1f", resolutionHours(ticket)) + " hours.";
        }
        emailService.send(List.of(ticket.getCreatedBy().getEmail()),
                "Ticket " + ticket.getTicketNo() + " is " + ticket.getStatus(), body);
        return toResponse(ticket);
    }

    // ------------------------------------------------------------------ helpers shared with other services
    public Ticket load(Long id) {
        return ticketRepository.findWithUsers(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ticket not found"));
    }

    /** Loads the ticket and checks that this user is allowed to see it. */
    public Ticket loadAccessible(Long id, UserPrincipal me) {
        Ticket ticket = load(id);
        boolean allowed = switch (me.getRole()) {
            case ADMIN -> true;
            case USER -> ticket.getCreatedBy().getId().equals(me.getId());
            case EMPLOYEE -> ticket.getAssignedTo() != null && ticket.getAssignedTo().getId().equals(me.getId());
        };
        if (!allowed) {
            throw new AccessDeniedException("You cannot access this ticket");
        }
        return ticket;
    }

    // ------------------------------------------------------------------ private
    /** Row level security: admin sees all, employee sees assigned tickets, user sees own tickets. */
    private Specification<Ticket> visibleTo(UserPrincipal me) {
        return (root, query, cb) -> switch (me.getRole()) {
            case ADMIN -> cb.conjunction();
            case USER -> cb.equal(root.get("createdBy").get("id"), me.getId());
            case EMPLOYEE -> cb.equal(root.get("assignedTo").get("id"), me.getId());
        };
    }

    private Specification<Ticket> filter(TicketStatus status, Priority priority, String text) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (priority != null) {
                predicates.add(cb.equal(root.get("priority"), priority));
            }
            if (text != null && !text.isBlank()) {
                String like = "%" + text.trim().toLowerCase() + "%";
                predicates.add(cb.or(cb.like(cb.lower(root.get("title")), like),
                        cb.like(cb.lower(root.get("ticketNo")), like)));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private static double resolutionHours(Ticket t) {
        return Duration.between(t.getCreatedAt(), t.getResolvedAt()).toMinutes() / 60.0;
    }

    public static TicketResponse toResponse(Ticket t) {
        Double hours = t.getResolvedAt() == null ? null : Math.round(resolutionHours(t) * 100) / 100.0;
        int sla = t.getPriority().slaHours();
        LocalDateTime end = t.getResolvedAt() != null ? t.getResolvedAt() : LocalDateTime.now();
        boolean breached = Duration.between(t.getCreatedAt(), end).toMinutes() > sla * 60L;
        User assignee = t.getAssignedTo();
        return new TicketResponse(t.getId(), t.getTicketNo(), t.getTitle(), t.getDescription(),
                t.getPriority(), t.getStatus(),
                t.getCreatedBy().getId(), t.getCreatedBy().getFullName(),
                assignee == null ? null : assignee.getId(), assignee == null ? null : assignee.getFullName(),
                t.getCreatedAt(), t.getUpdatedAt(), t.getAssignedAt(), t.getResolvedAt(),
                hours, sla, breached, t.getVersion());
    }
}
