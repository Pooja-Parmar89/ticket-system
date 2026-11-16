package com.pooja.ticketsystem.repository;

import com.pooja.ticketsystem.entity.Role;
import com.pooja.ticketsystem.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    List<User> findByRoleAndActiveTrueOrderByFullNameAsc(Role role);
}
