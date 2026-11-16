package com.pooja.ticketsystem.service;

import com.pooja.ticketsystem.dto.Dtos.AttachmentResponse;
import com.pooja.ticketsystem.entity.Ticket;
import com.pooja.ticketsystem.entity.TicketAttachment;
import com.pooja.ticketsystem.exception.BusinessException;
import com.pooja.ticketsystem.exception.ResourceNotFoundException;
import com.pooja.ticketsystem.repository.TicketAttachmentRepository;
import com.pooja.ticketsystem.repository.UserRepository;
import com.pooja.ticketsystem.security.UserPrincipal;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.PathResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AttachmentService {

    private static final int MAX_FILES_PER_TICKET = 5;

    private final TicketAttachmentRepository attachmentRepository;
    private final UserRepository userRepository;
    private final TicketService ticketService;
    private final AuditService auditService;
    private final Path uploadRoot;
    private final Set<String> allowedExtensions;

    public AttachmentService(TicketAttachmentRepository attachmentRepository, UserRepository userRepository,
                             TicketService ticketService, AuditService auditService,
                             @Value("${app.upload.dir}") String uploadDir,
                             @Value("${app.upload.allowed-extensions}") String allowed) {
        this.attachmentRepository = attachmentRepository;
        this.userRepository = userRepository;
        this.ticketService = ticketService;
        this.auditService = auditService;
        this.uploadRoot = Path.of(uploadDir).toAbsolutePath().normalize();
        this.allowedExtensions = Arrays.stream(allowed.split(","))
                .map(s -> s.trim().toLowerCase(Locale.ROOT)).collect(Collectors.toSet());
    }

    public List<AttachmentResponse> list(Long ticketId, UserPrincipal me) {
        ticketService.loadAccessible(ticketId, me);
        return attachmentRepository.findByTicketIdOrderByCreatedAtAsc(ticketId).stream()
                .map(AttachmentService::toResponse).toList();
    }

    public AttachmentResponse upload(Long ticketId, MultipartFile file, UserPrincipal me) throws IOException {
        Ticket ticket = ticketService.loadAccessible(ticketId, me);

        if (file == null || file.isEmpty()) {
            throw new BusinessException("Please choose a file");
        }
        if (attachmentRepository.countByTicketId(ticketId) >= MAX_FILES_PER_TICKET) {
            throw new BusinessException("A ticket can have at most " + MAX_FILES_PER_TICKET + " attachments");
        }
        // never trust the name sent by the browser (path traversal such as ../../x)
        String originalName = StringUtils.cleanPath(file.getOriginalFilename() == null ? "file" : file.getOriginalFilename());
        originalName = originalName.substring(originalName.lastIndexOf('/') + 1);
        String extension = StringUtils.getFilenameExtension(originalName);
        if (extension == null || !allowedExtensions.contains(extension.toLowerCase(Locale.ROOT))) {
            throw new BusinessException("File type not allowed. Allowed: " + String.join(", ", allowedExtensions));
        }

        String storedName = UUID.randomUUID() + "." + extension.toLowerCase(Locale.ROOT);
        Path folder = uploadRoot.resolve(String.valueOf(ticketId)).normalize();
        Files.createDirectories(folder);
        try (InputStream in = file.getInputStream()) {
            Files.copy(in, folder.resolve(storedName), StandardCopyOption.REPLACE_EXISTING);
        }

        TicketAttachment attachment = new TicketAttachment();
        attachment.setTicket(ticket);
        attachment.setUploadedBy(userRepository.getReferenceById(me.getId()));
        attachment.setOriginalName(originalName);
        attachment.setStoredName(storedName);
        attachment.setContentType(file.getContentType());
        attachment.setSizeBytes(file.getSize());
        attachment = attachmentRepository.save(attachment);

        auditService.log("ATTACHMENT_ADDED", "TICKET", ticketId, originalName + " (" + file.getSize() + " bytes)");
        return new AttachmentResponse(attachment.getId(), originalName, attachment.getContentType(),
                attachment.getSizeBytes(), me.getFullName(), attachment.getCreatedAt());
    }

    /** Holds the file name + the file itself for the download endpoint. */
    public record Download(String fileName, String contentType, Resource resource) {
    }

    public Download download(Long attachmentId, UserPrincipal me) {
        TicketAttachment attachment = attachmentRepository.findWithTicketById(attachmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Attachment not found"));
        Long ticketId = attachment.getTicket().getId();
        ticketService.loadAccessible(ticketId, me);          // same access rule as the ticket itself

        Path path = uploadRoot.resolve(String.valueOf(ticketId)).resolve(attachment.getStoredName()).normalize();
        if (!path.startsWith(uploadRoot) || !Files.exists(path)) {
            throw new ResourceNotFoundException("File is no longer available");
        }
        auditService.log("ATTACHMENT_DOWNLOADED", "TICKET", ticketId, attachment.getOriginalName());
        return new Download(attachment.getOriginalName(), attachment.getContentType(), new PathResource(path));
    }

    private static AttachmentResponse toResponse(TicketAttachment a) {
        return new AttachmentResponse(a.getId(), a.getOriginalName(), a.getContentType(), a.getSizeBytes(),
                a.getUploadedBy().getFullName(), a.getCreatedAt());
    }
}
