package com.pooja.ticketsystem.service;

import com.pooja.ticketsystem.dto.Dtos.CreateUserRequest;
import com.pooja.ticketsystem.dto.Dtos.UserResponse;
import com.pooja.ticketsystem.entity.Role;
import com.pooja.ticketsystem.entity.User;
import com.pooja.ticketsystem.exception.BusinessException;
import com.pooja.ticketsystem.exception.ResourceNotFoundException;
import com.pooja.ticketsystem.repository.UserRepository;
import com.pooja.ticketsystem.security.UserPrincipal;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder, AuditService auditService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditService = auditService;
    }

    public static UserResponse toResponse(User u) {
        return new UserResponse(u.getId(), u.getFullName(), u.getEmail(), u.getRole(),
                u.isActive(), u.isEmailVerified(), u.getCreatedAt());
    }

    public UserResponse me(UserPrincipal principal) {
        return toResponse(userRepository.findById(principal.getId())
                .orElseThrow(() -> new ResourceNotFoundException("User not found")));
    }

    public List<UserResponse> activeEmployees() {
        return userRepository.findByRoleAndActiveTrueOrderByFullNameAsc(Role.EMPLOYEE)
                .stream().map(UserService::toResponse).toList();
    }

    public List<UserResponse> all() {
        return userRepository.findAll(Sort.by("id")).stream().map(UserService::toResponse).toList();
    }

    /** Admin creates an employee / admin / user directly (no OTP needed, the admin vouches for the account). */
    public UserResponse create(CreateUserRequest request) {
        String email = request.email().trim().toLowerCase();
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new BusinessException("A user with this email already exists");
        }
        User user = new User();
        user.setFullName(request.fullName().trim());
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setRole(request.role());
        user.setEmailVerified(true);
        user.setActive(true);
        user = userRepository.save(user);
        auditService.log("USER_CREATED", "USER", user.getId(), "Created " + request.role() + " account " + email);
        return toResponse(user);
    }

    public UserResponse setActive(Long id, boolean active, UserPrincipal admin) {
        if (admin.getId().equals(id)) {
            throw new BusinessException("You cannot disable your own account");
        }
        User user = userRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("User not found"));
        user.setActive(active);
        user = userRepository.save(user);
        auditService.log(active ? "USER_ENABLED" : "USER_DISABLED", "USER", id, user.getEmail());
        return toResponse(user);
    }
}
