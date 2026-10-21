package com.example.comicworm.utils;

import jakarta.servlet.http.HttpServletRequest;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;

public class VNPayUtil {

    private VNPayUtil() {}

    public static String hmacSHA512(final String key, final String data) {
        try {
            if (key == null || data == null) {
                return "";
            }
            Mac hmac512 = Mac.getInstance("HmacSHA512");
            SecretKeySpec secretKey = new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA512");
            hmac512.init(secretKey);
            byte[] result = hmac512.doFinal(data.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(2 * result.length);
            for (byte b : result) {
                sb.append(String.format("%02x", b & 0xff));
            }
            return sb.toString();
        } catch (Exception ex) {
            return "";
        }
    }

    public static String getIpAddress(HttpServletRequest request) {
        if (request == null) {
            return "127.0.0.1";
        }
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("Proxy-Client-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("WL-Proxy-Client-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("HTTP_CLIENT_IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("HTTP_X_FORWARDED_FOR");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        if (ip != null && ip.contains(",")) {
            ip = ip.split(",")[0].trim();
        }
        if ("0:0:0:0:0:0:0:1".equals(ip) || ip == null || ip.isEmpty()) {
            ip = "127.0.0.1";
        }
        return ip;
    }

    public static String buildPaymentUrl(Map<String, String> vnpParams, String secretKey, String baseUrl) {
        List<String> fieldNames = new ArrayList<>(vnpParams.keySet());
        Collections.sort(fieldNames);

        StringBuilder hashData = new StringBuilder();
        StringBuilder query = new StringBuilder();

        for (String fieldName : fieldNames) {
            String fieldValue = vnpParams.get(fieldName);
            if (fieldValue != null && !fieldValue.isEmpty()) {
                try {
                    if (hashData.length() > 0) {
                        hashData.append('&');
                        query.append('&');
                    }
                    hashData.append(fieldName).append('=').append(URLEncoder.encode(fieldValue, StandardCharsets.US_ASCII.toString()));
                    query.append(URLEncoder.encode(fieldName, StandardCharsets.US_ASCII.toString())).append('=').append(URLEncoder.encode(fieldValue, StandardCharsets.US_ASCII.toString()));
                } catch (Exception ignored) {
                }
            }
        }

        String vnpSecureHash = hmacSHA512(secretKey, hashData.toString());
        query.append("&vnp_SecureHash=").append(vnpSecureHash);
        return baseUrl + "?" + query;
    }

    public static boolean verifySignature(Map<String, String> queryParams, String secretKey) {
        if (queryParams == null || queryParams.isEmpty() || secretKey == null) {
            return false;
        }
        String receivedHash = queryParams.get("vnp_SecureHash");
        if (receivedHash == null || receivedHash.isEmpty()) {
            return false;
        }

        Map<String, String> vnpParams = new HashMap<>();
        for (Map.Entry<String, String> entry : queryParams.entrySet()) {
            String key = entry.getKey();
            String val = entry.getValue();
            if (key != null && key.startsWith("vnp_")
                    && !"vnp_SecureHash".equalsIgnoreCase(key)
                    && !"vnp_SecureHashType".equalsIgnoreCase(key)
                    && val != null && !val.isEmpty()) {
                vnpParams.put(key, val);
            }
        }

        List<String> fieldNames = new ArrayList<>(vnpParams.keySet());
        Collections.sort(fieldNames);

        // Cách 1: Theo chuẩn VNPay 2.1.0 (URLEncode param values)
        StringBuilder hashDataEncoded = new StringBuilder();
        for (String fieldName : fieldNames) {
            String fieldValue = vnpParams.get(fieldName);
            try {
                if (hashDataEncoded.length() > 0) {
                    hashDataEncoded.append('&');
                }
                hashDataEncoded.append(fieldName).append('=').append(URLEncoder.encode(fieldValue, StandardCharsets.US_ASCII.toString()));
            } catch (Exception ignored) {}
        }
        String calculatedHashEncoded = hmacSHA512(secretKey, hashDataEncoded.toString());
        if (calculatedHashEncoded.equalsIgnoreCase(receivedHash)) {
            return true;
        }

        // Cách 2: Raw param values
        StringBuilder hashDataRaw = new StringBuilder();
        for (String fieldName : fieldNames) {
            String fieldValue = vnpParams.get(fieldName);
            if (hashDataRaw.length() > 0) {
                hashDataRaw.append('&');
            }
            hashDataRaw.append(fieldName).append('=').append(fieldValue);
        }
        String calculatedHashRaw = hmacSHA512(secretKey, hashDataRaw.toString());
        return calculatedHashRaw.equalsIgnoreCase(receivedHash);
    }
}
