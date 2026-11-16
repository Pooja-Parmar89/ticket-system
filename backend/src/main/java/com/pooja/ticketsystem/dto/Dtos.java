package com.pooja.ticketsystem.dto;

import com.pooja.ticketsystem.entity.Priority;
import com.pooja.ticketsystem.entity.Role;
import com.pooja.ticketsystem.entity.TicketStatus;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** All request / response objects in one file (Java records). */
public final class Dtos {

    private Dtos() {
    }

    public static final String PASSWORD_RULE = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,64}$";
    public static final String PASSWORD_MSG = "Password must be 8-64 characters with an upper case letter, a lower case letter and a digit";

    // ------------------------------------------------------------ auth
    public record RegisterRequest(
            @NotBlank @Size(max = 100) String fullName,
            @NotBlank @Email @Size(max = 150) String email,
            @NotBlank @Pattern(regexp = PASSWORD_RULE, message = PASSWORD_MSG) String password) {
    }

    public record VerifyOtpRequest(
            @NotBlank @Email String email,
            @NotBlank @Pattern(regexp = "\\d{6}", message = "OTP must be 6 digits") String otp) {
    }

    public record EmailRequest(@NotBlank @Email String email) {
    }

    public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {
    }

    public record ResetPasswordRequest(
            @NotBlank @Email String email,
            @NotBlank @Pattern(regexp = "\\d{6}", message = "OTP must be 6 digits") String otp,
            @NotBlank @Pattern(regexp = PASSWORD_RULE, message = PASSWORD_MSG) String newPassword) {
    }

    public record AuthResponse(String token, String tokenType, long expiresInSeconds, UserResponse user) {
    }

    public record MessageResponse(String message) {
    }

    // ------------------------------------------------------------ users
    public record UserResponse(Long id, String fullName, String email, Role role,
                               boolean active, boolean emailVerified, LocalDateTime createdAt) {
    }

    public record CreateUserRequest(
            @NotBlank @Size(max = 100) String fullName,
            @NotBlank @Email @Size(max = 150) String email,
            @NotBlank @Pattern(regexp = PASSWORD_RULE, message = PASSWORD_MSG) String password,
            @NotNull Role role) {
    }

    public record ActiveRequest(@NotNull Boolean active) {
    }

    // ------------------------------------------------------------ tickets
    public record CreateTicketRequest(
            @NotBlank @Size(min = 5, max = 200) String title,
            @NotBlank @Size(min = 10, max = 5000) String description,
            @NotNull Priority priority) {
    }

    public record AssignRequest(@NotNull Long employeeId, @NotNull Long version) {
    }

    public record StatusRequest(@NotNull TicketStatus status, @NotNull Long version) {
    }

    public record TicketResponse(Long id, String ticketNo, String title, String description,
                                 Priority priority, TicketStatus status,
                                 Long createdById, String createdByName,
                                 Long assignedToId, String assignedToName,
                                 LocalDateTime createdAt, LocalDateTime updatedAt,
                                 LocalDateTime assignedAt, LocalDateTime resolvedAt,
                                 Double resolutionHours, int slaHours, boolean slaBreached,
                                 Long version) {
    }

    public record CommentRequest(@NotBlank @Size(max = 2000) String comment) {
    }

    public record CommentResponse(Long id, Long userId, String userName, Role userRole,
                                  String comment, LocalDateTime createdAt) {
    }

    public record AttachmentResponse(Long id, String originalName, String contentType,
                                     long sizeBytes, String uploadedBy, LocalDateTime createdAt) {
    }

    public record AuditLogResponse(Long id, Long userId, String userEmail, String action,
                                   String entityType, Long entityId, String details,
                                   String ipAddress, LocalDateTime createdAt) {
    }

    public record DashboardResponse(long total, Map<String, Long> byStatus, Map<String, Long> byPriority) {
    }

    public record PageResponse<T>(List<T> content, int page, int size, long totalElements, int totalPages) {
    }

    // ------------------------------------------------------------ reports
    public record ReportSummary(long totalTickets, long openCount, long assignedCount,
                                long inProgressCount, long resolvedCount,
                                Double avgResolutionHours, long slaBreachedCount) {
    }

    public record PriorityReport(String priority, long totalTickets, long resolvedCount,
                                 Double avgResolutionHours, int slaHours) {
    }

    public record EmployeeReport(Long employeeId, String employeeName, long assignedTotal,
                                 long resolvedCount, long pendingCount, Double avgResolutionHours) {
    }

    public record ResolvedTicketReport(Long ticketId, String ticketNo, String title, String priority,
                                       String assignedToName, LocalDateTime createdAt,
                                       LocalDateTime resolvedAt, Double resolutionHours,
                                       int slaHours, boolean slaBreached) {
    }

    // ------------------------------------------------------------ errors
    public record ErrorResponse(LocalDateTime timestamp, int status, String error,
                                String message, Map<String, String> fieldErrors) {
    }
}
