package com.smartattend.security;

import com.smartattend.error.ApiException;

public record CurrentUser(long id, String role, String name) {

    /** Throws 403 unless the user has one of the given roles. */
    public void require(String... roles) {
        for (String r : roles) if (r.equals(role)) return;
        throw new ApiException(403, "FORBIDDEN", "This action requires role: " + String.join(" or ", roles));
    }
}
