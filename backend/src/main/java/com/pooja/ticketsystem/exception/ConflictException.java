package com.pooja.ticketsystem.exception;

/** Optimistic-lock conflict: somebody else changed the record first (maps to HTTP 409). */
public class ConflictException extends RuntimeException {
    public ConflictException(String message) {
        super(message);
    }
}
