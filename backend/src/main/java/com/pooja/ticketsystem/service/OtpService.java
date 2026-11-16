package com.pooja.ticketsystem.service;

import com.pooja.ticketsystem.entity.OtpPurpose;
import com.pooja.ticketsystem.entity.OtpToken;
import com.pooja.ticketsystem.exception.BusinessException;
import com.pooja.ticketsystem.repository.OtpTokenRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

/**
 * OTP rules: 6 digits, stored as a BCrypt hash, valid for a few minutes,
 * limited wrong attempts, one active OTP per email+purpose, 30 second gap between resends.
 */
@Service
public class OtpService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int RESEND_GAP_SECONDS = 30;

    private final OtpTokenRepository repository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final int expiryMinutes;
    private final int maxAttempts;

    public OtpService(OtpTokenRepository repository, PasswordEncoder passwordEncoder, EmailService emailService,
                      @Value("${app.otp.expiry-minutes}") int expiryMinutes,
                      @Value("${app.otp.max-attempts}") int maxAttempts) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
        this.emailService = emailService;
        this.expiryMinutes = expiryMinutes;
        this.maxAttempts = maxAttempts;
    }

    @Transactional
    public void generateAndSend(String email, OtpPurpose purpose) {
        repository.findFirstByEmailAndPurposeAndUsedFalseOrderByIdDesc(email, purpose).ifPresent(last -> {
            if (last.getCreatedAt() != null
                    && Duration.between(last.getCreatedAt(), LocalDateTime.now()).getSeconds() < RESEND_GAP_SECONDS) {
                throw new BusinessException("Please wait " + RESEND_GAP_SECONDS + " seconds before requesting a new OTP");
            }
        });
        repository.invalidateAll(email, purpose);

        String otp = String.format("%06d", RANDOM.nextInt(1_000_000));
        OtpToken token = new OtpToken();
        token.setEmail(email);
        token.setPurpose(purpose);
        token.setOtpHash(passwordEncoder.encode(otp));
        token.setExpiresAt(LocalDateTime.now().plusMinutes(expiryMinutes));
        repository.save(token);

        String subject = purpose == OtpPurpose.REGISTER ? "Verify your email" : "Password reset OTP";
        emailService.send(List.of(email), subject,
                "Your OTP is " + otp + "\nIt is valid for " + expiryMinutes + " minutes. Do not share it with anyone.");
    }

    /** noRollbackFor: the failed-attempt counter must be saved even though we throw an exception. */
    @Transactional(noRollbackFor = BusinessException.class)
    public void verify(String email, OtpPurpose purpose, String otp) {
        OtpToken token = repository.findFirstByEmailAndPurposeAndUsedFalseOrderByIdDesc(email, purpose)
                .orElseThrow(() -> new BusinessException("OTP not found. Please request a new OTP"));

        if (token.getExpiresAt().isBefore(LocalDateTime.now())) {
            token.setUsed(true);
            throw new BusinessException("OTP has expired. Please request a new OTP");
        }
        if (token.getAttempts() >= maxAttempts) {
            token.setUsed(true);
            throw new BusinessException("Too many wrong attempts. Please request a new OTP");
        }
        if (!passwordEncoder.matches(otp, token.getOtpHash())) {
            token.setAttempts(token.getAttempts() + 1);
            throw new BusinessException("Invalid OTP");
        }
        token.setUsed(true);
    }
}
