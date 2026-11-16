package com.pooja.ticketsystem;

import com.pooja.ticketsystem.entity.Priority;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** Keeps the Java SLA values in sync with the MySQL function fn_priority_sla_hours. */
class PriorityTest {

    @Test
    void slaHoursMatchDatabaseFunction() {
        assertEquals(4, Priority.CRITICAL.slaHours());
        assertEquals(24, Priority.HIGH.slaHours());
        assertEquals(72, Priority.MEDIUM.slaHours());
        assertEquals(120, Priority.LOW.slaHours());
    }
}
