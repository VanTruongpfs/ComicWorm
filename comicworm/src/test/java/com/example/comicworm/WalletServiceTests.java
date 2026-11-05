package com.example.comicworm;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.comicworm.dto.response.WalletDTO;
import com.example.comicworm.model.Wallet;
import com.example.comicworm.model.WalletTransaction;
import com.example.comicworm.model.enums.WalletTransactionType;
import com.example.comicworm.repository.WalletRepository;
import com.example.comicworm.repository.WalletTransactionRepository;
import com.example.comicworm.service.wallet.WalletService;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class WalletServiceTests {

    private final WalletRepository wallets = mock(WalletRepository.class);
    private final WalletTransactionRepository transactions = mock(WalletTransactionRepository.class);
    private final WalletService service = new WalletService(wallets, transactions);

    private Wallet wallet(Long userId, String balance) {
        Wallet wallet = new Wallet();
        wallet.setUserId(userId);
        wallet.setBalance(new BigDecimal(balance));
        return wallet;
    }

    @Test
    void creditCreatesWalletIfMissingAndAddsAmount() {
        Wallet wallet = wallet(7L, "10000");
        when(transactions.existsByEscrowId(50L)).thenReturn(false);
        when(wallets.findByIdForUpdate(7L)).thenReturn(Optional.of(wallet));
        when(transactions.save(any(WalletTransaction.class))).thenAnswer(call -> call.getArgument(0));

        WalletTransaction tx = service.credit(7L, new BigDecimal("30000"),
                WalletTransactionType.ESCROW_RELEASE, 50L, "Giải ngân giao dịch");

        verify(wallets).insertIgnore(7L);
        assertEquals(new BigDecimal("40000"), wallet.getBalance());
        assertEquals(new BigDecimal("40000"), tx.getBalanceAfter());
        assertEquals(new BigDecimal("30000"), tx.getAmount());
        assertEquals(7L, tx.getUserId());
        assertEquals(50L, tx.getEscrowId());
        assertEquals(WalletTransactionType.ESCROW_RELEASE, tx.getType());
    }

    @Test
    void creditRefusesSecondCreditForSameEscrow() {
        when(transactions.existsByEscrowId(50L)).thenReturn(true);

        ResponseStatusException error = assertThrows(ResponseStatusException.class, () -> service.credit(
                7L, new BigDecimal("30000"), WalletTransactionType.ESCROW_RELEASE, 50L, "note"));

        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
        verify(wallets, never()).findByIdForUpdate(any());
        verify(transactions, never()).save(any());
    }

    @Test
    void creditRejectsNonPositiveAmount() {
        ResponseStatusException error = assertThrows(ResponseStatusException.class, () -> service.credit(
                7L, BigDecimal.ZERO, WalletTransactionType.ESCROW_REFUND, 50L, "note"));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        verify(transactions, never()).save(any());
    }

    @Test
    void myWalletIsEmptyForUserWithoutWallet() {
        when(wallets.findById(7L)).thenReturn(Optional.empty());
        when(transactions.findTop100ByUserIdOrderByIdDesc(7L)).thenReturn(List.of());

        WalletDTO dto = service.myWallet(7L);

        assertEquals(BigDecimal.ZERO, dto.balance());
        assertEquals(0, dto.transactions().size());
    }

    @Test
    void myWalletRequiresLogin() {
        ResponseStatusException error = assertThrows(ResponseStatusException.class, () -> service.myWallet(null));
        assertEquals(HttpStatus.UNAUTHORIZED, error.getStatusCode());
    }
}
