package com.pooja.ticketsystem.controller;

import com.pooja.ticketsystem.dto.Dtos.*;
import com.pooja.ticketsystem.entity.Priority;
import com.pooja.ticketsystem.entity.TicketStatus;
import com.pooja.ticketsystem.security.UserPrincipal;
import com.pooja.ticketsystem.service.*;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/api")
public class TicketController {

    private final TicketService ticketService;
    private final CommentService commentService;
    private final AttachmentService attachmentService;
    private final AuditService auditService;

    public TicketController(TicketService ticketService, CommentService commentService,
                            AttachmentService attachmentService, AuditService auditService) {
        this.ticketService = ticketService;
        this.commentService = commentService;
        this.attachmentService = attachmentService;
        this.auditService = auditService;
    }

    // ---------------------------------------------------------------- tickets
    @PostMapping("/tickets")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('USER','ADMIN')")
    public TicketResponse create(@Valid @RequestBody CreateTicketRequest request,
                                 @AuthenticationPrincipal UserPrincipal me) {
        return ticketService.create(request, me);
    }

    @GetMapping("/tickets")
    public PageResponse<TicketResponse> search(@RequestParam(required = false) TicketStatus status,
                                               @RequestParam(required = false) Priority priority,
                                               @RequestParam(required = false) String search,
                                               @RequestParam(defaultValue = "0") int page,
                                               @RequestParam(defaultValue = "10") int size,
                                               @AuthenticationPrincipal UserPrincipal me) {
        return ticketService.search(status, priority, search, page, size, me);
    }

    @GetMapping("/tickets/{id}")
    public TicketResponse get(@PathVariable Long id, @AuthenticationPrincipal UserPrincipal me) {
        return ticketService.get(id, me);
    }

    @PutMapping("/tickets/{id}/assign")
    @PreAuthorize("hasRole('ADMIN')")
    public TicketResponse assign(@PathVariable Long id, @Valid @RequestBody AssignRequest request,
                                 @AuthenticationPrincipal UserPrincipal me) {
        return ticketService.assign(id, request, me);
    }

    @PutMapping("/tickets/{id}/status")
    @PreAuthorize("hasAnyRole('EMPLOYEE','ADMIN')")
    public TicketResponse changeStatus(@PathVariable Long id, @Valid @RequestBody StatusRequest request,
                                       @AuthenticationPrincipal UserPrincipal me) {
        return ticketService.changeStatus(id, request, me);
    }

    @GetMapping("/tickets/{id}/history")
    public List<AuditLogResponse> history(@PathVariable Long id, @AuthenticationPrincipal UserPrincipal me) {
        ticketService.loadAccessible(id, me);
        return auditService.historyOfTicket(id);
    }

    @GetMapping("/dashboard")
    public DashboardResponse dashboard(@AuthenticationPrincipal UserPrincipal me) {
        return ticketService.dashboard(me);
    }

    // ---------------------------------------------------------------- comments
    @GetMapping("/tickets/{id}/comments")
    public List<CommentResponse> comments(@PathVariable Long id, @AuthenticationPrincipal UserPrincipal me) {
        return commentService.list(id, me);
    }

    @PostMapping("/tickets/{id}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public CommentResponse addComment(@PathVariable Long id, @Valid @RequestBody CommentRequest request,
                                      @AuthenticationPrincipal UserPrincipal me) {
        return commentService.add(id, request, me);
    }

    // ---------------------------------------------------------------- attachments
    @GetMapping("/tickets/{id}/attachments")
    public List<AttachmentResponse> attachments(@PathVariable Long id, @AuthenticationPrincipal UserPrincipal me) {
        return attachmentService.list(id, me);
    }

    @PostMapping(value = "/tickets/{id}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public AttachmentResponse upload(@PathVariable Long id, @RequestPart("file") MultipartFile file,
                                     @AuthenticationPrincipal UserPrincipal me) throws IOException {
        return attachmentService.upload(id, file, me);
    }

    @GetMapping("/attachments/{attachmentId}/download")
    public ResponseEntity<Resource> download(@PathVariable Long attachmentId, @AuthenticationPrincipal UserPrincipal me) {
        AttachmentService.Download file = attachmentService.download(attachmentId, me);
        MediaType type = MediaType.APPLICATION_OCTET_STREAM;
        if (file.contentType() != null) {
            try {
                type = MediaType.parseMediaType(file.contentType());
            } catch (Exception ignored) {
                // keep octet-stream
            }
        }
        return ResponseEntity.ok()
                .contentType(type)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(file.fileName(), StandardCharsets.UTF_8).build().toString())
                .header("X-Content-Type-Options", "nosniff")
                .body(file.resource());
    }
}
