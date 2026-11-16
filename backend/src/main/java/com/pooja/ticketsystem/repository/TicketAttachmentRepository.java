package com.pooja.ticketsystem.repository;

import com.pooja.ticketsystem.entity.TicketAttachment;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TicketAttachmentRepository extends JpaRepository<TicketAttachment, Long> {

    @EntityGraph(attributePaths = {"uploadedBy"})
    List<TicketAttachment> findByTicketIdOrderByCreatedAtAsc(Long ticketId);

    long countByTicketId(Long ticketId);

    @EntityGraph(attributePaths = {"ticket"})
    Optional<TicketAttachment> findWithTicketById(Long id);
}
