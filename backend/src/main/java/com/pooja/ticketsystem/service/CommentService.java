package com.pooja.ticketsystem.service;

import com.pooja.ticketsystem.dto.Dtos.CommentRequest;
import com.pooja.ticketsystem.dto.Dtos.CommentResponse;
import com.pooja.ticketsystem.entity.Ticket;
import com.pooja.ticketsystem.entity.TicketComment;
import com.pooja.ticketsystem.entity.User;
import com.pooja.ticketsystem.repository.TicketCommentRepository;
import com.pooja.ticketsystem.repository.UserRepository;
import com.pooja.ticketsystem.security.UserPrincipal;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class CommentService {

    private final TicketCommentRepository commentRepository;
    private final UserRepository userRepository;
    private final TicketService ticketService;
    private final AuditService auditService;
    private final EmailService emailService;

    public CommentService(TicketCommentRepository commentRepository, UserRepository userRepository,
                          TicketService ticketService, AuditService auditService, EmailService emailService) {
        this.commentRepository = commentRepository;
        this.userRepository = userRepository;
        this.ticketService = ticketService;
        this.auditService = auditService;
        this.emailService = emailService;
    }

    public List<CommentResponse> list(Long ticketId, UserPrincipal me) {
        ticketService.loadAccessible(ticketId, me);
        return commentRepository.findByTicketIdOrderByCreatedAtAsc(ticketId).stream()
                .map(CommentService::toResponse).toList();
    }

    public CommentResponse add(Long ticketId, CommentRequest request, UserPrincipal me) {
        Ticket ticket = ticketService.loadAccessible(ticketId, me);
        User author = userRepository.getReferenceById(me.getId());

        TicketComment comment = new TicketComment();
        comment.setTicket(ticket);
        comment.setUser(author);
        comment.setComment(request.comment().trim());
        comment = commentRepository.save(comment);

        auditService.log("COMMENT_ADDED", "TICKET", ticketId, "Comment #" + comment.getId());

        // tell the other people on the ticket (creator + assignee), not the author
        Set<String> recipients = new HashSet<>();
        recipients.add(ticket.getCreatedBy().getEmail());
        if (ticket.getAssignedTo() != null) {
            recipients.add(ticket.getAssignedTo().getEmail());
        }
        recipients.remove(me.getUsername());
        emailService.send(recipients, "New comment on " + ticket.getTicketNo(),
                me.getFullName() + " commented on ticket " + ticket.getTicketNo() + ":\n\n" + comment.getComment());

        return new CommentResponse(comment.getId(), me.getId(), me.getFullName(), me.getRole(),
                comment.getComment(), comment.getCreatedAt());
    }

    private static CommentResponse toResponse(TicketComment c) {
        return new CommentResponse(c.getId(), c.getUser().getId(), c.getUser().getFullName(),
                c.getUser().getRole(), c.getComment(), c.getCreatedAt());
    }
}
