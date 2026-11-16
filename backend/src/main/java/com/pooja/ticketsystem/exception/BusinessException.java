package com.pooja.ticketsystem.exception;

/** A business rule was violated (maps to HTTP 400). */
public class BusinessException extends RuntimeException {
    public BusinessException(String message) {
        super(message);
    }
}
