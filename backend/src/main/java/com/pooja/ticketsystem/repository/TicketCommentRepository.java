package com.pooja.ticketsystem.repository;

import com.pooja.ticketsystem.entity.TicketComment;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TicketCommentRepository extends JpaRepository<TicketComment, Long> {

    @EntityGraph(attributePaths = {"user"})
    List<TicketComment> findByTicketIdOrderByCreatedAtAsc(Long ticketId);
}
