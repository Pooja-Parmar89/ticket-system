package com.pooja.ticketsystem.config;

import com.pooja.ticketsystem.entity.Role;
import com.pooja.ticketsystem.entity.User;
import com.pooja.ticketsystem.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Creates demo accounts on the first start (BCrypt hash is generated here, so no hash is stored in SQL).
 * Turn off with app.seed.enabled=false.
 */
@Component
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final boolean enabled;
    private final String defaultPassword;

    public DataInitializer(UserRepository userRepository, PasswordEncoder passwordEncoder,
                           @Value("${app.seed.enabled}") boolean enabled,
                           @Value("${app.seed.default-password}") String defaultPassword) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.enabled = enabled;
        this.defaultPassword = defaultPassword;
    }

    @Override
    public void run(String... args) {
        if (!enabled) {
            return;
        }
        create("System Admin", "admin@ticketsystem.com", Role.ADMIN);
        create("Rahul Support", "employee1@ticketsystem.com", Role.EMPLOYEE);
        create("Neha Support", "employee2@ticketsystem.com", Role.EMPLOYEE);
        create("Demo User", "user@ticketsystem.com", Role.USER);
    }

    private void create(String name, String email, Role role) {
        if (userRepository.existsByEmailIgnoreCase(email)) {
            return;
        }
        User user = new User();
        user.setFullName(name);
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(defaultPassword));
        user.setRole(role);
        user.setEmailVerified(true);
        user.setActive(true);
        userRepository.save(user);
        log.info("Created demo {} account: {}", role, email);
    }
}
