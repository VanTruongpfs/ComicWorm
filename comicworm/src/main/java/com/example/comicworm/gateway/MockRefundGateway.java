package com.example.comicworm.gateway;

import com.example.comicworm.model.Refund;

public class MockRefundGateway implements RefundGateway {

    @Override
    public RefundResult refund(Refund refund) {
        return RefundResult.success("MOCK-" + refund.getRefundCode());
    }
}
