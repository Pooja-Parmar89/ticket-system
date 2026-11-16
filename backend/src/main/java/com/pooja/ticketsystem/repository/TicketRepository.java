package com.pooja.ticketsystem.repository;

import com.pooja.ticketsystem.entity.Ticket;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface TicketRepository extends JpaRepository<Ticket, Long>, JpaSpecificationExecutor<Ticket> {

    /** Fetch creator and assignee together with the page -> avoids the N+1 select problem. */
    @Override
    @EntityGraph(attributePaths = {"createdBy", "assignedTo"})
    Page<Ticket> findAll(Specification<Ticket> spec, Pageable pageable);

    @Query("select t from Ticket t left join fetch t.createdBy left join fetch t.assignedTo where t.id = :id")
    Optional<Ticket> findWithUsers(@Param("id") Long id);
}
