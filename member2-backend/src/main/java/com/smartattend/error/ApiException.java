package com.smartattend.error;

import java.util.List;
import java.util.Map;

public class ApiException extends RuntimeException {
    private final int status;
    private final String code;
    private final List<Map<String, String>> details;

    public ApiException(int status, String code, String message) {
        this(status, code, message, null);
    }

    public ApiException(int status, String code, String message, List<Map<String, String>> details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }

    public static ApiException validation(String field, String message) {
        return new ApiException(400, "VALIDATION_ERROR", "Invalid request data",
                List.of(Map.of("field", field, "message", message)));
    }

    public int getStatus() { return status; }
    public String getCode() { return code; }
    public List<Map<String, String>> getDetails() { return details; }
}
