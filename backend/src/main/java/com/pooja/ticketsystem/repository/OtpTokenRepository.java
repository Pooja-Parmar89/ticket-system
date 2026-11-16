package com.pooja.ticketsystem.repository;

import com.pooja.ticketsystem.entity.OtpPurpose;
import com.pooja.ticketsystem.entity.OtpToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface OtpTokenRepository extends JpaRepository<OtpToken, Long> {

    Optional<OtpToken> findFirstByEmailAndPurposeAndUsedFalseOrderByIdDesc(String email, OtpPurpose purpose);

    @Modifying
    @Query("update OtpToken o set o.used = true where o.email = :email and o.purpose = :purpose and o.used = false")
    int invalidateAll(@Param("email") String email, @Param("purpose") OtpPurpose purpose);
}
