package com.pooja.ticketsystem.entity;

public enum Priority {
    LOW, MEDIUM, HIGH, CRITICAL;

    /** Target resolution time in hours. Same values as the MySQL function fn_priority_sla_hours. */
    public int slaHours() {
        return switch (this) {
            case CRITICAL -> 4;
            case HIGH -> 24;
            case MEDIUM -> 72;
            case LOW -> 120;
        };
    }
}
