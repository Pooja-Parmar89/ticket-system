package com.pooja.ticketsystem.service;

import com.pooja.ticketsystem.dto.Dtos.*;
import com.pooja.ticketsystem.entity.OtpPurpose;
import com.pooja.ticketsystem.entity.Role;
import com.pooja.ticketsystem.entity.User;
import com.pooja.ticketsystem.exception.BusinessException;
import com.pooja.ticketsystem.repository.UserRepository;
import com.pooja.ticketsystem.security.JwtService;
import com.pooja.ticketsystem.security.UserPrincipal;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final OtpService otpService;
    private final AuditService auditService;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder,
                       AuthenticationManager authenticationManager, JwtService jwtService,
                       OtpService otpService, AuditService auditService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.otpService = otpService;
        this.auditService = auditService;
    }

    /** Step 1 of sign-up: create an UNVERIFIED account and email an OTP. */
    @Transactional
    public MessageResponse register(RegisterRequest request) {
        String email = request.email().trim().toLowerCase();
        User user = userRepository.findByEmailIgnoreCase(email).orElse(null);

        if (user != null && user.isEmailVerified()) {
            throw new BusinessException("This email is already registered. Please login");
        }
        if (user == null) {
            user = new User();
            user.setEmail(email);
            user.setRole(Role.USER);          // public sign-up can only create normal users
        }
        user.setFullName(request.fullName().trim());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setEmailVerified(false);
        user.setActive(true);
        user = userRepository.save(user);

        otpService.generateAndSend(email, OtpPurpose.REGISTER);
        auditService.logAs(user.getId(), "USER_REGISTERED", "USER", user.getId(), "Registration started for " + email);
        return new MessageResponse("OTP sent to " + email + ". Please verify to activate your account");
    }

    /** Step 2 of sign-up: check the OTP and activate the account. */
    @Transactional
    public MessageResponse verifyRegistration(VerifyOtpRequest request) {
        String email = request.email().trim().toLowerCase();
        User user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new BusinessException("Account not found. Please register first"));
        if (user.isEmailVerified()) {
            return new MessageResponse("Email is already verified. Please login");
        }
        otpService.verify(email, OtpPurpose.REGISTER, request.otp());
        user.setEmailVerified(true);
        auditService.logAs(user.getId(), "EMAIL_VERIFIED", "USER", user.getId(), "Email verified with OTP");
        return new MessageResponse("Email verified successfully. You can login now");
    }

    public MessageResponse resendRegistrationOtp(EmailRequest request) {
        String email = request.email().trim().toLowerCase();
        User user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new BusinessException("Account not found. Please register first"));
        if (user.isEmailVerified()) {
            throw new BusinessException("Email is already verified. Please login");
        }
        otpService.generateAndSend(email, OtpPurpose.REGISTER);
        return new MessageResponse("A new OTP has been sent to " + email);
    }

    public AuthResponse login(LoginRequest request) {
        String email = request.email().trim().toLowerCase();
        try {
            Authentication auth = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(email, request.password()));
            UserPrincipal principal = (UserPrincipal) auth.getPrincipal();
            auditService.logAs(principal.getId(), "LOGIN_SUCCESS", "USER", principal.getId(), "Login successful");

            User user = userRepository.findById(principal.getId()).orElseThrow();
            return new AuthResponse(jwtService.generateToken(principal), "Bearer",
                    jwtService.getExpirationSeconds(), UserService.toResponse(user));
        } catch (BadCredentialsException ex) {
            auditService.logAs(null, "LOGIN_FAILED", "USER", null, "Wrong password or unknown email: " + email);
            throw ex;
        } catch (DisabledException ex) {
            auditService.logAs(null, "LOGIN_BLOCKED", "USER", null, "Unverified or disabled account: " + email);
            throw ex;
        }
    }

    /** Always answers the same message, so nobody can find out which emails are registered. */
    public MessageResponse forgotPassword(EmailRequest request) {
        String email = request.email().trim().toLowerCase();
        userRepository.findByEmailIgnoreCase(email)
                .filter(u -> u.isEmailVerified() && u.isActive())
                .ifPresent(u -> {
                    otpService.generateAndSend(email, OtpPurpose.RESET_PASSWORD);
                    auditService.logAs(u.getId(), "PASSWORD_RESET_REQUESTED", "USER", u.getId(), "OTP sent");
                });
        return new MessageResponse("If this email is registered, an OTP has been sent to it");
    }

    @Transactional
    public MessageResponse resetPassword(ResetPasswordRequest request) {
        String email = request.email().trim().toLowerCase();
        User user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new BusinessException("Invalid OTP"));
        otpService.verify(email, OtpPurpose.RESET_PASSWORD, request.otp());
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        auditService.logAs(user.getId(), "PASSWORD_RESET", "USER", user.getId(), "Password changed with OTP");
        return new MessageResponse("Password changed successfully. You can login now");
    }
}
