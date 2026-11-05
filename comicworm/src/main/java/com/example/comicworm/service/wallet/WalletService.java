package com.example.comicworm.service.wallet;

import com.example.comicworm.dto.response.WalletDTO;
import com.example.comicworm.model.Wallet;
import com.example.comicworm.model.WalletTransaction;
import com.example.comicworm.model.enums.WalletTransactionType;
import com.example.comicworm.repository.WalletRepository;
import com.example.comicworm.repository.WalletTransactionRepository;
import java.math.BigDecimal;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * In-app wallet. Money only comes in from exchange escrows (payout or refund); there is no withdrawal.
 * Every credit is tied to one escrow, and wallet_transactions.escrow_id is unique, so a retry cannot pay twice.
 */
@Service
@RequiredArgsConstructor
public class WalletService {

    private final WalletRepository wallets;
    private final WalletTransactionRepository transactions;

    @Transactional
    public WalletTransaction credit(Long userId, BigDecimal amount, WalletTransactionType type, Long escrowId, String note) {
        if (amount == null || amount.signum() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Số tiền cộng vào ví phải lớn hơn 0");
        }
        if (transactions.existsByEscrowId(escrowId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Khoản ký quỹ này đã được ghi vào ví");
        }
        wallets.insertIgnore(userId);
        Wallet wallet = wallets.findByIdForUpdate(userId)
                .orElseThrow(() -> new IllegalStateException("Wallet row missing after insert for user " + userId));
        wallet.setBalance(wallet.getBalance().add(amount));

        WalletTransaction tx = new WalletTransaction();
        tx.setUserId(userId);
        tx.setAmount(amount);
        tx.setType(type);
        tx.setEscrowId(escrowId);
        tx.setBalanceAfter(wallet.getBalance());
        tx.setNote(note);
        return transactions.save(tx);
    }

    @Transactional(readOnly = true)
    public WalletDTO myWallet(Long userId) {
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập");
        }
        BigDecimal balance = wallets.findById(userId).map(Wallet::getBalance).orElse(BigDecimal.ZERO);
        return new WalletDTO(balance, transactions.findTop100ByUserIdOrderByIdDesc(userId).stream()
                .map(tx -> new WalletDTO.Entry(tx.getId(), tx.getAmount(), tx.getType().name(), tx.getEscrowId(),
                        tx.getBalanceAfter(), tx.getNote(), tx.getCreatedAt()))
                .toList());
    }
}
